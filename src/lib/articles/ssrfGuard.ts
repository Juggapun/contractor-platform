/**
 * Issue #42 (Articles) — the second SSRF defense layered on top of
 * facebookUrl.ts's hostname allowlist: before this app's server ever
 * opens a connection to an allowlisted hostname, resolve it via DNS and
 * confirm every returned address is a real public IP, not a
 * private/loopback/link-local/reserved one. Since the allowlisted
 * hostnames (facebook.com, *.fbcdn.net) are fixed literals that are not
 * attacker-controlled, this check exists as defense-in-depth against a
 * misconfigured/compromised DNS record rather than against a
 * user-supplied arbitrary hostname (there is no such thing here — see
 * facebookUrl.ts's own header comment). It does not fully close a
 * classic TOCTOU DNS-rebinding window (the IP checked here and the IP
 * `fetch()` itself connects to a moment later could theoretically
 * differ) — full protection against that would require pinning the
 * connection to a specific resolved IP at the socket layer, which is
 * disproportionate engineering for a fixed, non-attacker-controlled
 * hostname allowlist reachable only by an already-authenticated admin.
 * This is stated plainly rather than overclaiming a stronger guarantee.
 */
import { promises as dns } from 'node:dns';
import net from 'node:net';

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // RFC1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata endpoints)
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
    if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower === '::') return true; // unspecified
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (RFC4193)
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — re-check the embedded v4 address.
      const v4 = lower.slice('::ffff:'.length);
      if (net.isIP(v4) === 4) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true; // not a recognizable IP literal at all — treat as unsafe
}

export async function resolvesToPublicAddressOnly(hostname: string): Promise<boolean> {
  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  return addresses.every((address) => !isPrivateOrReservedIp(address));
}
