import api from './client';

export const getPendingPhotos = (params) => api.get('/verification/pending', { params });
export const getVerificationStats = (params) => api.get('/verification/stats', { params });
export const approvePhoto = (data) => api.post('/verification/approve', data);
export const rejectPhoto = (data) => api.post('/verification/reject', data);
