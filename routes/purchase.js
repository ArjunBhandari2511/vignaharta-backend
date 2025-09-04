const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');
const Item = require('../models/Item');

// GET /api/purchases - Get all purchases with optional filtering
router.get('/', async (req, res) => {
  try {
    const { status, supplierName, phoneNumber, date, search } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (supplierName) {
      filter.supplierName = { $regex: supplierName, $options: 'i' };
    }
    
    if (phoneNumber) {
      filter.phoneNumber = phoneNumber;
    }
    
    if (date) {
      filter.date = date;
    }
    
    if (search) {
      filter.$or = [
        { supplierName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { billNo: { $regex: search, $options: 'i' } }
      ];
    }
    
    const purchases = await Purchase.find(filter)
      .populate('partyId', 'name phoneNumber balance')
      .sort({ createdAt: -1 });
    
    // Transform _id to id for frontend compatibility
    const transformedPurchases = purchases.map(purchase => ({
      ...purchase.toObject(),
      id: purchase._id.toString(),
      _id: undefined // Remove _id to avoid confusion
    }));
    
    res.json({
      success: true,
      data: transformedPurchases,
      count: transformedPurchases.length
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases'
    });
  }
});

// GET /api/purchases/:id - Get single purchase by ID
router.get('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('partyId', 'name phoneNumber balance');
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    res.json({
      success: true,
      data: purchase.getFormattedDetails()
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase'
    });
  }
});

// POST /api/purchases - Create new purchase
router.post('/', async (req, res) => {
  try {
    const { 
      supplierName, 
      phoneNumber, 
      items, 
      date, 
      status = 'pending',
      pdfUri 
    } = req.body;
    
    // Validate required fields
    if (!supplierName || !phoneNumber || !items || !date) {
      return res.status(400).json({
        success: false,
        error: 'Supplier name, phone number, items, and date are required'
      });
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required'
      });
    }
    
    // Generate bill number
    const billNo = await Purchase.generateNextBillNumber();
    
    // Find or create party
    const party = await Party.findOrCreate({
      name: supplierName,
      phoneNumber: phoneNumber,
      type: 'supplier'
    });
    
    // Create purchase
    const purchase = new Purchase({
      billNo,
      supplierName,
      phoneNumber,
      items,
      totalAmount: 0, // Will be calculated in pre-save middleware
      date,
      status,
      pdfUri,
      partyId: party._id
    });
    
    await purchase.save();
    
    // Update party balance (add to outstanding amount - we owe them)
    await Party.updateBalance(party._id, purchase.totalAmount, 'add');
    
    // Update stock levels for items (increase stock on purchase)
    for (const purchaseItem of items) {
      try {
        const item = await Item.findById(purchaseItem.id);
        if (item) {
          // Convert quantity from kg to bags (assuming 30kg per bag)
          const quantityInBags = purchaseItem.quantity / 30;
          item.openingStock += quantityInBags;
          
          await item.save();
        }
      } catch (itemError) {
        console.error(`Error updating stock for item ${purchaseItem.id}:`, itemError);
        // Continue with other items even if one fails
      }
    }
    
    // Update Bardana stock (universal item) - increase on purchase
    try {
      const bardanaItem = await Item.findOne({ 
        isUniversal: true, 
        productName: 'Bardana' 
      });
      
      if (bardanaItem) {
        // Increase Bardana stock by the same amount as total items purchased (in kg)
        const totalKgPurchased = items.reduce((sum, item) => sum + item.quantity, 0);
        const bardanaBagsToAdd = totalKgPurchased / 30;
        
        bardanaItem.openingStock += bardanaBagsToAdd;
        await bardanaItem.save();
      }
    } catch (bardanaError) {
      console.error('Error updating Bardana stock:', bardanaError);
      // Continue even if Bardana update fails
    }
    
    res.status(201).json({
      success: true,
      data: purchase.getFormattedDetails(),
      message: 'Purchase created successfully'
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    
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
      error: 'Failed to create purchase'
    });
  }
});

