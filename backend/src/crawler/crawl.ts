import { createHash } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import { assertSafeDestination, normalizeHttpUrl, revalidateDestination, sameSite, UnsafeUrlError } from '../security/urlSafety.js';

const MAX_TEXT_CHARS = 500_000;
const MAX_LINKS_PER_PAGE = 2_000;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const NAVIGATION_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 30_000;

export interface CrawledPage {
  url: string;
  title: string;
  httpStatus: number | null;
  contentHash: string;
  text: string;
  metaDescription: string;
  h1Count: number;
  imagesMissingAlt: number;
  formControlsMissingLabels: number;
  buttonsMissingName: number;
  linksMissingName: number;
  hasPrivacyLink: boolean;
  hasTermsLink: boolean;
  links: string[];
}

function sanitizeText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function installNetworkGuard(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();

    // Launch mode is intentionally document-only. This avoids executing remote
    // scripts, trackers, downloads, fonts/media and background requests.
    if (resourceType !== 'document') {
      await route.abort('blockedbyclient');
      return;
    }

    try {
      await assertSafeDestination(request.url());
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
}

async function crawlOne(page: Page, inputUrl: URL): Promise<CrawledPage> {
  const before = await assertSafeDestination(inputUrl);

  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error('PAGE_TOTAL_TIMEOUT')), PAGE_TIMEOUT_MS);
    timer.unref();
  });

  const navigation = (async () => {
    const response = await page.goto(before.url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    const finalUrl = normalizeHttpUrl(page.url());
    const finalSafety = await assertSafeDestination(finalUrl);
    if (finalUrl.hostname === before.url.hostname) {
      await revalidateDestination(finalUrl, before.addresses);
    }

    if (!response) throw new Error('NO_HTTP_RESPONSE');
    const headers = await response.allHeaders();
    const contentType = (headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('UNSUPPORTED_CONTENT_TYPE');
    }

    const contentLength = Number(headers['content-length'] ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_BYTES) {
      throw new Error('DOCUMENT_TOO_LARGE');
    }

    const extracted = await page.evaluate((maxLinks) => {
      const visibleText = document.body?.innerText ?? '';
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const linkNamesMissing = anchors.filter((anchor) => {
        const name = `${anchor.innerText ?? ''} ${anchor.getAttribute('aria-label') ?? ''} ${anchor.getAttribute('title') ?? ''}`.trim();
        return !name;
      }).length;

      const imagesMissingAlt = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
        .filter((img) => !img.hasAttribute('alt')).length;

      const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
      const controlsMissingLabels = controls.filter((control) => {
        if (control instanceof HTMLInputElement && control.type === 'hidden') return false;
        if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return false;
        if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false;
        if (control.closest('label')) return false;
        return true;
      }).length;

      const buttonsMissingName = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
        .filter((button) => !`${button.innerText ?? ''} ${button.getAttribute('aria-label') ?? ''} ${button.getAttribute('title') ?? ''}`.trim())
        .length;

      const hrefs = anchors.slice(0, maxLinks).map((anchor) => anchor.href).filter(Boolean);
      const navText = anchors.map((anchor) => `${anchor.innerText ?? ''} ${anchor.href}`.toLowerCase());

      return {
        text: visibleText,
        title: document.title ?? '',
        metaDescription: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '',
        h1Count: document.querySelectorAll('h1').length,
        imagesMissingAlt,
        controlsMissingLabels,
        buttonsMissingName,
        linksMissingName: linkNamesMissing,
        hasPrivacyLink: navText.some((value) => value.includes('privacy')),
        hasTermsLink: navText.some((value) => value.includes('terms') || value.includes('conditions')),
        hrefs,
      };
    }, MAX_LINKS_PER_PAGE);

    const text = sanitizeText(extracted.text);
    const canonical = finalSafety.url.toString();
    return {
      url: canonical,
      title: sanitizeText(extracted.title).slice(0, 500),
      httpStatus: response.status(),
      contentHash: createHash('sha256').update(text).digest('hex'),
      text,
      metaDescription: sanitizeText(extracted.metaDescription).slice(0, 1_000),
      h1Count: extracted.h1Count,
      imagesMissingAlt: extracted.imagesMissingAlt,
      formControlsMissingLabels: extracted.controlsMissingLabels,
      buttonsMissingName: extracted.buttonsMissingName,
      linksMissingName: extracted.linksMissingName,
      hasPrivacyLink: extracted.hasPrivacyLink,
      hasTermsLink: extracted.hasTermsLink,
      links: extracted.hrefs,
    };
  })();

  return Promise.race([navigation, timeout]);
}

export async function crawlPublicSite(startUrl: string, pageLimit: number): Promise<CrawledPage[]> {
  const root = (await assertSafeDestination(startUrl)).url;
  const cappedPageLimit = Math.min(Math.max(pageLimit, 1), 500);
  let browser: Browser | undefined;

  try {
    const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim();
    browser = await chromium.launch(executablePath
      ? { headless: true, executablePath }
      : { headless: true });
    const context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: 'block',
      javaScriptEnabled: false,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    await installNetworkGuard(page);

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
        const crawled = await crawlOne(page, normalized);
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

    await context.close();
    return results;
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
