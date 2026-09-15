const fs=require('fs');
const path=require('path');
const required=['brandedalign-app-icon-180.png','brandedalign-app-icon-192.png','brandedalign-app-icon-512.png'];
for(const file of required){
  if(!fs.existsSync(path.join(__dirname,file))){
    throw new Error(`Missing BrandedAlign icon asset: ${file}`);
  }
}
console.log('BrandedAlign approved icon assets verified');
