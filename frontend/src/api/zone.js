import api from './client';

export const scanZoneAccess = (data) => api.post('/zone/scan', data);
export const getZoneLogs = (params) => api.get('/zone/logs', { params });
