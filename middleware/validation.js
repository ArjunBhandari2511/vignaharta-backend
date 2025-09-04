const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
};

const validateFileType = (mimetype) => {
  const allowedTypes = ['application/pdf'];
  return allowedTypes.includes(mimetype);
};

const validateFileSize = (size, maxSize = 10 * 1024 * 1024) => {
  return size <= maxSize;
};

const sanitizePhoneNumber = (phoneNumber) => {
  const cleaned = phoneNumber.replace(/\s/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

const validateUploadRequest = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  if (!validateFileType(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'Only PDF files are allowed'
    });
  }

  if (!validateFileSize(req.file.size)) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds maximum limit of 10MB'
    });
  }

  next();
};

const validateWhatsAppRequest = (req, res, next) => {
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({
      success: false,
      error: 'Phone number and text message are required'
    });
  }

  if (!validatePhoneNumber(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format'
    });
  }

  // Sanitize phone number
  req.body.to = sanitizePhoneNumber(to);
  next();
};

const validateDocumentRequest = (req, res, next) => {
  const { to, text, documentUrl } = req.body;

  if (!to || !text || !documentUrl) {
    return res.status(400).json({
      success: false,
      error: 'Phone number, text message, and document URL are required'
    });
  }

  if (!validatePhoneNumber(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format'
    });
  }

  // Sanitize phone number
  req.body.to = sanitizePhoneNumber(to);
  next();
};

const validateInvoiceRequest = (req, res, next) => {
  const { to, customerName, invoiceNo, totalAmount, date } = req.body;

  if (!to || !customerName || !invoiceNo || !totalAmount || !date) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, customerName, invoiceNo, totalAmount, date'
    });
  }

  if (!validatePhoneNumber(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format'
    });
  }

  if (typeof totalAmount !== 'number' || totalAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Total amount must be a positive number'
    });
  }

  // Sanitize phone number
  req.body.to = sanitizePhoneNumber(to);
  next();
};

const validateItem = (req, res, next) => {
  const { productName, category, purchasePrice, salePrice, openingStock, asOfDate, lowStockAlert } = req.body;

  // Check required fields
  if (!productName || !category || purchasePrice === undefined || salePrice === undefined || 
      openingStock === undefined || !asOfDate || lowStockAlert === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: productName, category, purchasePrice, salePrice, openingStock, asOfDate, lowStockAlert'
    });
  }

  // Validate product name
  if (typeof productName !== 'string' || productName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Product name must be a non-empty string'
    });
  }

  // Validate category
  if (!['Primary', 'Kirana'].includes(category)) {
    return res.status(400).json({
      success: false,
      error: 'Category must be either "Primary" or "Kirana"'
    });
  }

  // Validate numeric fields
  if (typeof purchasePrice !== 'number' || purchasePrice < 0) {
    return res.status(400).json({
      success: false,
      error: 'Purchase price must be a non-negative number'
    });
  }

  if (typeof salePrice !== 'number' || salePrice < 0) {
    return res.status(400).json({
      success: false,
      error: 'Sale price must be a non-negative number'
    });
  }

  if (typeof openingStock !== 'number' || openingStock < 0) {
    return res.status(400).json({
      success: false,
      error: 'Opening stock must be a non-negative number'
    });
  }

  if (typeof lowStockAlert !== 'number' || lowStockAlert < 0) {
    return res.status(400).json({
      success: false,
      error: 'Low stock alert must be a non-negative number'
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(asOfDate)) {
    return res.status(400).json({
      success: false,
      error: 'As of date must be in YYYY-MM-DD format'
    });
  }

  // Sanitize product name
  req.body.productName = productName.trim();
  
  next();
};

module.exports = {
  validatePhoneNumber,
  validateFileType,
  validateFileSize,
  sanitizePhoneNumber,
  validateUploadRequest,
  validateWhatsAppRequest,
  validateDocumentRequest,
  validateInvoiceRequest,
  validateItem
};
