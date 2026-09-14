(function(){
  'use strict';

  const VERSION='2026-09-14-v1';
  const DOCS={
    terms:'2026-09-14-v1',
    privacy:'2026-09-14-v1',
    refunds:'2026-09-14-v1',
    automated_analysis_disclaimer:'2026-09-14-v1'
  };
  const QUEUE_KEY='ba_legal_event_queue_'+VERSION;
  const ACCEPT_KEY='ba_legal_acceptance_'+VERSION;
  const PURCHASE_KEY='ba_purchase_acceptance_'+VERSION;

  function now(){return new Date().toISOString()}

  function readQueue(){
    try{const v=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}
  }

  function writeQueue(q){
    try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q.slice(-100)))}catch{}
  }

  function queueEvent(event){
    const item={event_id:(crypto?.randomUUID?.()||('evt_'+Date.now()+'_'+Math.random().toString(36).slice(2))),terms_version:VERSION,accepted_at:now(),path:location.pathname,...event};
    const q=readQueue();q.push(item);writeQueue(q);return item;
  }

  async function currentUser(){
    try{if(typeof sb==='undefined'||!sb?.auth)return null;const {data}=await sb.auth.getUser();return data?.user||null}catch{return null}
  }

  async function currentOrg(userId){
    try{
      const {data,error}=await sb.from('organization_members').select('org_id').eq('user_id',userId).limit(1);
      if(error)throw error;
      return data?.[0]?.org_id||null;
    }catch{return null}
  }

  async function syncQueue(){
    const user=await currentUser();
    if(!user)return;
    const orgId=await currentOrg(user.id);
    const q=readQueue();
    if(!q.length)return;
    const remaining=[];
    for(const event of q){
      const row={
        user_id:user.id,
        organization_id:orgId,
        terms_version:VERSION,
        event_type:event.kind||'acceptance',
        action_name:event.action||null,
        plan_key:event.plan||null,
        document_versions:DOCS,
        source:'web',
        client_recorded_at:event.accepted_at||now(),
        metadata:{path:event.path||location.pathname,event_id:event.event_id||null}
      };
      try{
        const {error}=await sb.from('legal_acceptance_ledger').insert(row);
        if(error)throw error;
      }catch(e){remaining.push(event)}
    }
    writeQueue(remaining);
  }

  function record(kind,extra={}){
    const item=queueEvent({kind,...extra});
    if(kind==='account_creation')try{localStorage.setItem(ACCEPT_KEY,JSON.stringify(item))}catch{}
    if(kind==='subscription_purchase')try{localStorage.setItem(PURCHASE_KEY,JSON.stringify(item))}catch{}
    setTimeout(syncQueue,100);
    return item;
  }

  async function syncUserAcceptance(kind){
    try{
      const user=await currentUser();if(!user||typeof sb==='undefined')return;
      await sb.auth.updateUser({data:{ba_terms_version:VERSION,ba_terms_accepted_at:now(),ba_terms_acceptance_kind:kind}});
    }catch{}
  }

  function addAuthConsent(){
    const form=document.getElementById('authForm');
    const submit=document.getElementById('authSubmit');
    if(!form||!submit||document.getElementById('baAuthLegal'))return;
    const wrap=document.createElement('label');
    wrap.id='baAuthLegal';
    wrap.className='legal-check legal-hidden';
    wrap.innerHTML='<input id="baAuthLegalCheck" type="checkbox"><span>I have read and agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>, <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>, <a href="/refunds" target="_blank" rel="noopener">Refund & Cancellation Policy</a>, and <a href="/disclaimer" target="_blank" rel="noopener">AI & Automated Analysis Disclaimer</a>. I understand BrandedAlign provides automated informational guidance, not legal or regulatory approval.</span>';
    form.insertBefore(wrap,submit);

    const update=()=>{
      const signup=document.getElementById('authSignUpTab')?.classList.contains('active');
      wrap.classList.toggle('legal-hidden',!signup);
    };
    document.getElementById('authSignUpTab')?.addEventListener('click',()=>setTimeout(update,0));
    document.getElementById('authSignInTab')?.addEventListener('click',()=>setTimeout(update,0));
    update();

    form.addEventListener('submit',function(e){
      const signup=document.getElementById('authSignUpTab')?.classList.contains('active');
      if(!signup)return;
      const box=document.getElementById('baAuthLegalCheck');
      if(!box?.checked){
        e.preventDefault();e.stopImmediatePropagation();
        const st=document.getElementById('authStatus');
        if(st){st.textContent='You must agree to the Terms, Privacy Policy, Refund Policy, and Automated Analysis Disclaimer to create an account.';st.className='modal-status show error'}
        return;
      }
      record('account_creation');
      setTimeout(()=>syncUserAcceptance('account_creation'),1200);
    },true);
  }

  function showPurchaseConsent(plan,continueFn){
    document.getElementById('baConsentOverlay')?.remove();
    const overlay=document.createElement('div');
    overlay.id='baConsentOverlay';
    overlay.className='ba-consent-overlay';
    overlay.innerHTML='<div class="ba-consent-card" role="dialog" aria-modal="true" aria-labelledby="baConsentTitle"><span style="text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#0B6477;font-weight:800">Before checkout</span><h2 id="baConsentTitle">Confirm your BrandedAlign subscription</h2><p>Your selected plan renews automatically at the price and billing interval shown until you cancel. Digital subscription fees, scans, searches, analyses, credits, and usage are non-refundable once access or usage is provided, except where applicable law requires otherwise. Cancel before your next renewal to prevent a future charge. Cancellation does not ordinarily refund the current billing period.</p><label class="legal-check"><input id="baPurchaseCheck" type="checkbox"><span>I understand and agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>, <a href="/refunds" target="_blank" rel="noopener">Refund & Cancellation Policy</a>, and <a href="/disclaimer" target="_blank" rel="noopener">Automated Analysis Disclaimer</a>, including the no-guarantee and user-responsibility provisions.</span></label><div class="ba-consent-actions"><button type="button" class="ba-consent-cancel">Not now</button><button type="button" class="ba-consent-confirm" disabled>Agree & Continue to Checkout</button></div></div>';
    document.body.appendChild(overlay);
    const check=overlay.querySelector('#baPurchaseCheck');
    const confirm=overlay.querySelector('.ba-consent-confirm');
    check.addEventListener('change',()=>confirm.disabled=!check.checked);
    overlay.querySelector('.ba-consent-cancel').addEventListener('click',()=>overlay.remove());
    confirm.addEventListener('click',async()=>{
      record('subscription_purchase',{plan:String(plan||'')});
      await syncUserAcceptance('subscription_purchase');
      await syncQueue();
      overlay.remove();
      continueFn();
    });
  }

  function interceptPlanButtons(){
    document.addEventListener('click',function(e){
      const btn=e.target?.closest?.('.plan-btn');
      if(!btn)return;
      e.preventDefault();e.stopImmediatePropagation();
      const plan=btn.dataset.plan;
      showPurchaseConsent(plan,()=>{if(typeof beginCheckout==='function')beginCheckout(plan)});
    },true);
  }

  function addActionAck(formId,buttonId,labelText,actionName){
    const form=document.getElementById(formId);
    const button=document.getElementById(buttonId);
    if(!form||!button||document.getElementById(formId+'LegalAck'))return;
    const box=document.createElement('label');
    box.id=formId+'LegalAck';
    box.className='legal-check';
    box.style.marginTop='12px';
    box.innerHTML='<input type="checkbox"><span>'+labelText+' <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/disclaimer" target="_blank" rel="noopener">Disclaimer</a> apply.</span>';
    button.insertAdjacentElement('afterend',box);
    form.addEventListener('submit',function(e){
      const input=box.querySelector('input');
      if(!input.checked){
        e.preventDefault();e.stopImmediatePropagation();
        alert('Please check the acknowledgment before running this BrandedAlign review.');
        input.focus();
        return;
      }
      record('analysis_action',{action:actionName||formId});
      syncUserAcceptance('analysis_action');
      setTimeout(()=>{input.checked=false},0);
    },true);
  }

  function addResultNotice(){
    const fit=document.getElementById('fitResult');
    if(fit&&!document.getElementById('fitResultLegal')){
      const n=document.createElement('div');
      n.id='fitResultLegal';
      n.className='ba-result-legal';
      n.textContent='BrandedAlign results are automated informational guidance only. A result does not constitute legal or regulatory approval, certification, or a guarantee that content is safe to publish.';
      fit.insertAdjacentElement('afterend',n);
    }
  }

  function boot(){
    addAuthConsent();
    interceptPlanButtons();
    addActionAck('fitForm','fitBtn','By running this Fit Check, I acknowledge that automated results may be incomplete, incorrect, outdated, or miss issues. I remain responsible for final verification and anything I publish.','fit_check');
    addActionAck('agreementForm','agreementSubmit','By running this Agreement Review, I acknowledge that BrandedAlign does not determine whether an activity is legally or contractually permitted. I remain responsible for final decisions and professional review when appropriate.','agreement_review');
    addResultNotice();
    setTimeout(syncQueue,600);
    try{if(typeof sb!=='undefined'&&sb?.auth?.onAuthStateChange)sb.auth.onAuthStateChange((_event,session)=>{if(session?.user)setTimeout(syncQueue,500)})}catch{}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
