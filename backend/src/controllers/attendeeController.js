const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');

  const mapTicket = (ticket, qrCode) => ({
  _id: ticket._id,
  ticketNumber: ticket.ticketNumber,
  status: ticket.status,
  categoryName: ticket.categoryName,
  allowedZones: ticket.allowedZones || [],
  event: ticket.event ? {
    _id: ticket.event._id,
    name: ticket.event.name,
    startDate: ticket.event.startDate,
    endDate: ticket.event.endDate,
    venue: ticket.event.venue,
  } : null,
    attendee: ticket.attendee ? {
      _id: ticket.attendee._id,
      fullName: ticket.attendee.fullName,
      email: ticket.attendee.email,
      phone: ticket.attendee.phone,
      photo: ticket.attendee.photo,
      confirmationStatus: ticket.attendee.confirmationStatus,
      isConfirmed: ticket.attendee.isConfirmed,
      photoVerificationStatus: ticket.attendee.photoVerificationStatus,
      resubmitToken: ticket.attendee.resubmitToken,
      qrToken: ticket.attendee.qrToken,
      qrCode: ticket.attendee.qrCode || qrCode,
      notes: ticket.attendee.notes,
      allowedZones: ticket.attendee.allowedZones || ticket.allowedZones || [],
    } : null,
});

const getAttendeeTickets = async (req, res, next) => {
  try {
    const email = req.user.email?.toLowerCase?.() || '';
    const attendees = await Attendee.find({ email }).select('_id');
    const attendeeIds = attendees.map((a) => a._id);
    if (!attendeeIds.length) {
      return res.json({ success: true, data: { tickets: [] } });
    }
    const tickets = await Ticket.find({ attendee: { $in: attendeeIds } })
      .populate('event', 'name startDate endDate venue')
      .populate('attendee', 'fullName email phone photo confirmationStatus isConfirmed qrToken qrCode notes allowedZones photoVerificationStatus resubmitToken')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { tickets: tickets.map((t) => mapTicket(t)) } });
  } catch (err) { next(err); }
};

const getAttendeeTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }
    const email = req.user.email?.toLowerCase?.() || '';
    const attendee = await Attendee.findOne({ email });
    if (!attendee) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const ticket = await Ticket.findOne({ _id: req.params.ticketId, attendee: attendee._id })
      .populate('event', 'name startDate endDate venue')
      .populate('attendee', 'fullName email phone photo confirmationStatus isConfirmed qrToken qrCode notes allowedZones photoVerificationStatus resubmitToken');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    let qrCode = ticket.attendee?.qrCode;
    if (!qrCode && ticket.attendee?.qrToken) {
      qrCode = await QRCode.toDataURL(ticket.attendee.qrToken);
    }

    res.json({ success: true, data: { ticket: mapTicket(ticket, qrCode) } });
  } catch (err) { next(err); }
};

module.exports = {
  getAttendeeTickets,
  getAttendeeTicket,
};