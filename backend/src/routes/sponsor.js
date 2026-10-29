const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Sponsor = require('../models/Sponsor');
const { notifySponsorPassInvite } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');

// Middleware to ensure user is a Sponsor
const requireSponsor = (req, res, next) => {
  if (req.user.role !== 'Sponsor') {
    return res.status(403).json({ success: false, message: 'Sponsor access required.' });
  }
  next();
};

router.get('/workspace', protect, requireSponsor, async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findOne({ userId: req.user._id }).populate('eventId');
    if (!sponsor) return res.status(404).json({ success: false, message: 'No sponsor assignment found.' });

    const event = sponsor.eventId;
    const pkg = event.sponsorPackages.find(p => p.id === sponsor.packageId);
    
    res.json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          venue: event.venue,
          startDate: event.startDate
        },
        package: pkg,
        sponsor: sponsor
      }
    });
  } catch (err) { next(err); }
});

router.get('/team', protect, requireSponsor, async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findOne({ userId: req.user._id });
    if (!sponsor) return res.status(404).json({ success: false, message: 'No sponsor assignment found.' });

    const team = await Attendee.find({
      event: sponsor.eventId,
      sponsorId: sponsor._id,
      isPass: true
    });

    res.json({ success: true, data: team });
  } catch (err) { next(err); }
});

router.post('/team', protect, requireSponsor, async (req, res, next) => {
  try {
    const { fullName, email, phone } = req.body;
    if (!fullName) return res.status(400).json({ success: false, message: 'Name is required.' });

    const sponsor = await Sponsor.findOne({ userId: req.user._id }).populate('eventId');
    if (!sponsor) return res.status(404).json({ success: false, message: 'No sponsor assignment found.' });

    const event = sponsor.eventId;
    const emailRequired = event.settings?.communicationChannels?.email === true;
    const smsRequired = event.settings?.communicationChannels?.sms === true;

    if (emailRequired && (!email || String(email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for this event.' });
    }
    if (smsRequired && (!phone || String(phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for this event.' });
    }
    const pkg = event.sponsorPackages.find(p => p.id === sponsor.packageId);

    // Count current team members for this sponsor
    const currentTeamCount = await Attendee.countDocuments({ sponsorId: sponsor._id, isPass: true });

    if (currentTeamCount >= pkg.capacity) {
      return res.status(400).json({ success: false, message: 'Pass capacity reached for your package.' });
    }

    const attendee = await Attendee.create({
      fullName,
      email,
      phone,
      event: event._id,
      isPass: true,
      sponsorPackageId: pkg.id,
      sponsorId: sponsor._id,
      categoryName: `${pkg.name} Pass`,
      allowedZones: pkg.zones,
      addedVia: 'sponsor',
      confirmationStatus: 'invited',
      addedBy: req.user._id
    });

    await logActivity({
      req,
      action: 'sponsor_action',
      eventId: event._id,
      details: { message: `Sponsor created pass: ${fullName} (${pkg.name} Pass)` }
    });

    await logActivity({
      req,
      action: 'ticket_creation',
      eventId: event._id,
      details: { message: `Ticket pass created by sponsor: ${fullName}` }
    });

    try {
      await notifySponsorPassInvite(attendee, event, pkg);
    } catch (emailErr) {
      console.error('Failed to send pass invite:', emailErr);
    }

    res.json({ success: true, message: 'Team member added.', data: attendee });
  } catch (err) { next(err); }
});

router.delete('/team/:id', protect, requireSponsor, async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findOne({ userId: req.user._id });
    const attendee = await Attendee.findById(req.params.id);
    
    if (!attendee || !attendee.sponsorId || attendee.sponsorId.toString() !== sponsor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized or member not found.' });
    }

    await Attendee.findByIdAndDelete(req.params.id);
    await logActivity({
      req,
      action: 'sponsor_action',
      eventId: sponsor.eventId,
      details: { message: `Sponsor removed pass holder: ${attendee.fullName}` }
    });
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { next(err); }
});

module.exports = router;
