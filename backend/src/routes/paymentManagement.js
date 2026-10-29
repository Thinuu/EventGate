const express = require('express');
const router = express.Router();
const { protect, checkRole, requireEventAccess, requirePermission } = require('../middleware/auth');
const { ROLES } = require('../utils/rbac');
const {
  getPaymentSubmissions,
  getPaymentSubmissionDetails,
  approvePayment,
  rejectPayment,
  requestMoreInfo,
  getPaymentStatistics,
  exportPayments,
  // Super Admin endpoints
  getAllTransactions,
  getTransactionStatistics,
  getTransactionDetails,
  getTransactionTimeline,
  getTransactionAuditLog,
  exportAllTransactions,
} = require('../controllers/paymentManagementController');

// Apply authentication middleware
router.use(protect);

// Organizer payment management routes
router.get('/organizer', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentSubmissions);
router.get('/organizer/statistics', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentStatistics);
router.get('/organizer/export', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), exportPayments);
router.get('/organizer/:submissionId', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentSubmissionDetails);
router.post('/organizer/:submissionId/approve', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), approvePayment);
router.post('/organizer/:submissionId/reject', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), rejectPayment);
router.post('/organizer/:submissionId/request-info', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), requestMoreInfo);

// Admin payment management routes
router.get('/admin', checkRole(['main_admin', 'super_admin']), getPaymentSubmissions);
router.get('/admin/statistics', checkRole(['main_admin', 'super_admin']), getPaymentStatistics);
router.get('/admin/export', checkRole(['main_admin', 'super_admin']), exportPayments);
router.get('/admin/:submissionId', checkRole(['main_admin', 'super_admin']), getPaymentSubmissionDetails);
router.post('/admin/:submissionId/approve', checkRole(['main_admin', 'super_admin']), approvePayment);
router.post('/admin/:submissionId/reject', checkRole(['main_admin', 'super_admin']), rejectPayment);
router.post('/admin/:submissionId/request-info', checkRole(['main_admin', 'super_admin']), requestMoreInfo);

// Super Admin Transactions routes (platform-wide view)
router.get('/super-admin/transactions', checkRole(['super_admin']), getAllTransactions);
router.get('/super-admin/transactions/statistics', checkRole(['super_admin']), getTransactionStatistics);
router.get('/super-admin/transactions/export', checkRole(['super_admin']), exportAllTransactions);
router.get('/super-admin/transactions/:transactionId', checkRole(['super_admin']), getTransactionDetails);
router.get('/super-admin/transactions/:transactionId/timeline', checkRole(['super_admin']), getTransactionTimeline);
router.get('/super-admin/transactions/:transactionId/audit-log', checkRole(['super_admin']), getTransactionAuditLog);

module.exports = router;
