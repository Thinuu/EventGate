/**
 * SMS Service Adapter Pattern
 * This service manages SMS providers and handles rate limiting.
 */

const { v4: uuidv4 } = require('uuid');
const SystemConfig = require('../models/SystemConfig');

// Provider Interface (Implicit) should implement:
// async send(to, message) -> { success: boolean, messageId?: string, error?: string }

class TwilioProvider {
  constructor(config) {
    this.client = null;
    
    const sid = config.sms?.apiKey || process.env.TWILIO_ACCOUNT_SID;
    const token = config.sms?.apiSecret || process.env.TWILIO_AUTH_TOKEN;
    
    // Clean the from number (strip spaces/dashes)
    const rawFrom = process.env.TWILIO_PHONE_NUMBER || config.general?.platformName || 'EventGate';
    this.from = rawFrom.replace(/[\s\-\(\)]/g, '');
    
    if (sid && token) {
      try {
        this.client = require('twilio')(sid, token);
      } catch (err) {
        console.error('Twilio Initialization Error:', err);
      }
    }
  }

  /**
   * Normalizes phone numbers to E.164 format
   * Supports common local formats (e.g. Sri Lanka 07x...)
   */
  _normalizePhoneNumber(phone) {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Handle 00 international prefix
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    }

    // If it starts with +, assume it's already international
    if (cleaned.startsWith('+')) return cleaned;
    
    // Handle Sri Lankan local format (07XXXXXXXX -> +947XXXXXXXX)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+94' + cleaned.substring(1);
    }
    
    // Handle local format without leading 0 (7XXXXXXXX -> +947XXXXXXXX)
    if (cleaned.length === 9) {
      return '+94' + cleaned;
    }

    // Default fallback: just prepend + if missing
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  async send(to, message) {
    if (!this.client || !this.from) {
      console.log(`[SMS MOCK] To: ${to} | Message: ${message}`);
      return { success: true, mock: true };
    }

    const formattedTo = this._normalizePhoneNumber(to);
    console.log(`[Twilio] Attempting send to: ${formattedTo} from: ${this.from}`);

    try {
      const result = await this.client.messages.create({
        from: this.from,
        to: formattedTo,
        body: message,
      });
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Twilio Send Error:', {
        code: error.code,
        status: error.status,
        message: error.message
      });
      return { success: false, error: `[Twilio Error ${error.code}] ${error.message}` };
    }
  }
}

class SMSManager {
  constructor() {
    this.rateStore = new Map();
    this.windowMs = parseInt(process.env.SMS_RATE_WINDOW_MS || '900000', 10);
    this.maxPerWindow = parseInt(process.env.SMS_RATE_LIMIT_PER_WINDOW || '50', 10);
  }

  _isRateLimited(key) {
    const now = Date.now();
    const history = (this.rateStore.get(key) || []).filter((ts) => now - ts < this.windowMs);
    if (history.length >= this.maxPerWindow) return true;
    
    history.push(now);
    this.rateStore.set(key, history);
    return false;
  }

  async sendSMS(to, message, { rateKey } = {}) {
    if (!to || !message) return { sent: false, skipped: true };

    const phone = to.replace(/\s+/g, '').trim();
    
    if (this._isRateLimited(rateKey || phone)) {
      console.warn(`[SMS_LIMIT] Rate limit hit for ${phone}`);
      return { sent: false, error: 'Rate limit exceeded' };
    }

    const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
    
    // Auto-detect provider
    const hasTwilioEnv = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const providerType = hasTwilioEnv ? 'twilio' : (config.sms?.provider || 'mock');

    if (providerType === 'mock' || !hasTwilioEnv) {
      console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
      return { sent: true, mock: true };
    }

    console.log(`[SMS_SEND] Attempting via Twilio to ${phone}`);
    try {
      const provider = new TwilioProvider(config);
      const res = await provider.send(phone, message);
      
      if (res.success) {
        console.log(`[SMS_SUCCESS] ID: ${res.messageId} to ${phone}`);
      } else {
        console.error(`[SMS_ERROR] ${res.error} for ${phone}`);
      }

      return {
        sent: res.success,
        messageId: res.messageId,
        mock: res.mock,
        error: res.error
      };
    } catch (err) {
      console.error('[SMS_FATAL_ERROR]', err);
      return { sent: false, error: err.message };
    }
  }
}

const manager = new SMSManager();

module.exports = {
  sendSMS: (to, message, options) => manager.sendSMS(to, message, options),
};
