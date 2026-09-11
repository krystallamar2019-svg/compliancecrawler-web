const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const root = __dirname;

const commonHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://pbprkgkvsxkpdhsmjzrc.supabase.co https://compliance-api-production-dd13.up.railway.app; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com"
};

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, {
    ...commonHeaders,
    'Content-Type': type,
    'Cache-Control': status === 200 ? 'no-store' : 'no-cache',
    ...extra
  });
  res.end(body);
}

function serveFile(req, res, filename, type) {
  try {
    const body = fs.readFileSync(path.join(root, filename));
    if (req.method === 'HEAD') return send(res, 200, type, '');
    return send(res, 200, type, body);
  } catch {
    return send(res, 500, 'text/plain; charset=utf-8', 'BrandedAlign is temporarily unavailable.');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
      ok: true,
      app: 'BrandedAlign',
      owner: 'TeamUpWithKrystal',
      version: 'fresh-page-v2-compass-auth',
      billing: 'stripe-webhook-gated',
      deep_dives: true,
      auth_redirect: 'production'
    }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(req, res, 'index-v2.html', 'text/html; charset=utf-8');
  if (url.pathname === '/styles-v2.css') return serveFile(req, res, 'styles-v2.css', 'text/css; charset=utf-8');
  if (url.pathname === '/app-v2.js') return serveFile(req, res, 'app-v2.js', 'application/javascript; charset=utf-8');
  if (url.pathname === '/orb-v2.js') return serveFile(req, res, 'orb-v2.js', 'application/javascript; charset=utf-8');
  return send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`BrandedAlign v2 customer site active on ${port}`);
  console.log('Compass: restored dimensional WebGL | Auth redirect: production-aware | Billing: Stripe webhook gated');
});