// PUT /api/purchases/:id - Update purchase
router.put('/:id', async (req, res) => {
  try {
    const { 
      supplierName, 
      phoneNumber, 
      items, 
      date, 
      status, 
      pdfUri 
    } = req.body;
    
    const purchase = await Purchase.findById(req.params.id);
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    // Store original values for rollback
    const originalTotalAmount = purchase.totalAmount;
    const originalItems = [...purchase.items];
    
    // Update fields
    if (supplierName) purchase.supplierName = supplierName;
    if (phoneNumber) purchase.phoneNumber = phoneNumber;
    if (items) purchase.items = items;
    if (date) purchase.date = date;
    if (status) purchase.status = status;
    if (pdfUri !== undefined) purchase.pdfUri = pdfUri;
    
    await purchase.save();
    
    // Update party balance if total amount changed
    if (purchase.partyId && originalTotalAmount !== purchase.totalAmount) {
      const balanceDifference = purchase.totalAmount - originalTotalAmount;
      await Party.updateBalance(purchase.partyId, balanceDifference, 'add');
    }
    
    // Update stock levels if items changed
    if (items && JSON.stringify(originalItems) !== JSON.stringify(items)) {
      // Restore original stock levels (subtract what was previously added)
      for (const originalItem of originalItems) {
        try {
          const item = await Item.findById(originalItem.id);
          if (item) {
            const quantityInBags = originalItem.quantity / 30;
            item.openingStock -= quantityInBags;
            
            // Ensure stock doesn't go negative
            if (item.openingStock < 0) {
              item.openingStock = 0;
            }
            
            await item.save();
          }
        } catch (itemError) {
          console.error(`Error restoring stock for item ${originalItem.id}:`, itemError);
        }
      }
      
      // Apply new stock levels (add new quantities)
      for (const purchaseItem of items) {
        try {
          const item = await Item.findById(purchaseItem.id);
          if (item) {
            const quantityInBags = purchaseItem.quantity / 30;
            item.openingStock += quantityInBags;
            await item.save();
          }
        } catch (itemError) {
          console.error(`Error updating stock for item ${purchaseItem.id}:`, itemError);
        }
      }
      
      // Update Bardana stock
      try {
        const bardanaItem = await Item.findOne({ 
          isUniversal: true, 
          productName: 'Bardana' 
        });
        
        if (bardanaItem) {
          // Calculate difference in total kg
          const originalTotalKg = originalItems.reduce((sum, item) => sum + item.quantity, 0);
          const newTotalKg = items.reduce((sum, item) => sum + item.quantity, 0);
          const kgDifference = newTotalKg - originalTotalKg;
          const bardanaBagsDifference = kgDifference / 30;
          
          bardanaItem.openingStock += bardanaBagsDifference;
          if (bardanaItem.openingStock < 0) {
            bardanaItem.openingStock = 0;
          }
          
          await bardanaItem.save();
        }
      } catch (bardanaError) {
        console.error('Error updating Bardana stock:', bardanaError);
      }
    }
    
    res.json({
      success: true,
      data: purchase.getFormattedDetails(),
      message: 'Purchase updated successfully'
    });
  } catch (error) {
    console.error('Error updating purchase:', error);
    
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
      error: 'Failed to update purchase'
    });
  }
});

// PATCH /api/purchases/:id/status - Update purchase status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (pending, completed, cancelled)'
      });
    }
    
    const purchase = await Purchase.findById(req.params.id);
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    purchase.status = status;
    await purchase.save();
    
    res.json({
      success: true,
      data: purchase.getFormattedDetails(),
      message: 'Purchase status updated successfully'
    });
  } catch (error) {
    console.error('Error updating purchase status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update purchase status'
    });
  }
});

// DELETE /api/purchases/:id - Delete purchase
router.delete('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    
    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }
    
    // Restore stock levels (subtract what was added during purchase)
    for (const purchaseItem of purchase.items) {
      try {
        const item = await Item.findById(purchaseItem.id);
        if (item) {
          const quantityInBags = purchaseItem.quantity / 30;
          item.openingStock -= quantityInBags;
          
          // Ensure stock doesn't go negative
          if (item.openingStock < 0) {
            item.openingStock = 0;
          }
          
          await item.save();
        }
      } catch (itemError) {
        console.error(`Error restoring stock for item ${purchaseItem.id}:`, itemError);
      }
    }
    
    // Restore Bardana stock
    try {
      const bardanaItem = await Item.findOne({ 
        isUniversal: true, 
        productName: 'Bardana' 
      });
      
      if (bardanaItem) {
        const totalKgPurchased = purchase.items.reduce((sum, item) => sum + item.quantity, 0);
        const bardanaBagsToRestore = totalKgPurchased / 30;
        
        bardanaItem.openingStock -= bardanaBagsToRestore;
        if (bardanaItem.openingStock < 0) {
          bardanaItem.openingStock = 0;
        }
        
        await bardanaItem.save();
      }
    } catch (bardanaError) {
      console.error('Error restoring Bardana stock:', bardanaError);
    }
    
    // Update party balance (subtract the amount - we no longer owe them this amount)
    if (purchase.partyId) {
      await Party.updateBalance(purchase.partyId, purchase.totalAmount, 'subtract');
    }
    
    await Purchase.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Purchase deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete purchase'
    });
  }
});

// GET /api/purchases/supplier/:supplierName - Get purchases by supplier name
router.get('/supplier/:supplierName', async (req, res) => {
  try {
    const { supplierName } = req.params;
    const { phoneNumber } = req.query;
    
    const purchases = await Purchase.getPurchasesBySupplier(supplierName, phoneNumber);
    
    res.json({
      success: true,
      data: purchases,
      count: purchases.length
    });
  } catch (error) {
    console.error('Error fetching purchases by supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases by supplier'
    });
  }
});

// GET /api/purchases/date-range - Get purchases by date range
router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const purchases = await Purchase.getPurchasesByDateRange(startDate, endDate);
    
    res.json({
      success: true,
      data: purchases,
      count: purchases.length
    });
  } catch (error) {
    console.error('Error fetching purchases by date range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases by date range'
    });
  }
});

module.exports = router;
