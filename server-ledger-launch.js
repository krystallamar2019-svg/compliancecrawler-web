const fs=require('fs');
const path=require('path');
require('./pwa-icon-bootstrap.js');

const upstreamRead=fs.readFileSync.bind(fs);

const pwaHead=`
<link rel="manifest" href="/manifest.webmanifest">
<meta name="application-name" content="BrandedAlign">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BrandedAlign">
<link rel="apple-touch-icon" sizes="180x180" href="/brandedalign-app-icon-180.png">
`;

const pwaScript=`<script id="baPwaScript">
(function(){
  function bootPwa(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(function(err){console.warn('BrandedAlign service worker registration skipped',err)});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootPwa);else bootPwa();
})();
</script>`;

const ledgerScript=`<script id="baAcceptanceLedgerScript">
(function(){
  const VERSION='2026-09-14-v1';
  const DOCS={terms:'2026-09-14-v1',privacy:'2026-09-14-v1',refunds:'2026-09-14-v1',automated_analysis_disclaimer:'2026-09-14-v1'};
  const STORED=[
    ['ba_legal_acceptance_'+VERSION,'account_creation'],
    ['ba_purchase_acceptance_'+VERSION,'subscription_purchase'],
    ['ba_action_ack_'+VERSION,'analysis_action']
  ];

  async function currentUser(){
    try{if(typeof sb==='undefined'||!sb?.auth)return null;const {data}=await sb.auth.getUser();return data?.user||null}catch{return null}
  }

  async function currentOrg(userId){
    try{
      const {data,error}=await sb.from('organization_members').select('org_id').eq('user_id',userId).limit(1);
      if(error)throw error;
      return data?.[0]?.org_id||null;
    }catch(e){console.warn('BrandedAlign acceptance organization lookup skipped',e);return null}
  }

  function readStored(key,fallbackKind){
    try{
      const raw=localStorage.getItem(key);if(!raw)return null;
      const value=JSON.parse(raw);if(!value?.accepted_at)return null;
      return {...value,kind:value.kind||fallbackKind,key};
    }catch{return null}
  }

  function syncMarker(value){return 'ba_ledger_synced_'+VERSION+'_'+String(value.kind||'event')+'_'+String(value.accepted_at||'')}

  async function writeReceipt(value){
    const marker=syncMarker(value);
    try{if(localStorage.getItem(marker))return true}catch{}
    const user=await currentUser();if(!user)return false;
    const orgId=await currentOrg(user.id);
    const row={
      user_id:user.id,
      organization_id:orgId,
      terms_version:VERSION,
      event_type:value.kind||'existing_acceptance',
      action_name:value.action||null,
      plan_key:value.plan||null,
      document_versions:DOCS,
      source:'web',
      client_recorded_at:value.accepted_at||new Date().toISOString(),
      metadata:{path:location.pathname}
    };
    try{
      const {error}=await sb.from('legal_acceptance_ledger').insert(row);
      if(error)throw error;
      try{localStorage.setItem(marker,new Date().toISOString())}catch{}
      return true;
    }catch(e){console.warn('BrandedAlign legal acceptance ledger write skipped',e);return false}
  }

  async function syncStored(){
    for(const [key,kind] of STORED){const value=readStored(key,kind);if(value)await writeReceipt(value)}
  }

  function scheduleSync(){setTimeout(syncStored,350)}

  function boot(){
    document.getElementById('authForm')?.addEventListener('submit',scheduleSync);
    document.getElementById('fitForm')?.addEventListener('submit',scheduleSync);
    document.getElementById('agreementForm')?.addEventListener('submit',scheduleSync);
    document.addEventListener('click',e=>{if(e.target?.closest?.('.ba-consent-confirm'))scheduleSync()});
    try{if(typeof sb!=='undefined'&&sb?.auth?.onAuthStateChange)sb.auth.onAuthStateChange((_event,session)=>{if(session?.user)setTimeout(syncStored,500)})}catch{}
    setTimeout(syncStored,1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>`;

fs.readFileSync=function(file,options){
  const out=upstreamRead(file,options);
  const base=path.basename(String(file));
  if(base!=='index-v2.html'&&base!=='client-v1.html')return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  let next=text;
  if(!next.includes('href="/manifest.webmanifest"'))next=next.replace('</head>',pwaHead+'\n</head>');
  if(!next.includes('id="baPwaScript"'))next=next.replace('</body>',pwaScript+'\n</body>');
  if(!next.includes('id="baAcceptanceLedgerScript"'))next=next.replace('</body>',ledgerScript+'\n</body>');
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};

require('./server-editorial-mobile-launch.js');
