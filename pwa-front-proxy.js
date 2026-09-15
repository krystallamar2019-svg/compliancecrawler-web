const http=require('http');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');

require('./pwa-icon-bootstrap.js');

const publicPort=Number(process.env.PORT||8080);
const appPort=publicPort===8081?8082:8081;
const root=__dirname;

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

const assetMap=new Map([
  ['/brandedalign-app-icon-192.png',['brandedalign-app-icon-192.png','image/png']],
  ['/brandedalign-app-icon-512.png',['brandedalign-app-icon-512.png','image/png']],
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json; charset=utf-8']],
  ['/sw.js',['sw.js','application/javascript; charset=utf-8']]
]);

function serveFile(req,res,filename,type){
  try{
    const body=fs.readFileSync(path.join(root,filename));
    res.writeHead(200,{
      'Content-Type':type,
      'Content-Length':body.length,
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff'
    });
    if(req.method==='HEAD')return res.end();
    return res.end(body);
  }catch(err){
    console.error('PWA asset read failed',filename,err);
    res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    return res.end('BrandedAlign app asset unavailable');
  }
}

const childEnv={...process.env,PORT:String(appPort)};
const child=spawn(process.execPath,['server-ledger-launch.js'],{cwd:root,env:childEnv,stdio:'inherit'});
child.on('exit',(code,signal)=>{
  console.error('BrandedAlign upstream exited',code,signal);
  process.exit(code||1);
});

const server=http.createServer((req,res)=>{
  let pathname='/';
  try{pathname=new URL(req.url,'http://localhost').pathname}catch{}

  if(req.method!=='GET'&&req.method!=='HEAD'&&iconPaths.has(pathname)){
    res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
    return res.end('Method Not Allowed');
  }

  if(iconPaths.has(pathname)){
    console.log('PWA icon 200',pathname);
    return serveFile(req,res,'brandedalign-app-icon-180.png','image/png');
  }

  const mapped=assetMap.get(pathname);
  if(mapped){
    console.log('PWA asset 200',pathname);
    return serveFile(req,res,mapped[0],mapped[1]);
  }

  const upstream=http.request({
    hostname:'127.0.0.1',
    port:appPort,
    method:req.method,
    path:req.url,
    headers:{...req.headers,host:req.headers.host}
  },up=>{
    res.writeHead(up.statusCode||502,up.headers);
    up.pipe(res);
  });
  upstream.on('error',err=>{
    console.error('PWA proxy upstream error',err.message);
    if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end('BrandedAlign is starting. Please refresh.');
  });
  req.pipe(upstream);
});

server.listen(publicPort,'0.0.0.0',()=>{
  console.log(`BrandedAlign PWA front proxy active on ${publicPort}; app upstream on ${appPort}`);
});
