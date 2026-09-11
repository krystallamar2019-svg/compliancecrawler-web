const http = require('http');
const fs = require('fs');
const path = require('path');

const publicPort = Number(process.env.PORT || 8080);
const internalPort = publicPort === 18081 ? 18082 : 18081;
const originalPort = process.env.PORT;

process.env.PORT = String(internalPort);
require('./server.js');
if (originalPort == null) delete process.env.PORT;
else process.env.PORT = originalPort;

const customerFix = fs.readFileSync(path.join(__dirname, 'customer-fix.js'), 'utf8');
const scriptTag = '<script src="/customer-fix.js?v=20260911-subscriptions"></script>';

const wrapper = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true,service:'brandedalign-web',wrapper:'subscription-launch',owner:'TeamUpWithKrystal'}));
  }

  if (url.pathname === '/customer-fix.js') {
    res.writeHead(200, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Cache-Control':'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options':'nosniff'
    });
    return res.end(customerFix);
  }

  const headers = {...req.headers, host:`127.0.0.1:${internalPort}`};
  const proxyReq = http.request({hostname:'127.0.0.1',port:internalPort,path:req.url,method:req.method,headers}, proxyRes => {
    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      let body = Buffer.concat(chunks);
      const outHeaders = {...proxyRes.headers};
      delete outHeaders['content-length'];
      const contentType = String(outHeaders['content-type'] || '');
      if (contentType.includes('text/html')) {
        let text = body.toString('utf8');
        text = text.includes('</body>') ? text.replace('</body>', scriptTag + '\n</body>') : text + scriptTag;
        body = Buffer.from(text, 'utf8');
        outHeaders['cache-control'] = 'no-store, no-cache, must-revalidate';
      }
      res.writeHead(proxyRes.statusCode || 200, outHeaders);
      res.end(body);
    });
  });

  proxyReq.on('error', err => {
    res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:false,error:'upstream_unavailable'}));
    console.error('BrandedAlign wrapper proxy error:', err.message);
  });

  req.pipe(proxyReq);
});

wrapper.listen(publicPort, '0.0.0.0', () => {
  console.log(`BrandedAlign subscription wrapper listening on ${publicPort}; base app on ${internalPort}`);
});
