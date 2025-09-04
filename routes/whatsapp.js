const express = require('express');
const WhatsAppService = require('../utils/whatsapp');
const { 
  validateWhatsAppRequest, 
  validateDocumentRequest, 
  validateInvoiceRequest,
  validatePurchaseBillRequest 
} = require('../middleware/validation');
require('dotenv').config({ path: '../config.env' });

const router = express.Router();

// Send text message
router.post('/send-message', validateWhatsAppRequest, async (req, res) => {
  try {
    // Check if WhatsApp service is configured
    if (!WhatsAppService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service is not configured. Please check your environment variables.'
      });
    }

    const { to, text } = req.body;
    const result = await WhatsAppService.sendTextMessage(to, text);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('WhatsApp send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Send document
router.post('/send-document', validateDocumentRequest, async (req, res) => {
  try {
    // Check if WhatsApp service is configured
    if (!WhatsAppService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service is not configured. Please check your environment variables.'
      });
    }

    const { to, text, documentUrl, fileName } = req.body;
    const result = await WhatsAppService.sendDocument(to, text, documentUrl, fileName);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('WhatsApp send document error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Send invoice
router.post('/send-invoice', validateInvoiceRequest, async (req, res) => {
  try {
    // Check if WhatsApp service is configured
    if (!WhatsAppService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service is not configured. Please check your environment variables.'
      });
    }

    const { to, customerName, invoiceNo, totalAmount, date, documentUrl } = req.body;
    const result = await WhatsAppService.sendInvoice(
      to, 
      customerName, 
      invoiceNo, 
      totalAmount, 
      date, 
      documentUrl
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('WhatsApp send invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Send purchase bill
router.post('/send-purchase-bill', validatePurchaseBillRequest, async (req, res) => {
  try {
    // Check if WhatsApp service is configured
    if (!WhatsAppService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service is not configured. Please check your environment variables.'
      });
    }

    const { to, supplierName, billNo, totalAmount, date, documentUrl } = req.body;
    const result = await WhatsAppService.sendPurchaseBill(
      to, 
      supplierName, 
      billNo, 
      totalAmount, 
      date, 
      documentUrl
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('WhatsApp send purchase bill error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Get WhatsApp service status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp service is running',
    wasender: WhatsAppService.getConfigInfo(),
    endpoints: {
      'send-message': 'POST /whatsapp/send-message',
      'send-document': 'POST /whatsapp/send-document',
      'send-invoice': 'POST /whatsapp/send-invoice',
      'send-purchase-bill': 'POST /whatsapp/send-purchase-bill'
    }
  });
});

module.exports = router;
