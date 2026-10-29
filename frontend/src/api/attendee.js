import api from './client';

export const getAttendeeTickets = () => api.get('/user/tickets');
export const getAttendeeTicket = (ticketId) => api.get(`/user/ticket/${ticketId}`);
