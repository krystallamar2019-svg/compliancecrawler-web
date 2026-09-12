import assert from 'node:assert/strict';
import test from 'node:test';
import { hashVerificationToken, pageContainsVerificationMeta, verificationTokenMatches } from '../security/domainVerification.js';

test('verification token is stored as a one-way SHA-256 hash', () => {
  const token = 'branded-align-test-token-123456789';
  const hash = hashVerificationToken(token);
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
  assert.equal(verificationTokenMatches(token, hash), true);
  assert.equal(verificationTokenMatches(`${token}-wrong`, hash), false);
});

test('meta verification requires exact verification name and token', () => {
  const token = 'token-abcdefghijklmnopqrstuvwxyz';
  assert.equal(
    pageContainsVerificationMeta(`<html><head><meta content="${token}" name="brandedalign-verification"></head></html>`, token),
    true,
  );
  assert.equal(
    pageContainsVerificationMeta(`<meta name="brandedalign-verification" content="wrong">`, token),
    false,
  );
  assert.equal(
    pageContainsVerificationMeta(`<meta name="unrelated" content="${token}">`, token),
    false,
  );
});
