module.exports = function wakePaymentWorker() {
  const work = require('../jobs/paymentTasks').processNextTask();
  if (process.env.VERCEL) require('@vercel/functions').waitUntil(work);
  else work.catch(error => console.error('Payment worker wake failed:', error.message));
};
