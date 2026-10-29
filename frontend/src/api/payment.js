import api from './client';

/**
 * Get payment configuration (active gateways, supported methods) for an event.
 */
export const getPaymentConfig = async (eventId) => {
  const res = await api.get(`/payment/config/${eventId}`);
  return res.data;
};

/**
 * Create a payment session for the given order and gateway.
 * Returns { provider, sessionUrl, sessionId } for Stripe
 * or { provider, paymentData } for PayHere.
 */
export const createPaymentSession = async (orderId, gateway, confirmationToken) => {
  const res = await api.post('/payment/create-session', { orderId, gateway, confirmationToken });
  return res.data;
};
