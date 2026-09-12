(()=>{
  const nextPlan={steward:'harvest',harvest:'abundance',abundance:null};
  const label={steward:'Steward',harvest:'Harvest',abundance:'Abundance'};
  const style=document.createElement('style');
  style.textContent=`
    .client-welcome-grid{align-items:start!important}
    .client-membership-card{align-self:start!important}
    .client-nav-actions #clientPlanPill{display:none!important}
    .membership-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:10px 0 18px;padding-bottom:18px;border-bottom:1px solid rgba(18,43,57,.09)}
    .membership-plan-summary{min-width:0}
    .membership-plan-line{font-family:var(--serif);font-size:28px;font-weight:500;line-height:1.05;color:var(--ink)}
    .membership-plan-sub{margin-top:6px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#78898d}
    .membership-action-stack{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:0 0 auto}
    .membership-cancel-btn{border:0;background:transparent;padding:2px 3px;color:#7b8588;font-size:10px;font-weight:800;text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:nowrap}
    .membership-cancel-btn:disabled{cursor:default;text-decoration:none;opacity:.72}
    .membership-action-status{display:none;max-width:280px;font-size:10px;font-weight:800;color:#537078;line-height:1.4;text-align:right}
    .membership-action-status.show{display:block}
    .membership-action-status.error{color:#9a4b40}
    .client-membership-grid>div:nth-child(1),.client-membership-grid>div:nth-child(2){display:none}
    .client-membership-grid{grid-template-columns:1fr 1fr!important;margin-top:0!important}
    @media(max-width:620px){.membership-card-top{flex-direction:column}.membership-action-stack{align-items:flex-start;width:100%}.membership-action-status{text-align:left}.client-membership-grid{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);

  function status(message,error=false){const el=document.getElementById('membershipActionStatus');if(!el)return;el.textContent=message||'';el.classList.toggle('show',!!message);el.classList.toggle('error',!!error)}
  function fmt(v){if(!v)return'the end of your current billing cycle';const d=new Date(v);return Number.isNaN(d.getTime())?'the end of your current billing cycle':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
  function ensure(){
    const card=document.querySelector('.client-membership-card');
    const eyebrow=card?.querySelector('.eyebrow');
    if(!card||!eyebrow||document.getElementById('membershipCardTop'))return;
    document.getElementById('membershipUpgradeGroup')?.remove();
    const wrap=document.createElement('div');wrap.id='membershipCardTop';wrap.className='membership-card-top';
    wrap.innerHTML='<div class="membership-plan-summary"><div class="membership-plan-line" id="membershipPlanSummary">Membership</div><div class="membership-plan-sub">Current membership</div></div><div class="membership-action-stack"><button class="btn btn-primary btn-small" id="membershipUpgradeBtn" type="button" hidden>Upgrade</button><button class="membership-cancel-btn" id="membershipCancelBtn" type="button" hidden>Cancel membership</button><span class="membership-action-status" id="membershipActionStatus" aria-live="polite"></span></div>';
    eyebrow.insertAdjacentElement('afterend',wrap);
    document.getElementById('membershipUpgradeBtn').addEventListener('click',upgrade);
    document.getElementById('membershipCancelBtn').addEventListener('click',cancel);
  }
  async function refresh(){
    ensure();
    try{
      const me=await api('/api/me');
      const plan=String(me.plan||'free').toLowerCase();
      const subscriptionStatus=String(me.subscriptionStatus||'inactive').toLowerCase();
      const active=['active','trialing'].includes(subscriptionStatus);
      const summary=document.getElementById('membershipPlanSummary');
      if(summary)summary.textContent=(label[plan]||title(plan))+' · '+title(subscriptionStatus);
      const up=document.getElementById('membershipUpgradeBtn');const cancelBtn=document.getElementById('membershipCancelBtn');if(!up||!cancelBtn)return;
      if(!active){up.hidden=true;cancelBtn.hidden=true;return}
      cancelBtn.hidden=false;
      if(me.cancelAtPeriodEnd){up.hidden=true;cancelBtn.disabled=true;cancelBtn.textContent='Cancellation scheduled';status('Membership stays active through '+fmt(me.currentPeriodEnd)+'.');return}
      cancelBtn.disabled=false;cancelBtn.textContent='Cancel membership';status('');
      const next=nextPlan[plan];if(next){up.hidden=false;up.dataset.target=next;up.textContent='Upgrade to '+label[next]+' →'}else up.hidden=true;
    }catch(err){console.error('Membership actions unavailable',err)}
  }
  async function openPortal(message,button){
    if(button)button.disabled=true;
    status(message);
    try{
      const result=await api('/api/billing-portal',{method:'POST',body:'{}'});
      if(!result?.url)throw new Error('Billing portal unavailable.');
      location.assign(result.url);
    }catch(err){status(err.message||'Billing portal could not be opened.',true);if(button)button.disabled=false}
  }
  async function upgrade(){
    const btn=document.getElementById('membershipUpgradeBtn');const target=btn?.dataset.target;if(!btn||!target)return;
    if(!confirm('Open secure billing to upgrade to '+label[target]+'? Stripe will show the billing change before you confirm.'))return;
    await openPortal('Opening secure billing for your upgrade…',btn);
  }
  async function cancel(){
    const btn=document.getElementById('membershipCancelBtn');if(!btn||btn.disabled)return;
    let me=null;try{me=await api('/api/me')}catch{}
    const end=fmt(me?.currentPeriodEnd);
    if(!confirm('Open secure billing to cancel renewal? Your current access remains active through '+end+'.'))return;
    await openPortal('Opening secure billing to manage cancellation…',btn);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
  window.addEventListener('pageshow',()=>setTimeout(refresh,150));
})();
