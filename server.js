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

const finalHeroMarkup = `
      <div class="hero-art luxury-hero-art" aria-hidden="true">
        <div class="luxury-hero-frame">
          <img class="luxury-hero-image" src="/assets/brandedalign-final-hero.webp" alt="">
        </div>
      </div>`;

const finalHeroStyles = `
<style id="brandedalign-final-hero-styles">
.hero{overflow:hidden}
.luxury-hero-art{position:relative;min-height:560px;display:flex;align-items:center;justify-content:center;overflow:hidden!important;isolation:isolate}
.luxury-hero-art::before{content:"";position:absolute;inset:10% 2% 6%;background:radial-gradient(ellipse at center,rgba(255,226,170,.30),rgba(141,226,232,.10) 48%,transparent 72%);filter:blur(30px);z-index:-1}
.luxury-hero-frame{width:100%;height:520px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
.luxury-hero-image{display:block;width:138%;max-width:none;height:auto;transform:translateX(-1%);filter:drop-shadow(0 28px 44px rgba(88,64,24,.13));-webkit-mask-image:radial-gradient(ellipse 72% 82% at 50% 50%,#000 62%,rgba(0,0,0,.94) 76%,transparent 100%);mask-image:radial-gradient(ellipse 72% 82% at 50% 50%,#000 62%,rgba(0,0,0,.94) 76%,transparent 100%)}
@media(max-width:980px){.luxury-hero-art{min-height:500px}.luxury-hero-frame{height:470px}.luxury-hero-image{width:112%;transform:none}}
@media(max-width:640px){.luxury-hero-art{min-height:390px}.luxury-hero-frame{height:370px}.luxury-hero-image{width:128%;max-width:none}}
</style>`;

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

function serveHomepage(req, res) {
  try {
    let html = fs.readFileSync(path.join(root, 'index-v2.html'), 'utf8');
    html = html.replace(
      /<div class="hero-art" aria-hidden="true">[\s\S]*?<div class="soft-flower"><\/div>\s*<\/div>/,
      finalHeroMarkup.trim()
    );
    html = html.replace('</head>', finalHeroStyles + '\n</head>');
    html = html.replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^\"]+"><\/script>/, '');
    html = html.replace(/\s*<script src="\/orb-v2\.js"><\/script>/, '');
    if (req.method === 'HEAD') return send(res, 200, 'text/html; charset=utf-8', '');
    return send(res, 200, 'text/html; charset=utf-8', html);
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
      version: 'final-luxury-hero',
      hero: 'approved-static-luxury-asset',
      billing: 'stripe-webhook-gated',
      deep_dives: true,
      auth_redirect: 'production'
    }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return serveHomepage(req, res);
  if (url.pathname === '/styles-v2.css') return serveFile(req, res, 'styles-v2.css', 'text/css; charset=utf-8');
  if (url.pathname === '/app-v2.js') return serveFile(req, res, 'app-v2.js', 'application/javascript; charset=utf-8');
  if (url.pathname === '/assets/brandedalign-final-hero.webp') return serveFile(req, res, 'assets/brandedalign-final-hero.webp', 'image/webp');
  return send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`BrandedAlign final luxury hero site active on ${port}`);
  console.log('Hero: approved static luxury asset | Auth redirect: production-aware | Billing: Stripe webhook gated');
});