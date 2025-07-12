// index.js - Healthcare Bot API Server with MCP Support
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Debug: Check environment variables
console.log('🔧 Environment Check:');
console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('🔑 DB_NAME:', process.env.DB_NAME || 'medicare (default)');
console.log('📡 PORT:', process.env.PORT || '3001 (default)');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
const aiResponseRoute = require("./routes/aiResponseRoute");
app.use("/api/ai-response", aiResponseRoute);
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
const doctorRoutes = require("./routes/doctorRoutes");
app.use("/api/doctors", doctorRoutes);
const patientRoutes = require("./routes/patientRoutes");
app.use("/api/patients", patientRoutes);
const prescriptionRoutes = require("./routes/prescriptionRoutes");
app.use("/api", prescriptionRoutes);
const llmRoutes = require("./routes/llmRoutes");
app.use("/api", llmRoutes);
const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);

// Basic endpoints
app.get("/", (req, res) => {
  res.json({
    status: "✅ Healthcare Bot API is running",
    version: "1.0.0",
    protocols: {
      rest: "Available at /api/*",
      mcp: "Run 'npm run mcp' for Model Context Protocol server"
    },
    endpoints: {
      auth: "/api/auth/*",
      doctors: "/api/doctors/*", 
      patients: "/api/patients/*",
      ai: "/api/ai-response/*"
    }
  });
});

// MCP Integration endpoint
app.get("/api/mcp/tools", (req, res) => {
  res.json({
    message: "MCP tools available via stdio protocol",
    tools: [
      "book_appointment",
      "get_available_doctors", 
      "get_doctor_appointments",
      "get_patient_appointments",
      "authenticate_user",
      "register_user",
      "check_slot_availability"
    ],
    usage: "Run 'npm run mcp' to start MCP server"
  });
});

app.post("/api/book-appointment", (req, res) => {
  // Redirect to the proper doctor routes endpoint
  res.status(301).json({ 
    error: "Please use /api/doctors/book-appointment endpoint for REST API",
    redirect: "/api/doctors/book-appointment",
    mcp_alternative: "Use MCP 'book_appointment' tool for protocol-based booking"
  });
});

app.post("/api/calculate-bmi", (req, res) => {
  // ... keep your existing BMI logic
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start the video call WebSocket server
const VideoCallSignalingServer = require('./videoCallServer');
const videoCallServer = new VideoCallSignalingServer();
videoCallServer.start(3002);

app.listen(PORT, () => {
  console.log(`🚀 Healthcare Bot Server running on http://localhost:${PORT}`);
  console.log(`📋 REST API: http://localhost:${PORT}/api/`);
  console.log(`🔗 MCP Server: Run 'npm run mcp' for Model Context Protocol`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/`);
});