import api from './client';
export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.patch(`/users/${id}`, data);
export const resendUserCredentials = (id) => api.post(`/users/${id}/resend-credentials`);
export const updateUserPermissions = (id, data) => api.patch(`/users/${id}/permissions`, data);
export const assignUserToEvent = (id, eventId) => api.patch(`/users/${id}/assign-event`, { eventId });
export const toggleUserActive = (id) => api.patch(`/users/${id}/toggle-active`);
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Get current user profile
export const getCurrentUser = () => api.get('/users/profile');

// Update current user profile
export const updateCurrentUser = (data) => api.put('/users/profile', data);

// Change password
export const changePassword = (data) => api.post('/users/change-password', data);

// MFA endpoints
export const getMfaStatus = () => api.get('/users/mfa/status');
export const setupMfa = () => api.post('/users/mfa/setup');
export const verifyMfa = (code) => api.post('/users/mfa/verify', { code });
export const disableMfa = () => api.post('/users/mfa/disable');

// Session management
export const getUserSessions = () => api.get('/users/sessions');
export const revokeSession = (sessionId) => api.delete(`/users/sessions/${sessionId}`);