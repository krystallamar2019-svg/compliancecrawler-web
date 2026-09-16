const fs = require('fs');

const path = 'src/routes/agreementReviews.ts';
let source = fs.readFileSync(path, 'utf8');
const before = source;
source = source
  .replace(/decodeSearchHref\(match\[1\]\)/g, "decodeSearchHref(match[1] ?? '')")
  .replace(/match\[2\]\.replace/g, "(match[2] ?? '').replace");

if (source === before) {
  throw new Error('Agreement discovery TypeScript guard patterns were not found');
}

fs.writeFileSync(path, source);
console.log('BrandedAlign agreement discovery TypeScript guards applied');
