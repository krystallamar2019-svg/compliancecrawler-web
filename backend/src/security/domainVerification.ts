import { createHash, timingSafeEqual } from 'node:crypto';

export function hashVerificationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verificationTokenMatches(rawToken: string, storedHex: string) {
  const actual = Buffer.from(hashVerificationToken(rawToken), 'hex');
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHex, 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function pageContainsVerificationMeta(html: string, token: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    return name === 'brandedalign-verification' && content === token;
  });
}
