import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicIp, normalizeHttpUrl, UnsafeUrlError } from '../security/urlSafety.js';

function expectUnsafe(fn: () => unknown, code: string) {
  assert.throws(fn, (error) => error instanceof UnsafeUrlError && error.code === code);
}

test('normalizes supported public URL syntax', () => {
  const url = normalizeHttpUrl('https://Example.com:443/path?q=1#fragment');
  assert.equal(url.toString(), 'https://example.com/path?q=1');
});

test('rejects unsupported schemes, credentials, localhost and nonstandard ports', () => {
  expectUnsafe(() => normalizeHttpUrl('file:///etc/passwd'), 'UNSUPPORTED_URL_SCHEME');
  expectUnsafe(() => normalizeHttpUrl('https://user:pass@example.com/'), 'URL_CREDENTIALS_NOT_ALLOWED');
  expectUnsafe(() => normalizeHttpUrl('http://localhost/'), 'LOCALHOST_BLOCKED');
  expectUnsafe(() => normalizeHttpUrl('https://example.com:8443/'), 'NON_STANDARD_PORT_BLOCKED');
});

test('blocks private, loopback, metadata, CGNAT, multicast and reserved IP ranges', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
  ]) {
    expectUnsafe(() => assertPublicIp(ip), 'NON_PUBLIC_IP_BLOCKED');
  }
});

test('permits globally routable unicast addresses', () => {
  assert.doesNotThrow(() => assertPublicIp('8.8.8.8'));
  assert.doesNotThrow(() => assertPublicIp('1.1.1.1'));
  assert.doesNotThrow(() => assertPublicIp('2606:4700:4700::1111'));
});
