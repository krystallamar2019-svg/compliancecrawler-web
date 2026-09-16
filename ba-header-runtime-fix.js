const fs=require('fs');
const path=require('path');

const originalRead=fs.readFileSync.bind(fs);

const baMark=`<span class="brand-mark ba-brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ba-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173A4D"/><stop offset="1" stop-color="#071B2A"/></linearGradient><linearGradient id="ba-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2CF"/><stop offset="1" stop-color="#E8B84C"/></linearGradient></defs><rect x="1.5" y="1.5" width="61" height="61" rx="12" fill="url(#ba-bg)" stroke="#E8B84C" stroke-width="1.5"/><text x="7" y="44" font-family="Georgia,Times New Roman,serif" font-size="38" letter-spacing="-3" fill="url(#ba-gold)">BA</text><line x1="32" y1="8" x2="32" y2="56" stroke="#24A6B8" stroke-width="1.2"/><circle cx="32" cy="8" r="1.8" fill="#8DE2E8"/><line x1="19" y1="34" x2="50" y2="34" stroke="#E8B84C" stroke-width="1"/><path d="M34 30l1.4 3.1 3.2 1.4-3.2 1.4L34 39l-1.4-3.1-3.2-1.4 3.2-1.4z" fill="#FFD77A"/></svg></span>`;

const hardCss=`<style id="ba-header-runtime-fix">
.brand .brand-mark.ba-brand-mark{width:54px!important;height:54px!important;min-width:54px!important;border-radius:12px!important;overflow:hidden!important;background:none!important;box-shadow:0 8px 22px rgba(16,42,58,.18)!important;display:inline-block!important}
.brand .brand-mark.ba-brand-mark svg{display:block!important;width:100%!important;height:100%!important}
@media(max-width:640px){.brand .brand-mark.ba-brand-mark{width:48px!important;height:48px!important;min-width:48px!important}}
</style>`;

function patchHtml(text){
  let next=text;
  next=next.replace(/<span class="brand-mark"[^>]*>[\s\S]*?<\/svg><\/span>/g,baMark);
  next=next.replace(/<span class="brand-mark ba-brand-mark"[^>]*>[\s\S]*?<\/svg><\/span>/g,baMark);
  if(!next.includes('id="ba-header-runtime-fix"')) next=next.replace('</head>',hardCss+'\n</head>');
  return next;
}

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  const base=path.basename(String(file));
  if(base!=='index-v2.html' && base!=='index.html') return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const next=patchHtml(text);
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};

console.log('BA_HEADER_RUNTIME_FIX_ARMED');
require('./pwa-http-intercept-launch.js');
