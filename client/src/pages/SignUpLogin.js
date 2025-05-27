import React, { useState } from "react";
import WellnessChat from "./WellnessChat"; // Adjust path if needed

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

const roleButtonStyle = (active) => ({
  ...buttonStyle,
  width: "48%",
  marginBottom: 0,
  background: active
    ? "linear-gradient(90deg, #2563eb 60%, #38bdf8 100%)"
    : "#e0e7ff",
  color: active ? "white" : "#2563eb",
  fontWeight: active ? 700 : 500,
  border: active ? "none" : "1px solid #cbd5e1",
  marginRight: "4%",
});

const linkButtonStyle = {
  border: "none",
  background: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 500,
  textDecoration: "underline",
  fontSize: 15,
};

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
    // Doctor-specific
    specialization: "",
    license: "",
    experience: "",
    hospital: "",
  });
  const [message, setMessage] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRoleClick = (selectedRole) => {
    setRole(selectedRole);
    setMessage("");
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "signup") {
      if (role === "patient") {
        if (
          !form.username ||
          !form.email ||
          !form.phone ||
          !form.password ||
          !form.fullName ||
          !form.dob ||
          !form.gender
        ) {
          setMessage("Please fill all fields.");
          return;
        }
      } else {
        if (
          !form.username ||
          !form.email ||
          !form.phone ||
          !form.password ||
          !form.fullName ||
          !form.specialization ||
          !form.license ||
          !form.experience ||
          !form.hospital
        ) {
          setMessage("Please fill all fields.");
          return;
        }
      }
      setMessage("");
      setLoggedIn(true);
      if (onLogin) onLogin();
    } else {
      if (!form.username || !form.password) {
        setMessage("Please enter username and password.");
        return;
      }
      setMessage("");
      setLoggedIn(true);
      if (onLogin) onLogin();
    }
  };

  if (loggedIn) {
    return <WellnessChat username={form.username} />;
  }

  return (
    <div style={bgStyle}>
      <form style={cardStyle} onSubmit={handleSubmit}>
        <div style={headingStyle}>Welcome to Medicare {mode === "login" ? "Login" : "Sign Up"}</div>
        <div style={subheadingStyle}>
          {mode === "login"
            ? "Login to access your smart healthcare services."
            : "Create your account to access our smart healthcare services."}
        </div>
        {mode === "login" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              type="button"
              style={roleButtonStyle(role === "patient")}
              onClick={() => handleRoleClick("patient")}
            >
              Login as Patient
            </button>
            <button
              type="button"
              style={roleButtonStyle(role === "doctor")}
              onClick={() => handleRoleClick("doctor")}
            >
              Login as Doctor
            </button>
          </div>
        )}
        {mode === "signup" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              type="button"
              style={roleButtonStyle(role === "patient")}
              onClick={() => handleRoleClick("patient")}
            >
              Sign Up as Patient
            </button>
            <button
              type="button"
              style={roleButtonStyle(role === "doctor")}
              onClick={() => handleRoleClick("doctor")}
            >
              Sign Up as Doctor
            </button>
          </div>
        )}
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
            placeholder="Choose a username"
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
            placeholder="Create a password"
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
                  setMessage("");
                }}
                style={linkButtonStyle}
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
                  setMessage("");
                }}
                style={linkButtonStyle}
              >
                Login
              </button>
            </>
          )}
        </div>
        {message && (
          <div style={{ color: "#dc2626", textAlign: "center", marginTop: 8 }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
};

export default SignUpLogin;