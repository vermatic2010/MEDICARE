const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "1234", // <-- add your password if needed
  database: "medicare",
});

// MCP-style Get all upcoming appointments for a patient  
router.get("/appointments/:patientId", async (req, res) => {
  /**
   * MCP Protocol: GET /api/patients/appointments/{patientId}
   * Context: patient appointment retrieval
   */
  const patientId = req.params.patientId;
  console.log("MCP: Fetching appointments for patient ID:", patientId);
  
  try {
    const [appointments] = await db.query(
      `SELECT a.id, a.appointment_time, a.status,
              d.full_name AS doctor_name, d.specialization
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ? AND a.appointment_time >= NOW()
       ORDER BY a.appointment_time ASC`,
      [patientId]
    );
    
    console.log("MCP: Found appointments:", appointments);
    
    // MCP-style response with context
    res.json({
      protocol: "get-patient-appointments",
      context: {
        patient_id: parseInt(patientId),
        appointments_count: appointments.length,
        status: "success"
      },
      appointments,
      message: appointments.length > 0 ? "Appointments retrieved successfully" : "No upcoming appointments found"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch patient appointments:", err);
    res.status(500).json({
      protocol: "get-patient-appointments", 
      context: {
        patient_id: parseInt(patientId),
        status: "error"
      },
      error: "Failed to fetch appointments",
      details: err.message
    });
  }
});

// MCP-style Get patient details by ID
router.get("/:patientId", async (req, res) => {
  /**
   * MCP Protocol: GET /api/patients/{patientId}
   * Context: patient details retrieval by ID
   */
  const patientId = req.params.patientId;
  console.log("MCP: Fetching patient details for ID:", patientId);
  
  try {
    const [patients] = await db.query(
      "SELECT id, full_name, username, email, phone FROM patients WHERE id = ?",
      [patientId]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        protocol: "get-patient-by-id",
        context: {
          patient_id: parseInt(patientId),
          status: "not_found"
        },
        error: "Patient not found",
        message: `No patient found with ID: ${patientId}`
      });
    }
    
    const patient = patients[0];
    console.log("MCP: Found patient:", patient);
    
    // MCP-style response with context
    res.json({
      protocol: "get-patient-by-id",
      context: {
        patient_id: parseInt(patientId),
        status: "found"
      },
      patient,
      message: "Patient found successfully"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch patient:", err);
    res.status(500).json({
      protocol: "get-patient-by-id",
      context: {
        patient_id: parseInt(patientId),
        status: "error"
      },
      error: "Failed to fetch patient",
      details: err.message
    });
  }
});

// MCP-style Get patient ID from username
router.get("/lookup/:username", async (req, res) => {
  /**
   * MCP Protocol: GET /api/patients/lookup/{username}
   * Context: patient username to ID lookup
   */
  const username = req.params.username;
  console.log("MCP: Looking up patient by username:", username);
  
  try {
    const [patients] = await db.query(
      "SELECT id, full_name, username, email, phone FROM patients WHERE username = ?",
      [username]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        protocol: "lookup-patient-by-username",
        context: {
          username: username,
          status: "not_found"
        },
        error: "Patient not found",
        message: `No patient found with username: ${username}`
      });
    }
    
    const patient = patients[0];
    console.log("MCP: Found patient:", patient);
    
    // MCP-style response with context
    res.json({
      protocol: "lookup-patient-by-username",
      context: {
        username: username,
        patient_id: patient.id,
        status: "found"
      },
      patient,
      message: "Patient found successfully"
    });
  } catch (err) {
    console.error("MCP: Failed to lookup patient:", err);
    res.status(500).json({
      protocol: "lookup-patient-by-username",
      context: {
        username: username,
        status: "error"
      },
      error: "Failed to lookup patient",
      details: err.message
    });
  }
});

module.exports = router;