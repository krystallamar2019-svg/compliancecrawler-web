/* BrandedAlign setup previews are deterministic and do not consume AI credits. */
(function(root,factory){
  const integration=factory();
  if(typeof module==='object'&&module.exports)module.exports=integration;
  else{root.BAMomentum=integration;integration.mount();}
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const formUrl='https://link.captivationhub.com/widget/form/7uRggA8HGWJQwXMvDDZr';
  const options={
    hub:{title:'One brand hub',description:'One main website with clearly labeled offer sections. Use only where current agreements allow combined promotion.',hosting:'One website project and domain. Keep each offer’s forms, consent and follow-up separate.'},
    pages:{title:'Separate offer pages',description:'A personal brand hub with dedicated pages or subdomains for each offer. Review whether links between offers are permitted.',hosting:'One hosting account can manage distinct pages or projects. Map each domain or subdomain to the correct offer.'},
    sites:{title:'Separate brand sites',description:'Distinct sites and domains for offers that need stronger separation. Separate websites do not remove audience or recruiting restrictions.',hosting:'A single hosting account can manage separate website projects if contracts and access rules allow it. Each project gets its own domain, forms and analytics.'}
  };
  function plan(data={},choice){
    const findings=Array.isArray(data.findings)?data.findings:[];
    const parties=Array.isArray(data.parties)?data.parties:[];
    const review=data.review||{};
    const restricted=f=>['red','yellow'].includes(f.risk_level);
    const siteRisk=findings.some(f=>restricted(f)&&['same_brand','same_site'].includes(f.activity_key));
    const unknown=!findings.length||review.status==='needs_documents'||findings.some(f=>!['red','yellow','green'].includes(f.risk_level));
    const audienceRisk=findings.some(f=>restricted(f)&&['same_email_list','cross_sell_company_customers','recruit_existing_downline','recruit_same_prospect'].includes(f.activity_key));
    const suggested=siteRisk?'sites':parties.length>1?'pages':'hub';
    const selected=Object.hasOwn(options,choice||'')?choice:suggested;
    const names=parties.map(p=>String(p.company_name||'Unnamed offer'));
    const steps=[
      {title:'Confirm the limits before building',detail:unknown?'Some sources or activity checks are unresolved. Obtain current agreements and written clarification for those rows. Keep affected promotion and automation on hold.':'Review every flagged activity and get written clarification where needed. A green row is a finding from reviewed language, not permission or legal approval.',deliverable:'A list of allowed, restricted and unresolved activities for each company.'},
      {title:'Map each offer to its destination',detail:'Create one row per offer: company, public brand name, domain or page, contact form, audience source, and permitted next offer. '+(siteRisk?'Separate-site preview is selected because combined-brand or same-site activity was flagged.':'Choose a structure only after checking the agreement rows.'),deliverable:'A domain and page map with one destination for each offer.'},
      {title:'Set up hosting and ownership',detail:options[selected].hosting+' Keep ownership with your business. Grant collaborators only the project access they need. Track domain renewals, hosting fees and who manages each site.',deliverable:'A hosting inventory with project, domain, owner, renewal date and monthly cost.'},
      {title:'Separate contacts by source and permission',detail:(audienceRisk?'Audience sharing or recruiting was flagged. Keep company-originated contacts out of other companies’ campaigns. ':'Record where every contact came from before using it in a campaign. ')+'Use one CRM only if agreements permit it; otherwise use separate workspaces. Apply an offer/source tag and capture the consent given for that offer.',deliverable:'An audience-routing map, source tags and separate consent records.'},
      {title:'Connect forms, follow-up and booking',detail:'Route each offer form to its own source tag, pipeline and permitted follow-up. Connect booking only for the service requested. Add an unsubscribe path. Do not enroll one offer’s contacts in another offer’s campaign by default.',deliverable:'One documented lead path per offer from submission to follow-up.'},
      {title:'Test before launch',detail:'Submit a test lead for each offer. Verify its destination, tags, owner, follow-up and unsubscribe handling. Check that it never enters another offer’s campaign. Keep unresolved or restricted activities disabled.',deliverable:'A test checklist showing correct routing and no unintended cross-promotion.'},
      {title:'Choose who implements the plan',detail:'Use this checklist yourself or request a scoped setup from MomentumAutomated. Review deliverables, recurring costs and any verified BrandedAlign benefit before purchasing.',deliverable:'An approved scope and cost breakdown, with a launch checklist.'}
    ];
    return {selected,suggested,unknown,options,names,steps,brand:String(review.brand_name||'My business'),reviewId:typeof review.id==='string'?review.id:null};
  }
  function brief(p){
    return ['BrandedAlign setup request','Brand: '+p.brand,p.reviewId?'Review ID: '+p.reviewId:'Review ID: not supplied','Offers: '+(p.names.join(', ')||'To be supplied'),'Structure preview: '+options[p.selected].title,'Review status: '+(p.unknown?'Unresolved sources or checks; affected activities stay on hold':'Review flagged activities before launch'),'Requested scope: domain/page map, hosting projects, CRM source tags and consent, form routing, follow-up, booking and launch tests.','Please verify my BrandedAlign membership and any eligible setup benefit before quoting.'].join('\n');
  }
  function handoff(p,consent){
    if(consent!==true)throw new Error('Consent is required before sharing a setup brief.');
    const u=new URL(formUrl);u.searchParams.set('ba_setup_requirements',brief(p));return u.toString();
  }
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mount(){
    if(typeof document==='undefined')return;
    const target=document.querySelector('.client-main');if(!target)return;
    const section=document.createElement('section');section.id='implementation';section.className='ba-implementation container';
    target.appendChild(section);
    let data={},choice;
    function draw(){
      const p=plan(data,choice);
      section.innerHTML='<div class="agreement-shell"><span class="eyebrow">From review to setup</span><h2>Put your business structure into action.</h2><p>Preview a structure, use the setup checklist, or ask MomentumAutomated to implement it. These previews use your existing review and do not run another AI analysis.</p>'+
        (p.unknown?'<p class="ba-setup-notice">This is a planning preview. Current agreement sources or activity checks still need confirmation before affected work goes live.</p>':'')+
        '<div class="ba-structure-options" role="group" aria-label="Structure previews">'+Object.entries(options).map(([key,o])=>'<button type="button" class="ba-structure-card" data-structure="'+key+'" aria-pressed="'+(key===p.selected)+'"><strong>'+esc(o.title)+'</strong><span>'+esc(o.description)+'</span><small>'+(key===p.suggested?'Starting preview based on available review':'Explore this option')+'</small></button>').join('')+'</div>'+
        '<h3>Your setup checklist</h3><ol class="ba-setup-steps">'+p.steps.map(s=>'<li><h4>'+esc(s.title)+'</h4><p>'+esc(s.detail)+'</p><small><strong>Deliverable:</strong> '+esc(s.deliverable)+'</small></li>').join('')+'</ol>'+
        '<div class="ba-handoff"><span class="eyebrow">Optional implementation help</span><h3>Have MomentumAutomated handle the setup.</h3><p>Request a scope for your domains, hosting, CRM, follow-up and client workflow. Your BrandedAlign plan and payment will be checked before any startup freebie or setup credit is offered. Setup pricing and ongoing services are quoted separately.</p><p class="ba-relationship">BrandedAlign and MomentumAutomated are both operated by TeamUpWithKrystal. Implementation is optional and does not change your review findings.</p><label class="ba-share-consent"><input type="checkbox" id="baSetupConsent"><span>Share the setup brief below with MomentumAutomated through CapHub. It includes my brand, company names, review ID and selected structure. It excludes agreements, account credentials and billing details.</span></label><details><summary>Preview the setup brief</summary><pre>'+esc(brief(p))+'</pre></details><div class="ba-setup-actions"><button type="button" class="btn btn-primary" id="baSetupRequest" disabled>Continue to Setup Request</button><button type="button" class="btn btn-ghost" id="baCopyBrief">Copy Setup Brief</button></div><p id="baSetupStatus" role="status" aria-live="polite"></p></div></div>';
      section.querySelectorAll('[data-structure]').forEach(b=>b.addEventListener('click',()=>{choice=b.dataset.structure;draw();}));
      const check=section.querySelector('#baSetupConsent'),request=section.querySelector('#baSetupRequest');
      check.addEventListener('change',()=>{request.disabled=!check.checked;});
      request.addEventListener('click',()=>{if(check.checked)location.assign(handoff(p,true));});
      section.querySelector('#baCopyBrief').addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(brief(p));section.querySelector('#baSetupStatus').textContent='Setup brief copied. Paste it into your setup request.';}
        catch{section.querySelector('#baSetupStatus').textContent='Open “Preview the setup brief” to select and copy it manually.';}
      });
    }
    if(typeof renderAgreementResults==='function'){
      const original=renderAgreementResults;
      renderAgreementResults=function(result){original(result);data=result||{};choice=undefined;draw();};
    }
    const nav=document.querySelector('.client-links');
    if(nav){const link=document.createElement('a');link.href='#implementation';link.textContent='Setup Plan';nav.appendChild(link);}
    draw();
  }
  return {plan,brief,handoff,mount};
});
