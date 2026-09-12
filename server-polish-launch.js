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
.dive-study-link{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.82);border:1px solid rgba(18,43,57,.08);color:var(--teal);font-size:13px;font-weight:850;text-decoration:none}
.dive-study-link:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(18,43,57,.07)}
.dive-study-link span:last-child{font-size:17px;color:var(--gold)}
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
  document.getElementById('diveContent').innerHTML=`<span class="eyebrow">${esc(d.category||'Deep Dive')}</span><h2 id="diveTitle">${esc(d.title||'Deep Dive')}</h2><p><strong>${esc(riskLabel(d.risk_level))}</strong>${d.reviewed_at?' · Reviewed '+esc(fmtDate(d.reviewed_at)):''}</p>${sections}<div class="takeaway" style="margin-top:20px">Safer takeaway: ${esc(d.safe_takeaway||'Review the source and use qualified advice when the stakes are high.')}</div>${baStudyArea(d)}<p style="font-size:12px;margin-top:16px">This Deep Dive is educational guidance, not legal advice or a guarantee of compliance.</p>`;
  openModal('diveModal');
};
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
