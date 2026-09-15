const http=require('http');
const fs=require('fs');
const path=require('path');

const root=__dirname;
const originalCreateServer=http.createServer.bind(http);

const assetMap=new Map([
  ['/apple-touch-icon.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-precomposed.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-120x120-precomposed.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-120x120.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-152x152.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-167x167.png',['brandedalign-app-icon-180.png','image/png']],
  ['/apple-touch-icon-180x180.png',['brandedalign-app-icon-180.png','image/png']],
  ['/brandedalign-app-icon-180.png',['brandedalign-app-icon-180.png','image/png']],
  ['/brandedalign-app-icon-192.png',['brandedalign-app-icon-192.png','image/png']],
  ['/brandedalign-app-icon-512.png',['brandedalign-app-icon-512.png','image/png']],
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json; charset=utf-8']],
  ['/sw.js',['sw.js','application/javascript; charset=utf-8']],
  ['/favicon.ico',['brandedalign-app-icon-180.png','image/png']]
]);

function sendAsset(req,res,filename,type){
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
    res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    return res.end('BrandedAlign app icon unavailable');
  }
}

http.createServer=function(handler){
  return originalCreateServer((req,res)=>{
    let pathname='/';
    try{pathname=new URL(req.url,'http://localhost').pathname}catch{}
    const asset=assetMap.get(pathname);
    if(asset){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      return sendAsset(req,res,asset[0],asset[1]);
    }
    return handler(req,res);
  });
};
