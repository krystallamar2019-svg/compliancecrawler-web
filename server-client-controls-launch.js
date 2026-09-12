const fs=require('fs');
const path=require('path');
const originalRead=fs.readFileSync.bind(fs);
const controls=originalRead(path.join(__dirname,'client-membership-controls.js'),'utf8');

fs.readFileSync=function(file,options){
  const out=originalRead(file,options);
  if(path.basename(String(file))!=='client-v1.js')return out;
  const text=Buffer.isBuffer(out)?out.toString('utf8'):String(out);
  const injected=text+'\n'+controls+'\n';
  const encoding=typeof options==='string'?options:options&&options.encoding;
  return encoding?injected:Buffer.from(injected);
};

require('./server-legal-launch.js');
