const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const html = fs.readFileSync(path.join(__dirname, 'index.html'));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, service: 'compliancecrawler-web' }));
  }
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('User-agent: *\nAllow: /\n');
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`ComplianceCrawler web listening on ${port}`);
});
