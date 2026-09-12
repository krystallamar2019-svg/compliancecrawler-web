import assert from 'node:assert/strict';
import test from 'node:test';
import { safeFetchText } from '../security/safeFetch.js';
import { UnsafeUrlError } from '../security/urlSafety.js';

test('revalidates redirects and blocks a redirect to private/loopback space', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/internal' },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => safeFetchText('http://8.8.8.8/'),
      (error) => error instanceof UnsafeUrlError && error.code === 'NON_PUBLIC_IP_BLOCKED',
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
