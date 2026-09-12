const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);

const accountCss=`
.member-plan-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:linear-gradient(135deg,#edf9f7,#fff8e9);border:1px solid rgba(13,104,113,.14);font-size:11px;font-weight:900;color:#174a52;white-space:nowrap}.member-plan-pill:before{content:'✦';color:#b27a22}.nav-client-btn{white-space:nowrap}.plan-btn.current-plan{background:linear-gradient(135deg,#e7f7f3,#fff5df)!important;color:#174a52!important;border-color:rgba(13,104,113,.18)!important;cursor:default;box-shadow:none!important;transform:none!important}@media(max-width:1180px){.member-plan-pill{display:none!important}}@media(max-width:900px){.nav-client-btn{display:none!important}}
`;

const accountJs=`

// BrandedAlign public-site member navigation layer
function baTitle(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\\b\\w/g,m=>m.toUpperCase())}
function baSetCurrentPlan(plan,status){document.querySelectorAll('.plan-btn').forEach(btn=>{const active=btn.dataset.plan===plan&&['active','trialing'].includes(String(status||'').toLowerCase());btn.classList.toggle('current-plan',active);btn.disabled=active;if(active)btn.textContent='Current plan ✓'})}
function baHideMemberState(){document.getElementById('memberPlanPill')?.classList.add('hidden');document.getElementById('navClientBtn')?.classList.add('hidden')}
async function loadMemberAccount(){const session=await getSession();if(!session?.access_token){baHideMemberState();return null}try{const r=await fetch(API_URL+'/api/me',{headers:{'Authorization':'Bearer '+session.access_token}});if(!r.ok)throw new Error('Unable to load account');const d=await r.json();const plan=(d.plan||'free').toLowerCase();const status=(d.subscriptionStatus||'inactive').toLowerCase();const planName=baTitle(plan);const label=document.getElementById('memberPlanLabel');if(label)label.textContent=planName+' · '+baTitle(status);document.getElementById('memberPlanPill')?.classList.remove('hidden');document.getElementById('navClientBtn')?.classList.remove('hidden');baSetCurrentPlan(plan,status);if(['active','trialing'].includes(status)){const cta=document.querySelector('.nav-actions > a[href="#plans"]');cta?.classList.add('hidden')}return d}catch(err){console.error('Member navigation failed to load',err);return null}}
sb.auth.onAuthStateChange((event,session)=>{if(session?.access_token){setTimeout(loadMemberAccount,100);if(event==='SIGNED_IN'){const target=sessionStorage.getItem('ba_after_login');if(target){sessionStorage.removeItem('ba_after_login');setTimeout(()=>location.assign(target),180)}}}else baHideMemberState()});
setTimeout(loadMemberAccount,120);
`;

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  const base=path.basename(String(file));
  if(!['index-v2.html','styles-v2.css','app-v2.js'].includes(base)) return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  let next=text;
  if(base==='index-v2.html'){
    next=next.replace('<div id="sessionPill"',`<div id="memberPlanPill" class="member-plan-pill hidden"><span id="memberPlanLabel">Membership</span></div><a class="btn btn-ghost btn-small nav-client-btn hidden" id="navClientBtn" href="/client">Client Portal</a><div id="sessionPill"`);
  }else if(base==='styles-v2.css'){
    next+='\n'+accountCss;
  }else if(base==='app-v2.js'){
    next+='\n'+accountJs;
  }
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};

require('./server-launch.js');
