const express = require("express");
const mysql = require("mysql2/promise");
const NotificationService = require("../services/notificationService");
const nodemailer = require("nodemailer");

const router = express.Router();

// Initialize notification service
const notificationService = new NotificationService();

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "1234", // <-- add your password if needed
  database: "medicare",
});

// Helper to generate slots from start_time and end_time (both in "HH:MM:SS" format)
function generateSlotsFromTimes(start, end) {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  let slots = [];
  let hour = startHour;
  let minute = startMin;
  while (hour < endHour || (hour === endHour && minute < endMin)) {
    let displayHour = hour % 12 === 0 ? 12 : hour % 12;
    let ampm = hour < 12 ? "AM" : "PM";
    let slot = `${displayHour}:00 ${ampm}`;
    slots.push(slot);
    hour += 1;
    minute = 0;
  }
  return slots;
}

// MCP-style Get all appointments for a doctor (with patient details)
router.get("/appointments/:doctorId", async (req, res) => {
  /**
   * MCP Protocol: GET /api/doctors/appointments/{doctorId}?date={optional}
   * Context: doctor appointment retrieval
   */
  const doctorId = req.params.doctorId;
  const date = req.query.date; // optional, format: YYYY-MM-DD
  console.log("MCP: Fetching appointments for doctor ID:", doctorId, "date filter:", date);
  
  try {
    let query = `
      SELECT a.id, a.appointment_time, a.status, 
             p.full_name AS patient_name, p.phone AS patient_phone, p.gender, p.dob
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = ?
    `;
    let params = [doctorId];
    if (date) {
      query += " AND DATE(a.appointment_time) = ?";
      params.push(date);
    }
    query += " ORDER BY a.appointment_time ASC";
    const [appointments] = await db.query(query, params);
    
    console.log("MCP: Found appointments for doctor", doctorId, ":", appointments);
    
    // MCP-style response with context
    res.json({
      protocol: "get-doctor-appointments",
      context: {
        doctor_id: parseInt(doctorId),
        date_filter: date,
        appointments_count: appointments.length,
        status: "success"
      },
      appointments,
      message: appointments.length > 0 ? "Appointments retrieved successfully" : "No appointments found"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch appointments:", err);
    res.status(500).json({
      protocol: "get-doctor-appointments",
      context: {
        doctor_id: parseInt(doctorId),
        date_filter: date,
        status: "error"
      },
      error: "Failed to fetch appointments",
      details: err.message
    });
  }
});

// MCP-style Get all doctors with available slots
router.get("/available-slots", async (req, res) => {
  /**
   * MCP Protocol: GET /api/doctors/available-slots?specialist={optional}
   * Context: doctor availability retrieval
   */
  const { specialist } = req.query;
  console.log("MCP: Fetching available doctors, specialist filter:", specialist);
  
  try {
    let [doctors] = await db.query("SELECT id, full_name, specialization FROM doctors");

    // Filter by specialist if provided
    if (specialist) {
      doctors = doctors.filter(doc =>
        doc.specialization.toLowerCase().includes(specialist.toLowerCase())
      );
    }

    if (doctors.length === 0) {
      return res.json({
        protocol: "get-available-doctors",
        context: {
          specialist_filter: specialist,
          doctors_count: 0,
          status: "no_results"
        },
        doctors: [],
        message: specialist ? `No ${specialist} available at the moment.` : "No doctors available at the moment."
      });
    }

    const result = [];

    for (const doc of doctors) {
      // Get all availability for this doctor
      const [availRows] = await db.query(
        "SELECT day_of_week, start_time, end_time FROM doctor_availability WHERE doctor_id=?",
        [doc.id]
      );

      let slotsByDay = {};
      for (const avail of availRows) {
        // Generate slots for each available day
        const slots = generateSlotsFromTimes(avail.start_time, avail.end_time);
        slotsByDay[avail.day_of_week] = slots.map(time => ({ time, booked: false }));
      }

      result.push({ ...doc, slots: slotsByDay });
    }

    // MCP-style response with context
    res.json({
      protocol: "get-available-doctors",
      context: {
        specialist_filter: specialist,
        doctors_count: result.length,
        total_slots: result.reduce((total, doc) => {
          return total + Object.values(doc.slots).reduce((dayTotal, daySlots) => dayTotal + daySlots.length, 0);
        }, 0),
        status: "success"
      },
      doctors: result,
      message: "Doctors and availability retrieved successfully"
    });
  } catch (err) {
    console.error("MCP: Failed to fetch doctors/slots:", err);
    res.status(500).json({
      protocol: "get-available-doctors",
      context: {
        specialist_filter: specialist,
        status: "error"
      },
      error: "Failed to fetch doctors",
      details: err.message
    });
  }
});

// MCP-style Book an appointment (with slot conflict check)
router.post("/book-appointment", async (req, res) => {
  /**
   * Protocol: expects
   * {
   *   context: {
   *     patient_id: number,
   *     doctor_id: number,
   *     appointment_time: string (YYYY-MM-DD HH:MM:SS),
   *     [optional: session_id, user_agent, etc.]
   *   }
   * }
   */
  const { context } = req.body;
  if (!context || !context.patient_id || !context.doctor_id || !context.appointment_time) {
    return res.status(400).json({ error: "Missing booking context." });
  }

  // Model: extract from context
  const { patient_id, doctor_id, appointment_time } = context;

  try {
    // Validate appointment date is not in the past
    const appointmentDate = new Date(appointment_time);
    const currentDate = new Date();
    
    if (appointmentDate <= currentDate) {
      console.log("❌ Appointment booking rejected: Past date", appointment_time);
      return res.status(400).json({
        protocol: "book-appointment",
        context: { ...context, status: "invalid_date" },
        error: "Cannot book appointment for past date",
        message: "Please select a future date and time for your appointment."
      });
    }

    // Model: check for slot conflict
    const [existing] = await db.query(
      "SELECT * FROM appointments WHERE doctor_id=? AND appointment_time=?",
      [doctor_id, appointment_time]
    );
    if (existing.length > 0) {
      console.log("Slot conflict for doctor", doctor_id, "at", appointment_time);
      return res.status(409).json({
        protocol: "book-appointment",
        context: { ...context, status: "conflict" },
        message: "Doctor is not available at this slot."
      });
    }

    // Model: book the appointment
    await db.query(
      "INSERT INTO appointments (patient_id, doctor_id, appointment_time, status) VALUES (?, ?, ?, 'scheduled')",
      [patient_id, doctor_id, appointment_time]
    );
    console.log("Appointment booked for patient", patient_id, "with doctor", doctor_id, "at", appointment_time);

    // --- Notification block START ---
    // Fetch patient and doctor info for notification
    const [patientRows] = await db.query(
      "SELECT full_name, phone, email FROM patients WHERE id = ?",
      [patient_id]
    );
    const [doctorRows] = await db.query(
      "SELECT full_name, email, specialization, hospital FROM doctors WHERE id = ?",
      [doctor_id]
    );
    const patient = patientRows[0];
    const doctor = doctorRows[0];

    // Send appointment confirmation notifications using NotificationService
    if (patient && doctor) {
      try {
        const appointmentData = {
          appointment_time: appointment_time
        };
        
        const notificationResults = await notificationService.sendAppointmentConfirmation(
          patient, 
          appointmentData, 
          doctor
        );
        
        console.log("📧 Patient email:", notificationResults.patientEmail.success ? "✅ Sent" : "❌ Failed");
        console.log("📧 Doctor email:", notificationResults.doctorEmail.success ? "✅ Sent" : "❌ Failed");
        console.log("📱 Patient SMS:", notificationResults.patientSMS.success ? "✅ Sent" : "❌ Failed");
        
        if (notificationResults.patientEmail.error) {
          console.log("Patient email error:", notificationResults.patientEmail.error);
        }
        if (notificationResults.doctorEmail.error) {
          console.log("Doctor email error:", notificationResults.doctorEmail.error);
        }
        if (notificationResults.patientSMS.error) {
          console.log("Patient SMS error:", notificationResults.patientSMS.error);
        }
      } catch (notificationErr) {
        console.error("❌ Failed to send appointment notifications:", notificationErr);
      }
    }
    // --- Notification block END ---

    // Protocol: respond with context and status
    res.json({
      protocol: "book-appointment",
      context: { ...context, status: "booked" },
      message: "Appointment booked!"
    });
  } catch (err) {
    console.error("Failed to book appointment:", err);
    res.status(500).json({
      protocol: "book-appointment",
      context: { ...context, status: "error" },
      error: "Failed to book appointment"
    });
  }

});

module.exports = router;