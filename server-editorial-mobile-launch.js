const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);
const editorialCss=originalRead(path.join(__dirname,'mobile-editorial.css'),'utf8');
const mobileHeaderFix=`
@media(max-width:760px){
  body .site-header:before,
  body .site-header:after{
    display:none!important;
    content:none!important;
    background:none!important;
  }
}
`;
const socialPreviewMeta=`
<meta property="og:type" content="website">
<meta property="og:site_name" content="BrandedAlign">
<meta property="og:title" content="BrandedAlign | Protect Your Brand Before You Publish">
<meta property="og:description" content="Check one offer, website, or promotion for potential issues, or review how multiple offers work together under one brand.">
<meta property="og:url" content="https://brandedalign.com/">
<meta property="og:image" content="https://brandedalign.com/assets/brandedalign-hero-static.webp">
<meta property="og:image:alt" content="BrandedAlign dimensional compass artwork">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="BrandedAlign | Protect Your Brand Before You Publish">
<meta name="twitter:description" content="Check one offer, website, or promotion for potential issues, or review how multiple offers work together under one brand.">
<meta name="twitter:image" content="https://brandedalign.com/assets/brandedalign-hero-static.webp">
`;
const legalRuntimeTag='<script src="/legal-runtime.js" defer></script>';

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  const base=path.basename(String(file));
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const encoding=typeof options==='string'?options:options&&options.encoding;

  if(base==='styles-v2.css'){
    const next=text+'\n'+editorialCss+'\n'+mobileHeaderFix+'\n';
    return encoding?next:Buffer.from(next);
  }

  if(base==='index-v2.html'){
    let next=text.includes('property="og:title"')?text:text.replace('</head>',socialPreviewMeta+'\n</head>');
    if(!next.includes('/legal-runtime.js'))next=next.replace('</body>',legalRuntimeTag+'\n</body>');
    return encoding?next:Buffer.from(next);
  }

  if(base==='client-v1.html'){
    const next=text.includes('/legal-runtime.js')?text:text.replace('</body>',legalRuntimeTag+'\n</body>');
    return encoding?next:Buffer.from(next);
  }

  return out;
};
require('./server-client-controls-launch.js');
