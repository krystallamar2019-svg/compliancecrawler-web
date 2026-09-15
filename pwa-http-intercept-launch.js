const http=require('http');
const fs=require('fs');
const path=require('path');
require('./pwa-icon-bootstrap.js');

const root=__dirname;
const originalCreateServer=http.createServer.bind(http);
const iconPaths=new Set([
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/apple-touch-icon-120x120-precomposed.png',
  '/apple-touch-icon-120x120.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-167x167.png',
  '/apple-touch-icon-180x180.png',
  '/brandedalign-app-icon-180.png',
  '/favicon.ico'
]);
const assets=new Map([
  ['/brandedalign-app-icon-192.png',['brandedalign-app-icon-192.png','image/png']],
  ['/brandedalign-app-icon-512.png',['brandedalign-app-icon-512.png','image/png']],
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json; charset=utf-8']],
  ['/sw.js',['sw.js','application/javascript; charset=utf-8']]
]);

function sendFile(req,res,file,type){
  try{
    const body=fs.readFileSync(path.join(root,file));
    res.writeHead(200,{
      'Content-Type':type,
      'Content-Length':body.length,
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff'
    });
    if(req.method==='HEAD') return res.end();
    return res.end(body);
  }catch(err){
    console.error('PWA intercept read failed',file,err);
    res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    return res.end('BrandedAlign app asset unavailable');
  }
}

http.createServer=function patchedCreateServer(listener){
  return originalCreateServer((req,res)=>{
    let pathname='/';
    try{pathname=new URL(req.url,'http://localhost').pathname}catch{}
    if(iconPaths.has(pathname)){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      console.log('PWA INTERCEPT 200',pathname);
      return sendFile(req,res,'brandedalign-app-icon-180.png','image/png');
    }
    const mapped=assets.get(pathname);
    if(mapped){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      console.log('PWA INTERCEPT 200',pathname);
      return sendFile(req,res,mapped[0],mapped[1]);
    }
    return listener(req,res);
  });
};

console.log('BrandedAlign PWA HTTP intercept armed');
require('./server-ledger-launch.js');
