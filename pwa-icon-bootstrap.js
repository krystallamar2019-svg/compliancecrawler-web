const fs=require('fs');
const path=require('path');
const zlib=require('zlib');

function crc32(buf){
  let c=0xffffffff;
  for(const b of buf){
    c^=b;
    for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);
  }
  return (c^0xffffffff)>>>0;
}
function chunk(type,data){
  const t=Buffer.from(type);
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crc]);
}
function png(size){
  const w=size,h=size;
  const px=Buffer.alloc(w*h*4);
  const set=(x,y,r,g,b,a=255)=>{
    if(x<0||x>=w||y<0||y>=h)return;
    const i=(y*w+x)*4; px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=a;
  };
  const rect=(x0,y0,x1,y1,c)=>{
    for(let y=Math.max(0,y0);y<Math.min(h,y1);y++) for(let x=Math.max(0,x0);x<Math.min(w,x1);x++) set(x,y,...c);
  };
  const line=(x0,y0,x1,y1,t,c)=>{
    const dx=x1-x0,dy=y1-y0,steps=Math.max(Math.abs(dx),Math.abs(dy));
    for(let s=0;s<=steps;s++){
      const x=Math.round(x0+dx*s/steps),y=Math.round(y0+dy*s/steps),r=Math.max(1,Math.floor(t/2));
      rect(x-r,y-r,x+r+1,y+r+1,c);
    }
  };
  const bg=[24,32,44,255],white=[255,255,255,255];
  rect(0,0,w,h,bg);
  const u=v=>Math.round(v*size);

  // B monogram
  rect(u(.18),u(.23),u(.25),u(.75),white);
  rect(u(.25),u(.23),u(.42),u(.29),white);
  rect(u(.25),u(.47),u(.42),u(.53),white);
  rect(u(.25),u(.69),u(.42),u(.75),white);
  rect(u(.39),u(.28),u(.45),u(.48),white);
  rect(u(.39),u(.52),u(.45),u(.70),white);

  // A monogram
  line(u(.51),u(.74),u(.61),u(.24),u(.055),white);
  line(u(.61),u(.24),u(.72),u(.74),u(.055),white);
  rect(u(.55),u(.50),u(.68),u(.56),white);

  // Alignment marks: unmistakably BrandedAlign, not a compass/star
  rect(u(.76),u(.31),u(.88),u(.36),[255,122,89,255]);
  rect(u(.76),u(.46),u(.84),u(.51),[232,184,76,255]);
  rect(u(.76),u(.61),u(.91),u(.66),[36,166,184,255]);

  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){
    const ro=y*(w*4+1); raw[ro]=0;
    px.copy(raw,ro+1,y*w*4,(y+1)*w*4);
  }
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

for(const size of [180,192,512]){
  const name=`brandedalign-app-icon-${size}.png`;
  fs.writeFileSync(path.join(__dirname,name),png(size));
}
console.log('BrandedAlign BA monogram icon assets written');
