const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: (import.meta.env.REACT_APP_API_URL ? import.meta.env.REACT_APP_API_URL.replace(/\/api$/, '') : 'http://localhost:5000'),
      changeOrigin: true,
      secure: false,
    })
  );
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: (import.meta.env.REACT_APP_API_URL ? import.meta.env.REACT_APP_API_URL.replace(/\/api$/, '') : 'http://localhost:5000'),
      changeOrigin: true,
      secure: false,
      ws: true,
    })
  );
};
