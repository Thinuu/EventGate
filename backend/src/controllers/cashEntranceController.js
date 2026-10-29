const mongoose = require('mongoose');
const Order = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const QRCode = require('qrcode');
const { sendCashReservationEmail, sendCashReservationSMS, sendCashPaymentConfirmedEmail } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { emitDashboardEvent } = require('../utils/socket');
const SystemConfig = require('../models/SystemConfig');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');

// Helper to compute reservation expiry hours from config
async function getReservationExpiry() {
  const config = await SystemConfig.findOne({ key: 'global' }).lean();
  const hours = config?.payment?.cashAtEntrance?.reservationExpiryHours ?? 48;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// Create cash reservation (order with RESERVED status)
exports.createCashReservation = async (req, res) => {
  try {
    const { eventId, buyerName, buyerEmail, buyerPhone, notificationChannel, tickets } = req.body;
    if (!eventId || !buyerName || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Compute total amount and validate categories
    let totalAmount = 0;
    const validatedTickets = [];
    for (const ticket of tickets) {
      const category = event.categories.find(c => c.name === ticket.categoryName);
      if (!category) {
        return res.status(400).json({ success: false, message: `Category "${ticket.categoryName}" not found` });
      }
      const remaining = category.capacity - category.sold;
      if (ticket.quantity > remaining) {
        return res.status(400).json({ success: false, message: `Only ${remaining} tickets left for ${ticket.categoryName}` });
      }
      const price = category.price;
      totalAmount += price * ticket.quantity;
      validatedTickets.push({ categoryName: ticket.categoryName, quantity: ticket.quantity, price });
    }

    const reservationExpiry = await getReservationExpiry();

    const order = new Order({
      eventId,
      buyerId: req.user?._id,
      buyerName,
      buyerEmail,
      buyerPhone,
      notificationChannel: notificationChannel || 'email',
      tickets: validatedTickets,
      totalAmount,
      paymentMethod: 'cash_at_entrance',
      paymentStatus: 'awaiting_payment',
      status: 'RESERVED',
      reservationExpiry,
    });
    await order.save();

    // Create ticket documents with RESERVED status
    const ticketPromises = [];
    let slotIndex = 1;
    for (const t of validatedTickets) {
      const category = event.categories.find(c => c.name === t.categoryName);
      for (let i = 0; i < t.quantity; i++) {
        const ticketDoc = new Ticket({
          order: order._id,
          event: eventId,
          categoryId: category.id,
          categoryName: t.categoryName,
          allowedZones: category.allowedZones || [],
          price: t.price,
          status: 'RESERVED',
          slotIndex,
          ticketNumber: `${order.orderNumber}-${slotIndex}`,
        });
        ticketPromises.push(ticketDoc.save());
        slotIndex++;
      }
    }
    await Promise.all(ticketPromises);

    try {
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', eventId, {
        type: 'CASH_RESERVATION_CREATED',
        eventId,
        orderId: order._id,
        paymentMethod: 'cash_at_entrance',
      });
    } catch (socketErr) {
      console.error('Cash reservation socket broadcast error:', socketErr);
    }

    // Send reservation notifications
    try { await sendCashReservationEmail({ email: buyerEmail, name: buyerName }, order); } catch (e) { console.error('Cash reservation email error', e); }
    if (buyerPhone) {
      try { await sendCashReservationSMS(buyerPhone, order); } catch (e) { console.error('Cash reservation SMS error', e); }
    }

    res.status(201).json({ success: true, data: { orderId: order._id, reservationExpiry } });
  } catch (err) {
    console.error('createCashReservation error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

// Get instructions for a cash reservation
exports.getCashInstructions = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('eventId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.paymentMethod !== 'cash_at_entrance') {
      return res.status(400).json({ success: false, message: 'Not a cash‑at‑entrance order' });
    }
    const config = await SystemConfig.findOne({ key: 'global' }).lean();
    const terms = config?.payment?.cashAtEntrance?.terms ?? '';
    res.json({ success: true, data: { order: { orderNumber: order.orderNumber, totalAmount: order.totalAmount, reservationExpiry: order.reservationExpiry }, terms } });
  } catch (err) {
    console.error('getCashInstructions error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Optional: collect additional reservation info (currently a noop)
exports.submitReservationInfo = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    // Here you could store extra info from req.body if needed.
    res.json({ success: true, message: 'Info recorded' });
  } catch (err) {
    console.error('submitReservationInfo error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Staff marks cash payment received
exports.confirmCashPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    // RBAC check: allow higher roles or staff with explicit canCollectCash permission
    const { normalizeRole, ROLES } = require('../utils/rbac');
    const role = normalizeRole(req.user.role);
    const isHigherRole = [ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(role);
    const hasExplicitPermission = req.user.canCollectCash === true || (req.user.permissions && req.user.permissions.canCollectCash === true);

    if (!isHigherRole && !hasExplicitPermission) {
      return res.status(403).json({ success: false, message: 'You do not have permission to collect cash or confirm payments.' });
    }

    const order = await Order.findById(orderId).populate('eventId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentMethod !== 'cash_at_entrance') {
      return res.status(400).json({ success: false, message: 'Not a cash‑at‑entrance order' });
    }

    // EVENT ACCESS CHECK: Verify user has access to this event
    const eventId = order.eventId?._id || order.eventId;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Invalid order: missing event reference' });
    }

    // MainAdmin bypass
    if (role !== ROLES.MAIN_ADMIN) {
      const userId = String(req.user._id);
      const eventObj = order.eventId._id ? order.eventId : await Event.findById(eventId);
      
      const isCreator = String(eventObj.createdBy) === userId;
      const isMainOrganiser = (eventObj.mainOrganisers || []).some(id => String(id) === userId);
      const isAssigned = (eventObj.assignedOrganisers || []).some(id => String(id) === userId);
      const hasEventAccess = isCreator || isMainOrganiser || isAssigned || 
        (req.user.assignedEvents || []).some(eId => String(eId) === String(eventId));
      
      if (!hasEventAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
    }

    // IDEMPOTENCY: Check if already confirmed
    if (order.paymentStatus === 'paid' && order.status === 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'Cash payment already confirmed for this order.' });
    }
    // Update order status
    order.paymentStatus = 'paid';
    order.status = 'CONFIRMED';
    order.paidAt = new Date();
    await order.save();

    // Update tickets to SOLD and generate QR codes
    const tickets = await Ticket.find({ order: order._id });
    for (const ticket of tickets) {
      ticket.status = 'SOLD';
      ticket.qrActive = true;
      ticket.qrCode = await QRCode.toDataURL(ticket.ticketNumber);
      await ticket.save();
    }

    await processOrderFinalConfirmation({ orderId: order._id })
      .catch((error) => console.error('Cash QR/RFID assignment error:', error));

    // Notifications
    try { await sendCashPaymentConfirmedEmail({ email: order.buyerEmail, name: order.buyerName }, order); } catch (e) { console.error('Cash payment confirmed email error', e); }
    
    // SMS notification
    if (order.buyerPhone) {
      try {
        const { sendSMS } = require('../services/smsService');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        await sendSMS(
          order.buyerPhone,
          `EventGate: Your cash payment for Order ${order.orderNumber} has been received and your order is now confirmed. Complete your pass here: ${frontendUrl}/buyer/orders`
        );
      } catch (smsErr) {
        console.error('Error sending cash payment confirmation SMS:', smsErr);
      }
    }

    // Log activity and emit dashboard event
    await logActivity({ 
      req, 
      action: 'cash_payment_confirm', 
      eventId: order.eventId?._id, 
      details: { 
        orderId: order._id,
        confirmedBy: req.user._id,
        collectorName: req.user.name,
      } 
    });

    const io = req.app.get('io');
    emitDashboardEvent(io, 'cash_payment_confirmed', order.eventId?._id, { orderId: order._id });

    // Emit socket event to buyer room
    const { emitBuyerEvent } = require('../utils/socket');
    if (order.buyerId) {
      emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        action: 'approved',
      });
    }

    res.json({ success: true, message: 'Cash payment confirmed' });
  } catch (err) {
    console.error('confirmCashPayment error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get cash orders for dashboard
exports.getCashOrders = async (req, res) => {
  try {
    const { eventId, status } = req.query;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required' });
    }

    // Role-based validation
    const { normalizeRole, ROLES } = require('../utils/rbac');
    const role = normalizeRole(req.user.role);
    const isHigherRole = [ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(role);
    const hasExplicitPermission = req.user.canCollectCash === true || (req.user.permissions && req.user.permissions.canCollectCash === true);

    if (!isHigherRole && !hasExplicitPermission) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view cash orders.' });
    }

    // Verify staff is assigned to the event
    if (!isHigherRole) {
      const isAssigned = (req.user.assignedEvents || []).map(String).includes(String(eventId));
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this event.' });
      }
    }
    
    // Status can be 'pending' (RESERVED) or 'approved' (CONFIRMED)
    let orderStatus = {};
    if (status === 'pending') orderStatus = { status: 'RESERVED' };
    else if (status === 'approved') orderStatus = { status: 'CONFIRMED' };
    else if (status === 'rejected') orderStatus = { status: 'CANCELLED' };
    
    let query = {
      eventId,
      paymentMethod: { $in: ['cash_on_entrance', 'cash_at_entrance'] },
      ...orderStatus
    };

    // Filter by staff allowed zones if they are scoped to particular zones/ticket categories
    let orders;
    if (!isHigherRole && (req.user.assignedZones?.length > 0 || req.user.responsibilities?.zoneIds?.length > 0)) {
      const myZones = req.user.assignedZones || req.user.responsibilities?.zoneIds || [];
      
      // Get the event to find categories allowed in these zones
      const event = await Event.findById(eventId).lean();
      if (event) {
        // Find categories that are allowed in the staff's assigned zones
        const allowedCategoryNames = event.categories
          .filter(cat => cat.allowedZones && cat.allowedZones.some(zone => myZones.includes(zone)))
          .map(cat => cat.name);
        
        if (allowedCategoryNames.length > 0) {
          // Filter orders to only include those with tickets from allowed categories
          query['tickets.categoryName'] = { $in: allowedCategoryNames };
        } else {
          // If no allowed categories, return empty result
          return res.json({ success: true, data: [], info: 'No categories match your assigned zones' });
        }
      }
    }

    // Debug: log query
    console.log('Cash orders query:', JSON.stringify(query, null, 2));

    orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    
    // Debug: log count
    console.log('Found', orders.length, 'cash orders for event', eventId);

    // Enrich orders with zone information from event categories
    const event = await Event.findById(eventId).lean();
    if (event && event.categories) {
      const categoryZoneMap = {};
      event.categories.forEach(cat => {
        if (cat.allowedZones) {
          categoryZoneMap[cat.name] = cat.allowedZones;
        }
      });

      orders = orders.map(order => ({
        ...order,
        zones: [...new Set(
          (order.tickets || [])
            .flatMap(t => categoryZoneMap[t.categoryName] || [])
        )]
      }));
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('getCashOrders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
