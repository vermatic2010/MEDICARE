const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize Twilio if credentials are provided
let client = null;
if (accountSid && authToken) {
  if (accountSid.startsWith('AC')) {
    try {
      client = twilio(accountSid, authToken);
      console.log('✅ Twilio SMS service initialized');
    } catch (error) {
      console.log('⚠️ Twilio initialization failed:', error.message);
    }
  } else if (accountSid.startsWith('MG')) {
    console.log('⚠️ Invalid Twilio Account SID format detected:');
    console.log('   You provided a Messaging Service SID (starts with MG)');
    console.log('   Please use your main Account SID (starts with AC)');
    console.log('   Find it in Twilio Console > Account Dashboard');
  } else {
    console.log('⚠️ Invalid Twilio Account SID format - must start with AC');
  }
} else {
  console.log('⚠️ Twilio credentials not configured - SMS notifications disabled');
}

async function sendSMS({ to, message }) {
  if (!client) {
    console.log('⚠️ SMS not sent - Twilio not configured');
    return { success: false, error: 'Twilio not configured' };
  }
  
  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendSMS };