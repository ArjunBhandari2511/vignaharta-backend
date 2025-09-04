const axios = require('axios');
require('dotenv').config({ path: '../config.env' });

const WASENDER_API_KEY = process.env.WASENDER_API_KEY;
const WASENDER_API_BASE_URL = process.env.WASENDER_API_BASE_URL;

class WhatsAppService {
  /**
   * Send a text message via WhatsApp
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} message - Text message to send
   * @returns {Promise<Object>} Send result
   */
  static async sendTextMessage(phoneNumber, message) {
    try {
      const response = await axios.post(`${WASENDER_API_BASE_URL}/send-message`, {
        to: phoneNumber,
        text: message
      }, {
        headers: {
          'Authorization': `Bearer ${WASENDER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.success) {
        return {
          success: true,
          message: 'Message sent successfully',
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to send message'
        };
      }
    } catch (error) {
      console.error('WhatsApp send text error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Send a document via WhatsApp
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} message - Accompanying text message
   * @param {string} documentUrl - URL of the document
   * @param {string} fileName - Name of the file (optional)
   * @returns {Promise<Object>} Send result
   */
  static async sendDocument(phoneNumber, message, documentUrl, fileName) {
    try {
      const payload = {
        to: phoneNumber,
        text: message,
        documentUrl: documentUrl
      };

      if (fileName) {
        payload.fileName = fileName;
      }

      const response = await axios.post(`${WASENDER_API_BASE_URL}/send-message`, payload, {
        headers: {
          'Authorization': `Bearer ${WASENDER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.success) {
        return {
          success: true,
          message: 'Document sent successfully',
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to send document'
        };
      }
    } catch (error) {
      console.error('WhatsApp send document error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Send an invoice via WhatsApp
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} customerName - Customer's name
   * @param {string} invoiceNo - Invoice number
   * @param {number} totalAmount - Total invoice amount
   * @param {string} date - Invoice date
   * @param {string} documentUrl - URL of the invoice PDF (optional)
   * @returns {Promise<Object>} Send result
   */
  static async sendInvoice(phoneNumber, customerName, invoiceNo, totalAmount, date, documentUrl) {
    try {
      const messageText = `Dear ${customerName},\n\nYour invoice ${invoiceNo} has been generated.\n\nTotal Amount: ₹${totalAmount.toLocaleString()}\nDate: ${date}\n\nThank you for your business!`;

      if (documentUrl) {
        return await this.sendDocument(
          phoneNumber,
          messageText,
          documentUrl,
          `invoice-${invoiceNo}.pdf`
        );
      } else {
        return await this.sendTextMessage(phoneNumber, messageText);
      }
    } catch (error) {
      console.error('WhatsApp send invoice error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Send a purchase bill via WhatsApp
   * @param {string} phoneNumber - Recipient's phone number
   * @param {string} supplierName - Supplier's name
   * @param {string} billNo - Bill number
   * @param {number} totalAmount - Total bill amount
   * @param {string} date - Bill date
   * @param {string} documentUrl - URL of the purchase bill PDF (optional)
   * @returns {Promise<Object>} Send result
   */
  static async sendPurchaseBill(phoneNumber, supplierName, billNo, totalAmount, date, documentUrl) {
    try {
      const messageText = `Dear ${supplierName},\n\nYour purchase bill ${billNo} has been generated.\n\nTotal Amount: ₹${totalAmount.toLocaleString()}\nDate: ${date}\n\nPayment will be processed as per our terms.`;

      if (documentUrl) {
        return await this.sendDocument(
          phoneNumber,
          messageText,
          documentUrl,
          `purchase-bill-${billNo}.pdf`
        );
      } else {
        return await this.sendTextMessage(phoneNumber, messageText);
      }
    } catch (error) {
      console.error('WhatsApp send purchase bill error:', error);
      return this.handleError(error);
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} Formatted error response
   */
  static handleError(error) {
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timeout'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Failed to send message'
      };
    }

    return {
      success: false,
      error: error.message || 'Network error occurred'
    };
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} Validation result
   */
  static validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  /**
   * Format phone number to ensure it has country code
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} Formatted phone number
   */
  static formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\s/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  /**
   * Check if WASender API is properly configured
   * @returns {boolean} Configuration status
   */
  static isConfigured() {
    return !!(WASENDER_API_KEY && WASENDER_API_BASE_URL);
  }

  /**
   * Get WASender configuration info
   * @returns {Object} Configuration info
   */
  static getConfigInfo() {
    return {
      api_key: WASENDER_API_KEY ? '***' + WASENDER_API_KEY.slice(-4) : null,
      api_base_url: WASENDER_API_BASE_URL,
      configured: this.isConfigured()
    };
  }
}

module.exports = WhatsAppService;
