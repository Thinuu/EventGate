const express = require('express');
const router = express.Router();
const { resolveShortLink } = require('../services/shortLinkService');

// GET /api/short-links/:code - resolve a short link to its target path
router.get('/:code', async (req, res, next) => {
  try {
    const shortLink = await resolveShortLink(req.params.code);
    if (!shortLink) {
      return res.status(404).json({ success: false, message: 'Short link not found.' });
    }

    res.json({
      success: true,
      data: {
        code: shortLink.code,
        targetPath: shortLink.targetPath,
        label: shortLink.label,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
