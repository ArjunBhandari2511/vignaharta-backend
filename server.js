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
const itemRoutes = require('./routes/item');
const partyRoutes = require('./routes/party');
const saleRoutes = require('./routes/sale');
const purchaseRoutes = require('./routes/purchase');
const Item = require('./models/Item');

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
app.use('/api/items', itemRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vignaharta Billing Backend is running',
    timestamp: new Date().toISOString(),
    services: {
      upload: '/upload',
      whatsapp: '/whatsapp',
      company: '/company',
      items: '/api/items',
      parties: '/api/parties',
      sales: '/api/sales',
      purchases: '/api/purchases'
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

// Initialize Bardana universal item on server startup
async function initializeBardana() {
  try {
    // Check if Bardana already exists
    const existingBardana = await Item.findOne({ 
      isUniversal: true, 
      productName: 'Bardana' 
    });
    
    if (!existingBardana) {
      // Create Bardana universal item
      const bardanaItem = new Item({
        productName: 'Bardana',
        category: 'Primary',
        purchasePrice: 0,
        salePrice: 0,
        openingStock: 0,
        asOfDate: new Date().toISOString().split('T')[0],
        lowStockAlert: 10,
        isUniversal: true
      });
      
      await bardanaItem.save();
      console.log('✅ Bardana universal item initialized successfully');
    } else {
      console.log('✅ Bardana universal item already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing Bardana:', error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Upload service: http://localhost:${PORT}/upload`);
  console.log(`WhatsApp service: http://localhost:${PORT}/whatsapp`);
  console.log(`Company service: http://localhost:${PORT}/company`);
  console.log(`Items service: http://localhost:${PORT}/api/items`);
  console.log(`Parties service: http://localhost:${PORT}/api/parties`);
  console.log(`Sales service: http://localhost:${PORT}/api/sales`);
  console.log(`Purchases service: http://localhost:${PORT}/api/purchases`);
  
  // Initialize Bardana after server starts
  await initializeBardana();
});
