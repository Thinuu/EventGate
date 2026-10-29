import api from './client';

export const getAuditLogs = (params) => api.get('/audit/logs', { params });
export const getAuditReports = (params) => api.get('/audit/reports', { params });
export const exportAuditReport = (params) => api.get('/audit/export', { params, responseType: 'blob' });
export const getSystemLogs = (params) => api.get('/audit/system-logs', { params });
