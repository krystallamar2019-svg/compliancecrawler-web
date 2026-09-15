const fs=require('fs');
const path=require('path');
const zlib=require('zlib');

function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function encodePng(w,h,rgba){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const ro=y*(w*4+1);raw[ro]=0;rgba.copy(raw,ro+1,y*w*4,(y+1)*w*4);}const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function drawIcon(size){
  const S=4,w=size*S,h=size*S,buf=Buffer.alloc(w*h*4);const bg=[10,27,48,255],cream=[248,244,232,255],gold=[222,187,105,255],teal=[75,148,166,255],border=[31,63,97,255];
  const set=(x,y,c)=>{if(x<0||x>=w||y<0||y>=h)return;const i=(y*w+x)*4;buf[i]=c[0];buf[i+1]=c[1];buf[i+2]=c[2];buf[i+3]=c[3];};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)set(x,y,bg);
  const u=v=>Math.round(v*w), insideRR=(x,y,m,r)=>{const L=m,R=w-m,T=m,B=h-m;if(x>=L+r&&x<=R-r&&y>=T&&y<=B)return true;if(y>=T+r&&y<=B-r&&x>=L&&x<=R)return true;const cx=x<L+r?L+r:R-r,cy=y<T+r?T+r:B-r;return (x-cx)**2+(y-cy)**2<=r*r;};
  // subtle rounded border
  const m=u(.028),r=u(.17);for(let y=m;y<h-m;y++)for(let x=m;x<w-m;x++){if(insideRR(x,y,m,r)&&!insideRR(x,y,m+S*1.3,r-S*1.3))set(x,y,border);}
  const fillRect=(x0,y0,x1,y1,c)=>{for(let y=Math.max(0,y0);y<Math.min(h,y1);y++)for(let x=Math.max(0,x0);x<Math.min(w,x1);x++)set(x,y,c);};
  const ellipse=(cx,cy,rx,ry,c,cut=false)=>{for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1){if(cut)set(x,y,bg);else set(x,y,c);}}};
  const line=(x0,y0,x1,y1,t,c)=>{const minx=Math.floor(Math.min(x0,x1)-t),maxx=Math.ceil(Math.max(x0,x1)+t),miny=Math.floor(Math.min(y0,y1)-t),maxy=Math.ceil(Math.max(y0,y1)+t),dx=x1-x0,dy=y1-y0,ll=dx*dx+dy*dy;for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){let q=((x-x0)*dx+(y-y0)*dy)/ll;q=Math.max(0,Math.min(1,q));const px=x0+q*dx,py=y0+q*dy;if((x-px)**2+(y-py)**2<=t*t)set(x,y,c);}};
  // Elegant serif B
  const bx=u(.23),top=u(.29),bot=u(.72),stem=u(.045);fillRect(bx,top,bx+stem,bot,cream);fillRect(bx-u(.02),top-u(.012),bx+u(.20),top+u(.012),cream);fillRect(bx-u(.02),bot-u(.012),bx+u(.21),bot+u(.012),cream);
  ellipse(u(.39),u(.405),u(.15),u(.115),cream);ellipse(u(.385),u(.405),u(.085),u(.064),bg,true);
  ellipse(u(.40),u(.60),u(.165),u(.125),cream);ellipse(u(.39),u(.60),u(.092),u(.072),bg,true);
  // Elegant A
  line(u(.50),u(.72),u(.63),u(.29),u(.021),cream);line(u(.63),u(.29),u(.78),u(.72),u(.021),cream);fillRect(u(.49),u(.708),u(.59),u(.735),cream);fillRect(u(.69),u(.708),u(.80),u(.735),cream);fillRect(u(.555),u(.515),u(.705),u(.535),cream);
  // Brand alignment accents
  fillRect(u(.50),u(.492),u(.68),u(.512),gold);fillRect(u(.615),u(.205),u(.625),u(.335),teal);fillRect(u(.615),u(.68),u(.625),u(.80),teal);
  // downsample 4x
  const out=Buffer.alloc(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let R=0,G=0,B=0,A=0;for(let yy=0;yy<S;yy++)for(let xx=0;xx<S;xx++){const i=((y*S+yy)*w+(x*S+xx))*4;R+=buf[i];G+=buf[i+1];B+=buf[i+2];A+=buf[i+3];}const n=S*S,j=(y*size+x)*4;out[j]=R/n;out[j+1]=G/n;out[j+2]=B/n;out[j+3]=A/n;}
  return encodePng(size,size,out);
}
for(const size of [180,192,512])fs.writeFileSync(path.join(__dirname,`brandedalign-app-icon-${size}.png`),drawIcon(size));
console.log('BrandedAlign premium BA icon generated');
