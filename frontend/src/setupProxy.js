
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  
  const target = process.env.PROXY_TARGET || 'http://127.0.0.1:5000';
  app.use(
    '/api',
    createProxyMiddleware({
      
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
