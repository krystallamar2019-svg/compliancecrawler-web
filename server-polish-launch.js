const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);

const deepDiveCss=`
.dive-section{margin:20px 0 0;padding-top:18px;border-top:1px solid rgba(18,43,57,.09)}
.dive-section:first-of-type{border-top:0;padding-top:4px}
.dive-section h3{font-family:var(--sans);font-size:11px;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:var(--teal);margin:0 0 7px}
.dive-section p{margin:0;color:#64767d;font-size:14px;line-height:1.65}
.dive-study{margin-top:22px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#f1faf8,#fff8e9);border:1px solid rgba(18,43,57,.09)}
.dive-study-title{font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#61767c;margin-bottom:10px}
.dive-study-links{display:grid;gap:9px}
.dive-study-link{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.82);border:1px solid rgba(18,43,57,.08);color:var(--teal);font-size:13px;font-weight:850;text-decoration:none;overflow-wrap:anywhere}
.dive-study-link:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(18,43,57,.07)}
.dive-study-link span:last-child{font-size:17px;color:var(--gold);flex:0 0 auto}
html,body{max-width:100%;overflow-x:hidden}
img,svg,canvas{max-width:100%}
section[id]{scroll-margin-top:104px}
.modal-card{max-width:calc(100vw - 32px)}
@media(max-width:1280px){
  .nav{gap:16px!important}
  .nav-links{gap:18px}
  .nav-actions{gap:7px}
  .session-pill{max-width:220px}
  #sessionEmail{display:inline-block;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
}
@media(max-width:1140px){
  .nav-links{display:none!important}
  .hero{min-height:auto!important;padding:54px 0 34px!important}
  .hero-grid{grid-template-columns:1fr!important;gap:22px!important}
  .hero-copy{max-width:820px;margin:0 auto;width:100%}
  .hero h1{font-size:clamp(58px,8vw,86px)!important;max-width:800px!important}
  .hero-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important;max-width:800px!important}
  .hero-art{min-height:540px!important}
  .orb-stage{width:min(72vw,520px)!important;height:min(86vw,650px)!important}
}
@media(max-width:980px){
  .hero-actions{grid-template-columns:1fr!important;max-width:720px!important}
  .hero-choice{min-height:108px!important;flex-direction:row!important;align-items:center!important;padding:18px 54px 18px 18px!important}
  .hero-choice-icon{margin-bottom:0!important;flex:0 0 auto}
  .hero-choice:after{right:20px!important;top:50%!important;transform:translateY(-50%)!important}
  .hero-art{min-height:500px!important}
  .orb-stage{width:min(78vw,480px)!important;height:min(96vw,600px)!important}
}
@media(max-width:720px){
  .container{width:min(100% - 28px,1260px)}
  .nav{height:74px!important;gap:10px!important}
  .brand{gap:9px}
  .brand-mark{width:38px;height:38px}
  .brand-copy strong{font-size:20px}
  .nav-actions{gap:6px}
  .nav-actions>.btn{padding:10px 13px;font-size:13px}
  .session-pill{padding-left:8px;max-width:none}
  #sessionEmail{display:none}
  .hero{padding-top:42px!important}
  .hero h1{font-size:clamp(46px,13vw,58px)!important;line-height:1.01}
  .hero p{font-size:16px!important;margin:20px 0 24px!important}
  .hero-choice{min-height:96px!important}
  .hero-art{min-height:420px!important}
  .orb-stage{width:min(90vw,420px)!important;height:min(110vw,540px)!important}
  .trust-band{padding-top:28px!important}
  .modal{padding:12px}
  .modal-card{width:calc(100vw - 24px);max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:24px 20px}
  .modal-card h2{font-size:32px}
  .dive-study{padding:14px}
}
@media(max-width:520px){
  .brand-copy span{display:none!important}
  .nav-actions>.btn:not(.hidden){padding:9px 11px;font-size:12px}
  .hero h1{font-size:44px!important}
  .hero-art{min-height:360px!important}
  .orb-stage{width:min(92vw,380px)!important;height:min(112vw,480px)!important}
  .member-account-grid{grid-template-columns:1fr!important}
}
`;

