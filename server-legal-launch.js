const http=require('http');
const fs=require('fs');
const path=require('path');

const upstreamRead=fs.readFileSync.bind(fs);
const originalCreateServer=http.createServer.bind(http);

const EFFECTIVE_DATE='September 14, 2026';
const TERMS_VERSION='2026-09-14-v1';
const BRAND='BrandedAlign';
const PUBLIC_BRAND='TeamUpWithKrystal';
const OPERATOR='Krystal LaMar, an individual doing business as TeamUpWithKrystal';
const SUPPORT_EMAIL='support@brandedalign.com';

const legalLinks=`<div id="launchLegalLinks" class="launch-legal-links" aria-label="Legal links">
  <a href="/terms">Terms of Service</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/refunds">Refund & Cancellation Policy</a>
  <a href="/disclaimer">AI & Automated Analysis Disclaimer</a>
</div>`;

const legalLinkStyles=`<style id="launch-legal-styles">
.launch-legal-links{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-top:18px;padding-top:16px;border-top:1px solid rgba(16,42,58,.12);font-size:12px}.launch-legal-links a{color:#0B6477;text-decoration:none}.launch-legal-links a:hover{text-decoration:underline}.subscription-legal-note,.action-legal-note{max-width:980px;margin:18px auto 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.76);border:1px solid rgba(16,42,58,.10);font-size:12px;line-height:1.62;color:#52656d}.subscription-legal-note strong,.action-legal-note strong{color:#102A3A}.subscription-legal-note a,.action-legal-note a,.legal-check a{color:#0B6477}.client-legal-footer{max-width:1180px;margin:36px auto 18px;padding:18px 22px;border-top:1px solid rgba(16,42,58,.12);font-size:12px;color:#62727a}.client-legal-footer .launch-legal-links{margin-top:8px;padding-top:0;border-top:0}.client-legal-footer strong{color:#102A3A}.legal-check{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border:1px solid rgba(16,42,58,.11);border-radius:12px;background:rgba(255,255,255,.72);font-size:12px;line-height:1.5;color:#52656d}.legal-check input{margin-top:3px;flex:0 0 auto}.legal-hidden{display:none!important}.ba-consent-overlay{position:fixed;inset:0;z-index:99999;background:rgba(8,24,32,.58);display:grid;place-items:center;padding:20px}.ba-consent-card{width:min(620px,100%);max-height:90vh;overflow:auto;background:#FFFDF7;color:#102A3A;border-radius:24px;padding:28px;box-shadow:0 32px 90px rgba(0,0,0,.28);border:1px solid rgba(16,42,58,.10)}.ba-consent-card h2{margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500}.ba-consent-card p{color:#52656d;line-height:1.6}.ba-consent-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.ba-consent-actions button{border-radius:999px;padding:11px 18px;font-weight:700;cursor:pointer}.ba-consent-cancel{background:transparent;border:1px solid rgba(16,42,58,.18);color:#102A3A}.ba-consent-confirm{background:#0B6477;border:1px solid #0B6477;color:white}.ba-consent-confirm:disabled{opacity:.45;cursor:not-allowed}.ba-result-legal{margin-top:12px;padding:12px 14px;border-radius:12px;background:#fff8e7;border:1px solid rgba(232,184,76,.28);font-size:12px;line-height:1.55;color:#5e5849}
@media(max-width:640px){.launch-legal-links{gap:8px 12px}.subscription-legal-note,.action-legal-note{margin-left:12px;margin-right:12px}.ba-consent-card{padding:22px}.ba-consent-actions{flex-direction:column-reverse}.ba-consent-actions button{width:100%}}
</style>`;

