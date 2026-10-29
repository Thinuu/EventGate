const express = require('express');

const router = express.Router();
const entryRoutes = require('./entry');
const zoneRoutes = require('./zone');

const delegateTo = (targetRouter, targetPath) => (req, res, next) => {
  const originalUrl = req.url;
  req.url = targetPath;

  targetRouter.handle(req, res, (error) => {
    req.url = originalUrl;
    next(error);
  });
};

router.post('/scan-entry', delegateTo(entryRoutes, '/scan'));
router.post('/scan-zone', delegateTo(zoneRoutes, '/scan'));
router.get('/search', delegateTo(entryRoutes, '/search'));

module.exports = router;
