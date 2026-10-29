import api from './client';

export const getOrganiserWorkspace = (params) => api.get('/organiser/workspace', { params });

export const getOrganiserAttendees = (params) => api.get('/organiser/attendees', { params });
export const createOrganiserAttendee = (formData) => api.post('/organiser/attendees', formData);
export const updateOrganiserAttendee = (id, payload) => api.put(`/organiser/attendee/${id}`, payload);
export const deleteOrganiserAttendee = (id, eventId) => api.delete(`/organiser/attendee/${id}`, { params: { eventId } });
export const downloadOrganiserTemplate = (params) => api.get('/organiser/template', { params, responseType: 'blob' });
export const uploadOrganiserBulk = (formData) => api.post('/organiser/attendees/bulk', formData);
export const inviteOrganiserAttendee = (id, eventId) => api.post(`/organiser/attendees/${id}/invite`, {}, { params: { eventId } });
export const verifyOrganiserAttendee = (id, payload) => api.post(`/organiser/verification/${id}`, payload);
export const getOrganiserAttendeesScoped = (params) => getOrganiserAttendees(params);

export const getOrganiserTicketCategories = (params) => api.get('/organiser/ticket-categories', { params });
export const createTicketCategory = (payload) => api.post('/organiser/ticket-categories', payload);
export const updateTicketCategory = (categoryId, payload) => api.put(`/organiser/ticket-categories/${categoryId}`, payload);
export const deleteTicketCategory = (categoryId, eventId) => api.delete(`/organiser/ticket-categories/${categoryId}`, { params: { eventId } });

export const listSubOrganisers = (params) => api.get('/organiser/sub-organisers', { params });
export const createSubOrganiser = (payload) => api.post('/organiser/sub-organiser', payload);
export const updateSubOrganiser = (id, payload) => api.put(`/organiser/sub-organiser/${id}`, payload);
export const updateSubOrganiserStatus = (id, payload) => {
  const data = typeof payload === 'string' ? { status: payload } : payload;
  return updateSubOrganiser(id, data);
};
export const deleteSubOrganiser = (id) => api.delete(`/organiser/sub-organiser/${id}`);
export const getCustomRoles = (params) => api.get('/organiser/custom-roles', { params });
export const createCustomRole = (payload) => api.post('/organiser/custom-roles', payload);
export const updateCustomRole = (id, payload) => api.put(`/organiser/custom-roles/${id}`, payload);
export const deleteCustomRole = (id, eventId) => api.delete(`/organiser/custom-roles/${id}`, { params: { eventId } });

export const getVerificationQueue = (params) => api.get('/organiser/verification', { params });
export const updateVerificationStatus = (attendeeId, payload) => api.post(`/organiser/verification/${attendeeId}`, payload);

export const getInviteHistory = (params) => api.get('/organiser/invites', { params });
export const resendInvite = (ticketId, eventId) => api.post(`/organiser/invites/${ticketId}/resend`, {}, { params: { eventId } });
export const cancelInvite = (ticketId, eventId) => api.patch(`/organiser/invites/${ticketId}/cancel`, {}, { params: { eventId } });

export const getOrganiserEventStats = (id) => api.get(`/organiser/event/${id}/stats`);
export const getOrganiserEventLogs = (id, params) => api.get(`/organiser/event/${id}/entry-logs`, { params });
export const getOrganiserZonesReport = (id) => api.get(`/organiser/event/${id}/zones/report`);
export const exportOrganiserEventData = (id, params) => api.get(`/organiser/event/${id}/export`, { params, responseType: 'blob' });
export const getOrganiserEntryLogs = async (params) => {
  const eventId = params?.eventId || localStorage.getItem('lastSelectedEventId');
  if (!eventId) return { data: { success: true, data: { logs: [] } } };
  const { eventId: _eventId, ...rest } = params || {};
  return getOrganiserEventLogs(eventId, rest);
};
export const getOrganiserEvent = async () => {
  const res = await getOrganiserWorkspace({ eventId: localStorage.getItem('lastSelectedEventId') || undefined });
  return { ...res, data: { ...(res.data || {}), data: { ...(res.data?.data || {}), event: res.data?.data?.event || null } } };
};
export const getOrganiserDashboardStats = async () => {
  const eventId = localStorage.getItem('lastSelectedEventId');
  if (!eventId) return { data: { success: true, data: {} } };
  return getOrganiserEventStats(eventId);
};

export const getOrganiserZones = (params) => api.get('/organiser/zones', { params });
export const createZone = (payload) => api.post('/organiser/zones', payload);
export const updateZone = (zoneId, payload) => api.put(`/organiser/zones/${zoneId}`, payload);
export const deleteZone = (zoneId, eventId) => api.delete(`/organiser/zones/${zoneId}`, { params: { eventId } });
export const assignZoneCategories = (zoneId, payload) => api.patch(`/organiser/zones/${zoneId}/categories`, payload);

export const getOrganiserNotifications = (params) => api.get('/organiser/notifications', { params });
export const resendOrganiserNotification = (id, eventId) => api.post(`/organiser/notifications/${id}/resend`, {}, { params: { eventId } });

export const getOrganiserSettings = (params) => api.get('/organiser/settings', { params });
export const updateOrganiserSettings = (payload) => api.put('/organiser/settings', payload);
export const updateOrganiserEventCustomization = (payload) => api.put('/organiser/event-customization', payload);

export const getSponsorPackages = (params) => api.get('/organiser/sponsor-packages', { params });
export const createSponsorPackage = (payload, params) => api.post('/organiser/sponsor-packages', payload, { params });
export const updateSponsorPackage = (id, payload, params) => api.put(`/organiser/sponsor-packages/${id}`, payload, { params });
export const deleteSponsorPackage = (id, eventId) => api.delete(`/organiser/sponsor-packages/${id}`, { params: { eventId } });

export const getSponsors = (params) => api.get('/organiser/sponsors', { params });
export const createSponsor = (payload, params) => api.post('/organiser/sponsors', payload, { params });
export const deleteSponsor = (id, eventId) => api.delete(`/organiser/sponsors/${id}`, { params: { eventId } });

// Payment management for organizers
export const getAllPayments = (params) => api.get('/payment-management/organizer', { params });
export const getPaymentStatistics = (params) => api.get('/payment-management/organizer/statistics', { params });
export const getPaymentDetails = (submissionId) => api.get(`/payment-management/organizer/${submissionId}`);
export const approvePayment = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/approve`, data);
export const rejectPayment = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/reject`, data);
export const requestPaymentInfo = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/request-info`, data);
export const exportPayments = (params) => api.get('/payment-management/organizer/export', { params, responseType: 'blob' });
