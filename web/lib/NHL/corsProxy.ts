import { lookup } from "node:dns";
import { Agent } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import fetch, { type RequestInit } from "node-fetch";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const STATS_PATHS = new Set([
  "/stats/rest/en/season",
  "/stats/rest/en/shiftcharts",
  "/stats/rest/en/team/summary",
  "/stats/rest/en/team/powerplay",
  "/stats/rest/en/goalie/summary",
  "/stats/rest/en/goalie/advanced"
]);
const STATS_PARAMETERS = new Set([
  "isAggregate", "isGame", "sort", "start", "limit", "factCayenneExp", "cayenneExp"
]);

// Only the HTTPS NHL resources used by browser callers are part of this contract.
export function parseNhlProxyUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > 8192 || /[\\\u0000-\u001f\u007f#]/.test(value)) return null;
  try {
    const target = new URL(value);
    if (
      target.protocol !== "https:" || target.username || target.password || target.port ||
      !["api-web.nhle.com", "api.nhle.com"].includes(target.hostname) ||
      !value.startsWith(`${target.origin}/`) ||
      value.slice(target.origin.length).split("?")[0] !== target.pathname
    ) return null;

    if (target.hostname === "api-web.nhle.com") {
      if (target.search) return null;
      return /^\/v1\/(?:gamecenter\/\d{10}\/(?:boxscore|landing|play-by-play)|(?:schedule|standings|score)\/(?:now|\d{4}-\d{2}-\d{2})|club-schedule-season\/[A-Z]{2,3}\/\d{8})$/.test(target.pathname)
        ? target : null;
    }
    if (!STATS_PATHS.has(target.pathname)) return null;
    const seen = new Set<string>();
    for (const [key, parameter] of target.searchParams) {
      if (!STATS_PARAMETERS.has(key) || seen.has(key) || parameter.length > 2048 || /[\u0000-\u001f\u007f]/.test(parameter)) return null;
      seen.add(key);
      if (["isAggregate", "isGame"].includes(key) && !["true", "false"].includes(parameter)) return null;
      if (key === "limit" && (!/^\d{1,3}$/.test(parameter) || Number(parameter) < 1 || Number(parameter) > 100)) return null;
      if (key === "start" && !/^\d{1,6}$/.test(parameter)) return null;
    }
    if (target.pathname.endsWith("/shiftcharts") && (
      seen.size !== 1 || !/^gameId=\d{10}$/.test(target.searchParams.get("cayenneExp") ?? "")
    )) return null;
    return target;
  } catch {
    return null;
  }
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
] as const) blocked.addSubnet(address, prefix, "ipv4");

// Resolve at socket connection time and hand that exact checked address to TLS.
// IPv4-only egress avoids IPv6 transition/mapped-address ambiguity; no second lookup.
export const lookupNhlAddress: LookupFunction = (hostname, _options, callback) => {
  if (!["api-web.nhle.com", "api.nhle.com"].includes(hostname)) {
    callback(new Error("Unsupported NHL host"), "", 4);
    return;
  }
  lookup(hostname, { all: true, family: 4 }, (error, addresses) => {
    if (error || !addresses?.length || addresses.some(({ address, family }) =>
      family !== 4 || isIP(address) !== 4 || blocked.check(address, "ipv4")
    )) {
      callback(new Error("NHL address unavailable"), "", 4);
      return;
    }
    callback(null, addresses[0].address, 4);
  });
};

export async function fetchNhlProxyText(target: URL) {
  if (!parseNhlProxyUrl(target.toString())) throw new Error("Unsupported NHL URL");
  const agent = new Agent({ lookup: lookupNhlAddress, family: 4 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
      },
      redirect: "error",
      agent,
      // node-fetch v2 has its own older AbortSignal declaration.
      signal: controller.signal as NonNullable<RequestInit["signal"]>,
      size: MAX_RESPONSE_BYTES
    });
    return { upstream, bodyText: await upstream.text() };
  } finally {
    clearTimeout(timeout);
    agent.destroy();
  }
}
