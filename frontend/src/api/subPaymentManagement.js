import api from './client';

// Sub-Organiser payment management - uses /organizer routes which allow sub_organiser role
export const getSubOrgPayments = (params) => api.get('/payment-management/organizer', { params });
export const getSubOrgPaymentStatistics = (params) => api.get('/payment-management/organizer/statistics', { params });
export const getSubOrgPaymentDetails = (submissionId) => api.get(`/payment-management/organizer/${submissionId}`);
export const approveSubOrgPayment = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/approve`, data);
export const rejectSubOrgPayment = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/reject`, data);
export const requestSubOrgPaymentInfo = (submissionId, data) => api.post(`/payment-management/organizer/${submissionId}/request-info`, data);