const consentScript=`<script id="baLegalConsentScript">
(function(){
  const VERSION=${JSON.stringify(TERMS_VERSION)};
  const ACCEPT_KEY='ba_legal_acceptance_'+VERSION;
  const PURCHASE_KEY='ba_purchase_acceptance_'+VERSION;
  const ACTION_KEY='ba_action_ack_'+VERSION;
  function now(){return new Date().toISOString()}
  function mark(key,extra){const value={version:VERSION,accepted_at:now(),...extra};try{localStorage.setItem(key,JSON.stringify(value))}catch{};return value}
  async function syncUserAcceptance(kind){
    try{
      if(typeof sb==='undefined'||!sb?.auth)return;
      const {data}=await sb.auth.getUser();
      if(!data?.user)return;
      const payload={ba_terms_version:VERSION,ba_terms_accepted_at:now(),ba_terms_acceptance_kind:kind};
      await sb.auth.updateUser({data:payload});
    }catch(e){console.warn('Legal acceptance metadata sync skipped',e)}
  }
  function addAuthConsent(){
    const form=document.getElementById('authForm');const submit=document.getElementById('authSubmit');if(!form||!submit||document.getElementById('baAuthLegal'))return;
    const wrap=document.createElement('label');wrap.id='baAuthLegal';wrap.className='legal-check legal-hidden';wrap.innerHTML='<input id="baAuthLegalCheck" type="checkbox"><span>I have read and agree to the <a href="/terms" target="_blank">Terms of Service</a>, <a href="/privacy" target="_blank">Privacy Policy</a>, <a href="/refunds" target="_blank">Refund & Cancellation Policy</a>, and <a href="/disclaimer" target="_blank">AI & Automated Analysis Disclaimer</a>. I understand BrandedAlign is automated informational guidance, not legal or regulatory approval.</span>';
    form.insertBefore(wrap,submit);
    const update=()=>{const signup=document.getElementById('authSignUpTab')?.classList.contains('active');wrap.classList.toggle('legal-hidden',!signup)};
    document.getElementById('authSignUpTab')?.addEventListener('click',()=>setTimeout(update,0));
    document.getElementById('authSignInTab')?.addEventListener('click',()=>setTimeout(update,0));
    update();
    form.addEventListener('submit',function(e){
      const signup=document.getElementById('authSignUpTab')?.classList.contains('active');if(!signup)return;
      const box=document.getElementById('baAuthLegalCheck');if(!box?.checked){e.preventDefault();e.stopImmediatePropagation();const st=document.getElementById('authStatus');if(st){st.textContent='You must agree to the Terms, Privacy Policy, Refund Policy, and Automated Analysis Disclaimer to create an account.';st.className='modal-status show error'}return}
      mark(ACCEPT_KEY,{kind:'account_creation'});setTimeout(()=>syncUserAcceptance('account_creation'),1200);
    },true);
  }
  function showPurchaseConsent(plan,continueFn){
    document.getElementById('baConsentOverlay')?.remove();
    const overlay=document.createElement('div');overlay.id='baConsentOverlay';overlay.className='ba-consent-overlay';
    overlay.innerHTML='<div class="ba-consent-card" role="dialog" aria-modal="true" aria-labelledby="baConsentTitle"><span style="text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#0B6477;font-weight:800">Before checkout</span><h2 id="baConsentTitle">Confirm your BrandedAlign subscription</h2><p>Your selected plan renews automatically at the price and billing interval shown until you cancel. Digital subscription fees, scans, searches, analyses, credits, and usage are non-refundable once access or usage is provided, except where applicable law requires otherwise. Cancel before your next renewal to prevent a future charge. Cancellation does not ordinarily refund the current billing period.</p><label class="legal-check"><input id="baPurchaseCheck" type="checkbox"><span>I understand and agree to the <a href="/terms" target="_blank">Terms of Service</a>, <a href="/refunds" target="_blank">Refund & Cancellation Policy</a>, and <a href="/disclaimer" target="_blank">Automated Analysis Disclaimer</a>, including the no-guarantee and user-responsibility provisions.</span></label><div class="ba-consent-actions"><button type="button" class="ba-consent-cancel">Not now</button><button type="button" class="ba-consent-confirm" disabled>Agree & Continue to Checkout</button></div></div>';
    document.body.appendChild(overlay);
    const check=overlay.querySelector('#baPurchaseCheck');const confirm=overlay.querySelector('.ba-consent-confirm');check.addEventListener('change',()=>confirm.disabled=!check.checked);
    overlay.querySelector('.ba-consent-cancel').addEventListener('click',()=>overlay.remove());
    confirm.addEventListener('click',async()=>{mark(PURCHASE_KEY,{kind:'subscription_purchase',plan:String(plan||'')});await syncUserAcceptance('subscription_purchase');overlay.remove();continueFn()});
  }
  function interceptPlanButtons(){
    document.addEventListener('click',function(e){const btn=e.target?.closest?.('.plan-btn');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const plan=btn.dataset.plan;showPurchaseConsent(plan,()=>{if(typeof beginCheckout==='function')beginCheckout(plan)})},true);
  }
  function addActionAck(formId,buttonId,labelText){
    const form=document.getElementById(formId);const button=document.getElementById(buttonId);if(!form||!button||document.getElementById(formId+'LegalAck'))return;
    const box=document.createElement('label');box.id=formId+'LegalAck';box.className='legal-check';box.style.marginTop='12px';box.innerHTML='<input type="checkbox"><span>'+labelText+' <a href="/terms" target="_blank">Terms</a> and <a href="/disclaimer" target="_blank">Disclaimer</a> apply.</span>';
    button.insertAdjacentElement('afterend',box);
    form.addEventListener('submit',function(e){const input=box.querySelector('input');if(!input.checked){e.preventDefault();e.stopImmediatePropagation();alert('Please acknowledge the BrandedAlign automated-analysis terms before running this review.');return}mark(ACTION_KEY,{kind:'analysis_action',action:formId});syncUserAcceptance('analysis_action')},true);
  }
  function addResultNotice(){
    const fit=document.getElementById('fitResult');if(fit&&!document.getElementById('fitResultLegal')){const n=document.createElement('div');n.id='fitResultLegal';n.className='ba-result-legal';n.textContent='BrandedAlign results are automated informational guidance only. A result does not constitute legal or regulatory approval, certification, or a guarantee that content is safe to publish.';fit.insertAdjacentElement('afterend',n)}
  }
  function boot(){
    addAuthConsent();interceptPlanButtons();
    addActionAck('fitForm','fitBtn','By running this check, I acknowledge that automated results may be incomplete, incorrect, outdated, or miss issues. I remain responsible for final verification and publication.');
    addActionAck('agreementForm','agreementSubmit','By running this review, I acknowledge that BrandedAlign does not determine whether an activity is legally or contractually permitted. I remain responsible for final decisions and professional review when appropriate.');
    addResultNotice();
    try{const pending=localStorage.getItem(ACCEPT_KEY)||localStorage.getItem(PURCHASE_KEY);if(pending)setTimeout(()=>syncUserAcceptance('existing_acceptance'),1500)}catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>`;

