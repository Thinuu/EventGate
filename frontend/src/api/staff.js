import api from './client';

export const scanStaffEntry = (payload) => api.post('/staff/scan-entry', payload);
export const scanStaffZone = (payload) => api.post('/staff/scan-zone', payload);
export const searchStaffAttendees = (params) => api.get('/staff/search', { params });
