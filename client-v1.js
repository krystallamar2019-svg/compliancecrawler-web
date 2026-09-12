const API_URL='https://compliance-web-production-cf94.up.railway.app';
const SUPABASE_URL='https://pbprkgkvsxkpdhsmjzrc.supabase.co';
const SUPABASE_KEY='sb_publishable_UBCXWvPIRsU1SLpwZzGvig_dSIJYSjO';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const activityLabels={
  same_brand:'One personal brand',
  same_site:'Same website',
  same_social:'Same social accounts',
  same_email_list:'Same email audience',
  cross_sell_owned_audience:'Cross-sell independently owned audience',
  cross_sell_company_customers:'Cross-sell company-originated customers',
  build_multiple_teams:'Build teams in multiple companies',
  recruit_existing_downline:'Recruit existing downline elsewhere',
  recruit_same_prospect:'Present multiple opportunities to one prospect',
  compare_products:'Compare products'
};

let partyCount=0;
let activeMembership=false;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function title(v){return String(v||'').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function fmtDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
async function getSession(){const {data}=await sb.auth.getSession();return data?.session||null}

async function api(path,options={}){
  const session=await getSession();
  if(!session?.access_token)throw new Error('AUTH_REQUIRED');
  const headers={...(options.headers||{}),Authorization:'Bearer '+session.access_token};
  if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  const r=await fetch(API_URL+path,{...options,headers});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){const err=new Error(d.error||d.message||'REQUEST_FAILED');err.status=r.status;err.payload=d;throw err}
  return d;
}

function setAgreementStatus(message,error=false){const el=document.getElementById('agreementStatus');if(!el)return;el.textContent=message||'';el.classList.toggle('error',!!error)}

function partyTemplate(index){return `<div class="party-card" data-party-index="${index}"><div class="party-card-head"><strong>Company ${index}</strong><button type="button" class="party-remove">Remove</button></div><div class="party-grid"><input class="party-name" maxlength="200" placeholder="Company name" required><select class="party-type"><option value="affiliate">Affiliate</option><option value="direct_sales">Direct sales</option><option value="network_marketing">Network marketing</option><option value="referral">Referral</option><option value="sponsor">Sponsor</option><option value="other">Other</option></select><input class="party-title" maxlength="300" placeholder="Agreement / policy title"><input class="party-version" maxlength="120" placeholder="Version or revision date"><input class="party-date" type="date" aria-label="Effective date"><input class="party-url" type="url" maxlength="2048" placeholder="Official agreement URL"><textarea class="party-text wide" rows="5" placeholder="Paste the current agreement or the relevant Policies & Procedures text here for clause spotting."></textarea></div><p class="party-help">Official source links are saved for traceability. For this release, paste the agreement text you want analyzed. PDF upload and extraction comes next.</p></div>`}

function addParty(){
  partyCount++;
  const wrap=document.getElementById('agreementCompanies');
  const holder=document.createElement('div');holder.innerHTML=partyTemplate(partyCount);
  const card=holder.firstElementChild;
  card.querySelector('.party-remove')?.addEventListener('click',()=>{
    if(document.querySelectorAll('.party-card').length<=2){setAgreementStatus('Agreement Check needs at least two companies to compare.',true);return}
    card.remove();setAgreementStatus('');
  });
  wrap.appendChild(card);
}

function agreementPayload(){
  const parties=[...document.querySelectorAll('.party-card')].map(card=>({
    companyName:card.querySelector('.party-name').value.trim(),
    relationshipType:card.querySelector('.party-type').value,
    agreementTitle:card.querySelector('.party-title').value.trim()||undefined,
    agreementVersion:card.querySelector('.party-version').value.trim()||undefined,
    effectiveDate:card.querySelector('.party-date').value||undefined,
    sourceUrl:card.querySelector('.party-url').value.trim()||undefined,
    documentText:card.querySelector('.party-text').value.trim()||undefined
  }));
  return {
    brandName:document.getElementById('agreementBrandName').value.trim(),
    customerSource:document.getElementById('agreementCustomerSource').value,
    intendedActivities:[...document.querySelectorAll('input[name="agreementActivity"]:checked')].map(x=>x.value),
    notes:document.getElementById('agreementNotes').value.trim()||undefined,
    parties
  };
}

function riskRank(v){return {red:4,yellow:3,cannot_determine:2,green:1}[v]||0}
function riskLabel(v){return v==='red'?'Potential restriction':v==='yellow'?'Review needed':v==='green'?'No conflict found':'Cannot determine'}

