export const getApiBase = () => (import.meta.env.REACT_APP_API_URL || '/api').replace(/\/$/, '');
export const getBackendBase = () => {
  const api = getApiBase();
  return api.startsWith('/') ? window.location.origin : api.replace(/\/api\/?$/, '');
};
export const getAssetUrl = path => !path ? '' : /^https?:\/\//.test(path) ? path : `${getBackendBase()}${path.startsWith('/') ? path : `/${path}`}`;
export const getSocketUrl = () => getBackendBase();
