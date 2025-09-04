const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './config.env' });

// Check if config file exists
const configPath = path.join(__dirname, 'config.env');
if (!fs.existsSync(configPath)) {
  console.error('❌ Configuration file not found: config.env');
  console.error('Please create config.env file with required environment variables');
  process.exit(1);
}

// Check required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 
  'CLOUDINARY_API_SECRET',
  'WASENDER_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease update your config.env file');
  process.exit(1);
}

// Check if uploads directory exists, create if not
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

console.log('✅ Environment configuration validated');
console.log('✅ Starting Vignaharta Billing Backend...\n');

// Start the server
require('./server');
