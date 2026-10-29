// Event payloads are private to authorized rooms. Never globally broadcast PII.
const emitDashboardEvent = (io, channel, eventId, payload) => {
  if (!io || !eventId) return;
  io.to(`dashboard:${eventId}`).to(`event:${eventId}`).emit(channel, payload);
  if (channel === 'event_update') io.to('listings').emit('event_update', { eventId: String(eventId), type: payload?.type || 'UPDATED' });
};
const emitBuyerEvent = (io, buyerId, channel, payload) => {
  if (io && buyerId) io.to(`buyer:${buyerId}`).emit(channel, payload);
};
module.exports = { emitDashboardEvent, emitBuyerEvent };