function renderAgreementResults(data){
  const out=document.getElementById('agreementResults');
  const review=data.review||{};const parties=data.parties||[];const findings=data.findings||[];const activities=review.intended_activities||[];
  const byKey={};findings.forEach(f=>{byKey[f.activity_key+'|'+f.party_id]=f});
  const worst=findings.reduce((a,f)=>riskRank(f.risk_level)>riskRank(a)?f.risk_level:a,'green');
  let html=`<div class="agreement-result-head"><div><span class="eyebrow">Agreement compatibility review</span><h3>${esc(review.brand_name||'Your brand')}</h3><p>${parties.length} companies · ${activities.length} intended activities · ${review.status==='needs_documents'?'More agreement text needed':'Clause spotting complete'}</p></div><span class="risk-chip ${worst==='cannot_determine'?'unknown':worst}">${riskLabel(worst)}</span></div>`;
  html+=`<div class="agreement-matrix-wrap"><table class="agreement-matrix"><thead><tr><th>Activity</th>${parties.map(p=>`<th>${esc(p.company_name)}</th>`).join('')}</tr></thead><tbody>${activities.map(activity=>`<tr><td class="matrix-activity">${esc(activityLabels[activity]||activity)}</td>${parties.map(p=>{const f=byKey[activity+'|'+p.id];if(!f)return'<td class="matrix-cell"><span class="risk-chip unknown">Cannot determine</span></td>';const cls=f.risk_level==='cannot_determine'?'unknown':f.risk_level;return `<td class="matrix-cell"><span class="risk-chip ${cls}">${esc(riskLabel(f.risk_level))}</span><small>${esc(f.explanation||'')}</small>${f.evidence_excerpt?`<details><summary>Clause spotted</summary><small>${esc(f.evidence_excerpt)}</small></details>`:''}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  const safer=[...new Set(findings.map(f=>f.safer_structure).filter(Boolean))];
  if(safer.length)html+=`<div class="agreement-safer"><h4>Safer brand structure</h4><ul>${safer.slice(0,8).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  html+='<p class="agreement-history">Saved to your BrandedAlign organization. A green result means no conflict was found in the detected language reviewed. It is not legal certification.</p>';
  out.innerHTML=html;out.classList.remove('hidden');out.scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadSavedReviews(){
  const grid=document.getElementById('savedReviewsGrid');
  try{
    const d=await api('/api/agreement-reviews');
    const reviews=d.reviews||[];
    if(!reviews.length){grid.innerHTML='<div class="saved-empty">No saved Agreement Reviews yet. Your first completed review will appear here.</div>';return}
    grid.innerHTML=reviews.map(r=>`<button class="saved-review-card" type="button" data-review-id="${esc(r.id)}"><span class="eyebrow">${esc(r.status==='needs_documents'?'Needs documents':'Saved review')}</span><h3>${esc(r.brand_name)}</h3><p>${Array.isArray(r.intended_activities)?r.intended_activities.length:0} activity checks · ${esc(title(r.customer_source))}</p><div class="saved-review-meta"><span>${esc(fmtDate(r.created_at))}</span><span>Open →</span></div></button>`).join('');
    grid.querySelectorAll('[data-review-id]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true;
      try{const detail=await api('/api/agreement-reviews/'+encodeURIComponent(btn.dataset.reviewId));renderAgreementResults(detail)}catch(err){setAgreementStatus(err.message||'Unable to open saved review.',true)}finally{btn.disabled=false}
    }));
  }catch(err){grid.innerHTML='<div class="saved-empty">Saved reviews are temporarily unavailable.</div>';console.error(err)}
}

async function loadMembership(){
  const me=await api('/api/me');
  const plan=String(me.plan||'free').toLowerCase();
  const status=String(me.subscriptionStatus||'inactive').toLowerCase();
  activeMembership=['active','trialing'].includes(status);
  document.getElementById('clientPlan').textContent=title(plan);
  document.getElementById('clientStatus').textContent=title(status);
  document.getElementById('clientRenewal').textContent=me.currentPeriodEnd?fmtDate(me.currentPeriodEnd):'—';
  document.getElementById('clientScans').textContent=me.limits?.scans??'—';
  document.getElementById('clientPlanPill').textContent=title(plan)+' · '+title(status);
  const note=document.getElementById('clientMembershipNote');
  const agreement=document.getElementById('agreementForm');
  if(activeMembership){note.textContent='Your verified membership is active. Agreement Check is available.';agreement.classList.remove('client-locked')}
  else{note.innerHTML='Agreement Check requires an active membership. <a href="/#plans">View membership plans →</a>';agreement.classList.add('client-locked')}
}

async function openBilling(){
  const btn=document.getElementById('clientBillingBtn');btn.disabled=true;
  try{const d=await api('/api/billing-portal',{method:'POST',body:'{}'});if(!d.url)throw new Error('Billing portal did not return a URL.');location.assign(d.url)}catch(err){alert(err.message||'Unable to open billing portal.');btn.disabled=false}
}

async function init(){
  const session=await getSession();
  if(!session?.access_token){sessionStorage.setItem('ba_after_login','/client');location.replace('/?action=login');return}
  document.getElementById('clientEmail').textContent=session.user?.email||'Signed in';
  document.getElementById('clientSignOutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.assign('/')});
  document.getElementById('clientBillingBtn').addEventListener('click',openBilling);
  document.getElementById('addAgreementCompany').addEventListener('click',addParty);
  document.getElementById('agreementForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!activeMembership){setAgreementStatus('An active membership is required to run Agreement Check.',true);return}
    const payload=agreementPayload();
    if(payload.parties.length<2||payload.parties.some(p=>!p.companyName)){setAgreementStatus('Add at least two company names.',true);return}
    if(!payload.intendedActivities.length){setAgreementStatus('Choose at least one activity you want to compare.',true);return}
    const btn=document.getElementById('agreementSubmit');btn.disabled=true;btn.textContent='Comparing agreements…';setAgreementStatus('Saving the ecosystem and checking the agreement language…');
    try{
      const d=await api('/api/agreement-reviews',{method:'POST',body:JSON.stringify(payload)});
      setAgreementStatus(d.review?.status==='needs_documents'?'Saved. Some companies still need agreement text before BrandedAlign can evaluate every activity.':'Compatibility review complete.');
      renderAgreementResults(d);await loadSavedReviews();
    }catch(err){setAgreementStatus(err.message||'Agreement Check could not be completed.',true)}
    finally{btn.disabled=false;btn.textContent='Run Agreement Compatibility Review →'}
  });
  addParty();addParty();
  try{await loadMembership()}catch(err){console.error(err);document.getElementById('clientMembershipNote').textContent='Membership details are temporarily unavailable.'}
  await loadSavedReviews();
}

sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session)location.assign('/')});
init();
