const crypto = require('node:crypto');
const router = require('express').Router();
const { withJobLease } = require('../services/jobLease');
router.get('/', async (req, res, next) => {
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  const received = req.get('authorization') || '';
  if (!process.env.CRON_SECRET || received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.sendStatus(401);
  try {
    const result = await withJobLease('maintenance-v1', async () => {
      const deadline = Date.now() + 45000;
      let processed = 0;
      while (Date.now() < deadline && processed < 20) {
        const task = await require('../jobs/paymentTasks').processNextTask();
        if (!task?.processed) break;
        processed++;
      }
      const reservations = await require('../jobs/reservationMaintenance').runReservationMaintenance(25);
      await require('../utils/bankTransferScheduler').checkPendingPaymentsAndReservations(req.app.get('io'));
      const rfid = await require('../jobs/rfidArchiveRelease').runArchiveAndRelease();
      return { paymentTasks: processed, reservations, rfid };
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});
module.exports = router;
