import React, { useState } from "react";
import axios from "axios";

// --- Styles ---
const bgStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #e0e7ff 0%, #f0fdfa 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
};
const cardStyle = {
  background: "white",
  borderRadius: 18,
  boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.18)",
  padding: "36px 32px 28px 32px",
  maxWidth: 440,
  width: "100%",
  border: "1px solid #e0e7ff",
};
const headingStyle = {
  textAlign: "center",
  fontWeight: 700,
  fontSize: 28,
  color: "#2563eb",
  marginBottom: 8,
  letterSpacing: 1,
};
const subheadingStyle = {
  textAlign: "center",
  color: "#64748b",
  fontSize: 16,
  marginBottom: 24,
};
const labelStyle = {
  fontWeight: 500,
  color: "#334155",
  marginBottom: 4,
  display: "block",
};
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  marginBottom: 16,
  fontSize: 15,
  background: "#f8fafc",
  outline: "none",
  transition: "border 0.2s",
};
const selectStyle = {
  ...inputStyle,
  padding: "10px 8px",
};
const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(90deg, #2563eb 60%, #38bdf8 100%)",
  color: "white",
  fontWeight: 600,
  fontSize: 17,
  cursor: "pointer",
  marginBottom: 10,
  boxShadow: "0 2px 8px 0 rgba(37,99,235,0.08)",
  letterSpacing: 1,
};
const linkButtonStyle = {
  border: "none",
  background: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 500,
  textDecoration: "underline",
  fontSize: 15,
};
const toggleContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 18,
  userSelect: "none",
};
const sliderStyle = {
  background: "#e0e7ff",
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  width: 220,
  height: 40,
  position: "relative",
  cursor: "pointer",
  boxShadow: "0 2px 8px 0 rgba(37,99,235,0.08)",
};
const sliderButtonStyle = (active) => ({
  flex: 1,
  zIndex: 2,
  textAlign: "center",
  fontWeight: 600,
  fontSize: 16,
  color: active ? "white" : "#2563eb",
  transition: "color 0.2s",
  cursor: "pointer",
  padding: "8px 0",
});
const sliderThumbStyle = (role) => ({
  position: "absolute",
  top: 3,
  left: role === "patient" ? 3 : 110,
  width: 107,
  height: 34,
  background: "linear-gradient(90deg, #2563eb 60%, #38bdf8 100%)",
  borderRadius: 17,
  transition: "left 0.25s",
  zIndex: 1,
});

