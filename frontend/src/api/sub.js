import api from './client';

export const getSubDashboard = (params) => api.get('/sub/dashboard', { params });
export const getSubZones = (params) => api.get('/sub/zones', { params });
export const getSubAttendees = (params) => api.get('/sub/attendees', { params });
export const getSubLogs = (params) => api.get('/sub/logs', { params });
export const verifySubAttendee = (payload) => api.post('/sub/verify', payload);
export const scanSubEntry = (payload) => api.post('/sub/scan-entry', payload);
export const scanSubZone = (payload) => api.post('/sub/scan-zone', payload);
export const assignSubRfid = (attendeeId, payload) => api.post(`/sub/attendees/${attendeeId}/rfid`, payload);

// Team Management for Sub-Organisers (Scoping handled by backend)
export const getSubOrgTeam = (params) => api.get('/organiser/sub-organisers', { params });
export const createSubOrgTeamMember = (payload) => api.post('/organiser/sub-organiser', payload);
export const updateSubOrgTeamMember = (id, payload) => api.put(`/organiser/sub-organiser/${id}`, payload);

// Ticket Management for Sub-Organisers
export const createSubTicket = (payload) => api.post('/sub/tickets', payload);
export const updateSubTicket = (categoryId, payload) => api.patch(`/sub/tickets/${categoryId}`, payload);
export const deleteSubTicket = (categoryId, params) => api.delete(`/sub/tickets/${categoryId}`, { params });
export const regenerateTicketCode = (categoryId, payload) => api.patch(`/sub/tickets/${categoryId}/regenerate`, payload);
// Sub-Organiser Search
export const searchSubOrgAttendees = (params) => api.get('/sub/attendees', { params });