function injectPublic(html){
  if(html.includes('id="baLegalConsentScript"')) return html;
  let out=html.replace('</head>',legalLinkStyles+'\n</head>');
  const planNeedle='<div class="plan-foot">Cancel through the secure billing portal. BrandedAlign does not store your card number.</div>';
  const planReplacement=`<div class="plan-foot">Cancel through the secure billing portal. BrandedAlign does not store your card number.</div><div class="subscription-legal-note"><strong>Recurring digital subscription:</strong> Plans renew automatically at the price and billing interval shown until canceled. Digital subscription fees, searches, scans, analyses, credits, and other usage are non-refundable once access or usage is provided, except where required by law. Cancel before the next renewal to prevent a future charge. Cancellation does not ordinarily refund the current billing period, and paid access continues through the already-paid period. By purchasing, you affirmatively agree to the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a>, <a href="/refunds">Refund & Cancellation Policy</a>, and <a href="/disclaimer">AI & Automated Analysis Disclaimer</a>.</div>`;
  out=out.replace(planNeedle,planReplacement);
  out=out.replace('BrandedAlign is owned and operated by TeamUpWithKrystal.','BrandedAlign is a product of TeamUpWithKrystal and is currently operated by Krystal LaMar, an individual doing business as TeamUpWithKrystal.');
  out=out.replace('</footer>',legalLinks+'\n</footer>');
  out=out.replace('</body>',consentScript+'\n</body>');
  return out;
}

function injectClient(html){
  if(html.includes('id="baLegalConsentScript"')) return html;
  let out=html.replace('</head>',legalLinkStyles+'\n</head>');
  out=out.replace('<p class="agreement-disclaimer">BrandedAlign spots potential contract and policy conflicts for further review. It does not provide legal advice, legal opinions, or a guarantee that an activity is permitted.</p>','<p class="agreement-disclaimer">BrandedAlign spots potential contract and policy conflicts for further review. It does not provide legal advice, legal opinions, compliance certification, permission to proceed, or a guarantee that an activity is permitted. Automated review can miss issues or produce incorrect results. You remain responsible for final decisions.</p>');
  const footer=`<footer class="client-legal-footer"><strong>${BRAND}</strong> is a product of ${PUBLIC_BRAND}, currently operated by ${OPERATOR}. ${BRAND} provides automated informational risk-spotting and organizational guidance, not legal advice, regulatory approval, legal certification, or a guarantee of compliance.${legalLinks}</footer>`;
  out=out.replace('</body>',footer+'\n'+consentScript+'\n</body>');
  return out;
}

fs.readFileSync=function(file,options){
  const out=upstreamRead(file,options);
  const base=path.basename(String(file));
  if(base!=='index-v2.html'&&base!=='client-v1.html') return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const injected=base==='index-v2.html'?injectPublic(text):injectClient(text);
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?injected:Buffer.from(injected);
};

