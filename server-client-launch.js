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
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://pbprkgkvsxkpdhsmjzrc.supabase.co https://compliance-web-production-cf94.up.railway.app; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com"
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

function sendAdmin(req,res){
  try{
    let html=fs.readFileSync(path.join(root,'client-v1.html'),'utf8');
    const adminLock=`<style id="baAdminLock">body.ba-admin-pending .client-header,body.ba-admin-pending .client-main,body.ba-admin-pending .client-footer{visibility:hidden}.ba-admin-screen{min-height:100vh;display:grid;place-items:center;padding:28px;background:#fffdf7;color:#102a3a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.ba-admin-card{width:min(520px,100%);padding:32px;border:1px solid rgba(16,42,58,.12);border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(16,42,58,.10)}.ba-admin-card h1{margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:34px}.ba-admin-card p{line-height:1.6;color:#4d626c}.ba-admin-card a{display:inline-block;margin-top:12px;color:#0b6477;font-weight:800}</style>`;
    const adminGate=`<script id="baAdminGate">
(async function(){
  const body=document.body;
  function lock(title,message,linkText,linkHref){
    body.className='';
    body.innerHTML='<main class="ba-admin-screen"><section class="ba-admin-card"><h1>'+title+'</h1><p>'+message+'</p>'+(linkHref?'<a href="'+linkHref+'">'+linkText+'</a>':'')+'</section></main>';
  }
  try{
    const session=await getSession();
    if(!session?.access_token){
      sessionStorage.setItem('ba_after_login','/admin');
      location.replace('/');
      return;
    }
    const gate=await api('/api/admin/me');
    if(!gate?.mfa){
      lock('Admin locked','Multi factor authentication is required before owner access can open.','Return to BrandedAlign','/');
      return;
    }
    body.classList.remove('ba-admin-pending');
    body.classList.add('owner-mode');
    const brandSub=document.querySelector('.brand-copy span');if(brandSub)brandSub.textContent='Admin';
    const eyebrow=document.querySelector('.client-welcome .eyebrow');if(eyebrow)eyebrow.textContent='BrandedAlign Owner Workspace';
    const heading=document.querySelector('.client-welcome h1');if(heading)heading.textContent='Owner workspace';
    const intro=document.querySelector('.client-welcome p');if(intro)intro.textContent='Manage and review BrandedAlign from the owner side without customer billing or plan limits.';
  }catch(err){
    const code=String(err?.message||'');
    if(code==='ADMIN_MFA_REQUIRED'){
      lock('Admin locked','Your owner account is recognized, but multi factor authentication must be active before this workspace can open.','Return to BrandedAlign','/');
      return;
    }
    if(code==='AUTH_REQUIRED'||code==='AUTHORIZATION_REQUIRED'){
      sessionStorage.setItem('ba_after_login','/admin');
      location.replace('/');
      return;
    }
    lock('Access denied','This workspace is restricted to an approved BrandedAlign administrator using multi factor authentication.','Go to client portal','/client');
  }
})();
</script>`;
    html=html
      .replace('<title>Client Portal | BrandedAlign</title>','<title>Admin | BrandedAlign</title>')
      .replace('</head>',adminLock+'\n</head>')
      .replace('<body class="client-body">','<body class="client-body ba-admin-pending">')
      .replace('<span>Client Portal</span>','<span>Admin</span>')
      .replace('aria-label="Client portal navigation"','aria-label="Admin navigation"')
      .replace('</body>',adminGate+'\n</body>');
    res.writeHead(200,{...clientHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0','Pragma':'no-cache'});
    if(req.method==='HEAD')return res.end();
    res.end(html);
  }catch{
    res.writeHead(500,{...clientHeaders,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end('BrandedAlign Admin is temporarily unavailable.');
  }
}

http.createServer=function(handler){
  return originalCreateServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(['/admin','/admin/'].includes(url.pathname)){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{...clientHeaders,'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      return sendAdmin(req,res);
    }
    if(['/client','/client/'].includes(url.pathname)){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{...clientHeaders,'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      return sendClientFile(req,res,'client-v1.html','text/html; charset=utf-8');
    }
    if(url.pathname==='/client-v1.css')return sendClientFile(req,res,'client-v1.css','text/css; charset=utf-8');
    if(url.pathname==='/client-v1.js')return sendClientFile(req,res,'client-v1.js','application/javascript; charset=utf-8');
    if(url.pathname==='/legal-runtime.js')return sendClientFile(req,res,'legal-runtime.js','application/javascript; charset=utf-8');

    if(url.pathname==='/manifest.webmanifest')return sendClientFile(req,res,'manifest.webmanifest','application/manifest+json; charset=utf-8');
    if(url.pathname==='/sw.js')return sendClientFile(req,res,'sw.js','application/javascript; charset=utf-8');

    if([
      '/brandedalign-app-icon-180.png',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png'
    ].includes(url.pathname))return sendClientFile(req,res,'brandedalign-app-icon-180.png','image/png');
    if(url.pathname==='/brandedalign-app-icon-192.png')return sendClientFile(req,res,'brandedalign-app-icon-192.png','image/png');
    if(url.pathname==='/brandedalign-app-icon-512.png')return sendClientFile(req,res,'brandedalign-app-icon-512.png','image/png');

    return handler(req,res);
  });
};

require('./server-polish-launch.js');
