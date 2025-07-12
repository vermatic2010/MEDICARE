const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const router = express.Router();

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "medicare",
});

// Test DB connection on server start
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Connected to MySQL database 'medicare'");
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err.message);
  }
})();

// Signup route
router.post("/signup", async (req, res) => {
  const {
    role,
    username,
    email,
    phone,
    password,
    fullName,
    dob,
    gender,
    specialization,
    license,
    experience,
    hospital,
    availability // <-- Expecting array for doctor
  } = req.body;
  try {
    // Check if username already exists (check both tables for global uniqueness)
    const [patientRows] = await db.query("SELECT id FROM patients WHERE username=?", [username]);
    const [doctorRows] = await db.query("SELECT id FROM doctors WHERE username=?", [username]);
    
    if (patientRows.length > 0 || doctorRows.length > 0) {
      return res.status(400).json({ error: "Username already exists. Please choose a different username." });
    }

    // Note: Email uniqueness is not enforced - multiple users can have the same email

    const password_hash = await bcrypt.hash(password, 10);

    if (role === "patient") {
      console.log("Attempting patient signup:", username, email);
      await db.query(
        "INSERT INTO patients (username, email, phone, password_hash, full_name, dob, gender) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, email, phone, password_hash, fullName, dob, gender]
      );
      console.log("✅ Patient signup successful:", username);
    } else if (role === "doctor") {
      console.log("Attempting doctor signup:", username, email);
      const [result] = await db.query(
        "INSERT INTO doctors (username, email, phone, password_hash, full_name, specialization, license, experience, hospital) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [username, email, phone, password_hash, fullName, specialization, license, experience, hospital]
      );
      const doctorId = result.insertId;
      console.log("✅ Doctor signup successful:", username);

      // Insert doctor availability if provided
      if (Array.isArray(availability)) {
        for (const slot of availability) {
          if (slot.enabled && slot.start && slot.end) {
            await db.query(
              "INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)",
              [doctorId, slot.day, slot.start, slot.end]
            );
          }
        }
        console.log("✅ Doctor availability inserted for:", username);
      }
    } else {
      console.log("❌ Invalid role during signup:", role);
      return res.status(400).json({ error: "Invalid role" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    // Check for specific MySQL duplicate entry errors
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('username')) {
        return res.status(400).json({ error: "Username already exists. Please choose a different username." });
      }
    }
    res.status(400).json({ error: "Signup failed. Please try again." });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { role, username, password } = req.body;
  try {
    let user;
    if (role === "patient") {
      const [rows] = await db.query("SELECT * FROM patients WHERE username=?", [username]);
      user = rows[0];
    } else if (role === "doctor") {
      const [rows] = await db.query("SELECT * FROM doctors WHERE username=?", [username]);
      user = rows[0];
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    // You can add JWT here if needed
    res.json({ success: true, user: { id: user.id, username: user.username, role } });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// Forgot Password route
router.post("/forgot-password", async (req, res) => {
  const { role, email } = req.body;
  try {
    let user;
    if (role === "patient") {
      const [rows] = await db.query("SELECT * FROM patients WHERE email=?", [email]);
      user = rows[0];
    } else if (role === "doctor") {
      const [rows] = await db.query("SELECT * FROM doctors WHERE email=?", [email]);
      user = rows[0];
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    // Generate reset token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    if (role === "patient") {
      await db.query(
        "UPDATE patients SET reset_token=?, reset_token_expiry=? WHERE id=?",
        [resetToken, resetExpiry, user.id]
      );
    } else {
      await db.query(
        "UPDATE doctors SET reset_token=?, reset_token_expiry=? WHERE id=?",
        [resetToken, resetExpiry, user.id]
      );
    }

    // In production, send email with reset link
    // For now, return the token (remove this in production!)
    res.json({ 
      success: true, 
      message: "Password reset instructions sent to your email.",
      resetToken: resetToken // Remove this in production!
    });

  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    res.status(500).json({ error: "Password reset failed" });
  }
});

// Reset Password route
router.post("/reset-password", async (req, res) => {
  const { role, resetToken, newPassword } = req.body;
  try {
    let user;
    const now = new Date();

    if (role === "patient") {
      const [rows] = await db.query(
        "SELECT * FROM patients WHERE reset_token=? AND reset_token_expiry > ?",
        [resetToken, now]
      );
      user = rows[0];
    } else if (role === "doctor") {
      const [rows] = await db.query(
        "SELECT * FROM doctors WHERE reset_token=? AND reset_token_expiry > ?",
        [resetToken, now]
      );
      user = rows[0];
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    if (role === "patient") {
      await db.query(
        "UPDATE patients SET password_hash=?, reset_token=NULL, reset_token_expiry=NULL WHERE id=?",
        [password_hash, user.id]
      );
    } else {
      await db.query(
        "UPDATE doctors SET password_hash=?, reset_token=NULL, reset_token_expiry=NULL WHERE id=?",
        [password_hash, user.id]
      );
    }

    res.json({ success: true, message: "Password reset successfully!" });

  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ error: "Password reset failed" });
  }
});

// Change Email route (requires current password)
router.post("/change-email", async (req, res) => {
  const { role, username, currentPassword, newEmail } = req.body;
  try {
    let user;
    if (role === "patient") {
      const [rows] = await db.query("SELECT * FROM patients WHERE username=?", [username]);
      user = rows[0];
    } else if (role === "doctor") {
      const [rows] = await db.query("SELECT * FROM doctors WHERE username=?", [username]);
      user = rows[0];
    } else {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Note: Email uniqueness is not enforced - multiple users can have the same email

    // Update email
    if (role === "patient") {
      await db.query("UPDATE patients SET email=? WHERE id=?", [newEmail, user.id]);
    } else {
      await db.query("UPDATE doctors SET email=? WHERE id=?", [newEmail, user.id]);
    }

    res.json({ success: true, message: "Email updated successfully!" });

  } catch (err) {
    console.error("❌ Change email error:", err.message);
    res.status(500).json({ error: "Email change failed" });
  }
});

module.exports = router;