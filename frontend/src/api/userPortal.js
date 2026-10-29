import api from './client';

export const getUserDashboard = () => api.get('/user/dashboard');
export const getUserTickets = () => api.get('/user/tickets');
export const getUserTicket = (id) => api.get(`/user/ticket/${id}`);
export const updateUserProfile = (data) => api.put('/user/profile', data);
