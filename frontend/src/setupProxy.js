/**
 * Proxy /api to backend. Restart frontend (npm start) after editing.
 * No path rewrite so backend receives /api/user-mgmt/... (PATCH/DELETE and GET single user work correctly).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Default to localhost for non-Docker dev (Windows/Mac host),
  // but allow docker-compose to override via env.
  const target = process.env.PROXY_TARGET || 'http://127.0.0.1:5000';
  app.use(
    '/api',
    createProxyMiddleware({
      // In Docker, talk to the backend service by its Compose service name
      target,
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
