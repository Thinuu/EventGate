import api from './client';

export const getConfirmInviteInfo = (inviteToken) => api.get(`/confirm/${inviteToken}`);
export const submitConfirmInviteDetails = (inviteToken, formData) =>
  api.post(`/confirm/${inviteToken}`, formData);
