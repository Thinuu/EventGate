import api from './client';

export const getRfidInventory = (params) => api.get('/rfid/inventory', { params });
export const addInventoryRfid = (rfidTags) => api.post('/rfid/inventory', { rfidTags });
export const uploadInventoryRfid = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/rfid/inventory/bulk', form);
};
export const assignRfidToAttendee = (qrToken, rfidTag) => api.post('/rfid/assign', { qrToken, rfidTag });
export const getRfidTags = (eventId) => api.get(`/rfid/events/${eventId}`);
export const addRfidTags = (eventId, categoryId, rfidTags) => api.post(`/rfid/events/${eventId}/tags`, { categoryId, rfidTags });
export const uploadRfidTags = (eventId, categoryId, file) => {
  const form = new FormData();
  form.append('categoryId', categoryId);
  form.append('file', file);
  return api.post(`/rfid/events/${eventId}/upload`, form);
};
export const deleteRfidTag = (eventId, tagId) => api.delete(`/rfid/events/${eventId}/tags/${tagId}`);

// RFID validation and unassign endpoints
export const validateRfidTag = (rfidTag, params) => api.get(`/rfid/validate/${rfidTag}`, { params });
export const unassignRfidTag = (rfidTag, reason) => api.delete(`/rfid/unassign/${rfidTag}`, { data: { reason } });
export const getRfidAssignment = (attendeeId) => api.get(`/rfid/assignment/${attendeeId}`);

// Inventory management endpoints
export const disableRfidTag = (rfidTag, reason) => api.patch(`/rfid/inventory/${rfidTag}/disable`, { reason });
export const enableRfidTag = (rfidTag) => api.patch(`/rfid/inventory/${rfidTag}/enable`);
export const deleteRfidFromInventory = (rfidTag) => api.delete(`/rfid/inventory/${rfidTag}`);

// RFID assignment to attendee (used by sub-organizer and admin)
export const assignInventoryRfid = (attendeeId, rfidTag, replaceExisting = false) => {
  return api.post(`/attendees/${attendeeId}/rfid`, { rfidTag, replaceExisting });
};

// New RFID Architecture Endpoints
export const getRfidAssignments = (params) => api.get('/rfid/assignments', { params });
export const getRfidAccessLogs = (params) => api.get('/rfid/access-logs', { params });
export const getRfidTagHistory = (rfidTag) => api.get(`/rfid/tags/${rfidTag}/history`);
export const getEventRfidOverview = (eventId) => api.get(`/rfid/events/${eventId}/overview`);
