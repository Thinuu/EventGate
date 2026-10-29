import api from './client';
export const scanEntry = (data) => api.post('/entry/scan', data);
export const getEntryLogs = (params) => api.get('/entry/logs', { params });
export const getEntryStats = (eventOrParams) => {
  const params = typeof eventOrParams === 'string' ? { eventId: eventOrParams } : eventOrParams;
  return api.get('/entry/stats', { params });
};
export const searchEntryAttendees = (params) => api.get('/entry/search', { params });
export const lookupEntry = (params) => api.get('/entry/lookup', { params });
export const lookupAttendee = (qrToken) => api.get(`/entry/attendee/${qrToken}`);
export const checkInAttendee = (data) => api.post('/entry/checkin', data);
export const checkOutAttendee = (data) => api.post('/entry/checkout', data);

// RFID Assignment endpoints (QR-first flow)
export const getEventRfidStatus = (eventId) => api.get(`/entry/event-rfid-status/${eventId}`);
export const getAttendeeByQr = (qrToken, eventId) => api.get(`/entry/attendee-by-qr/${qrToken}`, { params: { eventId } });
export const assignRfidToAttendee = (data) => api.post('/entry/rfid-assign', data);
