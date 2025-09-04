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

module.exports = {
  validatePhoneNumber,
  validateFileType,
  validateFileSize,
  sanitizePhoneNumber,
  validateUploadRequest,
  validateWhatsAppRequest,
  validateDocumentRequest,
  validateInvoiceRequest
};
