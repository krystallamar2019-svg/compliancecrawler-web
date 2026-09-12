const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);
const mobileCss=originalRead(path.join(__dirname,'mobile-fix-v2.css'),'utf8');
fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  if(path.basename(String(file))!=='styles-v2.css')return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const next=text+'\n'+mobileCss+'\n';
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?next:Buffer.from(next);
};
require('./server-client-controls-launch.js');
