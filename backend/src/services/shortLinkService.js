const ShortLink = require('../models/ShortLink');

const generateCode = () => {
  const random = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `${random}${stamp}`.toLowerCase();
};

const createShortLink = async ({ targetPath, label, expiresAt }) => {
  if (!targetPath) {
    throw new Error('targetPath is required');
  }

  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    try {
      return await ShortLink.create({ code, targetPath, label, expiresAt });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  throw new Error('Unable to generate a unique short link.');
};

const resolveShortLink = async (code) => {
  const shortLink = await ShortLink.findOne({ code });
  if (!shortLink) return null;

  if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
    return null;
  }

  shortLink.clicks += 1;
  shortLink.lastAccessedAt = new Date();
  await shortLink.save().catch(() => {});
  return shortLink;
};

module.exports = { createShortLink, resolveShortLink };