const pageCss=`
:root{--ink:#102A3A;--teal:#0B6477;--cream:#FFFDF7;--gold:#E8B84C;--muted:#60727a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 8% 0%,rgba(141,226,232,.20),transparent 26%),linear-gradient(180deg,#fffdfa,#faf4e9);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}a{color:var(--teal)}.wrap{width:min(960px,calc(100% - 36px));margin:0 auto}.top{padding:26px 0;border-bottom:1px solid rgba(16,42,58,.10);background:rgba(255,253,247,.88);backdrop-filter:blur(10px);position:sticky;top:0;z-index:5}.brand{display:flex;gap:12px;align-items:center;text-decoration:none;color:var(--ink);font-family:Georgia,"Times New Roman",serif;font-size:23px}.mark{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#0B6477,#102A3A);color:var(--gold);box-shadow:0 8px 20px rgba(16,42,58,.18)}main{padding:58px 0 72px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;color:var(--teal);font-weight:700;font-size:12px}.card{background:rgba(255,255,255,.84);border:1px solid rgba(16,42,58,.09);box-shadow:0 26px 70px rgba(16,42,58,.08);border-radius:28px;padding:clamp(26px,5vw,54px)}h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;line-height:1.08}h1{font-size:clamp(42px,7vw,68px);margin:12px 0 8px}h2{font-size:26px;margin:34px 0 9px}h3{margin-top:28px}.meta{color:var(--muted);font-size:13px}.notice{margin:22px 0;padding:16px 18px;border-left:4px solid var(--gold);background:#fff8e7;border-radius:10px;color:#4d5d64}.back{display:inline-block;margin-top:34px;text-decoration:none;font-weight:700}.footer{padding:24px 0 42px;color:var(--muted);font-size:12px}.legalnav{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:10px}ul{padding-left:22px}@media(max-width:640px){main{padding-top:32px}.card{border-radius:20px}}
`;

