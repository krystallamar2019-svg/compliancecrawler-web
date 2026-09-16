const fs = require('fs');

const path = 'src/routes/agreementReviews.ts';
const lines = fs.readFileSync(path, 'utf8').split('\n');

if (!lines[287] || !lines[287].includes('match[1]')) {
  throw new Error(`Expected agreement discovery guard target on line 288, got: ${lines[287] || '<missing>'}`);
}
if (!lines[289] || !lines[289].includes('match[2]')) {
  throw new Error(`Expected agreement discovery guard target on line 290, got: ${lines[289] || '<missing>'}`);
}

lines[287] = lines[287].replace('match[1]', "match[1] ?? ''");
lines[289] = lines[289].replace('match[2]', "match[2] ?? ''");

fs.writeFileSync(path, lines.join('\n'));
console.log('BrandedAlign agreement discovery TypeScript guards applied to lines 288 and 290');
