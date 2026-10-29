const express = require('express');
module.exports = function configureBodyParsers(app) {
  app.use('/api/payment/stripe-webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => Buffer.isBuffer(req.body) ? next() : jsonParser(req, res, next));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
};
