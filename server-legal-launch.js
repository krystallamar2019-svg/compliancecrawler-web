const http=require('http');
const fs=require('fs');
const path=require('path');

const upstreamRead=fs.readFileSync.bind(fs);
const originalCreateServer=http.createServer.bind(http);

const EFFECTIVE_DATE='September 12, 2026';
const BRAND='BrandedAlign';
const OPERATOR='TeamUpWithKrystal';
const SUPPORT_EMAIL='support@brandedalign.com';

const legalLinks=`<div id="launchLegalLinks" class="launch-legal-links" aria-label="Legal links">
  <a href="/terms">Terms of Use</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/refunds">Refund & Cancellation Policy</a>
  <a href="/disclaimer">Educational Disclaimer</a>
</div>`;

const legalLinkStyles=`<style id="launch-legal-styles">
.launch-legal-links{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-top:18px;padding-top:16px;border-top:1px solid rgba(16,42,58,.12);font-size:12px}.launch-legal-links a{color:#0B6477;text-decoration:none}.launch-legal-links a:hover{text-decoration:underline}.subscription-legal-note{max-width:980px;margin:18px auto 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.68);border:1px solid rgba(16,42,58,.09);font-size:12px;line-height:1.65;color:#52656d}.subscription-legal-note a{color:#0B6477}.client-legal-footer{max-width:1180px;margin:36px auto 18px;padding:18px 22px;border-top:1px solid rgba(16,42,58,.12);font-size:12px;color:#62727a}.client-legal-footer .launch-legal-links{margin-top:8px;padding-top:0;border-top:0}.client-legal-footer strong{color:#102A3A}
@media(max-width:640px){.launch-legal-links{gap:8px 12px}.subscription-legal-note{margin-left:12px;margin-right:12px}}
</style>`;

function injectPublic(html){
  if(html.includes('id="launchLegalLinks"')) return html;
  let out=html.replace('</head>',legalLinkStyles+'\n</head>');
  const planNeedle='<div class="plan-foot">Cancel through the secure billing portal. BrandedAlign does not store your card number.</div>';
  const planReplacement=`<div class="plan-foot">Cancel through the secure billing portal. BrandedAlign does not store your card number.</div><div class="subscription-legal-note"><strong>Monthly subscription:</strong> Plans renew automatically each month at the price shown until canceled. You can cancel renewal through the secure billing portal. Cancellation stops future renewal and access continues through the end of the already-paid billing period. Plan changes may include prorated charges or credits shown by Stripe before confirmation. By purchasing a plan, you agree to the <a href="/terms">Terms of Use</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/refunds">Refund & Cancellation Policy</a>.</div>`;
  out=out.replace(planNeedle,planReplacement);
  out=out.replace('</footer>',legalLinks+'\n</footer>');
  return out;
}

