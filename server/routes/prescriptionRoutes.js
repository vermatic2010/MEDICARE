const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const NotificationService = require("../services/notificationService");

const notificationService = new NotificationService();

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "1234",
  database: "medicare",
});

// MCP-style Get all medicines/prescriptions for a patient
router.get("/patients/:patientId/medicines", async (req, res) => {
  const patientId = req.params.patientId;
  console.log("MCP: Fetching medicines for patient ID:", patientId);
  
  try {
    const [medicines] = await db.query(
      `SELECT p.id, p.medicine_name as name, p.dosage, p.duration, p.instructions,
              p.prescribed_date, p.status,
              d.full_name as doctor_name, d.specialization
       FROM prescriptions p
       LEFT JOIN doctors d ON p.doctor_id = d.id
       WHERE p.patient_id = ? AND p.status = 'active'
       ORDER BY p.prescribed_date DESC`,
      [patientId]
    );
    
    console.log("MCP: Found medicines:", medicines);
    
    // MCP-style response with context
    res.json({
      protocol: "get-patient-medicines",
      context: {
        patient_id: parseInt(patientId),
        medicines_count: medicines.length,
        status: "success"
      },
      medicines,
      message: medicines.length > 0 ? "Medicines retrieved successfully" : "No active medicines found"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch patient medicines:", err);
    res.status(500).json({
      protocol: "get-patient-medicines",
      context: {
        patient_id: parseInt(patientId),
        status: "error"
      },
      error: "Failed to fetch medicines",
      details: err.message
    });
  }
});

// MCP-style Add a new prescription/medicine
router.post("/prescriptions/add", async (req, res) => {
  /**
   * MCP Protocol: expects
   * {
   *   context: {
   *     patient_id: number,
   *     doctor_id: number (optional),
   *     medicine_name: string,
   *     dosage: string,
   *     duration: string,
   *     instructions: string (optional),
   *     [session_id, user_agent, etc.]
   *   }
   * }
   */
  const { context } = req.body;
  
  // Support both old format and new MCP format
  const prescriptionData = context || req.body;
  const { patientId, patient_id, doctorId, doctor_id, name, medicine_name, dosage, duration, instructions } = prescriptionData;
  
  const finalPatientId = patient_id || patientId;
  const finalDoctorId = doctor_id || doctorId;
  const finalMedicineName = medicine_name || name;
  
  console.log("MCP: Adding prescription:", { finalPatientId, finalMedicineName, dosage, duration, finalDoctorId, instructions });
  
  try {
    if (!finalPatientId || !finalMedicineName || !dosage || !duration) {
      return res.status(400).json({
        protocol: "add-prescription",
        context: {
          patient_id: finalPatientId,
          status: "validation_error"
        },
        error: "Missing required fields: patient_id, medicine_name, dosage, duration"
      });
    }
    
    const [result] = await db.query(
      `INSERT INTO prescriptions (patient_id, doctor_id, medicine_name, dosage, duration, instructions, prescribed_date, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 'active')`,
      [finalPatientId, finalDoctorId || null, finalMedicineName, dosage, duration, instructions || '']
    );
    
    console.log("MCP: Prescription added with ID:", result.insertId);
    
    // Send prescription notification to patient
    try {
      // Fetch patient and doctor details for notifications
      const [patientRows] = await db.query(
        'SELECT full_name, email, phone FROM patients WHERE id = ?',
        [finalPatientId]
      );
      
      const [doctorRows] = await db.query(
        'SELECT full_name, specialization FROM doctors WHERE id = ?',
        [finalDoctorId || 1] // Default to doctor 1 if no doctor specified
      );
      
      if (patientRows.length > 0) {
        const patient = patientRows[0];
        const doctor = doctorRows.length > 0 ? doctorRows[0] : { full_name: 'Healthcare Provider', specialization: 'General Medicine' };
        
        const prescriptionData = {
          date: new Date(),
          medicines: [{
            name: finalMedicineName,
            dosage: dosage,
            frequency: 'As prescribed', // You might want to add this field to your form
            duration: duration,
            instructions: instructions || ''
          }]
        };
        
        const patientData = {
          name: patient.full_name,
          email: patient.email,
          phone: patient.phone
        };
        
        const doctorData = {
          name: doctor.full_name,
          specialization: doctor.specialization
        };
        
        // Send notifications asynchronously (don't wait for completion)
        notificationService.sendPrescriptionNotifications(patientData, prescriptionData, doctorData)
          .then(notificationResults => {
            console.log('Prescription notifications sent:', notificationResults);
          })
          .catch(notificationError => {
            console.error('Failed to send prescription notifications:', notificationError);
          });
      }
    } catch (notificationError) {
      console.error('Error preparing prescription notifications:', notificationError);
      // Don't fail the prescription creation if notifications fail
    }
    
    // MCP-style response
    res.json({
      protocol: "add-prescription",
      context: {
        patient_id: finalPatientId,
        doctor_id: finalDoctorId,
        prescription_id: result.insertId,
        status: "prescribed"
      },
      message: "Prescription added successfully and notifications sent"
    });
  } catch (err) {
    console.error("MCP: Failed to add prescription:", err);
    res.status(500).json({
      protocol: "add-prescription",
      context: {
        patient_id: finalPatientId,
        status: "error"
      },
      error: "Failed to add prescription",
      details: err.message
    });
  }
});

// MCP-style Update prescription status
router.put("/prescriptions/:prescriptionId/status", async (req, res) => {
  /**
   * MCP Protocol: expects
   * {
   *   context: {
   *     prescription_id: number,
   *     status: string,
   *     updated_by: number (optional),
   *     [session_id, user_agent, etc.]
   *   }
   * }
   */
  const prescriptionId = req.params.prescriptionId;
  const { context } = req.body;
  
  // Support both old format and new MCP format
  const updateData = context || req.body;
  const { status, updated_by } = updateData;
  
  try {
    if (!status || !['active', 'inactive', 'completed'].includes(status)) {
      return res.status(400).json({
        protocol: "update-prescription-status",
        context: {
          prescription_id: parseInt(prescriptionId),
          status: "validation_error"
        },
        error: "Invalid status. Must be: active, inactive, or completed"
      });
    }
    
    await db.query(
      "UPDATE prescriptions SET status = ? WHERE id = ?",
      [status, prescriptionId]
    );
    
    // MCP-style response
    res.json({
      protocol: "update-prescription-status",
      context: {
        prescription_id: parseInt(prescriptionId),
        new_status: status,
        updated_by: updated_by,
        status: "updated"
      },
      message: "Prescription status updated successfully"
    });
  } catch (err) {
    console.error("MCP: Failed to update prescription status:", err);
    res.status(500).json({
      protocol: "update-prescription-status",
      context: {
        prescription_id: parseInt(prescriptionId),
        status: "error"
      },
      error: "Failed to update prescription status",
      details: err.message
    });
  }
});

// MCP-style Get prescription history for a patient
router.get("/patients/:patientId/prescription-history", async (req, res) => {
  const patientId = req.params.patientId;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50; // Default to 50, can be overridden
  console.log("MCP: Fetching prescription history for patient ID:", patientId, "limit:", limit);
  
  try {
    const [prescriptions] = await db.query(
      `SELECT p.id, p.medicine_name, p.dosage, p.duration, p.instructions,
              p.prescribed_date, p.status, p.created_at, p.updated_at,
              d.full_name as doctor_name, d.specialization as doctor_specialization
       FROM prescriptions p
       LEFT JOIN doctors d ON p.doctor_id = d.id
       WHERE p.patient_id = ?
       ORDER BY p.prescribed_date DESC, p.created_at DESC
       LIMIT ?`,
      [patientId, limit]
    );
    
    console.log("MCP: Found prescription history:", prescriptions.length, "records");
    
    // MCP-style response with context
    res.json({
      protocol: "get-prescription-history",
      context: {
        patient_id: parseInt(patientId),
        prescriptions_count: prescriptions.length,
        limit: limit,
        status: "success"
      },
      prescriptions,
      message: prescriptions.length > 0 ? 
        `Found ${prescriptions.length} prescription${prescriptions.length > 1 ? 's' : ''} in history` : 
        "No prescription history found"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch prescription history:", err);
    res.status(500).json({
      protocol: "get-prescription-history",
      context: {
        patient_id: parseInt(patientId),
        status: "error"
      },
      error: "Failed to fetch prescription history",
      details: err.message
    });
  }
});

module.exports = router;
