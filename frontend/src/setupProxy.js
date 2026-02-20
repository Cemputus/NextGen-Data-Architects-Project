/**
 * Proxy /api to backend. Restart frontend (npm start) after editing.
 * No path rewrite so backend receives /api/user-mgmt/... (PATCH/DELETE and GET single user work correctly).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      secure: false,
      onError: (err, req, res) => {
        console.error('[Proxy] Backend unreachable:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend not running', message: 'Start backend\\run_backend.bat first.' }));
      },
    })
  );
};
