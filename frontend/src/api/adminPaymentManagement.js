import api from './client';

// Get all payment submissions (admin view)
export const getAllPayments = (params) => api.get('/payment-management/admin', { params });

// Get payment statistics
export const getPaymentStatistics = (params) => api.get('/payment-management/admin/statistics', { params });

// Get payment submission details
export const getPaymentDetails = (submissionId) => api.get(`/payment-management/admin/${submissionId}`);

// Approve a payment submission
export const approvePayment = (submissionId, data) => api.post(`/payment-management/admin/${submissionId}/approve`, data);

// Reject a payment submission
export const rejectPayment = (submissionId, data) => api.post(`/payment-management/admin/${submissionId}/reject`, data);

// Request more information for a payment
export const requestPaymentInfo = (submissionId, data) => api.post(`/payment-management/admin/${submissionId}/request-info`, data);

// Export payments
export const exportPayments = (params) => api.get('/payment-management/admin/export', { params, responseType: 'blob' });