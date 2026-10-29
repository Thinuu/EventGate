import api from './client';

// Get buyer's order history
export const getBuyerOrderHistory = (params) => api.get('/buyer/orders', { params });

// Get order details
export const getOrderDetails = (orderId) => api.get(`/buyer/orders/${orderId}`);

// Cancel an order
export const cancelOrder = (orderId, reason) => api.post(`/buyer/orders/${orderId}/cancel`, { reason });

// Request refund
export const requestRefund = (orderId, reason) => api.post(`/buyer/orders/${orderId}/refund`, { reason });

// Get order tickets
export const getOrderTickets = (orderId) => api.get(`/buyer/orders/${orderId}/tickets`);

// Download order invoice
export const downloadInvoice = (orderId) => api.get(`/buyer/orders/${orderId}/invoice`, { responseType: 'blob' });