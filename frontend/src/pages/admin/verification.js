const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/auth');
const { 
  listPendingPhotos, 
  verifyPhoto 
} = require('../controllers/photoVerificationController');

router.use(protect);

// Verification Dashboard Endpoints
router.get('/pending', listPendingPhotos);
// Handles both approve and reject actions
router.post('/verify', verifyPhoto);

module.exports = router;