const deepDiveJs=`

// BrandedAlign Deep Dive presentation layer
const baStudyLinks={
  'affiliate-influencer-disclosures':[
    {label:'FTC — Endorsement Guides: What People Are Asking',url:'https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking'}
  ],
  'earnings-lifestyle-claims':[
    {label:'FTC — Business Guidance Concerning Multi-Level Marketing',url:'https://www.ftc.gov/business-guidance/resources/business-guidance-concerning-multi-level-marketing'}
  ],
  'health-wellness-claims':[
    {label:'FDA — Label Claims for Conventional Foods and Dietary Supplements',url:'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/label-claims-conventional-foods-and-dietary-supplements'}
  ],
  'copyright-fair-use':[
    {label:'U.S. Copyright Office — Copyright Basics (Circular 1)',url:'https://www.copyright.gov/circs/circ01.pdf'}
  ]
};
function baDeepDiveSections(body){
  const normalized=String(body||'').replace(/\\\\n/g,'\\n').replace(/\\r\\n/g,'\\n');
  return normalized.split(/\\n\\s*\\n/).filter(Boolean).map(block=>{
    const lines=block.split(/\\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return'';
    if(lines.length===1)return '<div class="dive-section"><p>'+esc(lines[0])+'</p></div>';
    const heading=lines.shift();
    return '<div class="dive-section"><h3>'+esc(heading)+'</h3><p>'+esc(lines.join(' '))+'</p></div>';
  }).join('');
}
function baStudyArea(d){
  const links=[];
  const primary=safeUrl(d.source_url);
  if(primary)links.push({label:'Primary source: '+(d.source_label||'Official guidance'),url:primary});
  (baStudyLinks[d.slug]||[]).forEach(item=>{const u=safeUrl(item.url);if(u&&u!==primary)links.push({label:item.label,url:u})});
  if(!links.length)return'';
  return '<div class="dive-study"><div class="dive-study-title">Further study · official sources</div><div class="dive-study-links">'+links.map(item=>'<a class="dive-study-link" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(item.label)+'</span><span>↗</span></a>').join('')+'</div></div>';
}
openDive=function(d){
  const sections=baDeepDiveSections(d.body);
  const reviewed=d.reviewed_at?' · Reviewed '+esc(fmtDate(d.reviewed_at)):'';
  const takeaway=esc(d.safe_takeaway||'Review the source and use qualified advice when the stakes are high.');
  const html='<span class="eyebrow">'+esc(d.category||'Deep Dive')+'</span>'+
    '<h2 id="diveTitle">'+esc(d.title||'Deep Dive')+'</h2>'+
    '<p><strong>'+esc(riskLabel(d.risk_level))+'</strong>'+reviewed+'</p>'+
    sections+
    '<div class="takeaway" style="margin-top:20px">Safer takeaway: '+takeaway+'</div>'+
    baStudyArea(d)+
    '<p style="font-size:12px;margin-top:16px">This Deep Dive is educational guidance, not legal advice or a guarantee of compliance.</p>';
  document.getElementById('diveContent').innerHTML=html;
  openModal('diveModal');
};

function baHandleEntryLink(){
  const p=new URLSearchParams(location.search);
  const action=String(p.get('action')||'').toLowerCase();
  const plan=String(p.get('plan')||'').toLowerCase();
  let handled=false;
  if(['steward','harvest','abundance'].includes(plan)){
    handled=true;
    setTimeout(()=>beginCheckout(plan),250);
  }else if(action==='login'){
    handled=true;
    setTimeout(()=>showAuth(null,'signin'),250);
  }else if(action==='signup'){
    handled=true;
    setTimeout(()=>showAuth(null,'signup'),250);
  }else if(action==='fit'){
    handled=true;
    setTimeout(()=>document.getElementById('fit')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
  }
  if(handled)history.replaceState({},'',location.pathname+(location.hash||''));
}
setTimeout(baHandleEntryLink,300);
`;

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  const base=path.basename(String(file));
  if(!['styles-v2.css','app-v2.js'].includes(base))return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const next=base==='styles-v2.css'?text+'\n'+deepDiveCss:text+'\n'+deepDiveJs;
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};

require('./server-account-launch.js');
