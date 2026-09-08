import { describe, expect, it } from 'vitest';
import { isPrivateOrReservedIp, resolvesToPublicAddressOnly } from '../src/lib/net/ssrfGuard';

describe('isPrivateOrReservedIp', () => {
  it('flags loopback (127.0.0.0/8)', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('127.255.255.255')).toBe(true);
  });

  it('flags RFC1918 private ranges', () => {
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
  });

  it('does not flag 172.15.x.x / 172.32.x.x (just outside the RFC1918 172.16-31 band)', () => {
    expect(isPrivateOrReservedIp('172.15.0.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false);
  });

  it('flags link-local (169.254.0.0/16, incl. cloud metadata endpoints)', () => {
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
  });

  it('flags CGNAT (100.64.0.0/10)', () => {
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('100.100.0.1')).toBe(true);
  });

  it('does not flag CGNAT-adjacent addresses outside the /10', () => {
    expect(isPrivateOrReservedIp('100.63.255.255')).toBe(false);
    expect(isPrivateOrReservedIp('100.128.0.1')).toBe(false);
  });

  it('flags "this network" (0.0.0.0/8) and multicast/reserved (224+)', () => {
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
    expect(isPrivateOrReservedIp('224.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('255.255.255.255')).toBe(true);
  });

  it('does not flag a real public IPv4 address', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('157.240.1.1')).toBe(false); // a real Facebook-range address
  });

  it('flags IPv6 loopback and link-local/unique-local', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd12:3456::1')).toBe(true);
  });

  it('does not flag a real public IPv6 address', () => {
    expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
  });

  it('resolves an IPv4-mapped IPv6 loopback correctly', () => {
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('treats an unparseable string as unsafe', () => {
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
    expect(isPrivateOrReservedIp('')).toBe(true);
  });
});

describe('resolvesToPublicAddressOnly', () => {
  it('returns false for localhost (resolves to loopback)', async () => {
    expect(await resolvesToPublicAddressOnly('localhost')).toBe(false);
  });

  it('returns false for a hostname that does not resolve at all', async () => {
    expect(await resolvesToPublicAddressOnly('this-host-does-not-exist.invalid')).toBe(false);
  });
});
