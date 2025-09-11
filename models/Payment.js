const mongoose = require('mongoose');

// Main Payment schema - unified for both payment-in and payment-out
const paymentSchema = new mongoose.Schema({
  paymentNo: {
    type: String,
    required: [true, 'Payment number is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['payment-in', 'payment-out'],
    default: 'payment-in'
  },
  partyName: {
    type: String,
    required: [true, 'Party name is required'],
    trim: true,
    maxlength: [100, 'Party name cannot exceed 100 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Basic phone number validation
        return /^\+?[1-9]\d{1,14}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Invalid phone number format'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: false,
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },
  date: {
    type: String,
    required: [true, 'Date is required'],
    match: [/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'Date must be in MM/DD/YYYY format']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  paymentMethod: {
    type: String,
    required: false,
    enum: ['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other'],
    default: 'cash'
  },
  reference: {
    type: String,
    required: false,
    trim: true,
    maxlength: [100, 'Reference cannot exceed 100 characters']
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: false // Will be populated when party is created/updated
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  versionKey: false // Removes __v field
});

// Index for better query performance
paymentSchema.index({ type: 1 });
paymentSchema.index({ partyName: 1 });
paymentSchema.index({ phoneNumber: 1 });
paymentSchema.index({ date: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ partyId: 1 });
paymentSchema.index({ type: 1, partyName: 1 }); // Compound index for filtering

// Pre-save middleware to sanitize data
paymentSchema.pre('save', function(next) {
  // Sanitize phone number
  if (this.phoneNumber) {
    this.phoneNumber = this.phoneNumber.replace(/[^\d+]/g, '');
    if (!this.phoneNumber.startsWith('+')) {
      this.phoneNumber = '+91' + this.phoneNumber;
    }
  }
  
  // Set totalAmount to amount if not provided
  if (!this.totalAmount && this.amount) {
    this.totalAmount = this.amount;
  }
  
  next();
});

// Instance method to get formatted payment details
paymentSchema.methods.getFormattedDetails = function() {
  return {
    id: this._id,
    paymentNo: this.paymentNo,
    type: this.type,
    partyName: this.partyName,
    phoneNumber: this.phoneNumber,
    amount: this.amount,
    totalAmount: this.totalAmount,
    date: this.date,
    status: this.status,
    description: this.description,
    paymentMethod: this.paymentMethod,
    reference: this.reference,
    partyId: this.partyId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to generate next payment number
paymentSchema.statics.generateNextPaymentNumber = async function(type = 'payment-in') {
  try {
    const prefix = type === 'payment-in' ? 'PAY-IN' : 'PAY-OUT';
    const lastPayment = await this.findOne({ 
      paymentNo: { $regex: `^${prefix}-` } 
    }).sort({ paymentNo: -1 });
    
    if (!lastPayment) {
      return `${prefix}-1`;
    }
    
    const match = lastPayment.paymentNo.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) {
      return `${prefix}-1`;
    }
    
    const lastNumber = parseInt(match[1], 10);
    return `${prefix}-${lastNumber + 1}`;
  } catch (error) {
    console.error('Error generating payment number:', error);
    const prefix = type === 'payment-in' ? 'PAY-IN' : 'PAY-OUT';
    return `${prefix}-1`;
  }
};

// Static method to get payments by date range
paymentSchema.statics.getPaymentsByDateRange = async function(startDate, endDate, type = null) {
  try {
    // Convert date strings to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filter = {
      createdAt: {
        $gte: start,
        $lte: end
      }
    };
    
    if (type) {
      filter.type = type;
    }
    
    const payments = await this.find(filter).sort({ createdAt: -1 });
    return payments;
  } catch (error) {
    throw error;
  }
};

// Static method to get payments by party
paymentSchema.statics.getPaymentsByParty = async function(partyName, phoneNumber, type = null) {
  try {
    const filter = {};
    
    if (partyName) {
      filter.partyName = { $regex: partyName, $options: 'i' };
    }
    
    if (phoneNumber) {
      filter.phoneNumber = phoneNumber;
    }
    
    if (type) {
      filter.type = type;
    }
    
    const payments = await this.find(filter).sort({ createdAt: -1 });
    return payments;
  } catch (error) {
    throw error;
  }
};

// Static method to get payment summary by type
paymentSchema.statics.getPaymentSummary = async function(type = null, startDate = null, endDate = null) {
  try {
    const filter = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    }
    
    const summary = await this.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);
    
    return summary;
  } catch (error) {
    throw error;
  }
};

// Static method to update party balance based on payment
paymentSchema.statics.updatePartyBalance = async function(payment) {
  try {
    const Party = require('./Party');
    
    if (!payment.partyId) {
      return;
    }
    
    // For payment-in: reduce customer balance (they paid us)
    // For payment-out: reduce supplier balance (we paid them)
    const operation = payment.type === 'payment-in' ? 'subtract' : 'subtract';
    
    await Party.updateBalance(payment.partyId, payment.amount, operation);
  } catch (error) {
    console.error('Error updating party balance:', error);
    throw error;
  }
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
