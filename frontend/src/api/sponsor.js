import api from './client';

export const getSponsorWorkspace = () => api.get('/sponsor/workspace');
export const getSponsorTeam = (params) => api.get('/sponsor/team', { params });
export const addSponsorTeamMember = (payload) => api.post('/sponsor/team', payload);
export const removeSponsorTeamMember = (id) => api.delete(`/sponsor/team/${id}`);
export const downloadTicketPass = (token) => api.get(`/tickets/download/${token}`, { responseType: 'blob' });
