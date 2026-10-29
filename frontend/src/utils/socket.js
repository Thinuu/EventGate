let socketScriptPromise = null;

const loadSocketScript = () => {
  if (window.io) {
    return Promise.resolve(window.io);
  }

  if (!socketScriptPromise) {
    socketScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/socket.io-client.js';
      script.async = true;
      script.onload = () => (window.io ? resolve(window.io) : reject(new Error('Socket client unavailable')));
      script.onerror = () => reject(new Error('Socket script failed to load'));
      document.body.appendChild(script);
    });
  }

  return socketScriptPromise;
};

export const createDashboardSocket = async () => {
  const io = await loadSocketScript();
  return io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket'], auth: { token: localStorage.getItem('entrynex_token') },
  });
};
