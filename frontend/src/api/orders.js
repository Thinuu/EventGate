import api from './client';

// Create new order
export const createOrder = (data) => api.post('/orders', data);

// Create bank transfer order
export const createBankTransferOrder = (data) => api.post('/bank-transfer/order', data);

// Get order by confirmation token
export const getOrderByToken = (token) => api.get(`/orders/confirm/${token}`);
export const getBuyerOrderByToken = (token) =>  api.get(`/orders/confirm/${token}`);

// Finalize order after all tickets are assigned
export const finalizeOrder = (orderId, confirmationToken) => api.post(`/orders/finalize/${orderId}`, { confirmationToken });

// Buyer confirmation portal slot actions
export const saveTicketAttendee = (ticketId, data) => api.post(`/tickets/${ticketId}/attendee`, data);
export const sendTicketInvite = (ticketId, data) => api.post(`/tickets/${ticketId}/invite`, data);

// Sample request/response examples:
/*
// POST /api/orders
const sampleRequest = {
  eventId: "507f1f77bcf86cd799439011",
  buyerName: "John Doe",
  buyerEmail: "john@example.com",
  buyerPhone: "+1234567890",
  tickets: [
    {
      categoryName: "VIP",
      quantity: 2,
      price: 5000
    },
    {
      categoryName: "General",
      quantity: 1,
      price: 2000
    }
  ]
};

// Response
const sampleResponse = {
  success: true,
  data: {
    orderId: "507f1f77bcf86cd799439012",
    orderNumber: "ORD-A1B2C3D4",
    confirmationToken: "uuid-string-here",
    totalAmount: 12000
  },
  message: "Order created successfully"
};
*/
