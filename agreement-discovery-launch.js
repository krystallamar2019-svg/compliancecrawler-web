const http=require('http');

const originalCreateServer=http.createServer.bind(http);
const SUPABASE_URL='https://pbprkgkvsxkpdhsmjzrc.supabase.co';
const SUPABASE_KEY='sb_publishable_UBCXWvPIRsU1SLpwZzGvig_dSIJYSjO';
const requestLog=new Map();

function json(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  });
  res.end(body);
}

function limited(req){
  const key=String(req.socket?.remoteAddress||'unknown');
  const now=Date.now();
  const current=(requestLog.get(key)||[]).filter(t=>now-t<60000);
  if(current.length>=12){requestLog.set(key,current);return true}
  current.push(now);requestLog.set(key,current);return false;
}

async function authenticated(req){
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return false;
  try{
    const r=await fetch(SUPABASE_URL+'/auth/v1/user',{
      headers:{Authorization:auth,apikey:SUPABASE_KEY},
      signal:AbortSignal.timeout(5000)
    });
    return r.ok;
  }catch{return false}
}

function decodeSearchHref(raw){
  try{
    const value=String(raw||'').replace(/&amp;/g,'&');
    const absolute=value.startsWith('//')?'https:'+value:value;
    const parsed=new URL(absolute,'https://duckduckgo.com');
    const redirected=parsed.searchParams.get('uddg');
    const target=redirected?decodeURIComponent(redirected):parsed.toString();
    const url=new URL(target);
    if(!['http:','https:'].includes(url.protocol))return null;
    return url.toString();
  }catch{return null}
}

function candidateScore(company,title,urlValue){
  let score=0;
  const hay=(title+' '+urlValue).toLowerCase();
  const compactCompany=company.toLowerCase().replace(/[^a-z0-9]/g,'');
  try{
    const host=new URL(urlValue).hostname.toLowerCase().replace(/^www\./,'');
    const compactHost=host.replace(/[^a-z0-9]/g,'');
    if(compactCompany.length>=4&&compactHost.includes(compactCompany))score+=90;
    const tokens=company.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=4);
    if(tokens.some(t=>host.includes(t)))score+=50;
    if(/reddit|facebook|instagram|youtube|scribd|pinterest|linkedin|coursehero/.test(host))score-=80;
  }catch{}
  if(/affiliate agreement|associate agreement|distributor agreement|independent.{0,20}agreement|policies.{0,8}procedures|policy manual|compliance|terms.{0,8}conditions/.test(hay))score+=50;
  if(/agreement|polic|procedure|compliance|terms/.test(hay))score+=20;
  if(/\.pdf(?:$|[?#])/.test(urlValue.toLowerCase()))score+=12;
  const years=hay.match(/20(?:2[4-9]|3[0-9])/g)||[];
  if(years.length)score+=Math.max(...years.map(Number))-2020;
  return score;
}

async function readable(urlValue){
  try{
    const r=await fetch('https://r.jina.ai/'+urlValue,{
      headers:{'User-Agent':'BrandedAlign/1.0 agreement discovery'},
      signal:AbortSignal.timeout(10000)
    });
    if(!r.ok)return null;
    const text=(await r.text()).trim();
    if(text.length<700)return null;
    const signals=(text.match(/agreement|polic(?:y|ies)|procedure|affiliate|distributor|associate|representative|compliance/gi)||[]).length;
    if(signals<4)return null;
    return text.slice(0,240000);
  }catch{return null}
}

function metadata(text,fallback){
  const title=text.match(/^Title:\s*(.+)$/mi)?.[1]?.trim()||fallback||'Current company agreement';
  const version=text.match(/(?:version|revision|rev\.?)\s*[:#-]?\s*([A-Za-z0-9._-]{1,30})/i)?.[1]||null;
  const date=text.match(/(?:effective|updated|revised|revision date|last updated)\s*(?:date)?\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},\s+20\d{2}|20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]20\d{2})/i)?.[1]||null;
  return {title:title.slice(0,300),version:version?version.slice(0,120):null,effectiveDateText:date};
}

async function discover(company,suppliedUrl){
  const candidates=[];
  if(suppliedUrl)candidates.push({title:'Provided official source',url:suppliedUrl,score:500});
  try{
    const q=company+' affiliate agreement policies procedures distributor agreement compliance terms';
    const r=await fetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{
      headers:{'User-Agent':'Mozilla/5.0 BrandedAlign agreement discovery'},
      signal:AbortSignal.timeout(8000)
    });
    if(r.ok){
      const html=await r.text();
      const re=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while((m=re.exec(html))&&candidates.length<16){
        const url=decodeSearchHref(m[1]);if(!url)continue;
        const title=String(m[2]||'').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
        candidates.push({title,url,score:candidateScore(company,title,url)});
      }
    }
  }catch{}
  const unique=[...new Map(candidates.map(c=>[c.url,c])).values()].sort((a,b)=>b.score-a.score).slice(0,6);
  const checked=await Promise.all(unique.map(async c=>({candidate:c,text:await readable(c.url)})));
  const usable=checked.filter(x=>x.text).map(x=>({
    ...x,
    quality:x.candidate.score+Math.min(60,(x.text.match(/agreement|polic(?:y|ies)|procedure|affiliate|distributor|associate|representative|compliance/gi)||[]).length)
  })).sort((a,b)=>b.quality-a.quality)[0];
  if(!usable)return null;
  return {sourceUrl:usable.candidate.url,documentText:usable.text,...metadata(usable.text,usable.candidate.title)};
}

http.createServer=function agreementDiscoveryCreateServer(listener){
  return originalCreateServer(async(req,res)=>{
    let url;
    try{url=new URL(req.url,'http://localhost')}catch{return listener(req,res)}
    if(url.pathname!=='/agreement-discovery')return listener(req,res);
    if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
    if(limited(req))return json(res,429,{error:'RATE_LIMITED'});
    if(!(await authenticated(req)))return json(res,401,{error:'AUTHORIZATION_REQUIRED'});
    const company=String(url.searchParams.get('company')||'').trim().slice(0,200);
    const supplied=String(url.searchParams.get('source')||'').trim().slice(0,2048)||null;
    if(!company)return json(res,400,{error:'COMPANY_REQUIRED'});
    try{
      const found=await discover(company,supplied);
      if(!found)return json(res,200,{found:false,company});
      return json(res,200,{found:true,company,...found,retrievedAt:new Date().toISOString()});
    }catch{return json(res,200,{found:false,company})}
  });
};

console.log('BrandedAlign agreement discovery intercept armed');
require('./server-ledger-launch.js');
