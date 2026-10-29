import api from './client';

export const getAdminWorkspace = (params) => api.get('/admin/workspace', { params });
export const getAdminSettings = () => api.get('/admin/settings');
export const updateAdminSettings = (payload) => api.patch('/admin/settings', payload);
export const exportAdminReport = (params) =>
  api.get('/admin/reports/export', { params, responseType: 'blob' });
