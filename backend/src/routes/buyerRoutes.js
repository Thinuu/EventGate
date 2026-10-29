const express = require('express');
const { protect } = require('../middleware/auth');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const {
  getBuyerOrders,
  getBuyerOrderDetails,
  assignSelfToTicket,
  inviteForTicket,
  getBuyerTickets,
  assignAttendeeToTicket,
  getBuyerInvites,
  resendInviteForTicket,
  cancelOrder,
  requestRefund,
} = require('../controllers/buyerController');

const router = express.Router();

router.use(protect);

router.get('/orders', getBuyerOrders);
router.get('/orders/:orderId', getBuyerOrderDetails);
router.post('/orders/:orderId/cancel', cancelOrder);
router.post('/orders/:orderId/refund', requestRefund);
router.get('/tickets', getBuyerTickets);
router.get('/invites', getBuyerInvites);
router.post('/assign', assignAttendeeToTicket);
router.post('/tickets/:ticketId/assign-self', upload.single('photo'), handleAzureUpload('attendee-photos'), assignSelfToTicket);
router.post('/tickets/:ticketId/invite', inviteForTicket);
router.post('/tickets/:ticketId/resend-invite', resendInviteForTicket);

module.exports = router;
