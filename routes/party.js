const express = require('express');
const router = express.Router();
const Party = require('../models/Party');

// GET /api/parties - Get all parties with optional filtering
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (type && type !== 'all') {
      filter.type = type;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const parties = await Party.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: parties,
      count: parties.length
    });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parties'
    });
  }
});

// GET /api/parties/:id - Get single party by ID
router.get('/:id', async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    
    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }
    
    res.json({
      success: true,
      data: party.getFormattedDetails()
    });
  } catch (error) {
    console.error('Error fetching party:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch party'
    });
  }
});

// POST /api/parties - Create new party
router.post('/', async (req, res) => {
  try {
    const { name, phoneNumber, type, address, email } = req.body;
    
    // Validate required fields
    if (!name || !phoneNumber || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name, phone number, and type are required'
      });
    }
    
    // Check if party already exists
    const existingParty = await Party.findOne({
      name: name,
      phoneNumber: phoneNumber
    });
    
    if (existingParty) {
      return res.status(409).json({
        success: false,
        error: 'Party with this name and phone number already exists'
      });
    }
    
    const party = new Party({
      name,
      phoneNumber,
      type,
      address,
      email,
      balance: 0
    });
    
    await party.save();
    
    res.status(201).json({
      success: true,
      data: party.getFormattedDetails(),
      message: 'Party created successfully'
    });
  } catch (error) {
    console.error('Error creating party:', error);
    
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
      error: 'Failed to create party'
    });
  }
});

// PUT /api/parties/:id - Update party
router.put('/:id', async (req, res) => {
  try {
    const { name, phoneNumber, type, address, email, balance } = req.body;
    
    const party = await Party.findById(req.params.id);
    
    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }
    
    // Check if another party exists with the same name and phone number
    if (name && phoneNumber) {
      const existingParty = await Party.findOne({
        name: name,
        phoneNumber: phoneNumber,
        _id: { $ne: req.params.id }
      });
      
      if (existingParty) {
        return res.status(409).json({
          success: false,
          error: 'Another party with this name and phone number already exists'
        });
      }
    }
    
    // Update fields
    if (name) party.name = name;
    if (phoneNumber) party.phoneNumber = phoneNumber;
    if (type) party.type = type;
    if (address !== undefined) party.address = address;
    if (email !== undefined) party.email = email;
    if (balance !== undefined) party.balance = balance;
    
    await party.save();
    
    res.json({
      success: true,
      data: party.getFormattedDetails(),
      message: 'Party updated successfully'
    });
  } catch (error) {
    console.error('Error updating party:', error);
    
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
      error: 'Failed to update party'
    });
  }
});

// PATCH /api/parties/:id/balance - Update party balance
router.patch('/:id/balance', async (req, res) => {
  try {
    const { amount, operation } = req.body;
    
    if (amount === undefined || !operation) {
      return res.status(400).json({
        success: false,
        error: 'Amount and operation are required'
      });
    }
    
    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'Operation must be add, subtract, or set'
      });
    }
    
    const party = await Party.updateBalance(req.params.id, amount, operation);
    
    res.json({
      success: true,
      data: party.getFormattedDetails(),
      message: 'Party balance updated successfully'
    });
  } catch (error) {
    console.error('Error updating party balance:', error);
    
    if (error.message === 'Party not found') {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update party balance'
    });
  }
});

// POST /api/parties/find-or-create - Find existing party or create new one
router.post('/find-or-create', async (req, res) => {
  try {
    const { name, phoneNumber, type, address, email } = req.body;
    
    if (!name || !phoneNumber || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name, phone number, and type are required'
      });
    }
    
    const party = await Party.findOrCreate({
      name,
      phoneNumber,
      type,
      address,
      email,
      balance: 0
    });
    
    res.json({
      success: true,
      data: party.getFormattedDetails(),
      message: party.isNew ? 'Party created successfully' : 'Party found'
    });
  } catch (error) {
    console.error('Error finding or creating party:', error);
    
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
      error: 'Failed to find or create party'
    });
  }
});

// DELETE /api/parties/:id - Delete party
router.delete('/:id', async (req, res) => {
  try {
    const party = await Party.findById(req.params.id);
    
    if (!party) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }
    
    await Party.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Party deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting party:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete party'
    });
  }
});

module.exports = router;
