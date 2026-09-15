import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export class UnsafeUrlError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

export function normalizeHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError('INVALID_URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('UNSUPPORTED_URL_SCHEME');
  }
  if (url.username || url.password) throw new UnsafeUrlError('URL_CREDENTIALS_NOT_ALLOWED');

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) throw new UnsafeUrlError('HOST_REQUIRED');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new UnsafeUrlError('LOCALHOST_BLOCKED');
  }

  const allowedPort = !url.port ||
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443');
  if (!allowedPort) throw new UnsafeUrlError('NON_STANDARD_PORT_BLOCKED');

  url.hash = '';
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }
  return url;
}

export function assertPublicIp(rawIp: string) {
  let address: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    address = ipaddr.process(rawIp);
  } catch {
    throw new UnsafeUrlError('INVALID_RESOLVED_IP');
  }

  // ipaddr.js classifies loopback, private, link-local, multicast, CGNAT,
  // reserved/documentation and IPv4-mapped ranges separately. Only globally
  // routable unicast addresses are acceptable crawler destinations.
  if (address.range() !== 'unicast') {
    throw new UnsafeUrlError('NON_PUBLIC_IP_BLOCKED');
  }
}

export async function resolvePublicAddresses(url: URL): Promise<string[]> {
  const hostname = normalizeHostname(url.hostname);

  if (ipaddr.isValid(hostname)) {
    assertPublicIp(hostname);
    return [ipaddr.process(hostname).toString()];
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('DNS_RESOLUTION_FAILED');
  }

  if (records.length === 0) throw new UnsafeUrlError('DNS_RESOLUTION_EMPTY');

  const addresses = [...new Set(records.map((record) => record.address))];
  for (const address of addresses) assertPublicIp(address);
  return addresses.sort();
}

export async function assertSafeDestination(input: string | URL) {
  const url = input instanceof URL ? normalizeHttpUrl(input.toString()) : normalizeHttpUrl(input);
  const addresses = await resolvePublicAddresses(url);
  return { url, addresses };
}

export async function revalidateDestination(url: URL, previousAddresses: string[]) {
  const addresses = await resolvePublicAddresses(url);
  if (addresses.some((address) => !previousAddresses.includes(address))) {
    throw new UnsafeUrlError('DNS_REBINDING_DETECTED');
  }
  return addresses;
}

export function sameSite(candidate: URL, root: URL) {
  return candidate.protocol === root.protocol &&
    normalizeHostname(candidate.hostname) === normalizeHostname(root.hostname) &&
    candidate.port === root.port;
}
