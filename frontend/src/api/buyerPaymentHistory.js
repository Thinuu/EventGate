import api from './client';

/**
 * Get buyer's payment history with pagination and status filtering
 * @param {Object} params - { page, limit, status }
 */
export const getBuyerPaymentHistory = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.status) queryParams.append('status', params.status);

  const res = await api.get(`/buyer/payment-history?${queryParams.toString()}`);
  return res.data;
};
