const express = require('express');
const router = express.Router();
const bankTransferController = require('../controllers/bankTransferController');
const { protect: authenticate } = require('../middleware/auth');
const { upload } = require('../controllers/bankTransferController');
const path = require('path');
const fs = require('fs');

// Public routes
router.post('/order', bankTransferController.createBankTransferOrder);
router.get('/instructions/:orderIdOrToken', bankTransferController.getBankTransferInstructions);
router.post('/submit/:orderIdOrToken', upload.single('receipt'), bankTransferController.submitPaymentReceipt);

// Protected routes (require authentication)
router.get('/payments', authenticate, bankTransferController.getPendingPayments);
router.post('/payments/:submissionId/approve', authenticate, bankTransferController.approvePayment);
router.post('/payments/:submissionId/reject', authenticate, bankTransferController.rejectPayment);
router.post('/payments/:submissionId/request-info', authenticate, bankTransferController.requestMoreInfo);

// Receipt viewing with permission check
router.get('/receipt/:submissionId', authenticate, async (req, res) => {
  try {
    const PaymentSubmission = require('../models/PaymentSubmission');
    const Order = require('../models/Order');
    const Event = require('../models/Event');
    const User = require('../models/User');
    
    const { submissionId } = req.params;
    const user = req.user;
    
    // Find the payment submission
    const submission = await PaymentSubmission.findById(submissionId).populate('orderId');
    
    if (!submission) {
      return res.status(404).json({ message: 'Payment submission not found' });
    }
    
    // Get the order and event
    const order = await Order.findById(submission.orderId).populate('eventId');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Permission check
    const hasAccess = await checkReceiptAccess(user, order);
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to view this receipt' });
    }
    
    // Check if file exists
    if (!submission.receiptFile) {
      return res.status(404).json({ message: 'Receipt file not found' });
    }
    
    if (submission.receiptFile.startsWith('azure-private:')) {
      const buffer = await require('../services/privateReceiptStorage').downloadReceipt(submission.receiptFile);
      res.setHeader('Content-Type', submission.receiptFileType === 'pdf' ? 'application/pdf' : 'image/jpeg');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(buffer);
    }
    if (process.env.NODE_ENV === 'production') return res.status(410).json({ message: 'Legacy receipt must be migrated to private storage' });
    const filePath = path.resolve(submission.receiptFile);
    
    // Security check: ensure file is within uploads directory (case-insensitive for Windows)
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const normalizedFilePath = path.normalize(filePath).toLowerCase();
    const normalizedUploadsDir = path.normalize(uploadsDir).toLowerCase();
    
    if (!normalizedFilePath.startsWith(normalizedUploadsDir)) {
      return res.status(403).json({ message: 'Invalid file path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Determine content type
    const contentType = submission.receiptFileType === 'pdf' 
      ? 'application/pdf' 
      : 'image/jpeg';
    
    // Send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="receipt-${submissionId}.${submission.receiptFileType === 'pdf' ? 'pdf' : 'jpg'}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error streaming receipt file:', err);
      if (!res.headersSent)	res.status(500).json({ message: 'Error serving file' });
    });
  } catch (error) {
    console.error('Error serving receipt:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to check receipt access permissions
async function checkReceiptAccess(user, order) {
  const role = user.role?.toLowerCase();
  
  // Super Admin has access to everything
  if (role === 'superadmin') return true;
  
  // Buyer can view their own receipts
  if (role === 'attendee' || role === 'buyer') {
    return user.email === order.buyerEmail || user._id.toString() === order.buyerId?.toString();
  }
  
  // Main Organizer can view receipts for their events
  if (role === 'mainorganiser') {
    const userEventIds = user.assignedEvents || [];
    return userEventIds.some(id => id.toString() === order.eventId?._id?.toString());
  }
  
  // Sub Organizer can view receipts for their assigned events
  if (role === 'suborganiser') {
    const userEventIds = user.assignedEvents || [];
    return userEventIds.some(id => id.toString() === order.eventId?._id?.toString());
  }
  
  // Staff with cash collection permission can view receipts
  if (role === 'staff') {
    const canCollectCash = user.canCollectCash || user.permissions?.canCollectCash;
    if (canCollectCash) {
      const userEventIds = user.assignedEvents || [];
      return userEventIds.some(id => id.toString() === order.eventId?._id?.toString());
    }
  }
  
  return false;
}

// Admin routes
router.get('/bank-accounts', authenticate, bankTransferController.getBankAccounts);
router.post('/bank-accounts', authenticate, bankTransferController.createBankAccount);
router.put('/bank-accounts/:accountId', authenticate, bankTransferController.updateBankAccount);
router.delete('/bank-accounts/:accountId', authenticate, bankTransferController.deleteBankAccount);

module.exports = router;
