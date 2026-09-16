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
    const adminLock=`<style id="baAdminLock">
body.ba-admin-pending .client-header,body.ba-admin-pending .client-main,body.ba-admin-pending .client-footer{visibility:hidden}
.ba-admin-screen,.ba-admin-screen *{box-sizing:border-box}
.ba-admin-screen{min-height:100vh;display:grid;place-items:center;padding:18px;background:#fffdf7;color:#102a3a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-x:hidden}
.ba-admin-card{width:100%;max-width:560px;padding:28px;border:1px solid rgba(16,42,58,.12);border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(16,42,58,.10);overflow:hidden}
.ba-admin-card h1{margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:clamp(28px,7vw,34px);line-height:1.08}.ba-admin-card p{line-height:1.55;color:#4d626c;overflow-wrap:anywhere}.ba-admin-card a{display:inline-block;margin-top:12px;color:#0b6477;font-weight:800}
.ba-admin-card button{border:0;border-radius:999px;padding:12px 18px;background:#102a3a;color:#fff;font-weight:800;cursor:pointer}.ba-admin-card button:disabled{opacity:.55;cursor:default}
.ba-mfa-box{width:100%;margin-top:20px;padding:18px;border:1px solid rgba(16,42,58,.12);border-radius:18px;background:#fffdf7;overflow:hidden}.ba-mfa-qr{display:grid;place-items:center;width:100%;margin:14px auto}.ba-mfa-qr img,.ba-mfa-qr svg{display:block;width:min(240px,100%);height:auto;max-width:100%;background:#fff;padding:10px;border-radius:14px}.ba-mfa-secret{width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;padding:10px;border-radius:10px;background:#f1f4f2;color:#102a3a}.ba-mfa-row{display:flex;gap:10px;margin-top:14px;width:100%}.ba-mfa-row input{flex:1;min-width:0;width:100%;border:1px solid rgba(16,42,58,.22);border-radius:12px;padding:12px 14px;font-size:18px;letter-spacing:.12em}.ba-mfa-status{margin-top:12px;font-size:13px;font-weight:700;color:#4d626c;overflow-wrap:anywhere}.ba-mfa-status.error{color:#9a4b40}
@media(max-width:600px){.ba-admin-screen{padding:12px}.ba-admin-card{padding:22px 16px;border-radius:20px}.ba-mfa-box{padding:14px}.ba-mfa-row{flex-direction:column}.ba-mfa-row button{width:100%}.ba-mfa-secret{font-size:11px}}
</style>`;
    const adminGate=`<script id="baAdminGate">
(async function(){
  const body=document.body;
  const SUPABASE_URL='https://pbprkgkvsxkpdhsmjzrc.supabase.co';
  const SUPABASE_KEY='sb_publishable_UBCXWvPIRsU1SLpwZzGvig_dSIJYSjO';
  const API_URL='https://compliance-web-production-cf94.up.railway.app';
  const authClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

  function screen(title,message,inner=''){
    body.className='';
    body.innerHTML='<main class="ba-admin-screen"><section class="ba-admin-card"><h1>'+title+'</h1><p>'+message+'</p>'+inner+'</section></main>';
  }
  async function session(){const r=await authClient.auth.getSession();return r.data?.session||null}
  async function call(path){
    const s=await session();
    if(!s?.access_token)throw new Error('AUTH_REQUIRED');
    const r=await fetch(API_URL+path,{headers:{Authorization:'Bearer '+s.access_token}});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw new Error(d.error||'REQUEST_FAILED');
    return d;
  }
  function renderQr(container,qr){
    container.innerHTML='';
    if(typeof qr!=='string'||!qr)return;
    if(qr.startsWith('data:image/')){
      const img=document.createElement('img');img.alt='BrandedAlign authenticator QR code';img.src=qr;container.appendChild(img);return;
    }
    try{
      const doc=new DOMParser().parseFromString(qr,'image/svg+xml');
      const svg=doc.documentElement;
      if(svg&&svg.nodeName.toLowerCase()==='svg'){
        const safeSvg=document.importNode(svg,true);
        safeSvg.removeAttribute('style');
        safeSvg.setAttribute('role','img');
        safeSvg.setAttribute('aria-label','BrandedAlign authenticator QR code');
        container.appendChild(safeSvg);
      }
    }catch{}
  }
  async function showMfaSetup(){
    screen('Secure your admin account','BrandedAlign requires an authenticator code before the owner workspace can open.',
      '<div class="ba-mfa-box" id="baMfaBox"><p><strong>Use an authenticator app</strong> such as Apple Passwords, Google Authenticator, Microsoft Authenticator, Authy, or 1Password.</p><button id="baStartMfa" type="button">Set up authenticator</button><div id="baMfaStatus" class="ba-mfa-status"></div></div>');
    const start=document.getElementById('baStartMfa');
    const status=document.getElementById('baMfaStatus');
    start.addEventListener('click',async()=>{
      start.disabled=true;status.textContent='Creating your secure authenticator setup…';status.className='ba-mfa-status';
      try{
        const factors=await authClient.auth.mfa.listFactors();
        if(factors.error)throw factors.error;
        const verified=(factors.data?.totp||[]).find(f=>f.status==='verified');
        if(verified){await showMfaChallenge(verified.id);return}
        for(const factor of (factors.data?.totp||[]).filter(f=>f.status!=='verified')){
          await authClient.auth.mfa.unenroll({factorId:factor.id}).catch(()=>undefined);
        }
        const enrolled=await authClient.auth.mfa.enroll({factorType:'totp',friendlyName:'BrandedAlign Owner'});
        if(enrolled.error)throw enrolled.error;
        const factorId=enrolled.data.id;
        const qr=enrolled.data.totp.qr_code;
        const secret=enrolled.data.totp.secret;
        const box=document.getElementById('baMfaBox');
        box.innerHTML='';
        const instructions=document.createElement('p');
        const strong=document.createElement('strong');strong.textContent='Scan this QR code';instructions.appendChild(strong);instructions.append(' with your authenticator app. If you are viewing this on the same phone, add the secret manually instead.');box.appendChild(instructions);
        const qrBox=document.createElement('div');qrBox.className='ba-mfa-qr';box.appendChild(qrBox);renderQr(qrBox,qr);
        const secretBox=document.createElement('div');secretBox.className='ba-mfa-secret';secretBox.setAttribute('aria-label','Authenticator secret');secretBox.textContent=secret;box.appendChild(secretBox);
        const row=document.createElement('div');row.className='ba-mfa-row';
        const input=document.createElement('input');input.id='baMfaCode';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=8;input.placeholder='6 digit code';
        const button=document.createElement('button');button.id='baVerifyMfa';button.type='button';button.textContent='Verify';
        row.appendChild(input);row.appendChild(button);box.appendChild(row);
        const newStatus=document.createElement('div');newStatus.id='baMfaStatus';newStatus.className='ba-mfa-status';newStatus.textContent='Enter the current code from your authenticator app.';box.appendChild(newStatus);
        button.addEventListener('click',()=>verifyEnrollment(factorId));
      }catch(err){status.textContent=err.message||'Could not start MFA setup.';status.className='ba-mfa-status error';start.disabled=false}
    });
  }
  async function verifyEnrollment(factorId){
    const code=document.getElementById('baMfaCode')?.value.trim();
    const status=document.getElementById('baMfaStatus');
    const btn=document.getElementById('baVerifyMfa');
    if(!/^\\d{6,8}$/.test(code||'')){status.textContent='Enter the code shown in your authenticator app.';status.className='ba-mfa-status error';return}
    btn.disabled=true;status.textContent='Verifying…';status.className='ba-mfa-status';
    try{
      const challenge=await authClient.auth.mfa.challenge({factorId});if(challenge.error)throw challenge.error;
      const verified=await authClient.auth.mfa.verify({factorId,challengeId:challenge.data.id,code});if(verified.error)throw verified.error;
      await authClient.auth.refreshSession();
      location.replace('/admin');
    }catch(err){status.textContent=err.message||'That code did not verify. Try the newest code.';status.className='ba-mfa-status error';btn.disabled=false}
  }
  async function showMfaChallenge(factorId){
    screen('Verify your admin login','Enter the current code from your authenticator app to open BrandedAlign Admin.',
      '<div class="ba-mfa-box"><div class="ba-mfa-row"><input id="baMfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6 digit code"><button id="baVerifyMfa" type="button">Verify</button></div><div id="baMfaStatus" class="ba-mfa-status"></div></div>');
    document.getElementById('baVerifyMfa').addEventListener('click',()=>verifyEnrollment(factorId));
  }

  try{
    const s=await session();
    if(!s?.access_token){sessionStorage.setItem('ba_after_login','/admin');location.replace('/');return}
    const me=await call('/api/me');
    if(String(me?.organization?.role||'').toLowerCase()!=='owner'){
      screen('Access denied','This workspace is restricted to the BrandedAlign owner.','<a href="/client">Go to client portal</a>');return;
    }
    const assurance=await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error)throw assurance.error;
    if(assurance.data?.currentLevel!=='aal2'){
      const factors=await authClient.auth.mfa.listFactors();
      if(factors.error)throw factors.error;
      const verified=(factors.data?.totp||[]).find(f=>f.status==='verified');
      if(verified){await showMfaChallenge(verified.id)}else{await showMfaSetup()}
      return;
    }
    const gate=await call('/api/admin/me');
    if(!gate?.mfa)throw new Error('ADMIN_MFA_REQUIRED');
    body.classList.remove('ba-admin-pending');body.classList.add('owner-mode');
    const brandSub=document.querySelector('.brand-copy span');if(brandSub)brandSub.textContent='Admin';
    const eyebrow=document.querySelector('.client-welcome .eyebrow');if(eyebrow)eyebrow.textContent='BrandedAlign Owner Workspace';
    const heading=document.querySelector('.client-welcome h1');if(heading)heading.textContent='Owner workspace';
    const intro=document.querySelector('.client-welcome p');if(intro)intro.textContent='Manage and review BrandedAlign from the owner side without customer billing or plan limits.';
  }catch(err){
    const code=String(err?.message||'');
    if(code==='AUTH_REQUIRED'||code==='AUTHORIZATION_REQUIRED'){sessionStorage.setItem('ba_after_login','/admin');location.replace('/');return}
    if(code==='ADMIN_MFA_REQUIRED'){await showMfaSetup();return}
    screen('Access denied','This workspace is restricted to an approved BrandedAlign administrator using multi factor authentication.','<a href="/client">Go to client portal</a>');
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
    if(['/brandedalign-app-icon-180.png','/apple-touch-icon.png','/apple-touch-icon-precomposed.png'].includes(url.pathname))return sendClientFile(req,res,'brandedalign-app-icon-180.png','image/png');
    if(url.pathname==='/brandedalign-app-icon-192.png')return sendClientFile(req,res,'brandedalign-app-icon-192.png','image/png');
    if(url.pathname==='/brandedalign-app-icon-512.png')return sendClientFile(req,res,'brandedalign-app-icon-512.png','image/png');
    return handler(req,res);
  });
};

require('./server-polish-launch.js');
