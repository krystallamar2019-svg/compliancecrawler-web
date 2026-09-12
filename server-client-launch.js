const http=require('http');
const fs=require('fs');
const path=require('path');

const root=__dirname;
const originalCreateServer=http.createServer.bind(http);
const clientHeaders={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'SAMEORIGIN',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://pbprkgkvsxkpdhsmjzrc.supabase.co https://compliance-web-production-cf94.up.railway.app; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com"
};

function sendClientFile(req,res,filename,type){
  try{
    const body=fs.readFileSync(path.join(root,filename));
    res.writeHead(200,{...clientHeaders,'Content-Type':type,'Cache-Control':'no-store'});
    if(req.method==='HEAD')return res.end();
    res.end(body);
  }catch{
    res.writeHead(500,{...clientHeaders,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end('BrandedAlign Client Portal is temporarily unavailable.');
  }
}

http.createServer=function(handler){
  return originalCreateServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(['/client','/client/'].includes(url.pathname)){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{...clientHeaders,'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      return sendClientFile(req,res,'client-v1.html','text/html; charset=utf-8');
    }
    if(url.pathname==='/client-v1.css')return sendClientFile(req,res,'client-v1.css','text/css; charset=utf-8');
    if(url.pathname==='/client-v1.js')return sendClientFile(req,res,'client-v1.js','application/javascript; charset=utf-8');
    return handler(req,res);
  });
};

require('./server-polish-launch.js');
