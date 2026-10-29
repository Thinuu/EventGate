// Explicit profiles avoid guessing whether a numeric credential is a QR or RFID.
const FORMATS = ['numeric10', 'decimal', 'hex', 'alphanumeric'];
function decodeCredential(raw, profile = {}) {
  if (typeof raw !== 'string' || raw.length > 256) throw new Error('Scan must be a string of at most 256 characters');
  let value = raw.trim();
  for (const [key, fromStart] of [['prefix', true], ['suffix', false]]) {
    const part = profile[key];
    if (!part) continue;
    if (!(fromStart ? value.startsWith(part) : value.endsWith(part))) throw new Error(`Reader ${key} mismatch`);
    value = fromStart ? value.slice(part.length) : value.slice(0, -part.length);
  }
  const format = profile.format || 'numeric10';
  if (format === 'hex') value = value.replace(/[: -]/g, '').toUpperCase();
  const rules = { numeric10: /^\d{10}$/, decimal: /^\d{1,64}$/, hex: /^(?:[0-9A-F]{2}){2,32}$/, alphanumeric: /^[a-zA-Z0-9_-]{1,64}$/ };
  if (!rules[format]?.test(value)) throw new Error('Credential does not match reader format');
  return value; // Never convert to Number: leading zeros and 64-bit IDs matter.
}
module.exports = { decodeCredential, FORMATS };
