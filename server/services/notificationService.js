const nodemailer = require('nodemailer');
const twilio = require('twilio');

class NotificationService {
  constructor() {
    // Email configuration (Gmail SMTP)
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASSWORD // Your Gmail app password
      }
    });

    // SMS configuration (Twilio) - Only initialize if credentials are provided
    this.twilioClient = null;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken && accountSid.startsWith('AC')) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
        console.log('✅ NotificationService: Twilio SMS initialized');
      } catch (error) {
        console.log('⚠️ NotificationService: Twilio initialization failed:', error.message);
      }
    } else {
      console.log('⚠️ NotificationService: Twilio credentials not configured');
    }
  }

  // Send prescription notification email
  async sendPrescriptionEmail(patientData, prescriptionData, doctorData) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: patientData.email,
        subject: 'New Prescription from HealthConnect',
        text: this.generatePrescriptionEmailHTML(patientData, prescriptionData, doctorData)
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Prescription email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending prescription email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send prescription notification SMS
  async sendPrescriptionSMS(patientData, prescriptionData, doctorData) {
    try {
      const message = this.generatePrescriptionSMSText(patientData, prescriptionData, doctorData);
      
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: patientData.phone
      });

      console.log('Prescription SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Error sending prescription SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // Send both email and SMS notifications
  async sendPrescriptionNotifications(patientData, prescriptionData, doctorData) {
    const results = {
      email: { success: false },
      sms: { success: false }
    };

    // Send email if patient has email
    if (patientData.email) {
      results.email = await this.sendPrescriptionEmail(patientData, prescriptionData, doctorData);
    }

    // Send SMS if patient has phone number
    if (patientData.phone) {
      results.sms = await this.sendPrescriptionSMS(patientData, prescriptionData, doctorData);
    }

    return results;
  }

  // Generate simple text email for prescription
  generatePrescriptionEmailHTML(patient, prescription, doctor) {
    return `
PRESCRIPTION NOTIFICATION

Dear ${patient.name},

Dr. ${doctor.name} has issued you a new prescription.

PRESCRIPTION DETAILS:
Date: ${new Date(prescription.date).toLocaleDateString()}
Doctor: Dr. ${doctor.name} (${doctor.specialization})
Patient: ${patient.name}

PRESCRIBED MEDICINES:
${prescription.medicines.map(medicine => `
${medicine.name}
- Dosage: ${medicine.dosage}
- Frequency: ${medicine.frequency}
- Duration: ${medicine.duration}${medicine.instructions ? `\n- Instructions: ${medicine.instructions}` : ''}
`).join('\n')}

IMPORTANT INSTRUCTIONS:
- Take medicines exactly as prescribed
- Complete the full course even if you feel better
- Contact your doctor if you experience any side effects
- Keep medicines in a cool, dry place
- Do not share medicines with others

If you have any questions about your prescription, please contact Dr. ${doctor.name}.

HealthConnect
This is an automated message.
    `;
  }

  // Generate SMS text for prescription
  generatePrescriptionSMSText(patient, prescription, doctor) {
    const medicineList = prescription.medicines.map(med => 
      `${med.name} - ${med.dosage} for ${med.duration}`
    ).join(', ');

    return `🏥 HealthConnect - New Prescription

Hi ${patient.name}!

Dr. ${doctor.name} (${doctor.specialization}) has prescribed:

${medicineList}

${prescription.medicines[0].instructions ? `Instructions: ${prescription.medicines[0].instructions}` : 'Follow doctor\'s instructions'}

📧 Check your email for detailed information.
💊 Take medicines as prescribed.

HealthConnect Team`.trim();
  }

  // Send appointment reminder email
  async sendAppointmentReminderEmail(patientData, appointmentData, doctorData) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: patientData.email,
        subject: '📅 Appointment Reminder - HealthConnect',
        html: this.generateAppointmentReminderHTML(patientData, appointmentData, doctorData)
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Appointment reminder email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      return { success: false, error: error.message };
    }
  }

  // Send appointment reminder SMS
  async sendAppointmentReminderSMS(patientData, appointmentData, doctorData) {
    try {
      const message = `
🏥 HealthConnect Reminder

Hi ${patientData.name}! 
Your appointment with Dr. ${doctorData.name} is tomorrow at ${appointmentData.time} on ${new Date(appointmentData.date).toLocaleDateString()}.

Please be on time. Call if you need to reschedule.

- HealthConnect Team
      `.trim();

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: patientData.phone
      });

      console.log('Appointment reminder SMS sent:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Error sending appointment reminder SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate appointment reminder email HTML
  generateAppointmentReminderHTML(patient, appointment, doctor) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .appointment-box { border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #f8fafc; }
        .footer { background-color: #2d3748; color: white; padding: 20px; text-align: center; }
        .btn { display: inline-block; background-color: #48bb78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 HealthConnect</h1>
          <h2>Appointment Reminder</h2>
        </div>
        
        <div class="content">
          <h3>Dear ${patient.name},</h3>
          <p>This is a friendly reminder about your upcoming appointment.</p>
          
          <div class="appointment-box">
            <h4>📅 Appointment Details</h4>
            <p><strong>Doctor:</strong> Dr. ${doctor.name} (${doctor.specialization})</p>
            <p><strong>Date:</strong> ${new Date(appointment.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointment.time}</p>
            <p><strong>Type:</strong> ${appointment.type || 'Consultation'}</p>
          </div>
          
          <p>Please arrive 10 minutes early and bring any relevant medical documents.</p>
          
          <a href="${process.env.APP_URL}/video-call" class="btn">Join Video Call</a>
        </div>
        
        <div class="footer">
          <p>HealthConnect - Your Digital Healthcare Partner</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  // Send appointment confirmation notifications (both SMS and email)
  async sendAppointmentConfirmation(patientData, appointmentData, doctorData) {
    const results = {
      patientEmail: { success: false, messageId: null, error: null },
      doctorEmail: { success: false, messageId: null, error: null },
      patientSMS: { success: false, sid: null, error: null }
    };

    // Send confirmation email to patient
    try {
      const patientEmailResult = await this.sendAppointmentConfirmationEmail(patientData, appointmentData, doctorData);
      results.patientEmail = patientEmailResult;
    } catch (error) {
      results.patientEmail.error = error.message;
      console.error('Patient appointment confirmation email failed:', error);
    }

    // Send notification email to doctor  
    try {
      const doctorEmailResult = await this.sendAppointmentConfirmationEmailToDoctor(patientData, appointmentData, doctorData);
      results.doctorEmail = doctorEmailResult;
    } catch (error) {
      results.doctorEmail.error = error.message;
      console.error('Doctor appointment notification email failed:', error);
    }

    // Send confirmation SMS to patient
    try {
      const smsResult = await this.sendAppointmentConfirmationSMS(patientData, appointmentData, doctorData);
      results.patientSMS = smsResult;
    } catch (error) {
      results.patientSMS.error = error.message;
      console.error('Appointment confirmation SMS failed:', error);
    }

    return results;
  }

  // Send appointment confirmation email
  async sendAppointmentConfirmationEmail(patientData, appointmentData, doctorData) {
    try {
      // Simple email format as requested
      const emailContent = `Dear ${patientData.full_name},

Your appointment with Dr. ${doctorData.full_name} is confirmed for ${appointmentData.appointment_time}.

Thank you!`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: patientData.email,
        subject: 'Appointment Confirmed',
        text: emailContent
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Appointment confirmation email sent to patient:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending appointment confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send appointment confirmation email to doctor
  async sendAppointmentConfirmationEmailToDoctor(patientData, appointmentData, doctorData) {
    try {
      const emailContent = `Dear Dr. ${doctorData.full_name},

You have a new appointment scheduled with patient ${patientData.full_name} for ${appointmentData.appointment_time}.

Thank you!`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: doctorData.email,
        subject: 'New Appointment Scheduled',
        text: emailContent
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Appointment notification email sent to doctor:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending appointment notification email to doctor:', error);
      return { success: false, error: error.message };
    }
  }

  // Send appointment confirmation SMS
  async sendAppointmentConfirmationSMS(patientData, appointmentData, doctorData) {
    if (!this.twilioClient) {
      console.log('⚠️ Twilio not configured - SMS not sent');
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      // Ensure phone is in E.164 format
      let phone = patientData.phone;
      if (!phone.startsWith("+")) {
        phone = "+91" + phone.replace(/^0+/, "");
      }

      console.log(`📱 Attempting to send SMS to: ${phone}`);

      const message = `🎉 Appointment Confirmed!

Dear ${patientData.full_name},
Your appointment with Dr. ${doctorData.full_name} is confirmed for ${appointmentData.appointment_time}.

Hospital: ${doctorData.hospital || 'HealthConnect Clinic'}
Specialization: ${doctorData.specialization || 'General'}

Please arrive 15 minutes early. Thank you!
- HealthConnect Team`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      console.log('✅ SMS sent successfully!');
      console.log('   SID:', result.sid);
      console.log('   Status:', result.status);
      console.log('   To:', result.to);
      console.log('   Price:', result.price || 'N/A');
      
      // Check for any errors
      if (result.errorCode) {
        console.log('⚠️ SMS Error Code:', result.errorCode);
        console.log('⚠️ SMS Error Message:', result.errorMessage);
      }
      
      return { success: true, sid: result.sid, status: result.status };
    } catch (error) {
      console.error('❌ Error sending appointment confirmation SMS:', error);
      
      // Provide specific error messages for common issues
      if (error.code === 21211) {
        console.error('📞 Phone number not verified! For Twilio trial accounts:');
        console.error('   1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        console.error('   2. Click "Add a new number"');
        console.error(`   3. Add and verify: ${phone}`);
        return { success: false, error: 'Phone number not verified in Twilio trial account' };
      } else if (error.code === 21614) {
        console.error('📞 Invalid phone number format');
        return { success: false, error: 'Invalid phone number format' };
      }
      
      return { success: false, error: error.message, code: error.code };
    }
  }

  // Generate appointment confirmation email HTML
  generateAppointmentConfirmationHTML(patient, appointment, doctor) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin: 20px 0; }
        .appointment-box { border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #f0fdf4; }
        .details { margin: 15px 0; }
        .label { font-weight: bold; color: #374151; }
        .value { color: #10b981; font-weight: 600; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Appointment Confirmed!</h1>
          <p>Your healthcare appointment has been successfully scheduled</p>
        </div>
        
        <div class="content">
          <div class="success-icon">✅</div>
          
          <p>Dear <strong>${patient.full_name}</strong>,</p>
          <p>Your appointment has been successfully confirmed. Here are the details:</p>
          
          <div class="appointment-box">
            <h3>📅 Appointment Details</h3>
            <div class="details">
              <span class="label">Date & Time:</span>
              <span class="value">${new Date(appointment.appointment_time).toLocaleString()}</span>
            </div>
            <div class="details">
              <span class="label">Doctor:</span>
              <span class="value">Dr. ${doctor.full_name}</span>
            </div>
            <div class="details">
              <span class="label">Specialization:</span>
              <span class="value">${doctor.specialization || 'General Medicine'}</span>
            </div>
            <div class="details">
              <span class="label">Hospital/Clinic:</span>
              <span class="value">${doctor.hospital || 'HealthConnect Clinic'}</span>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4>📝 Important Reminders:</h4>
            <ul>
              <li>Please arrive 15 minutes before your appointment time</li>
              <li>Bring your ID and any relevant medical documents</li>
              <li>If you need to reschedule, please contact us at least 24 hours in advance</li>
            </ul>
          </div>
          
          <p>We look forward to seeing you!</p>
        </div>
        
        <div class="footer">
          <p>HealthConnect - Your Digital Healthcare Partner</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

module.exports = NotificationService;