function layout(title,eyebrow,body){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102A3A"><title>${title} | ${BRAND}</title><meta name="robots" content="index,follow"><style>${pageCss}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/"><span class="mark">✦</span><span>${BRAND}</span></a></div></header><main><div class="wrap"><article class="card"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><div class="meta">Effective ${EFFECTIVE_DATE} · Version ${TERMS_VERSION} · ${BRAND} by ${PUBLIC_BRAND}</div>${body}<a class="back" href="/">← Back to BrandedAlign</a></article></div></main><footer class="footer"><div class="wrap"><div>© 2026 ${PUBLIC_BRAND}. All rights reserved.</div><div class="legalnav"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds & cancellation</a><a href="/disclaimer">Automated analysis disclaimer</a></div></div></footer></body></html>`;
}

const docs={
'/disclaimer':()=>layout('AI & Automated Analysis Disclaimer','Important information',`
<div class="notice"><strong>${BRAND} is an automated informational technology service.</strong> It does not provide legal advice, regulatory advice, legal opinions, legal representation, compliance certification, financial advice, tax advice, medical advice, or other licensed professional services.</div>
<h2>Automated output can be wrong</h2><p>${BRAND} may use software rules, artificial intelligence, machine learning, third-party information, databases, APIs, or other automated systems. Outputs may be inaccurate, incomplete, inconsistent, outdated, misleading, or inappropriate for a particular situation. The Service may miss an existing issue or flag an issue that does not actually exist.</p>
<h2>No approval, certification, or permission to publish</h2><p>A result indicating that no issue was detected does not constitute legal approval, regulatory approval, certification, clearance, authorization, permission to publish, or a representation that content is lawful or risk-free. A warning does not necessarily mean that a violation exists.</p>
<h2>You remain responsible</h2><p>You are solely responsible for reviewing, verifying, approving, distributing, publishing, relying upon, or otherwise using content reviewed through ${BRAND}. You are responsible for determining whether professional review is appropriate before making claims, publishing advertising, signing agreements, handling regulated material, or taking other business action.</p>
<h2>Changing rules and third-party sources</h2><p>Laws, regulations, regulatory interpretations, advertising standards, platform rules, company policies, and source material can change without notice. ${BRAND} may not immediately identify every change. Important information should be verified against current authoritative sources.</p>
<h2>No guarantee of outcome</h2><p>${BRAND} does not guarantee compliance, non-infringement, accessibility conformance, approval by a regulator, approval by a platform or affiliate company, business results, financial results, or prevention of claims, penalties, disputes, account restrictions, or losses.</p>`),
'/refunds':()=>layout('Refund & Cancellation Policy','Billing',`
<div class="notice"><strong>Digital service; generally no refunds.</strong> Except where required by applicable law, amounts paid for subscriptions, searches, scans, analyses, credits, usage, and other digital functionality are final and non-refundable once access or usage has been provided.</div>
<h2>Recurring subscriptions</h2><p>Paid ${BRAND} plans automatically renew at the price and billing interval clearly shown at checkout until canceled. By purchasing a recurring plan, you authorize ${BRAND} and its payment processor to charge the selected payment method for each renewal until cancellation.</p>
<h2>How cancellation works</h2><p>Use the secure billing portal linked from your ${BRAND} account to cancel renewal. Cancellation prevents future renewal charges when completed before the next renewal is incurred. Unless applicable law requires otherwise, cancellation does not retroactively reverse a charge already incurred and does not create a prorated refund for the current billing period. Paid access ordinarily continues through the end of the already-paid period.</p>
<h2>Non-refundable digital usage</h2><p>Except where required by law, refunds or cash credits are not provided for unused subscription time; unused searches, scans, analyses, credits, pages, or usage allowances; failure to use the Service; dissatisfaction with an automated result; a result that does not produce an expected outcome; or a decision to discontinue use before the end of a paid billing period.</p>
<h2>Consumed usage</h2><p>A search, scan, analysis, report, credit, or other metered unit may be treated as consumed when the request is submitted and accepted for processing, even if you later choose not to use the result or the result differs from what you expected. Usage allowances have no cash value.</p>
<h2>Billing errors</h2><p>The no-refund policy does not prevent you from reporting a genuine duplicate charge, unauthorized charge, or payment-processing error. Contact ${SUPPORT_EMAIL} promptly so the transaction can be reviewed. Nothing in this policy limits rights that applicable law does not permit the parties to waive.</p>`),
'/privacy':()=>layout('Privacy Policy','Your information',`
<div class="notice">This policy describes information ${BRAND} may collect and process when you visit the site, create an account, purchase a subscription, submit documents or URLs, or run a review.</div>
<h2>Operator</h2><p>${BRAND} is a product of ${PUBLIC_BRAND}, currently operated by ${OPERATOR}.</p>
<h2>Information we may collect</h2><p>Depending on how you use ${BRAND}, we may collect account information such as email address; authentication and account-status data; subscription and billing metadata; URLs, agreements, text, files, prompts, brand material, and other content you choose to submit; scan inputs and results; support communications; consent and acceptance records; and technical data such as device, browser, IP address or derived security identifiers, timestamps, and security logs.</p>
<h2>Payments</h2><p>Payments and subscription billing are processed by Stripe or another disclosed payment processor. ${BRAND} does not intentionally store your full payment-card number. Payment processors process payment information under their own terms and privacy practices.</p>
<h2>Automated processing and service providers</h2><p>To perform requested reviews, submitted content may be processed by hosting, database, authentication, security, analytics, automation, artificial-intelligence, search, or other technical service providers used to operate ${BRAND}. We use such providers to provide, secure, support, and maintain the Service.</p>
<h2>How information is used</h2><p>Information may be used to provide and secure the Service, authenticate users, process subscription status, perform requested reviews, save results, document contractual assent, troubleshoot problems, prevent abuse, communicate about the Service, maintain business records, and improve reliability and user experience.</p>
<h2>Your submitted content</h2><p>You retain your rights in material you submit. You authorize ${OPERATOR} to host, copy, transmit, process, analyze, transform, display, and otherwise use submitted material only as reasonably necessary to provide, secure, support, maintain, troubleshoot, and improve the Service and to perform actions you request. Do not submit material you are not authorized to disclose or process.</p>
<h2>Retention</h2><p>Information is retained for as long as reasonably necessary to provide the Service, maintain security and business records, document transactions and contractual acceptance, meet legal or accounting obligations, resolve disputes, and enforce agreements.</p>
<h2>Privacy choices</h2><p>Depending on where you live, applicable law may provide rights concerning access, correction, deletion, portability, or certain processing. Send privacy requests to ${SUPPORT_EMAIL}. Identity verification may be required before a request is completed.</p>
<h2>Security</h2><p>Reasonable administrative and technical safeguards are used to protect information. No internet service, transmission method, or storage system can guarantee absolute security.</p>
<h2>Children</h2><p>${BRAND} is intended for adults and business users and is not directed to children under 13.</p>
<h2>Changes</h2><p>This Privacy Policy may be updated as the Service changes. Material updates will be posted with a revised effective date and, where appropriate or required, renewed acceptance may be requested.</p>`),
'/terms':()=>layout('Terms of Service','Binding agreement',`
<div class="notice">These Terms are a legally binding agreement governing access to and use of ${BRAND}. ${BRAND} is a product of ${PUBLIC_BRAND}, currently operated by ${OPERATOR} (“Company,” “we,” “us,” or “our”). By affirmatively accepting these Terms, creating an account after being presented with them, purchasing a subscription after being presented with them, or using a feature whose interface clearly states that use constitutes acknowledgment of these Terms, you agree to be bound by them.</div>
<h2>1. Eligibility and authority</h2><p>You must be at least 18 years old and legally capable of entering a binding contract. If you use ${BRAND} on behalf of a company, client, employer, agency, or other entity, you represent that you have authority to act for that entity.</p>
<h2>2. The Service</h2><p>${BRAND} provides automated tools that may assist with reviewing branding, marketing, advertising, disclosures, accessibility, privacy signals, agreement compatibility, claims, and related risk-spotting. Features, sources, limits, and availability may vary by plan and may change over time.</p>
<h2>3. No professional advice</h2><p>${BRAND} does not provide legal, regulatory, financial, tax, medical, accounting, or other licensed professional advice. Use of the Service does not create an attorney-client, fiduciary, advisor, consultant, or professional relationship. The <a href="/disclaimer">AI & Automated Analysis Disclaimer</a> is incorporated into these Terms.</p>
<h2>4. No guarantee of compliance or accuracy</h2><p>We do not warrant or guarantee that any score, scan, search, recommendation, warning, omission, source, suggested revision, or other output is accurate, complete, current, legally sufficient, compliant, suitable, or appropriate for publication. Automated systems may produce false positives, false negatives, incomplete results, or incorrect results.</p>
<h2>5. Your final responsibility</h2><p>You retain sole responsibility for reviewing, verifying, approving, publishing, distributing, selling, promoting, advertising, submitting, relying upon, or otherwise using your content. You are responsible for determining whether your content and business activities comply with applicable law, regulation, contract terms, platform rules, professional requirements, intellectual-property rights, and other obligations.</p>
<h2>6. Assumption of risk</h2><p>By using ${BRAND}, you knowingly accept the inherent limitations of automated analysis, artificial intelligence, third-party information, changing laws, changing platform policies, changing company policies, and human decision-making. Risks may include missed issues, incorrect classifications, rejected advertising, account restrictions, business losses, claims, disputes, enforcement inquiries, regulatory consequences, and other losses arising from your decision to publish, rely upon, or otherwise use content.</p>
<h2>7. Accounts and seats</h2><p>You are responsible for accurate account information, safeguarding credentials, and activity occurring through your account. Each individual seat may be required to separately acknowledge applicable Terms and product limitations. You may not share credentials in a manner that bypasses plan limits or security controls.</p>
<h2>8. Searches, scans, analyses, and usage</h2><p>Metered searches, scans, analyses, credits, pages, reports, tokens, or other usage may be treated as consumed when a request is submitted and accepted for processing. Usage allowances have no cash value. Unless a plan expressly provides otherwise, unused usage does not roll over and may expire at the end of the applicable usage or billing period.</p>
<h2>9. Subscriptions and automatic renewal</h2><p>Paid plans automatically renew at the price and billing interval shown at checkout until canceled. By purchasing a recurring subscription, you expressly authorize ${BRAND} and its payment processor to charge your selected payment method for each recurring billing period until cancellation. Material billing terms are presented before purchase.</p>
<h2>10. Cancellation</h2><p>You may cancel renewal through the cancellation method made available in your account or another method expressly identified by ${BRAND}. Cancellation prevents future renewal charges when completed before the next renewal is incurred. Unless required by law, cancellation does not retroactively cancel a charge already incurred. Paid access ordinarily continues through the end of the already-paid billing period.</p>
<h2>11. No-refund digital service policy</h2><p>Except where required by applicable law, amounts paid for subscriptions, digital services, searches, scans, analyses, credits, usage, and other digital functionality are final and non-refundable once access or usage has been provided. The <a href="/refunds">Refund & Cancellation Policy</a> is incorporated into these Terms.</p>
<h2>12. Billing errors</h2><p>Nothing in the no-refund policy prevents review of a genuine duplicate charge, unauthorized charge, or payment-processing error. Report suspected billing errors promptly to ${SUPPORT_EMAIL}.</p>
<h2>13. User content</h2><p>You retain ownership of content you submit. You represent that you have the rights and permissions necessary to submit and process it. You grant ${OPERATOR} a limited, nonexclusive license to host, copy, transmit, process, analyze, transform, display, and otherwise use that content as reasonably necessary to provide, secure, support, maintain, troubleshoot, and improve the Service and to perform actions you request.</p>
<h2>14. Sensitive information</h2><p>Do not submit passwords, private authentication credentials, Social Security numbers, full payment-card numbers, protected health information, classified material, another party’s trade secrets, or similarly sensitive information unless ${BRAND} expressly provides functionality designed and authorized to process that information.</p>
<h2>15. Third-party services and information</h2><p>${BRAND} may rely on third-party websites, databases, APIs, artificial-intelligence providers, search providers, payment processors, hosting providers, platform documentation, or other information. Third-party material may change without notice. We do not control and cannot guarantee the accuracy, legality, availability, completeness, security, or continued existence of third-party services or information.</p>
<h2>16. Changing laws, rules, and policies</h2><p>Laws, regulations, regulatory interpretations, advertising standards, industry rules, platform policies, and company policies can change. ${BRAND} may not immediately identify or incorporate every change. Previous results should not be assumed to remain accurate indefinitely.</p>
<h2>17. Acceptable use</h2><p>You may not use the Service to violate law; infringe another party’s rights; commit fraud; distribute malware; interfere with the Service; bypass security or plan limits; obtain unauthorized access; intentionally submit unlawful material for unlawful activity; or falsely represent a ${BRAND} result as legal approval, certification, regulatory approval, or a guaranteed statement of compliance.</p>
<h2>18. Intellectual property</h2><p>${BRAND}, its software, design, workflows, interfaces, branding, proprietary analysis methods, documentation, compilations, and original content are owned by ${OPERATOR} or its licensors and protected by applicable intellectual-property law. These Terms provide only a limited right to use the Service and do not transfer ownership.</p>
<h2>19. Service availability and changes</h2><p>The Service may experience downtime, maintenance, interruptions, bugs, latency, data-processing failures, integration failures, or other technical problems. Features may be added, removed, limited, replaced, suspended, or discontinued. Unless separately agreed in writing, uninterrupted or error-free availability is not guaranteed.</p>
<h2>20. Disclaimer of warranties</h2><p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${BRAND} IS PROVIDED “AS IS” AND “AS AVAILABLE.” THE COMPANY DISCLAIMS WARRANTIES, EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, AVAILABILITY, AND FITNESS OF RESULTS. SOME JURISDICTIONS DO NOT PERMIT EXCLUSION OF CERTAIN WARRANTIES, SO THESE EXCLUSIONS APPLY ONLY TO THE MAXIMUM EXTENT PERMITTED BY LAW.</p>
<h2>21. Limitation of liability</h2><p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ${OPERATOR}, ${PUBLIC_BRAND}, AND THEIR AFFILIATED BUSINESSES, OWNERS, MEMBERS, MANAGERS, OFFICERS, EMPLOYEES, CONTRACTORS, AGENTS, LICENSORS, SERVICE PROVIDERS, SUCCESSORS, AND ASSIGNS (THE “BRANDEDALIGN PARTIES”) WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, LOST BUSINESS, LOST OPPORTUNITIES, LOSS OF GOODWILL, LOSS OF DATA, BUSINESS INTERRUPTION, PLATFORM RESTRICTIONS, REJECTED ADVERTISING, REGULATORY COSTS OR PENALTIES, OR THIRD-PARTY CLAIMS ARISING FROM OR RELATING TO THE SERVICE OR RELIANCE ON ITS OUTPUTS.</p>
<p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE AGGREGATE LIABILITY OF THE BRANDEDALIGN PARTIES ARISING FROM OR RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU ACTUALLY PAID TO ${BRAND} DURING THE TWELVE MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS ($100) IF YOU USED THE SERVICE WITHOUT PAYMENT. NOTHING IN THESE TERMS EXCLUDES LIABILITY THAT APPLICABLE LAW DOES NOT PERMIT TO BE EXCLUDED OR LIMITED.</p>
<h2>22. Indemnification and hold harmless</h2><p>To the maximum extent permitted by applicable law, you agree to defend, indemnify, and hold harmless the BrandedAlign Parties from third-party claims, demands, proceedings, liabilities, judgments, losses, damages, penalties, costs, and reasonable attorneys’ fees arising from or related to your submitted content; your publication, advertising, distribution, sale, or use of content; your violation of law or regulation; your infringement or alleged infringement of another party’s rights; your misuse of the Service; or your material breach of these Terms. This obligation does not require you to indemnify a BrandedAlign Party for liability that applicable law prohibits that party from shifting to you.</p>
<h2>23. No sole reliance for high-stakes decisions</h2><p>You agree not to use a ${BRAND} output as the sole basis for a decision where an error could reasonably result in significant legal liability, regulatory liability, financial loss, health or safety consequences, loss of important rights, or similarly serious consequences.</p>
<h2>24. Suspension and termination</h2><p>We may suspend or terminate access when reasonably necessary to protect the Service, users, third parties, or the BrandedAlign Parties from fraud, abuse, security threats, unlawful conduct, nonpayment, material violation of these Terms, or other substantial risk. Termination does not create a right to a refund except where required by law.</p>
<h2>25. Electronic assent and records</h2><p>You agree that contracts, notices, disclosures, acknowledgments, consents, and records relating to ${BRAND} may be provided electronically to the extent permitted by law. When the Service presents an unchecked checkbox, “I Agree” control, purchase control accompanied by contractual language, or another process clearly stating that an action constitutes acceptance, completing that action constitutes electronic assent. ${BRAND} may maintain electronic records of account identifiers, dates, times, Terms versions, acceptance events, and reasonable technical information associated with assent.</p>
<h2>26. Feature-level acknowledgments</h2><p>Where ${BRAND} displays an acknowledgment adjacent to a Search, Scan, Analyze, Review, Submit, Generate, or similar function and clearly states that activating the feature confirms acknowledgment of specified limitations or these Terms, use of that function confirms your continuing acknowledgment. Feature-level notices supplement the original affirmative acceptance and do not replace it.</p>
<h2>27. Updates to these Terms</h2><p>We may update these Terms as the Service, business, or law changes. Material changes may be communicated through the Service, by email, or another reasonable method. Where renewed affirmative acceptance is appropriate or legally required, continued access may require acceptance of the revised Terms. Material changes apply prospectively except where law permits otherwise.</p>
<h2>28. Governing law</h2><p>Except where applicable law requires otherwise, these Terms and disputes arising from them or the Service are governed by the laws of the State of Utah, without regard to conflict-of-laws principles.</p>
<h2>29. Venue</h2><p>Except where applicable consumer law requires otherwise, judicial proceedings arising from or relating to these Terms or ${BRAND} shall be brought in an appropriate state court located in Washington County, Utah, or the United States District Court for the District of Utah when federal jurisdiction exists. Nothing prevents an eligible party from bringing a claim in an appropriate small-claims court.</p>
<h2>30. Severability</h2><p>If a provision is invalid, illegal, or unenforceable, it will be enforced to the maximum extent permitted by law or severed where necessary, and the remaining provisions remain effective.</p>
<h2>31. No waiver</h2><p>Failure to enforce a provision on one occasion does not waive the right to enforce it or another provision later.</p>
<h2>32. Assignment</h2><p>You may not assign these Terms without prior written consent. We may assign these Terms in connection with a merger, acquisition, restructuring, financing, sale of assets, or transfer of the business or Service, subject to applicable law.</p>
<h2>33. Entire agreement</h2><p>These Terms, together with the Privacy Policy, Refund & Cancellation Policy, AI & Automated Analysis Disclaimer, applicable plan terms, and any additional terms expressly incorporated by reference, form the agreement governing the Service.</p>
<h2>34. Survival</h2><p>Provisions that by their nature should survive termination, including intellectual-property provisions, disclaimers, limitations of liability, indemnification, dispute provisions, payment obligations, and accrued rights, survive termination.</p>
<h2>35. Contact</h2><p>Questions concerning these Terms may be sent to ${SUPPORT_EMAIL}.</p>
<div class="notice"><strong>Important acknowledgment:</strong> By accepting these Terms, you acknowledge that ${BRAND} is an automated assistive tool; does not provide legal or regulatory advice; does not guarantee that content is legal, compliant, accurate, complete, or safe to publish; may miss issues or produce incorrect results; leaves final publishing and business decisions with you; provides digital usage that is generally non-refundable once provided or consumed except where law requires otherwise; and uses recurring subscriptions that continue until canceled.</div>`)
};

function sendLegal(req,res,body){
  const headers={
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'X-Frame-Options':'SAMEORIGIN',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'"
  };
  res.writeHead(200,headers);
  if(req.method==='HEAD') return res.end();
  res.end(body);
}

http.createServer=function(handler){
  return originalCreateServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(docs[url.pathname]){
      if(req.method!=='GET'&&req.method!=='HEAD'){
        res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8',Allow:'GET, HEAD'});
        return res.end('Method Not Allowed');
      }
      return sendLegal(req,res,docs[url.pathname]());
    }
    return handler(req,res);
  });
};

require('./server-client-launch.js');
