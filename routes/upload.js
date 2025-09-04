const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CloudinaryService = require('../utils/cloudinary');
const { validateUploadRequest } = require('../middleware/validation');
require('dotenv').config({ path: '../config.env' });

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Upload PDF to Cloudinary or store locally
router.post('/', upload.single('file'), validateUploadRequest, async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileName = path.parse(req.file.originalname).name;

    // Check if Cloudinary is configured
    if (CloudinaryService.isConfigured()) {
      // Upload to Cloudinary
      const result = await CloudinaryService.uploadPdf(filePath, fileName, 'invoices');

      // Clean up local file
      fs.unlinkSync(filePath);

      if (result.success) {
        res.json({
          success: true,
          url: result.url,
          public_id: result.public_id,
          message: 'File uploaded successfully to Cloudinary'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to upload file to Cloudinary'
        });
      }
    } else {
      // Fallback: Store locally and return local URL
      const localUrl = `${req.protocol}://${req.get('host')}/uploads/${path.basename(filePath)}`;
      
      res.json({
        success: true,
        url: localUrl,
        message: 'File stored locally (Cloudinary not configured)',
        local: true
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up local file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

// Get upload status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Upload service is running',
    cloudinary: CloudinaryService.getConfigInfo(),
    uploads: {
      max_file_size: process.env.MAX_FILE_SIZE || '10MB',
      allowed_types: ['application/pdf']
    }
  });
});

module.exports = router;
