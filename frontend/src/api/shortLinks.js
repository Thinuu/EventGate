import api from './client';

export const resolveShortLink = (code) => api.get(`/short-links/${code}`);
