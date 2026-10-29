const SystemConfig = require('../models/SystemConfig');

class WhatsAppProvider {
  constructor(config) {
    this.client = null;
    this.provider = config.whatsapp?.provider;
    
    if (this.provider === 'twilio') {
      const sid = config.whatsapp?.apiKey || process.env.TWILIO_ACCOUNT_SID;
      const token = config.whatsapp?.apiSecret || process.env.TWILIO_AUTH_TOKEN;
      if (sid && token) {
        this.client = require('twilio')(sid, token);
      }
    }
  }

  async send(to, message) {
    if (this.provider === 'none' || !this.provider) {
      return { success: false, error: 'WhatsApp provider disabled' };
    }

    if (!this.client && this.provider === 'twilio') {
       console.log(`[WHATSAPP MOCK] To: ${to} | Message: ${message}`);
       return { success: true, mock: true };
    }

    try {
      if (this.provider === 'twilio') {
        const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
        const result = await this.client.messages.create({
          from,
          to: `whatsapp:${to}`,
          body: message,
        });
        return { success: true, messageId: result.sid };
      }
      
      // Meta Graph API (placeholder)
      if (this.provider === 'meta') {
        console.log(`[WHATSAPP META] To: ${to} | Message: ${message}`);
        return { success: true, mock: true };
      }

      return { success: false, error: 'Unknown provider' };
    } catch (error) {
      console.error('WhatsApp Send Error:', error);
      return { success: false, error: error.message };
    }
  }
}

const sendWhatsApp = async (to, message) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  if (!config.whatsapp?.enabled) return { sent: false, skipped: true };
  
  const provider = new WhatsAppProvider(config);
  const res = await provider.send(to, message);
  return { sent: res.success, messageId: res.messageId, mock: res.mock, error: res.error };
};

module.exports = { sendWhatsApp };