// --- Main Component ---
const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SignUpLogin = ({ onLogin }) => {
  const [mode, setMode] = useState("login"); // or "signup"
  const [role, setRole] = useState("patient"); // "patient" or "doctor"
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    fullName: "",
    dob: "",
    gender: "",
    specialization: "",
    license: "",
    experience: "",
    hospital: "",
  });
  const [availability, setAvailability] = useState(
    daysOfWeek.map((day) => ({
      day,
      enabled: false,
      start: "",
      end: "",
    }))
  );
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error"); // "success" or "error"
  const [loggedIn, setLoggedIn] = useState(false);

  // Helper function to set messages with appropriate type
  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const clearMessage = () => {
    setMessage("");
    setMessageType("error");
  };

  // --- Validation ---
  const validateSignup = (role, form) => {
    if (!form.username || form.username.length < 3) return "Username must be at least 3 characters.";
    if (!form.email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(form.email)) return "Please enter a valid email address.";
    if (!form.phone || !/^\d{10,15}$/.test(form.phone.replace(/\D/g, ""))) return "Please enter a valid phone number.";
    if (!form.password || form.password.length < 6) return "Password must be at least 6 characters.";
    if (!form.fullName || form.fullName.length < 2) return "Please enter your full name.";
    if (role === "patient") {
      if (!form.dob) return "Please enter your date of birth.";
      if (!form.gender) return "Please select your gender.";
    } else if (role === "doctor") {
      if (!form.specialization) return "Please enter your specialization.";
      if (!form.license) return "Please enter your medical license number.";
      if (!form.experience || isNaN(form.experience) || form.experience < 0) return "Please enter valid years of experience.";
      if (!form.hospital) return "Please enter your hospital/clinic name.";
      if (!availability.some((a) => a.enabled && a.start && a.end)) return "Please set at least one available day and time.";
    }
    return "";
  };

  // --- Handlers ---
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRoleClick = (selectedRole) => {
    setRole(selectedRole);
    clearMessage();
    setForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      fullName: "",
      dob: "",
      gender: "",
      specialization: "",
      license: "",
      experience: "",
      hospital: "",
    });
    setAvailability(
      daysOfWeek.map((day) => ({
        day,
        enabled: false,
        start: "",
        end: "",
      }))
    );
  };

  const handleAvailabilityChange = (idx, field, value) => {
    setAvailability((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, [field]: field === "enabled" ? value : value } : a
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "signup") {
      const validationMsg = validateSignup(role, form);
      if (validationMsg) {
        showMessage(validationMsg);
        return;
      }
      try {
        await axios.post("http://localhost:3001/api/auth/signup", {
          role,
          ...form,
          availability: role === "doctor"
            ? availability.filter((a) => a.enabled && a.start && a.end)
            : undefined,
        });
        showMessage("Signup successful! Please login.", "success");
        setMode("login");
      } catch (err) {
        showMessage(err.response?.data?.error || "Signup failed. Please try again.");
      }
    } else {
      if (!form.username || !form.password) {
        showMessage("Please enter username and password.");
        return;
      }
      try {
        const response = await axios.post("http://localhost:3001/api/auth/login", {
          role,
          username: form.username,
          password: form.password,
        });
        const userData = response.data.user; // Capture user data including ID
        clearMessage();
        setLoggedIn(true);
        if (onLogin) onLogin(role, userData); // Pass both role and user data
      } catch (err) {
        showMessage(err.response?.data?.error || "Login failed. Please try again.");
      }
    }
  };

  // --- Render ---
  if (loggedIn) {
    // Don't render WellnessChat directly - let App.js handle the navigation
    return <div>Login successful! Please wait...</div>;
  }

  return (
    <div style={bgStyle}>
      <form style={cardStyle} onSubmit={handleSubmit}>
        <div style={headingStyle}>
          Welcome to HealthConnect {mode === "login" ? "Login" : "Sign Up"}
        </div>
        <div style={subheadingStyle}>
          {mode === "login"
            ? "Login to access your smart healthcare services."
            : "Create your account to access our smart healthcare services."}
        </div>
        {/* Role Toggle */}
        <div style={toggleContainerStyle}>
          <div style={sliderStyle}>
            <div style={sliderThumbStyle(role)} />
            <div
              style={sliderButtonStyle(role === "patient")}
              onClick={() => handleRoleClick("patient")}
            >
              Patient
            </div>
            <div
              style={sliderButtonStyle(role === "doctor")}
              onClick={() => handleRoleClick("doctor")}
            >
              Doctor
            </div>
          </div>
        </div>
        {mode === "signup" && (
          <>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                type="text"
                style={inputStyle}
                placeholder="Enter your full name"
              />
            </div>
            {role === "patient" && (
              <>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
                    type="date"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    style={selectStyle}
                  >
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}
            {role === "doctor" && (
              <>
                <div>
                  <label style={labelStyle}>Specialization</label>
                  <input
                    name="specialization"
                    value={form.specialization}
                    onChange={handleChange}
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. Cardiologist"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Medical License Number</label>
                  <input
                    name="license"
                    value={form.license}
                    onChange={handleChange}
                    type="text"
                    style={inputStyle}
                    placeholder="Enter license number"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Years of Experience</label>
                  <input
                    name="experience"
                    value={form.experience}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    style={inputStyle}
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Hospital/Clinic Name</label>
                  <input
                    name="hospital"
                    value={form.hospital}
                    onChange={handleChange}
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. City Hospital"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Weekly Availability</label>
                  <div style={{ marginBottom: 12 }}>
                    {availability.map((a, idx) => (
                      <div key={a.day} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          checked={a.enabled}
                          onChange={e => handleAvailabilityChange(idx, "enabled", e.target.checked)}
                          style={{ marginRight: 8 }}
                        />
                        <span style={{ width: 80 }}>{a.day}</span>
                        <input
                          type="time"
                          value={a.start}
                          disabled={!a.enabled}
                          onChange={e => handleAvailabilityChange(idx, "start", e.target.value)}
                          style={{ ...inputStyle, width: 110, marginBottom: 0, marginRight: 6 }}
                        />
                        <span style={{ margin: "0 6px" }}>to</span>
                        <input
                          type="time"
                          value={a.end}
                          disabled={!a.enabled}
                          onChange={e => handleAvailabilityChange(idx, "end", e.target.value)}
                          style={{ ...inputStyle, width: 110, marginBottom: 0 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                style={inputStyle}
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                type="tel"
                style={inputStyle}
                placeholder="Enter your phone number"
              />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            type="text"
            style={inputStyle}
            placeholder="Enter your username"
          />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input
            name="password"
            value={form.password}
            onChange={handleChange}
            type="password"
            style={inputStyle}
            placeholder="Enter your password"
          />
        </div>
        <button type="submit" style={buttonStyle}>
          {mode === "login"
            ? role === "doctor"
              ? "Login as Doctor"
              : "Login as Patient"
            : role === "doctor"
              ? "Sign Up as Doctor"
              : "Sign Up as Patient"}
        </button>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  clearMessage();
                }}
                style={linkButtonStyle}
                type="button"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  clearMessage();
                }}
                style={linkButtonStyle}
                type="button"
              >
                Login
              </button>
            </>
          )}
        </div>
        {message && (
          <div style={{ 
            color: messageType === "success" ? "#059669" : "#dc2626", // Green for success, red for error
            textAlign: "center", 
            marginTop: 8,
            fontWeight: messageType === "success" ? "600" : "500",
            backgroundColor: messageType === "success" ? "#f0fdf4" : "#fef2f2", // Light green/red background
            padding: "8px 12px",
            borderRadius: "6px",
            border: messageType === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca"
          }}>
            {messageType === "success" && "✅ "}{message}
          </div>
        )}
      </form>
    </div>
  );
};

export default SignUpLogin;