import api from './client';

export const getSuperAdminOverview = () => api.get('/super-admin/overview');
export const getSuperAdminWorkspace = (params) => api.get('/super-admin/workspace', { params });
export const searchSuperAdmin = (q) => api.get('/super-admin/search', { params: { q } });

export const createSuperAdminEvent = (payload) => api.post('/super-admin/events', payload);
export const updateSuperAdminEvent = (id, payload) => api.patch(`/super-admin/events/${id}`, payload);
export const deleteSuperAdminEvent = (id) => api.delete(`/super-admin/events/${id}`);

export const createSuperAdminOrganiser = (payload) => api.post('/super-admin/organisers', payload);
export const updateSuperAdminOrganiser = (id, payload) => api.patch(`/super-admin/organisers/${id}`, payload);
export const deleteSuperAdminOrganiser = (id) => api.delete(`/super-admin/organisers/${id}`);

export const createSuperAdminCompany = (payload) => api.post('/super-admin/companies', payload);
export const updateSuperAdminCompany = (id, payload) => api.patch(`/super-admin/companies/${id}`, payload);
export const deleteSuperAdminCompany = (id) => api.delete(`/super-admin/companies/${id}`);

export const getSuperAdminCompanies = () => api.get('/super-admin/workspace').then(res => ({ data: { data: res.data.data.organisations.rows } }));
export const getSuperAdminOrganisers = () => api.get('/super-admin/workspace').then(res => ({ data: { data: res.data.data.events.filters.organiserOptions } }));

export const createSuperAdminUser = (payload) => api.post('/super-admin/users', payload);
export const updateSuperAdminUser = (id, payload) => api.patch(`/super-admin/users/${id}`, payload);
export const resendSuperAdminUserCredentials = (id) => api.post(`/super-admin/users/${id}/resend-credentials`);
export const updateSuperAdminUserStatus = (id, status) => api.patch(`/super-admin/users/${id}/status`, { status });
export const deleteSuperAdminUser = (id) => api.delete(`/super-admin/users/${id}`);

export const resendSuperAdminNotification = (id) => api.post(`/super-admin/notifications/${id}/resend`);

export const exportSuperAdminReport = (params) =>
  api.get('/super-admin/reports/export', { params, responseType: 'blob' });

export const getSuperAdminSettings = () => api.get('/super-admin/settings');
export const updateSuperAdminSettings = (payload) => api.patch('/super-admin/settings', payload);
export const getSuperAdminLogs = (params) => api.get('/super-admin/logs', { params });
export const uploadSystemAsset = (formData) => api.post('/upload/system-asset', formData);

// Bank Account management (uses /bank-transfer/bank-accounts routes)
export const getAdminBankAccounts = () => api.get('/bank-transfer/bank-accounts');
export const createAdminBankAccount = (payload) => api.post('/bank-transfer/bank-accounts', payload);
export const updateAdminBankAccount = (id, payload) => api.put(`/bank-transfer/bank-accounts/${id}`, payload);
export const deleteAdminBankAccount = (id) => api.delete(`/bank-transfer/bank-accounts/${id}`);
