const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Party = require('../models/Party');

// GET /api/payments - Get all payments with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      type, 
      status, 
      partyName, 
      phoneNumber, 
      date, 
      search,
      startDate,
      endDate,
      paymentMethod
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (partyName) {
      filter.partyName = { $regex: partyName, $options: 'i' };
    }
    
    if (phoneNumber) {
      filter.phoneNumber = phoneNumber;
    }
    
    if (date) {
      filter.date = date;
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    }
    
    if (search) {
      filter.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { paymentNo: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const payments = await Payment.find(filter)
      .populate('partyId', 'name phoneNumber balance')
      .sort({ createdAt: -1 });
    
    // Transform _id to id for frontend compatibility
    const transformedPayments = payments.map(payment => ({
      ...payment.toObject(),
      id: payment._id.toString(),
      _id: undefined // Remove _id to avoid confusion
    }));
    
    res.json({
      success: true,
      data: transformedPayments,
      count: transformedPayments.length
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

// GET /api/payments/summary - Get payment summary
router.get('/summary', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    
    const summary = await Payment.getPaymentSummary(type, startDate, endDate);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment summary'
    });
  }
});

// GET /api/payments/:id - Get single payment by ID
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('partyId', 'name phoneNumber balance');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      data: payment.getFormattedDetails()
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
});

// POST /api/payments - Create new payment
router.post('/', async (req, res) => {
  try {
    const { 
      type = 'payment-in',
      partyName, 
      phoneNumber, 
      amount,
      totalAmount,
      date, 
      status = 'completed',
      description,
      paymentMethod = 'cash',
      reference
    } = req.body;
    
    // Validate required fields
    if (!partyName || !phoneNumber || !amount || !date) {
      return res.status(400).json({
        success: false,
        error: 'Party name, phone number, amount, and date are required'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }
    
    // Generate payment number
    const paymentNo = await Payment.generateNextPaymentNumber(type);
    
    // Find or create party
    const party = await Party.findOrCreate({
      name: partyName,
      phoneNumber: phoneNumber
    });
    
    // Create payment
    const payment = new Payment({
      paymentNo,
      type,
      partyName,
      phoneNumber,
      amount,
      totalAmount: totalAmount || amount,
      date,
      status,
      description,
      paymentMethod,
      reference,
      partyId: party._id
    });
    
    await payment.save();
    
    // Update party balance
    await Payment.updatePartyBalance(payment);
    
    res.status(201).json({
      success: true,
      data: payment.getFormattedDetails(),
      message: 'Payment created successfully'
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

// PUT /api/payments/:id - Update payment
router.put('/:id', async (req, res) => {
  try {
    const { 
      partyName, 
      phoneNumber, 
      amount,
      totalAmount,
      date, 
      status, 
      description,
      paymentMethod,
      reference
    } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Store original values for rollback
    const originalAmount = payment.amount;
    const originalPartyId = payment.partyId;
    
    // Update fields
    if (partyName) payment.partyName = partyName;
    if (phoneNumber) payment.phoneNumber = phoneNumber;
    if (amount !== undefined) payment.amount = amount;
    if (totalAmount !== undefined) payment.totalAmount = totalAmount;
    if (date) payment.date = date;
    if (status) payment.status = status;
    if (description !== undefined) payment.description = description;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (reference !== undefined) payment.reference = reference;
    
    await payment.save();
    
    // Update party balance if amount changed
    if (originalAmount !== payment.amount && payment.partyId) {
      // First, reverse the original payment
      const reverseOperation = payment.type === 'payment-in' ? 'add' : 'add';
      await Party.updateBalance(originalPartyId, originalAmount, reverseOperation);
      
      // Then apply the new payment
      await Payment.updatePartyBalance(payment);
    }
    
    res.json({
      success: true,
      data: payment.getFormattedDetails(),
      message: 'Payment updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update payment'
    });
  }
});

// PATCH /api/payments/:id/status - Update payment status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (pending, completed, cancelled)'
      });
    }
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    const originalStatus = payment.status;
    payment.status = status;
    await payment.save();
    
    // If status changed from completed to cancelled or vice versa, update party balance
    if ((originalStatus === 'completed' && status === 'cancelled') ||
        (originalStatus === 'cancelled' && status === 'completed')) {
      await Payment.updatePartyBalance(payment);
    }
    
    res.json({
      success: true,
      data: payment.getFormattedDetails(),
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});

// DELETE /api/payments/:id - Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Reverse the party balance update
    if (payment.partyId && payment.status === 'completed') {
      const reverseOperation = payment.type === 'payment-in' ? 'add' : 'add';
      await Party.updateBalance(payment.partyId, payment.amount, reverseOperation);
    }
    
    await Payment.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment'
    });
  }
});

// GET /api/payments/party/:partyName - Get payments by party name
router.get('/party/:partyName', async (req, res) => {
  try {
    const { partyName } = req.params;
    const { phoneNumber, type } = req.query;
    
    const payments = await Payment.getPaymentsByParty(partyName, phoneNumber, type);
    
    res.json({
      success: true,
      data: payments,
      count: payments.length
    });
  } catch (error) {
    console.error('Error fetching payments by party:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments by party'
    });
  }
});

// GET /api/payments/date-range - Get payments by date range
router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const payments = await Payment.getPaymentsByDateRange(startDate, endDate, type);
    
    res.json({
      success: true,
      data: payments,
      count: payments.length
    });
  } catch (error) {
    console.error('Error fetching payments by date range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments by date range'
    });
  }
});

// GET /api/payments/type/:type - Get payments by type (payment-in or payment-out)
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { status, partyName, phoneNumber, date, search } = req.query;
    
    if (!['payment-in', 'payment-out'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment type. Must be payment-in or payment-out'
      });
    }
    
    // Build filter object
    const filter = { type };
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (partyName) {
      filter.partyName = { $regex: partyName, $options: 'i' };
    }
    
    if (phoneNumber) {
      filter.phoneNumber = phoneNumber;
    }
    
    if (date) {
      filter.date = date;
    }
    
    if (search) {
      filter.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { paymentNo: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const payments = await Payment.find(filter)
      .populate('partyId', 'name phoneNumber balance')
      .sort({ createdAt: -1 });
    
    // Transform _id to id for frontend compatibility
    const transformedPayments = payments.map(payment => ({
      ...payment.toObject(),
      id: payment._id.toString(),
      _id: undefined // Remove _id to avoid confusion
    }));
    
    res.json({
      success: true,
      data: transformedPayments,
      count: transformedPayments.length
    });
  } catch (error) {
    console.error('Error fetching payments by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments by type'
    });
  }
});

module.exports = router;
