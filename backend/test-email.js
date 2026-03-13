require('dotenv').config();
const { sendOTPEmail } = require('./src/services/email.service');

async function test() {
  console.log('Testing email with these settings:');
  console.log('HOST:', process.env.EMAIL_HOST);
  console.log('PORT:', process.env.EMAIL_PORT);
  console.log('USER:', process.env.EMAIL_USER);
  console.log('PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');
  console.log('');
  
  console.log('Sending test email...');
  
  const result = await sendOTPEmail(
    'priyanshuprincegupta1@gmail.com',
    '123456',
    'Test User'
  );
  
  console.log('Result:', result);
}

test();