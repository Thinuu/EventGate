import api from './client';

export default api;
export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
  updatePassword: (d) => api.patch('/auth/update-password', d),
};
export const eventsAPI = {
  list: (p) => api.get('/events', { params: p }),
  get: (slug) => api.get(`/events/${slug}`),
  adminAll: (p) => api.get('/events/admin/all', { params: p }),
  myEvents: () => api.get('/events/my/events'),
  create: (d) => api.post('/events', d),
  update: (id, d) => api.patch(`/events/${id}`, d),
  publish: (id) => api.patch(`/events/${id}/publish`),
  assignOrganiser: (id, d) => api.patch(`/events/${id}/assign-organiser`, d),
  dashboard: (id) => api.get(`/events/${id}/dashboard`),
};
export const ordersAPI = {
  create: (d) => api.post('/orders', d),
  getByToken: (t) => api.get(`/orders/confirm/${t}`),
  markPaid: (id, d) => api.patch(`/orders/${id}/mark-paid`, d),
  list: (p) => api.get('/orders', { params: p }),
};
export const attendeesAPI = {
  list: (p) => api.get('/attendees', { params: p }),
  get: (id) => api.get(`/attendees/${id}`),
  create: (d) => api.post('/attendees', d),
  update: (id, d) => api.patch(`/attendees/${id}`, d),
  confirmByToken: (t, fd) => api.post(`/attendees/confirm/${t}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getConfirmByToken: (t) => api.get(`/attendees/confirm/${t}`),
  bulkUpload: (fd) => api.post('/attendees/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadTemplate: () => api.get('/attendees/template', { responseType: 'blob' }),
  invite: (id) => api.post(`/attendees/${id}/invite`),
  verifyPhoto: (id, d) => api.patch(`/attendees/${id}/verify-photo`, d),
};
export const usersAPI = {
  list: (p) => api.get('/users', { params: p }),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.patch(`/users/${id}`, d),
  assignEvent: (id, d) => api.patch(`/users/${id}/assign-event`, d),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};
export const entryAPI = {
  scan: (d) => api.post('/entry/scan', d),
  logs: (p) => api.get('/entry/logs', { params: p }),
  stats: (p) => api.get('/entry/stats', { params: p }),
  getAttendeeByQR: (t) => api.get(`/entry/attendee/${t}`),
};
