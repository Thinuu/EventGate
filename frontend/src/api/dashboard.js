import api from './client';

export const getDashboardStats = (params) => api.get('/dashboard/stats', { params });
export const getDashboardLogs = (params) => api.get('/dashboard/logs', { params });
export const getDashboardTimeline = (params) => api.get('/dashboard/timeline', { params });
export const getDashboardDenied = (params) => api.get('/dashboard/denied', { params });
export const exportDashboard = (params) => api.get('/dashboard/export', { params, responseType: 'blob' });
