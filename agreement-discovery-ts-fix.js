const fs = require('fs');

const path = 'src/routes/agreementReviews.ts';
let source = fs.readFileSync(path, 'utf8');
source = source
  .replace("const url = decodeSearchHref(match[1]);", "const url = decodeSearchHref(match[1] || '');")
  .replace("const title = match[2].replace", "const title = (match[2] || '').replace");
fs.writeFileSync(path, source);
console.log('BrandedAlign agreement discovery TypeScript guards applied');
