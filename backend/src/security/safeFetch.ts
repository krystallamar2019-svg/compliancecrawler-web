import { assertSafeDestination, normalizeHttpUrl, revalidateDestination } from './urlSafety.js';

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 128 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

async function readLimitedText(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('VERIFICATION_BODY_TOO_LARGE');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

export async function safeFetchText(input: string) {
  let current = normalizeHttpUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safety = await assertSafeDestination(current);
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'BrandedAlignVerification/1.0',
        Accept: 'text/plain,text/html,application/xhtml+xml;q=0.9',
      },
    });

    await revalidateDestination(current, safety.addresses);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error('REDIRECT_LOCATION_MISSING');
      if (redirectCount === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS');
      current = normalizeHttpUrl(new URL(location, current).toString());
      continue;
    }

    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('VERIFICATION_BODY_TOO_LARGE');
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('UNSUPPORTED_VERIFICATION_CONTENT_TYPE');
    }

    return {
      status: response.status,
      url: current,
      contentType,
      body: await readLimitedText(response),
    };
  }

  throw new Error('TOO_MANY_REDIRECTS');
}
