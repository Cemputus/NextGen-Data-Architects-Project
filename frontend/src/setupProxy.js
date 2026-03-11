/**
 * Proxy /api to backend. Restart frontend (npm start) after editing.
 * No path rewrite so backend receives /api/user-mgmt/... (PATCH/DELETE and GET single user work correctly).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      // In Docker, talk to the backend service by its Compose service name
      target: 'http://backend:5000',
      changeOrigin: true,
      secure: false,
      onError: (err, req, res) => {
        console.error('[Proxy] Backend unreachable:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Backend not running',
            message: 'Check that the Docker backend service is healthy (docker compose ps).',
          })
        );
      },
    })
  );
};
