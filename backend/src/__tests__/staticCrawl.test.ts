import assert from 'node:assert/strict';
import test from 'node:test';
import { crawlPublicSiteStatic } from '../crawler/staticCrawl.js';

test('static crawler extracts the one-page signals used by BrandedAlign findings', async () => {
  const originalFetch = globalThis.fetch;
  const html = `<!doctype html>
    <html>
      <head>
        <title>Example Offer</title>
        <meta name="description" content="A clear example offer">
      </head>
      <body>
        <h1>Example Offer</h1>
        <img src="hero.jpg">
        <img src="logo.jpg" alt="Example logo">
        <label for="email">Email</label><input id="email" type="email">
        <input id="phone" type="tel">
        <button aria-label="Open menu"></button>
        <button></button>
        <a href="/privacy">Privacy policy</a>
        <a href="/empty"></a>
        <p>Earn $500 per month with this example.</p>
      </body>
    </html>`;

  globalThis.fetch = (async () => new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(Buffer.byteLength(html)),
    },
  })) as typeof fetch;

  try {
    const pages = await crawlPublicSiteStatic('http://8.8.8.8/', 1);
    assert.equal(pages.length, 1);
    const page = pages[0]!;
    assert.equal(page.title, 'Example Offer');
    assert.equal(page.metaDescription, 'A clear example offer');
    assert.equal(page.h1Count, 1);
    assert.equal(page.imagesMissingAlt, 1);
    assert.equal(page.formControlsMissingLabels, 1);
    assert.equal(page.buttonsMissingName, 1);
    assert.equal(page.linksMissingName, 1);
    assert.equal(page.hasPrivacyLink, true);
    assert.equal(page.hasTermsLink, false);
    assert.match(page.text, /Earn \$500 per month/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
