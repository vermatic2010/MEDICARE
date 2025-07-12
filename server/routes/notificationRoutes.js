const express = require('express');
const router = express.Router();
// const NotificationService = require('../services/notificationService');

// const notificationService = new NotificationService();

// Temporary placeholder for notifications
const notificationService = {
  sendPrescriptionNotifications: async () => {
    console.log('⚠️ Prescription notifications disabled');
    return { email: { success: false }, sms: { success: false } };
  },
  sendAppointmentReminderEmail: async () => {
    console.log('⚠️ Appointment email disabled');
    return { success: false };
  },
  sendAppointmentReminderSMS: async () => {
    console.log('⚠️ Appointment SMS disabled');
    return { success: false };
  }
};

// Send prescription notification to patient
router.post('/prescription', async (req, res) => {
  try {
    const { patientId, prescriptionData, doctorId } = req.body;

    // Validate required fields
    if (!patientId || !prescriptionData || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientId, prescriptionData, doctorId'
      });
    }

    // In a real application, you would fetch this data from your database
    // For now, we'll use the provided data or mock data
    const patientData = {
      id: patientId,
      name: prescriptionData.patientName || 'Patient',
      email: prescriptionData.patientEmail,
      phone: prescriptionData.patientPhone
    };

    const doctorData = {
      id: doctorId,
      name: prescriptionData.doctorName || 'Dr. Smith',
      specialization: prescriptionData.doctorSpecialization || 'General Medicine'
    };

    const prescription = {
      date: new Date(),
      medicines: prescriptionData.medicines || [],
      instructions: prescriptionData.instructions || ''
    };

    // Send notifications
    const results = await notificationService.sendPrescriptionNotifications(
      patientData,
      prescription,
      doctorData
    );

    res.json({
      success: true,
      message: 'Prescription notifications sent',
      results: results
    });

  } catch (error) {
    console.error('Error sending prescription notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send prescription notifications',
      error: error.message
    });
  }
});

// Send appointment reminder notifications
router.post('/appointment-reminder', async (req, res) => {
  try {
    const { patientId, appointmentData, doctorId } = req.body;

    if (!patientId || !appointmentData || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientId, appointmentData, doctorId'
      });
    }

    const patientData = {
      id: patientId,
      name: appointmentData.patientName || 'Patient',
      email: appointmentData.patientEmail,
      phone: appointmentData.patientPhone
    };

    const doctorData = {
      id: doctorId,
      name: appointmentData.doctorName || 'Dr. Smith',
      specialization: appointmentData.doctorSpecialization || 'General Medicine'
    };

    const appointment = {
      date: appointmentData.date,
      time: appointmentData.time,
      type: appointmentData.type || 'Consultation'
    };

    // Send email reminder
    const emailResult = await notificationService.sendAppointmentReminderEmail(
      patientData,
      appointment,
      doctorData
    );

    // Send SMS reminder
    const smsResult = await notificationService.sendAppointmentReminderSMS(
      patientData,
      appointment,
      doctorData
    );

    res.json({
      success: true,
      message: 'Appointment reminder notifications sent',
      results: {
        email: emailResult,
        sms: smsResult
      }
    });

  } catch (error) {
    console.error('Error sending appointment reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send appointment reminders',
      error: error.message
    });
  }
});

// Test notification endpoint
router.post('/test', async (req, res) => {
  try {
    const { type, email, phone } = req.body;

    const testPatient = {
      name: 'John Doe',
      email: email || 'test@example.com',
      phone: phone || '+1234567890'
    };

    const testDoctor = {
      name: 'Dr. Sarah Johnson',
      specialization: 'Cardiology'
    };

    if (type === 'prescription') {
      const testPrescription = {
        date: new Date(),
        medicines: [
          {
            name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '30 days',
            instructions: 'Take with food'
          },
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '30 days',
            instructions: 'Take with meals'
          }
        ]
      };

      const results = await notificationService.sendPrescriptionNotifications(
        testPatient,
        testPrescription,
        testDoctor
      );

      res.json({
        success: true,
        message: 'Test prescription notifications sent',
        results: results
      });

    } else if (type === 'appointment') {
      const testAppointment = {
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        time: '10:00 AM',
        type: 'Follow-up Consultation'
      };

      const emailResult = await notificationService.sendAppointmentReminderEmail(
        testPatient,
        testAppointment,
        testDoctor
      );

      const smsResult = await notificationService.sendAppointmentReminderSMS(
        testPatient,
        testAppointment,
        testDoctor
      );

      res.json({
        success: true,
        message: 'Test appointment reminder sent',
        results: {
          email: emailResult,
          sms: smsResult
        }
      });

    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid test type. Use "prescription" or "appointment"'
      });
    }

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = router;
