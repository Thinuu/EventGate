// src/routes/entrance.js
const express = require('express');
const router = express.Router();
const { confirmCashPayment } = require('../controllers/entranceController');
const { protect, checkRole } = require('../middleware/auth');

// Staff endpoint to confirm cash payment at entrance
router.post('/confirm/:orderId', protect, checkRole(['staff', 'volunteer', 'main_admin', 'super_admin']), confirmCashPayment);

module.exports = router;
