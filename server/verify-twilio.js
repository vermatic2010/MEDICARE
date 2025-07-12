const twilio = require('twilio');
require('dotenv').config();

async function verifyTwilioCredentials() {
  console.log('🔍 Twilio Credential Verification');
  console.log('=================================');
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  
  console.log('📋 Current Credentials:');
  console.log(`Account SID: ${accountSid || 'NOT SET'}`);
  console.log(`Auth Token: ${authToken ? authToken.substring(0, 8) + '...' : 'NOT SET'}`);
  console.log(`Phone Number: ${fromNumber || 'NOT SET'}`);
  console.log('');
  
  if (!accountSid || !authToken) {
    console.log('❌ Missing credentials in .env file');
    return;
  }
  
  try {
    console.log('🔗 Testing Twilio authentication...');
    const client = twilio(accountSid, authToken);
    
    // Test by fetching account info
    const account = await client.api.accounts(accountSid).fetch();
    
    console.log('✅ Authentication successful!');
    console.log(`Account Status: ${account.status}`);
    console.log(`Account Type: ${account.type}`);
    console.log(`Date Created: ${account.dateCreated}`);
    
    // Test phone number validity
    if (fromNumber) {
      try {
        const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
        const matchingNumber = phoneNumbers.find(num => num.phoneNumber === fromNumber);
        
        if (matchingNumber) {
          console.log('✅ Phone number is valid and owned by this account');
        } else {
          console.log('⚠️ Phone number not found in your Twilio account');
          console.log('Available numbers:');
          phoneNumbers.forEach(num => console.log(`  - ${num.phoneNumber}`));
        }
      } catch (phoneError) {
        console.log('⚠️ Could not verify phone number:', phoneError.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Authentication failed!');
    console.log(`Error: ${error.message}`);
    
    if (error.code === 20003) {
      console.log('');
      console.log('💡 Error 20003 means:');
      console.log('   - Invalid username (Account SID) OR');
      console.log('   - Invalid password (Auth Token)');
      console.log('   - The Account SID and Auth Token don\'t match');
      console.log('');
      console.log('🔧 To fix:');
      console.log('   1. Go to https://console.twilio.com/');
      console.log('   2. Find your Account SID and Auth Token');
      console.log('   3. Make sure they are from the same account');
      console.log('   4. Update server\\.env with matching credentials');
    }
  }
}

verifyTwilioCredentials();
