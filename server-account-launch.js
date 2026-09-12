const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);

const accountSection=`
<section class="member-account hidden" id="memberAccount" aria-labelledby="memberAccountTitle">
  <div class="container member-account-card">
    <div>
      <span class="eyebrow">Your BrandedAlign membership</span>
      <h2 id="memberAccountTitle">Your account is ready.</h2>
      <p class="member-account-copy">Your verified subscription controls your review limits and access.</p>
    </div>
    <div class="member-account-grid">
      <div><span>Plan</span><strong id="memberAccountPlan">—</strong></div>
      <div><span>Status</span><strong id="memberAccountStatus">—</strong></div>
      <div><span>Next billing date</span><strong id="memberAccountRenewal">—</strong></div>
      <div><span>Scans per cycle</span><strong id="memberAccountScans">—</strong></div>
    </div>
    <div class="member-account-actions">
      <button class="btn btn-primary" id="memberBillingBtn" type="button">Manage billing →</button>
      <a class="btn btn-ghost" href="#fit">Run a Fit Check</a>
    </div>
  </div>
</section>`;

const successBanner=`
<div id="checkoutSuccessBanner" class="checkout-success hidden" role="status" aria-live="polite">
  <div class="container checkout-success-inner">
    <div class="checkout-success-icon">✓</div>
    <div class="checkout-success-copy"><strong id="checkoutSuccessTitle">Membership confirmed.</strong><span id="checkoutSuccessText">Your paid access is active.</span></div>
    <button class="btn btn-ghost btn-small" id="successBillingBtn" type="button">Manage billing</button>
    <button class="checkout-success-close" id="successCloseBtn" type="button" aria-label="Dismiss">×</button>
  </div>
</div>`;

const accountCss=`
.member-plan-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:linear-gradient(135deg,#edf9f7,#fff8e9);border:1px solid rgba(13,104,113,.14);font-size:11px;font-weight:900;color:#174a52;white-space:nowrap}.member-plan-pill:before{content:'✦';color:#b27a22}.nav-billing-btn{white-space:nowrap}.checkout-success{position:relative;z-index:20;background:linear-gradient(100deg,#123a42,#116d76 60%,#9e742f);color:white;border-bottom:1px solid rgba(255,255,255,.15)}.checkout-success-inner{min-height:74px;display:flex;align-items:center;gap:14px}.checkout-success-icon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:20px;font-weight:900}.checkout-success-copy{display:flex;flex-direction:column;flex:1}.checkout-success-copy strong{font-family:var(--serif);font-size:21px;font-weight:500}.checkout-success-copy span{font-size:12px;opacity:.9}.checkout-success .btn{background:rgba(255,255,255,.94)}.checkout-success-close{border:0;background:transparent;color:white;font-size:25px;cursor:pointer;padding:7px}.member-account{padding:34px 0 84px}.member-account-card{display:grid;grid-template-columns:1.1fr 1.5fr auto;gap:30px;align-items:center;padding:30px 34px;border-radius:26px;background:linear-gradient(120deg,rgba(255,255,255,.94),rgba(241,250,248,.92) 55%,rgba(255,247,231,.9));border:1px solid rgba(18,43,57,.1);box-shadow:0 22px 58px rgba(18,43,57,.08)}.member-account-card h2{font-size:36px;margin-top:8px}.member-account-copy{margin:9px 0 0;color:var(--muted);font-size:13px}.member-account-grid{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:12px}.member-account-grid div{padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.76);border:1px solid rgba(18,43,57,.08)}.member-account-grid span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#7b8a8e}.member-account-grid strong{display:block;margin-top:4px;font-family:var(--serif);font-size:19px;font-weight:500}.member-account-actions{display:flex;flex-direction:column;gap:9px;min-width:160px}.plan-btn.current-plan{background:linear-gradient(135deg,#e7f7f3,#fff5df)!important;color:#174a52!important;border-color:rgba(13,104,113,.18)!important;cursor:default;box-shadow:none!important;transform:none!important}@media(max-width:1050px){.member-account-card{grid-template-columns:1fr 1fr}.member-account-actions{grid-column:1/-1;flex-direction:row}.nav-billing-btn{display:none}}@media(max-width:720px){.member-plan-pill{display:none}.member-account-card{grid-template-columns:1fr;padding:24px}.member-account-grid{grid-template-columns:1fr 1fr}.member-account-actions{grid-column:auto;flex-direction:column}.checkout-success-inner{padding:12px 0;flex-wrap:wrap}.checkout-success-copy{min-width:210px}}
`;

