(()=>{
  const nextPlan={steward:'harvest',harvest:'abundance',abundance:null};
  const label={steward:'Steward',harvest:'Harvest',abundance:'Abundance'};
  const style=document.createElement('style');
  style.textContent='.membership-upgrade-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.membership-cancel-btn{border:0;background:transparent;padding:4px 2px;color:#7b8588;font-size:10px;font-weight:800;text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:nowrap}.membership-cancel-btn:disabled{cursor:default;text-decoration:none;opacity:.72}.membership-action-status{display:none;width:100%;font-size:10px;font-weight:800;color:#537078;line-height:1.35}.membership-action-status.show{display:block}.membership-action-status.error{color:#9a4b40}@media(max-width:820px){.membership-upgrade-group{width:100%}}';
  document.head.appendChild(style);

  function status(message,error=false){const el=document.getElementById('membershipActionStatus');if(!el)return;el.textContent=message||'';el.classList.toggle('show',!!message);el.classList.toggle('error',!!error)}
  function fmt(v){if(!v)return'the end of your current billing cycle';const d=new Date(v);return Number.isNaN(d.getTime())?'the end of your current billing cycle':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
  function ensure(){
    const nav=document.querySelector('.client-nav-actions');const pill=document.getElementById('clientPlanPill');
    if(!nav||!pill||document.getElementById('membershipUpgradeGroup'))return;
    const group=document.createElement('div');group.id='membershipUpgradeGroup';group.className='membership-upgrade-group';
    group.innerHTML='<button class="btn btn-primary btn-small" id="membershipUpgradeBtn" type="button" hidden>Upgrade</button><button class="membership-cancel-btn" id="membershipCancelBtn" type="button" hidden>Cancel membership</button><span class="membership-action-status" id="membershipActionStatus" aria-live="polite"></span>';
    pill.insertAdjacentElement('afterend',group);
    document.getElementById('membershipUpgradeBtn').addEventListener('click',upgrade);
    document.getElementById('membershipCancelBtn').addEventListener('click',cancel);
  }
  async function refresh(){
    ensure();
    try{
      const me=await api('/api/me');const plan=String(me.plan||'free').toLowerCase();const active=['active','trialing'].includes(String(me.subscriptionStatus||'').toLowerCase());
      const up=document.getElementById('membershipUpgradeBtn');const cancelBtn=document.getElementById('membershipCancelBtn');if(!up||!cancelBtn)return;
      if(!active){up.hidden=true;cancelBtn.hidden=true;return}
      cancelBtn.hidden=false;
      if(me.cancelAtPeriodEnd){up.hidden=true;cancelBtn.disabled=true;cancelBtn.textContent='Cancellation scheduled';status('Membership stays active through '+fmt(me.currentPeriodEnd)+'.');return}
      cancelBtn.disabled=false;cancelBtn.textContent='Cancel membership';status('');
      const next=nextPlan[plan];if(next){up.hidden=false;up.dataset.target=next;up.textContent='Upgrade to '+label[next]+' →'}else up.hidden=true;
    }catch(err){console.error('Membership actions unavailable',err)}
  }
  async function upgrade(){
    const btn=document.getElementById('membershipUpgradeBtn');const target=btn?.dataset.target;if(!btn||!target)return;
    if(!confirm('Upgrade to '+label[target]+' now? Stripe will apply mid-cycle proration and keep your current renewal date.'))return;
    btn.disabled=true;status('Applying your upgrade…');
    try{const result=await api('/api/upgrade-membership',{method:'POST',body:'{}'});if(result.paymentUrl){location.assign(result.paymentUrl);return}status('Upgrade successful. Refreshing…');setTimeout(()=>location.reload(),1000)}catch(err){status(err.message||'Upgrade could not be completed.',true);btn.disabled=false}
  }
  async function cancel(){
    const btn=document.getElementById('membershipCancelBtn');if(!btn||btn.disabled)return;
    let me=null;try{me=await api('/api/me')}catch{}
    const end=fmt(me?.currentPeriodEnd);
    if(!confirm('Cancel membership renewal? Your access will stay active through '+end+'.'))return;
    btn.disabled=true;status('Scheduling cancellation…');
    try{await api('/api/cancel-membership',{method:'POST',body:'{}'});btn.textContent='Cancellation scheduled';document.getElementById('membershipUpgradeBtn').hidden=true;status('Membership stays active through '+end+'.')}catch(err){status(err.message||'Cancellation could not be scheduled.',true);btn.disabled=false}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
  window.addEventListener('pageshow',()=>setTimeout(refresh,150));
})();