function injectClient(html){
  if(html.includes('id="launchLegalLinks"')) return html;
  let out=html.replace('</head>',legalLinkStyles+'\n</head>');
  const footer=`<footer class="client-legal-footer"><strong>${BRAND}</strong> is owned and operated by ${OPERATOR}. ${BRAND} provides educational risk-spotting and organizational guidance, not legal advice or legal certification.${legalLinks}</footer>`;
  out=out.replace('</body>',footer+'\n</body>');
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
:root{--ink:#102A3A;--teal:#0B6477;--cream:#FFFDF7;--gold:#E8B84C;--muted:#60727a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 8% 0%,rgba(141,226,232,.20),transparent 26%),linear-gradient(180deg,#fffdfa,#faf4e9);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}a{color:var(--teal)}.wrap{width:min(960px,calc(100% - 36px));margin:0 auto}.top{padding:26px 0;border-bottom:1px solid rgba(16,42,58,.10);background:rgba(255,253,247,.88);backdrop-filter:blur(10px);position:sticky;top:0}.brand{display:flex;gap:12px;align-items:center;text-decoration:none;color:var(--ink);font-family:Georgia,"Times New Roman",serif;font-size:23px}.mark{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#0B6477,#102A3A);color:var(--gold);box-shadow:0 8px 20px rgba(16,42,58,.18)}main{padding:58px 0 72px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;color:var(--teal);font-weight:700;font-size:12px}.card{background:rgba(255,255,255,.84);border:1px solid rgba(16,42,58,.09);box-shadow:0 26px 70px rgba(16,42,58,.08);border-radius:28px;padding:clamp(26px,5vw,54px)}h1,h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;line-height:1.08}h1{font-size:clamp(42px,7vw,68px);margin:12px 0 8px}h2{font-size:26px;margin:34px 0 9px}.meta{color:var(--muted);font-size:13px}.notice{margin:22px 0;padding:16px 18px;border-left:4px solid var(--gold);background:#fff8e7;border-radius:10px;color:#4d5d64}.back{display:inline-block;margin-top:34px;text-decoration:none;font-weight:700}.footer{padding:24px 0 42px;color:var(--muted);font-size:12px}.legalnav{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:10px}@media(max-width:640px){main{padding-top:32px}.card{border-radius:20px}}
`;

function layout(title,eyebrow,body){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102A3A"><title>${title} | ${BRAND}</title><meta name="robots" content="index,follow"><style>${pageCss}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/"><span class="mark">✦</span><span>${BRAND}</span></a></div></header><main><div class="wrap"><article class="card"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><div class="meta">Effective ${EFFECTIVE_DATE} · ${BRAND} by ${OPERATOR}</div>${body}<a class="back" href="/">← Back to BrandedAlign</a></article></div></main><footer class="footer"><div class="wrap"><div>© 2026 ${OPERATOR}. All rights reserved.</div><div class="legalnav"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds & cancellation</a><a href="/disclaimer">Disclaimer</a></div></div></footer></body></html>`;
}

const docs={
'/disclaimer':()=>layout('Educational Disclaimer','Important information',`
<div class="notice"><strong>${BRAND} is an educational technology service.</strong> It does not provide legal advice, legal opinions, legal representation, compliance certification, tax advice, financial advice, or professional licensing advice.</div>
<h2>Automated guidance is not a legal conclusion</h2><p>${BRAND} can identify potential risks, missing disclosures, conflicting language, accessibility concerns, privacy signals, marketing claims, or provisions in materials you submit. Automated analysis can be incomplete, incorrect, or outdated. Laws, regulations, platform rules, and company policies can change.</p>
<h2>Agreement compatibility reviews</h2><p>When you submit affiliate agreements, policies, terms, or other documents, ${BRAND} may highlight possible conflicts or areas that deserve closer review. A result such as “no conflict found in the documents reviewed” does not mean that an activity is legally permitted, contractually authorized, or risk-free. “Cannot determine” means the available material does not support a reliable conclusion.</p>
<h2>You remain responsible for decisions</h2><p>You are responsible for reviewing the underlying source material and deciding whether professional advice is appropriate before publishing content, making claims, recruiting, marketing, signing agreements, or taking other business action. When the stakes are significant or a result is uncertain, consult a qualified attorney or other appropriate professional.</p>
<h2>No guarantee</h2><p>${BRAND} does not guarantee compliance, non-infringement, accessibility conformance, approval by a regulator, approval by an affiliate company, or any particular business outcome.</p>`),
'/refunds':()=>layout('Refund & Cancellation Policy','Billing',`
<div class="notice"><strong>Simple cancellation:</strong> You can cancel subscription renewal through the secure billing portal linked from your BrandedAlign account. Cancellation stops future renewal charges and your paid access continues through the end of the current paid billing period.</div>
<h2>Recurring subscriptions</h2><p>Paid ${BRAND} plans are recurring monthly subscriptions unless a different billing period is clearly shown at checkout. Your plan renews automatically at the then-current subscription price until you cancel.</p>
<h2>How to cancel</h2><p>Sign in to your ${BRAND} account, open <strong>Manage billing</strong>, and use Stripe’s secure customer portal to cancel the subscription. You do not need to contact sales to stop renewal.</p>
<h2>Refunds</h2><p>Except where required by law or where ${OPERATOR} expressly agrees otherwise in writing, subscription fees already paid are non-refundable and unused time, scans, pages, or account capacity are not converted to cash or prorated refunds after cancellation.</p>
<h2>Plan changes and proration</h2><p>Plan upgrades or other subscription changes may take effect immediately. Stripe may calculate a prorated charge or credit for the remainder of the billing period. The amount shown by Stripe before you confirm the change controls that transaction.</p>
<h2>Billing errors</h2><p>If you believe you were charged incorrectly or charged more than once, contact ${SUPPORT_EMAIL} promptly so the transaction can be reviewed. Nothing in this policy limits rights that cannot legally be waived.</p>`),
'/privacy':()=>layout('Privacy Policy','Your information',`
<div class="notice">This policy explains the information ${BRAND} may collect and use when you visit the site, create an account, purchase a subscription, submit documents or URLs, or run a review.</div>
<h2>Information we collect</h2><p>Depending on how you use ${BRAND}, we may collect account information such as your email address; authentication and account status data; subscription and billing metadata; URLs, agreements, text, files, and other material you choose to submit; scan inputs and results; support communications; and technical data such as device, browser, IP address, timestamps, and security logs.</p>
<h2>Payments</h2><p>Payments and subscription billing are processed by Stripe. ${BRAND} does not store your full payment card number. Stripe may collect and process payment information under its own privacy terms.</p>
<h2>How we use information</h2><p>We use information to provide and secure the service, authenticate accounts, process subscription status, perform requested reviews, save results, troubleshoot problems, prevent abuse, communicate about the service, maintain records, and improve reliability and user experience.</p>
<h2>Service providers and disclosures</h2><p>We may disclose information to vendors and infrastructure providers that help operate ${BRAND}, including payment, authentication, database, hosting, security, and technical service providers. We may also disclose information when reasonably necessary to comply with law, protect rights and safety, investigate misuse, or complete a business transfer. We do not sell personal information for money.</p>
<h2>Submitted content</h2><p>Do not submit confidential or restricted information unless you have the right to provide it for review. You retain your rights in material you submit. You grant ${OPERATOR} a limited right to process that material only as reasonably necessary to provide, secure, support, and improve the service.</p>
<h2>Retention</h2><p>We retain information for as long as reasonably necessary to provide the service, maintain security and business records, meet legal or accounting obligations, resolve disputes, and enforce agreements. You may request deletion of eligible personal information, subject to legal, security, billing, and recordkeeping exceptions.</p>
<h2>Your choices and privacy rights</h2><p>Depending on where you live, you may have rights to request access, correction, deletion, or a portable copy of certain personal information, or to object to certain processing. Send privacy requests to ${SUPPORT_EMAIL}. We may need to verify your identity before completing a request.</p>
<h2>Security</h2><p>We use reasonable administrative and technical safeguards designed to protect information. No internet service or storage system can guarantee absolute security.</p>
<h2>Children</h2><p>${BRAND} is intended for adults and business users. We do not knowingly offer the service to children under 13.</p>
<h2>Changes</h2><p>We may update this Privacy Policy as the service changes. Material updates will be posted with a revised effective date.</p>`),
'/terms':()=>layout('Terms of Use','Agreement',`
<div class="notice">These Terms govern your access to and use of ${BRAND}, a service owned and operated by ${OPERATOR}. By creating an account, using the service, or purchasing a plan, you agree to these Terms and the linked policies.</div>
<h2>1. Eligibility and authority</h2><p>You must be at least 18 years old and legally able to enter a binding agreement. If you use ${BRAND} for a company or other organization, you represent that you are authorized to act for that organization.</p>
<h2>2. What the service does</h2><p>${BRAND} provides automated and organized educational review tools for brand, marketing, disclosure, accessibility, privacy, agreement compatibility, and related risk-spotting purposes. Features, limits, and availability may vary by plan.</p>
<h2>3. Accounts and security</h2><p>You are responsible for providing accurate account information, safeguarding credentials, and activity occurring through your account. Notify us if you believe an account has been compromised.</p>
<h2>4. Your content and permissions</h2><p>You are responsible for URLs, documents, agreements, text, files, and other material you submit. You represent that you have the right to submit and process that material. You retain your ownership rights. You grant ${OPERATOR} a limited license to host, copy, process, analyze, and display submitted material as reasonably necessary to provide and support the service.</p>
<h2>5. Acceptable use</h2><p>You may not use ${BRAND} to violate law or another party’s rights; access systems or non-public content without authorization; upload malware; evade usage limits; interfere with the service; scrape or reverse engineer the service except where law expressly permits; or use outputs to falsely claim legal approval, certification, or guaranteed compliance.</p>
<h2>6. Subscriptions and billing</h2><p>Paid plans renew automatically on the billing interval shown at checkout until canceled. Prices, plan limits, applicable taxes, and material billing terms are shown before purchase. Billing is processed through Stripe. Plan changes may include prorated charges or credits shown before confirmation.</p>
<h2>7. Cancellation and refunds</h2><p>You may cancel renewal through the secure billing portal linked from your account. Cancellation stops future renewal and access continues through the end of the paid billing period. Refunds are governed by the <a href="/refunds">Refund & Cancellation Policy</a>.</p>
<h2>8. Intellectual property</h2><p>${BRAND}, its software, interface, branding, reports, templates, and original content are owned by ${OPERATOR} or its licensors and are protected by applicable intellectual property laws. These Terms do not transfer ownership of the service to you.</p>
<h2>9. Third-party services</h2><p>The service relies on third parties such as payment, hosting, authentication, and database providers. Third-party services are governed by their own terms and may experience outages or changes outside our control.</p>
<h2>10. Educational service; no legal advice</h2><p>The <a href="/disclaimer">Educational Disclaimer</a> is part of these Terms. ${BRAND} is not a law firm and does not provide legal advice, legal opinions, or compliance certification. You remain responsible for business and publishing decisions.</p>
<h2>11. Service changes and availability</h2><p>We may modify features, limits, security controls, or service availability. We may suspend or restrict access when reasonably necessary for maintenance, security, suspected misuse, nonpayment, or legal compliance.</p>
<h2>12. Warranty disclaimer</h2><p>To the maximum extent permitted by law, ${BRAND} is provided on an “as is” and “as available” basis. ${OPERATOR} disclaims warranties that are not expressly stated, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that every risk will be identified or that outputs will be error-free, complete, or current.</p>
<h2>13. Limitation of liability</h2><p>To the maximum extent permitted by law, ${OPERATOR} will not be liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages arising from the service. To the maximum extent permitted by law, total liability arising from the service will not exceed the amount you paid for ${BRAND} during the six months immediately preceding the event giving rise to the claim.</p>
<h2>14. Indemnity</h2><p>To the extent permitted by law, you agree to defend and indemnify ${OPERATOR} from claims arising from your unlawful use of the service, your submitted material, or your violation of another party’s rights or these Terms.</p>
<h2>15. Governing law</h2><p>These Terms are governed by the laws of the State of Utah, without regard to conflict-of-law rules, except where applicable law requires otherwise.</p>
<h2>16. Changes to these Terms</h2><p>We may update these Terms as the service changes. Material changes will be posted with a revised effective date. Continued use after an update becomes effective means you accept the updated Terms to the extent permitted by law.</p>
<h2>17. Contact</h2><p>Questions about these Terms may be sent to ${SUPPORT_EMAIL}.</p>`)
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
