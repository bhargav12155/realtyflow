import { promises as dns } from "dns";
import net from "net";

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
  [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
  [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
  [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
  [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
  [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
  [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
  [ipv4ToInt("224.0.0.0"), ipv4ToInt("239.255.255.255")],
  [ipv4ToInt("240.0.0.0"), ipv4ToInt("255.255.255.255")],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:x.x.x.x)
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedMatch) return isPrivateIPv4(v4MappedMatch[1]);
  return false;
}

/**
 * Validate that a URL is safe to fetch from server-side code:
 *  - http(s) only
 *  - hostname does not resolve to a private/loopback/link-local address
 * Throws on rejection so callers don't accidentally bypass the check.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Refusing to fetch invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Refusing to fetch non-http(s) URL (${parsed.protocol})`);
  }

  const host = parsed.hostname;
  if (!host) throw new Error("Refusing to fetch URL with empty hostname");

  // If hostname is already a literal IP, validate directly.
  const ipFamily = net.isIP(host);
  if (ipFamily === 4) {
    if (isPrivateIPv4(host)) throw new Error(`Refusing to fetch private/loopback address ${host}`);
    return parsed;
  }
  if (ipFamily === 6) {
    if (isPrivateIPv6(host)) throw new Error(`Refusing to fetch private/loopback address ${host}`);
    return parsed;
  }

  // Reject obvious internal hostnames.
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal")) {
    throw new Error(`Refusing to fetch internal hostname ${host}`);
  }

  // Resolve every A/AAAA record and reject if any is private.
  const addrs = await dns.lookup(host, { all: true });
  for (const a of addrs) {
    if (a.family === 4 && isPrivateIPv4(a.address)) {
      throw new Error(`Refusing to fetch ${host} — resolves to private address ${a.address}`);
    }
    if (a.family === 6 && isPrivateIPv6(a.address)) {
      throw new Error(`Refusing to fetch ${host} — resolves to private address ${a.address}`);
    }
  }
  return parsed;
}

export async function safePublicFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  const safe = await assertSafePublicUrl(rawUrl);
  return fetch(safe.toString(), init);
}
