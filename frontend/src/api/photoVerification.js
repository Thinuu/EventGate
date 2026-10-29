import api from './client';

export const getPendingPhotos = (params) => api.get('/verification/pending', { params });
export const verifyPhoto = (payload) => {
  if (payload?.status === 'rejected') {
    return api.post('/verification/reject', payload);
  }

  return api.post('/verification/approve', payload);
};
export const resubmitPhoto = (token, formData) => api.post('/attendees/resubmit/photo', formData);