const accountJs=`

// BrandedAlign paid-member account layer
function baTitle(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\\b\\w/g,m=>m.toUpperCase())}
function baReturnState(){const p=new URLSearchParams(location.search);return {success:['success','complete','completed'].includes((p.get('billing')||p.get('checkout')||'').toLowerCase())||p.get('success')==='true',cancel:['cancel','canceled','cancelled'].includes((p.get('billing')||p.get('checkout')||'').toLowerCase())}}
function baSetCurrentPlan(plan,status){document.querySelectorAll('.plan-btn').forEach(btn=>{const active=btn.dataset.plan===plan&&['active','trialing'].includes(String(status||'').toLowerCase());btn.classList.toggle('current-plan',active);btn.disabled=active;if(active)btn.textContent='Current plan ✓'})}
function baHideMemberState(){document.getElementById('memberPlanPill')?.classList.add('hidden');document.getElementById('navBillingBtn')?.classList.add('hidden');document.getElementById('memberAccount')?.classList.add('hidden')}
async function loadMemberAccount(){const session=await getSession();if(!session?.access_token){baHideMemberState();return null}try{const r=await fetch(API_URL+'/api/me',{headers:{'Authorization':'Bearer '+session.access_token}});if(!r.ok)throw new Error('Unable to load account');const d=await r.json();const plan=(d.plan||'free').toLowerCase();const status=(d.subscriptionStatus||'inactive').toLowerCase();const planName=baTitle(plan);document.getElementById('memberPlanLabel').textContent=planName+' · '+baTitle(status);document.getElementById('memberPlanPill').classList.remove('hidden');document.getElementById('navBillingBtn').classList.remove('hidden');document.getElementById('memberAccount').classList.remove('hidden');document.getElementById('memberAccountPlan').textContent=planName;document.getElementById('memberAccountStatus').textContent=baTitle(status);document.getElementById('memberAccountRenewal').textContent=d.currentPeriodEnd?fmtDate(d.currentPeriodEnd):'—';document.getElementById('memberAccountScans').textContent=d.limits?.scans??'—';baSetCurrentPlan(plan,status);const ret=baReturnState();if(ret.success&&['active','trialing'].includes(status)){document.getElementById('checkoutSuccessTitle').textContent=planName+' is active.';document.getElementById('checkoutSuccessText').textContent='Stripe confirmed your membership and BrandedAlign unlocked your paid access.';document.getElementById('checkoutSuccessBanner').classList.remove('hidden');history.replaceState({},'',location.pathname+location.hash)}return d}catch(err){console.error('Member account failed to load',err);return null}}
document.getElementById('memberBillingBtn')?.addEventListener('click',openBilling);document.getElementById('navBillingBtn')?.addEventListener('click',openBilling);document.getElementById('successBillingBtn')?.addEventListener('click',openBilling);document.getElementById('successCloseBtn')?.addEventListener('click',()=>document.getElementById('checkoutSuccessBanner')?.classList.add('hidden'));
sb.auth.onAuthStateChange((_event,session)=>{if(session?.access_token)setTimeout(loadMemberAccount,100);else baHideMemberState()});
setTimeout(loadMemberAccount,120);
`;

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  const base=path.basename(String(file));
  if(!['index-v2.html','styles-v2.css','app-v2.js'].includes(base)) return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  let next=text;
  if(base==='index-v2.html'){
    next=next.replace('<div id="sessionPill"',`<div id="memberPlanPill" class="member-plan-pill hidden"><span id="memberPlanLabel">Membership</span></div><button class="btn btn-ghost btn-small nav-billing-btn hidden" type="button" id="navBillingBtn">Manage billing</button><div id="sessionPill"`);
    next=next.replace('<main id="top">','<main id="top">'+successBanner);
    next=next.replace('<section class="section pricing" id="plans">',accountSection+'<section class="section pricing" id="plans">');
  }else if(base==='styles-v2.css'){
    next+='\n'+accountCss;
  }else if(base==='app-v2.js'){
    next=next.replace(/function handleReturnMessage\(\)\{[\s\S]*?\}\nfunction handleAuthReturn/,"function handleReturnMessage(){const p=new URLSearchParams(location.search);const cancel=['cancel','canceled','cancelled'].includes((p.get('billing')||p.get('checkout')||'').toLowerCase());if(cancel)setTimeout(()=>alert('Checkout was canceled. No paid access was unlocked.'),300)}\nfunction handleAuthReturn");
    next+='\n'+accountJs;
  }
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};

require('./server-launch.js');
