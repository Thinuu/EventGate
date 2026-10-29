const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const PaymentSubmission = require('../models/PaymentSubmission');
const { protect } = require('../middleware/auth');

/**
 * GET /api/buyer/payment-history
 * Returns paginated payment history for the authenticated buyer.
 */
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Optional filters
    const filter = { 
      $or: [
        { buyerId: req.user._id },
        { buyerEmail: req.user.email }
      ]
    };
    
    if (req.query.status) {
        filter.paymentStatus = req.query.status;
    }

    const totalOrders = await Order.countDocuments(filter);
    
    const orders = await Order.find(filter)
      .populate('eventId', 'name venue startDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enqueue payment submission details for bank transfers
    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      let submissionDetails = null;
      if (order.paymentMethod === 'bank_transfer') {
        submissionDetails = await PaymentSubmission.findOne({ orderId: order._id }).lean();
      }
      return {
        ...order,
        submissionDetails
      };
    }));

    res.json({
      success: true,
      data: enhancedOrders,
      pagination: {
        page,
        limit,
        total: totalOrders,
        pages: Math.ceil(totalOrders / limit)
      }
    });

  } catch (error) {
    console.error('Buyer Payment History Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching payment history' });
  }
});

module.exports = router;
