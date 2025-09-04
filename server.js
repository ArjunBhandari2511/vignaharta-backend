const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');
require('dotenv').config({ path: './config.env' });

// Connect to MongoDB
connectDB();

const uploadRoutes = require('./routes/upload');
const whatsappRoutes = require('./routes/whatsapp');
const companyRoutes = require('./routes/company');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/upload', uploadRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/company', companyRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vignaharta Billing Backend is running',
    timestamp: new Date().toISOString(),
    services: {
      upload: '/upload',
      whatsapp: '/whatsapp',
      company: '/company'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found' 
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Upload service: http://localhost:${PORT}/upload`);
  console.log(`WhatsApp service: http://localhost:${PORT}/whatsapp`);
  console.log(`Company service: http://localhost:${PORT}/company`);
});
