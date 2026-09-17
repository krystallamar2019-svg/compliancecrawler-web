import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { CrawledPage } from './crawl.js';
import { assertSafeDestination, normalizeHttpUrl, revalidateDestination, sameSite } from '../security/urlSafety.js';

const MAX_TEXT_CHARS = 500_000;
const MAX_LINKS_PER_PAGE = 2_000;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function readLimitedHtml(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let html = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOCUMENT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error('DOCUMENT_TOO_LARGE');
    }
    html += decoder.decode(value, { stream: true });
  }
  html += decoder.decode();
  return html;
}

async function fetchSafeHtml(input: URL) {
  let current = normalizeHttpUrl(input.toString());

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safety = await assertSafeDestination(current);
    let response: Response;
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'BrandedAlignCrawler/1.0',
          Accept: 'text/html,application/xhtml+xml;q=0.9',
        },
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError' || name === 'TimeoutError') throw new Error('PAGE_TOTAL_TIMEOUT');
      throw error;
    }

    await revalidateDestination(current, safety.addresses);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error('REDIRECT_LOCATION_MISSING');
      if (redirectCount === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS');
      current = normalizeHttpUrl(new URL(location, current).toString());
      continue;
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('UNSUPPORTED_CONTENT_TYPE');
    }

    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('DOCUMENT_TOO_LARGE');
    }

    return {
      status: response.status,
      url: current,
      html: await readLimitedHtml(response),
    };
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

function parsePage(html: string, pageUrl: URL, httpStatus: number): CrawledPage {
  const $ = cheerio.load(html);
  const links: string[] = [];
  let linksMissingName = 0;
  let hasPrivacyLink = false;
  let hasTermsLink = false;

  $('a[href]').slice(0, MAX_LINKS_PER_PAGE).each((_index, element) => {
    const anchor = $(element);
    const href = anchor.attr('href') ?? '';
    const name = `${anchor.text()} ${anchor.attr('aria-label') ?? ''} ${anchor.attr('title') ?? ''}`.trim();
    if (!name) linksMissingName += 1;

    const navText = `${anchor.text()} ${href}`.toLowerCase();
    if (navText.includes('privacy')) hasPrivacyLink = true;
    if (navText.includes('terms') || navText.includes('conditions')) hasTermsLink = true;

    try {
      links.push(new URL(href, pageUrl).toString());
    } catch {
      // Ignore malformed links.
    }
  });

  let imagesMissingAlt = 0;
  $('img').each((_index, element) => {
    if ($(element).attr('alt') === undefined) imagesMissingAlt += 1;
  });

  const labelsFor = new Set<string>();
  $('label[for]').each((_index, element) => {
    const target = $(element).attr('for');
    if (target) labelsFor.add(target);
  });

  let controlsMissingLabels = 0;
  $('input,select,textarea').each((_index, element) => {
    const control = $(element);
    if (control.is('input') && (control.attr('type') ?? '').toLowerCase() === 'hidden') return;
    if (control.attr('aria-label') || control.attr('aria-labelledby')) return;
    const id = control.attr('id');
    if (id && labelsFor.has(id)) return;
    if (control.closest('label').length > 0) return;
    controlsMissingLabels += 1;
  });

  let buttonsMissingName = 0;
  $('button').each((_index, element) => {
    const button = $(element);
    const name = `${button.text()} ${button.attr('aria-label') ?? ''} ${button.attr('title') ?? ''}`.trim();
    if (!name) buttonsMissingName += 1;
  });

  const title = sanitizeText($('title').first().text()).slice(0, 500);
  const metaDescription = sanitizeText($('meta[name="description"]').first().attr('content') ?? '').slice(0, 1_000);
  const h1Count = $('h1').length;

  $('script,style,noscript,template').remove();
  const text = sanitizeText($('body').text());

  return {
    url: pageUrl.toString(),
    title,
    httpStatus,
    contentHash: createHash('sha256').update(text).digest('hex'),
    text,
    metaDescription,
    h1Count,
    imagesMissingAlt,
    formControlsMissingLabels: controlsMissingLabels,
    buttonsMissingName,
    linksMissingName,
    hasPrivacyLink,
    hasTermsLink,
    links,
  };
}

export async function crawlPublicSiteStatic(startUrl: string, pageLimit: number): Promise<CrawledPage[]> {
  const root = (await assertSafeDestination(startUrl)).url;
  const cappedPageLimit = Math.min(Math.max(pageLimit, 1), 500);
  const pending: URL[] = [root];
  const seen = new Set<string>();
  const results: CrawledPage[] = [];
  let crawlRoot = root;

  while (pending.length > 0 && results.length < cappedPageLimit) {
    const next = pending.shift()!;
    const normalized = normalizeHttpUrl(next.toString());
    const key = normalized.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const fetched = await fetchSafeHtml(normalized);
      const crawled = parsePage(fetched.html, fetched.url, fetched.status);
      results.push(crawled);
      if (results.length === 1) crawlRoot = normalizeHttpUrl(crawled.url);

      for (const rawLink of crawled.links) {
        if (pending.length + seen.size > cappedPageLimit * 20) break;
        try {
          const candidate = normalizeHttpUrl(rawLink);
          if (!sameSite(candidate, crawlRoot)) continue;
          if (!seen.has(candidate.toString())) pending.push(candidate);
        } catch {
          // Ignore malformed, unsupported or non-http(s) links.
        }
      }
    } catch (error) {
      if (results.length === 0) throw error;
    }
  }

  return results;
}
