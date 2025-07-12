#!/usr/bin/env node

/**
 * Healthcare Bot MCP Server
 * Implements Model Context Protocol for healthcare appointment booking and management
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Database connection
const db = mysql.createPool({
  host: "localhost",
  user: "root", 
  password: "1234",
  database: "medicare",
});

// Initialize MCP Server
const server = new Server(
  {
    name: "healthcare-bot-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Helper functions
async function generateSlotsFromTimes(start, end) {
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

async function sendNotifications(patientId, doctorId, appointmentTime) {
  try {
    // Fetch patient and doctor info
    const [patientRows] = await db.query(
      "SELECT full_name, phone, email FROM patients WHERE id = ?",
      [patientId]
    );
    const [doctorRows] = await db.query(
      "SELECT full_name, email FROM doctors WHERE id = ?",
      [doctorId]
    );
    
    const patient = patientRows[0];
    const doctor = doctorRows[0];

    if (!patient || !doctor) return false;

    // Email notification setup
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: 'vermatic2010@gmail.com',
        pass: 'dhqq cxmp lmpk uqat'
      }
    });

    // Send patient email
    if (patient.email) {
      const mailOptionsPatient = {
        from: 'vermatic2010@gmail.com',
        to: patient.email,
        subject: 'Appointment Confirmation',
        text: `Dear ${patient.full_name},\n\nYour appointment with Dr. ${doctor.full_name} is confirmed for ${appointmentTime}.\n\nThank you!`
      };
      
      await transporter.sendMail(mailOptionsPatient);
    }

    // Send doctor email
    if (doctor.email) {
      const mailOptionsDoctor = {
        from: 'vermatic2010@gmail.com',
        to: doctor.email,
        subject: 'New Appointment Booked',
        text: `Dear Dr. ${doctor.full_name},\n\nYou have a new appointment with patient ${patient.full_name} scheduled for ${appointmentTime}.\n\nThank you!`
      };
      
      await transporter.sendMail(mailOptionsDoctor);
    }

    return true;
  } catch (error) {
    console.error('Notification error:', error);
    return false;
  }
}

// Define MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "book_appointment",
        description: "Book a medical appointment for a patient with a doctor",
        inputSchema: {
          type: "object",
          properties: {
            patient_id: {
              type: "number",
              description: "ID of the patient booking the appointment"
            },
            doctor_id: {
              type: "number", 
              description: "ID of the doctor for the appointment"
            },
            appointment_time: {
              type: "string",
              description: "Appointment date and time in YYYY-MM-DD HH:MM:SS format"
            },
            notes: {
              type: "string",
              description: "Optional notes for the appointment"
            }
          },
          required: ["patient_id", "doctor_id", "appointment_time"]
        }
      },
      {
        name: "get_available_doctors",
        description: "Get list of available doctors with their specializations and availability",
        inputSchema: {
          type: "object",
          properties: {
            specialization: {
              type: "string",
              description: "Optional filter by doctor specialization"
            },
            date: {
              type: "string", 
              description: "Optional date filter in YYYY-MM-DD format"
            }
          },
          required: []
        }
      },
      {
        name: "get_doctor_appointments",
        description: "Get all appointments for a specific doctor",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: {
              type: "number",
              description: "ID of the doctor"
            },
            date: {
              type: "string",
              description: "Optional date filter in YYYY-MM-DD format"
            }
          },
          required: ["doctor_id"]
        }
      },
      {
        name: "get_patient_appointments", 
        description: "Get all appointments for a specific patient",
        inputSchema: {
          type: "object",
          properties: {
            patient_id: {
              type: "number",
              description: "ID of the patient"
            }
          },
          required: ["patient_id"]
        }
      },
      {
        name: "authenticate_user",
        description: "Authenticate a user (patient or doctor) with username and password",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username for authentication"
            },
            password: {
              type: "string", 
              description: "Password for authentication"
            },
            role: {
              type: "string",
              enum: ["patient", "doctor"],
              description: "User role - either patient or doctor"
            }
          },
          required: ["username", "password", "role"]
        }
      },
      {
        name: "register_user",
        description: "Register a new user (patient or doctor)",
        inputSchema: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["patient", "doctor"],
              description: "User role - either patient or doctor"
            },
            username: {
              type: "string",
              description: "Unique username"
            },
            email: {
              type: "string",
              description: "Email address"
            },
            phone: {
              type: "string",
              description: "Phone number"
            },
            password: {
              type: "string",
              description: "Password"
            },
            full_name: {
              type: "string",
              description: "Full name"
            },
            dob: {
              type: "string",
              description: "Date of birth (for patients)"
            },
            gender: {
              type: "string",
              description: "Gender (for patients)"
            },
            specialization: {
              type: "string",
              description: "Medical specialization (for doctors)"
            },
            license: {
              type: "string", 
              description: "Medical license number (for doctors)"
            },
            experience: {
              type: "number",
              description: "Years of experience (for doctors)"
            },
            hospital: {
              type: "string",
              description: "Hospital affiliation (for doctors)"
            },
            availability: {
              type: "array",
              description: "Doctor availability schedule (for doctors)",
              items: {
                type: "object",
                properties: {
                  day: {
                    type: "string",
                    description: "Day of the week"
                  },
                  start: {
                    type: "string", 
                    description: "Start time in HH:MM format"
                  },
                  end: {
                    type: "string",
                    description: "End time in HH:MM format"
                  },
                  enabled: {
                    type: "boolean",
                    description: "Whether this availability slot is enabled"
                  }
                }
              }
            }
          },
          required: ["role", "username", "email", "phone", "password", "full_name"]
        }
      },
      {
        name: "check_slot_availability",
        description: "Check if a specific appointment slot is available for a doctor",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: {
              type: "number",
              description: "ID of the doctor"
            },
            appointment_time: {
              type: "string",
              description: "Requested appointment time in YYYY-MM-DD HH:MM:SS format"
            }
          },
          required: ["doctor_id", "appointment_time"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "book_appointment":
        return await handleBookAppointment(args);
      case "get_available_doctors":
        return await handleGetAvailableDoctors(args);
      case "get_doctor_appointments":
        return await handleGetDoctorAppointments(args);
      case "get_patient_appointments":
        return await handleGetPatientAppointments(args);
      case "authenticate_user":
        return await handleAuthenticateUser(args);
      case "register_user":
        return await handleRegisterUser(args);
      case "check_slot_availability":
        return await handleCheckSlotAvailability(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Tool implementations
async function handleBookAppointment(args) {
  const { patient_id, doctor_id, appointment_time, notes = "" } = args;

  // Check for slot conflict
  const [existing] = await db.query(
    "SELECT * FROM appointments WHERE doctor_id=? AND appointment_time=?",
    [doctor_id, appointment_time]
  );
  
  if (existing.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "Doctor is not available at this slot",
            status: "conflict"
          })
        }
      ]
    };
  }

  // Book the appointment
  const [result] = await db.query(
    "INSERT INTO appointments (patient_id, doctor_id, appointment_time, status, notes) VALUES (?, ?, ?, 'scheduled', ?)",
    [patient_id, doctor_id, appointment_time, notes]
  );

  // Send notifications
  await sendNotifications(patient_id, doctor_id, appointment_time);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          appointment_id: result.insertId,
          status: "booked",
          message: "Appointment successfully booked!",
          appointment_time,
          notifications_sent: true
        })
      }
    ]
  };
}

async function handleGetAvailableDoctors(args) {
  const { specialization, date } = args;
  
  let query = "SELECT id, full_name, specialization, email, phone FROM doctors";
  let params = [];
  
  if (specialization) {
    query += " WHERE specialization LIKE ?";
    params.push(`%${specialization}%`);
  }
  
  const [doctors] = await db.query(query, params);
  
  const result = [];
  for (const doc of doctors) {
    // Get availability for each doctor
    const [availRows] = await db.query(
      "SELECT day_of_week, start_time, end_time FROM doctor_availability WHERE doctor_id=?",
      [doc.id]
    );
    
    let slotsByDay = {};
    for (const avail of availRows) {
      const slots = await generateSlotsFromTimes(avail.start_time, avail.end_time);
      slotsByDay[avail.day_of_week] = slots.map(time => ({ time, booked: false }));
    }
    
    result.push({ ...doc, availability: slotsByDay });
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          doctors: result,
          count: result.length
        })
      }
    ]
  };
}

async function handleGetDoctorAppointments(args) {
  const { doctor_id, date } = args;
  
  let query = `
    SELECT a.id, a.appointment_time, a.status, a.notes,
           p.full_name AS patient_name, p.phone AS patient_phone, p.gender, p.dob
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.doctor_id = ?
  `;
  let params = [doctor_id];
  
  if (date) {
    query += " AND DATE(a.appointment_time) = ?";
    params.push(date);
  }
  
  query += " ORDER BY a.appointment_time ASC";
  const [appointments] = await db.query(query, params);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          appointments,
          count: appointments.length
        })
      }
    ]
  };
}

async function handleGetPatientAppointments(args) {
  const { patient_id } = args;
  
  const [appointments] = await db.query(
    `SELECT a.id, a.appointment_time, a.status, a.notes,
            d.full_name AS doctor_name, d.specialization
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.patient_id = ? AND a.appointment_time >= NOW()
     ORDER BY a.appointment_time ASC`,
    [patient_id]
  );
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          appointments,
          count: appointments.length
        })
      }
    ]
  };
}

async function handleAuthenticateUser(args) {
  const { username, password, role } = args;
  
  let user;
  if (role === "patient") {
    const [rows] = await db.query("SELECT * FROM patients WHERE username=?", [username]);
    user = rows[0];
  } else if (role === "doctor") {
    const [rows] = await db.query("SELECT * FROM doctors WHERE username=?", [username]);
    user = rows[0];
  } else {
    throw new Error("Invalid role");
  }
  
  if (!user) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "Invalid credentials"
          })
        }
      ]
    };
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "Invalid credentials"
          })
        }
      ]
    };
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role
          }
        })
      }
    ]
  };
}

async function handleRegisterUser(args) {
  const {
    role, username, email, phone, password, full_name,
    dob, gender, specialization, license, experience, hospital, availability
  } = args;
  
  // Check username uniqueness across both tables
  const [patientRows] = await db.query("SELECT id FROM patients WHERE username=?", [username]);
  const [doctorRows] = await db.query("SELECT id FROM doctors WHERE username=?", [username]);
  
  if (patientRows.length > 0 || doctorRows.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: "Username already exists. Please choose a different username."
          })
        }
      ]
    };
  }
  
  const password_hash = await bcrypt.hash(password, 10);
  
  if (role === "patient") {
    await db.query(
      "INSERT INTO patients (username, email, phone, password_hash, full_name, dob, gender) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, email, phone, password_hash, full_name, dob, gender]
    );
  } else if (role === "doctor") {
    const [result] = await db.query(
      "INSERT INTO doctors (username, email, phone, password_hash, full_name, specialization, license, experience, hospital) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [username, email, phone, password_hash, full_name, specialization, license, experience, hospital]
    );
    
    const doctorId = result.insertId;
    
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
    }
  } else {
    throw new Error("Invalid role");
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          message: "User registered successfully!"
        })
      }
    ]
  };
}

async function handleCheckSlotAvailability(args) {
  const { doctor_id, appointment_time } = args;
  
  // Check if slot is already booked
  const [existing] = await db.query(
    "SELECT * FROM appointments WHERE doctor_id=? AND appointment_time=?",
    [doctor_id, appointment_time]
  );
  
  const isAvailable = existing.length === 0;
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          available: isAvailable,
          doctor_id,
          appointment_time,
          message: isAvailable ? "Slot is available" : "Slot is already booked"
        })
      }
    ]
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Healthcare Bot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
