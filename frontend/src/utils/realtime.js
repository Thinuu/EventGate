import { io as connect } from 'socket.io-client';
// Refresh the handshake token on every reconnect; never use long-polling across instances.
export function io(url, options = {}) {
  return connect(url, { ...options, transports: ['websocket'], auth: callback => callback({ token: localStorage.getItem('entrynex_token') }) });
}
