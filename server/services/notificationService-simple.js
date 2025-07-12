const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    console.log('⚠️ NotificationService: Email and SMS disabled for testing');
  }

  async sendPrescriptionEmail(patientData, prescriptionData, doctorData) {
    console.log('⚠️ Email notification disabled');
    return { success: false, error: 'Email not configured' };
  }

  async sendPrescriptionSMS(patientData, prescriptionData, doctorData) {
    console.log('⚠️ SMS notification disabled');
    return { success: false, error: 'SMS not configured' };
  }

  async sendPrescriptionNotifications(patientData, prescriptionData, doctorData) {
    const results = {
      email: await this.sendPrescriptionEmail(patientData, prescriptionData, doctorData),
      sms: await this.sendPrescriptionSMS(patientData, prescriptionData, doctorData)
    };
    return results;
  }

  async sendAppointmentReminderEmail(patientData, appointmentData, doctorData) {
    console.log('⚠️ Appointment email disabled');
    return { success: false, error: 'Email not configured' };
  }

  async sendAppointmentReminderSMS(patientData, appointmentData, doctorData) {
    console.log('⚠️ Appointment SMS disabled');
    return { success: false, error: 'SMS not configured' };
  }
}

module.exports = NotificationService;
