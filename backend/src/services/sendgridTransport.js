function address(value) {
  if (typeof value === 'object' && value?.email) return value;
  const text = String(value || '');
  const match = text.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { email: match[2], name: match[1].replace(/^"|"$/g, '') } : { email: text };
}
function createSendgridTransport(apiKey) {
  return { async send(message) {
    const personalization = { to: (Array.isArray(message.to) ? message.to : [message.to]).map(address) };
    if (message.dynamicTemplateData) personalization.dynamic_template_data = message.dynamicTemplateData;
    const payload = { personalizations: [personalization], from: address(message.from) };
    if (message.subject) payload.subject = message.subject;
    if (message.templateId) payload.template_id = message.templateId;
    else payload.content = [{ type: 'text/html', value: message.html || '' }];
    if (message.attachments?.length) payload.attachments = message.attachments.map(item => ({
      content: Buffer.isBuffer(item.content) ? item.content.toString('base64') : item.content,
      filename: item.filename, type: item.type || item.contentType,
      disposition: item.disposition || 'attachment', content_id: item.content_id || item.contentId || item.cid,
    }));
    const result = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000), body: JSON.stringify(payload),
    });
    if (!result.ok) throw new Error(`SendGrid rejected delivery (${result.status})`);
    return { accepted: true };
  } };
}
module.exports = { createSendgridTransport };
