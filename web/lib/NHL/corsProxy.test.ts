// @vitest-environment node
import { lookup, type LookupAddress } from "node:dns";
import http, { type ClientRequest } from "node:http";
import https, { Agent, type RequestOptions } from "node:https";
import type { LookupFunction } from "node:net";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { fetchNhlProxyText, lookupNhlAddress } from "./corsProxy";

vi.mock("node:dns", () => ({ lookup: vi.fn() }));

const TARGET = new URL("https://api-web.nhle.com/v1/gamecenter/2026010054/boxscore");
const PUBLIC_ADDRESS = "23.45.67.89";
type Fixture = {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  stall?: "dns" | "headers" | "body";
};
let fixture: Fixture;
let redirects: Fixture[];
let addresses: LookupAddress[];
let dnsError: NodeJS.ErrnoException | null;
let connectedAddresses: string[];
let streams: PassThrough[];
let transport: MockInstance<typeof https.request>;
let httpTransport: MockInstance<typeof http.request>;
let destroyAgent: MockInstance<Agent["destroy"]>;

beforeEach(() => {
  fixture = { statusCode: 200, headers: { "content-type": "application/json" }, body: Buffer.from('{"ok":true}') };
  redirects = [];
  addresses = [{ address: PUBLIC_ADDRESS, family: 4 }];
  dnsError = null;
  connectedAddresses = [];
  streams = [];
  vi.mocked(lookup).mockReset();
  vi.mocked(lookup).mockImplementation(((
    _hostname: string,
    _options: unknown,
    callback: (error: NodeJS.ErrnoException | null, result: LookupAddress[]) => void
  ) => {
    if (fixture.stall !== "dns") callback(dnsError, addresses);
  }) as typeof lookup);
  destroyAgent = vi.spyOn(Agent.prototype, "destroy");
  // These replace both possible transports before any test. No sockets are opened.
  httpTransport = vi.spyOn(http, "request").mockImplementation(() => { throw new Error("Unexpected HTTP transport"); });
  transport = vi.spyOn(https, "request").mockImplementation(((options: RequestOptions) => {
    const req = Object.assign(new PassThrough(), { abort: vi.fn() });
    const current = redirects.shift() ?? fixture;
    streams.push(req);
    queueMicrotask(() => {
      const agent = options.agent as Agent;
      const resolveAddress = agent.options.lookup as LookupFunction;
      resolveAddress(String(options.hostname), { family: agent.options.family }, (error, address) => {
        if (error) { req.emit("error", error); return; }
        connectedAddresses.push(address);
        if (current.stall === "headers") return;
        const res = Object.assign(new PassThrough(), { statusCode: current.statusCode, headers: current.headers });
        streams.push(res);
        req.emit("response", res);
        if (current.stall !== "body") res.end(current.body);
      });
    });
    return req as unknown as ClientRequest;
  }) as typeof https.request);
});

afterEach(() => {
  for (const stream of streams) stream.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function resolveHost(hostname = TARGET.hostname) {
  return new Promise<{ error: NodeJS.ErrnoException | null; address: string; family: number }>((resolve) => {
    lookupNhlAddress(hostname, { family: 4 }, (error, address, family) => resolve({ error, address, family }));
  });
}

describe("NHL socket address boundary", () => {
  it("passes the checked public IPv4 address to the socket lookup without a second resolution", async () => {
    const result = await fetchNhlProxyText(TARGET);
    expect(result.bodyText).toBe('{"ok":true}');
    expect(connectedAddresses).toEqual([PUBLIC_ADDRESS]);
    expect(lookup).toHaveBeenCalledExactlyOnceWith(TARGET.hostname, { all: true, family: 4 }, expect.any(Function));
    const options = transport.mock.calls[0][0] as RequestOptions;
    expect(options.hostname).toBe(TARGET.hostname);
    expect(options.method).toBe("GET");
    expect((options.agent as Agent).options).toMatchObject({ family: 4, lookup: lookupNhlAddress });
    expect(httpTransport).not.toHaveBeenCalled();
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it.each([
    "0.0.0.0", "0.1.2.3", "10.0.0.1", "100.64.0.1", "100.127.255.254",
    "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.254",
    "192.0.0.8", "192.0.2.1", "192.88.99.1", "192.168.1.1", "198.18.0.1",
    "198.19.255.254", "198.51.100.1", "203.0.113.1", "224.0.0.1", "239.255.255.254",
    "240.0.0.1", "255.255.255.255", "2130706433", "0x7f000001", "not-an-address"
  ])("denies DNS answer %s before any connection", async (address) => {
    addresses = [{ address, family: 4 }];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("NHL address unavailable");
    expect(connectedAddresses).toEqual([]);
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it.each(["::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:4860:4860::8888"])("fails closed for IPv6 answer %s", async (address) => {
    addresses = [{ address, family: 6 }];
    expect((await resolveHost()).error).toBeInstanceOf(Error);
  });

  it.each([false, true])("rejects a mixed public/private DNS result, private answer first=%s", async (privateFirst) => {
    addresses.push({ address: "10.0.0.1", family: 4 });
    if (privateFirst) addresses.reverse();
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("NHL address unavailable");
    expect(connectedAddresses).toEqual([]);
  });

  it("rejects empty answers and DNS failures", async () => {
    addresses = [];
    expect((await resolveHost()).error).toBeInstanceOf(Error);
    dnsError = new Error("synthetic DNS failure");
    expect((await resolveHost()).error?.message).toBe("NHL address unavailable");
  });

  it("denies unexpected socket hostnames without resolving", async () => {
    expect((await resolveHost("attacker.invalid")).error).toBeInstanceOf(Error);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects unsupported direct helper destinations before transport", async () => {
    await expect(fetchNhlProxyText(new URL("https://127.0.0.1/"))).rejects.toThrow("Unsupported NHL URL");
    expect(transport).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    expect(destroyAgent).not.toHaveBeenCalled();
  });
});

function redirectTo(location: string, statusCode = 307): Fixture {
  return { statusCode, headers: { location }, body: Buffer.from("") };
}

describe("NHL HTTP client limits with synthetic streams", () => {
  it.each([301, 302, 303, 307, 308])("rejects HTTP %s to an unapproved destination without a second request", async (statusCode) => {
    redirects = [redirectTo("http://169.254.169.254/synthetic", statusCode)];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("Unsupported NHL redirect");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(httpTransport).not.toHaveBeenCalled();
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://169.254.169.254/latest/meta-data",
    "http://api-web.nhle.com/v1/standings/2026-10-17",
    "https://api-web.nhle.com:8443/v1/standings/2026-10-17",
    "https://api-web.nhle.com.attacker.invalid/v1/standings/2026-10-17",
    "https://user@api-web.nhle.com/v1/standings/2026-10-17",
    "/v1/arbitrary-path",
    "/v1/standings/2026-10-17#fragment",
    "https://[::1]/v1/standings/2026-10-17",
    "http://[invalid"
  ])("refuses a redirect to %s", async (location) => {
    redirects = [redirectTo(location)];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("Unsupported NHL redirect");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(httpTransport).not.toHaveBeenCalled();
  });

  it("refuses a redirect without a Location header", async () => {
    redirects = [{ statusCode: 302, headers: {}, body: Buffer.from("") }];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("Unsupported NHL redirect");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/v1/standings/2026-10-17",
    "https://api-web.nhle.com/v1/standings/2026-10-17"
  ])("follows one now-to-dated redirect to %s through a fresh checked lookup", async (location) => {
    const now = new URL("https://api-web.nhle.com/v1/standings/now");
    redirects = [redirectTo(location)];
    const result = await fetchNhlProxyText(now);
    expect(result.bodyText).toBe('{"ok":true}');
    expect(transport).toHaveBeenCalledTimes(2);
    const hop = transport.mock.calls[1][0] as RequestOptions;
    expect(hop).toMatchObject({ hostname: "api-web.nhle.com", path: "/v1/standings/2026-10-17", method: "GET" });
    expect((hop.agent as Agent).options).toMatchObject({ family: 4, lookup: lookupNhlAddress });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(connectedAddresses).toEqual([PUBLIC_ADDRESS, PUBLIC_ADDRESS]);
    expect(httpTransport).not.toHaveBeenCalled();
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it("refuses a second redirect even between approved resources", async () => {
    redirects = [
      redirectTo("/v1/standings/2026-10-17"),
      redirectTo("/v1/standings/2026-10-16")
    ];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("Unsupported NHL redirect");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("re-checks DNS on the redirect hop and rejects a private answer", async () => {
    vi.mocked(lookup).mockImplementationOnce(((
      _hostname: string,
      _options: unknown,
      callback: (error: NodeJS.ErrnoException | null, result: LookupAddress[]) => void
    ) => callback(null, [{ address: PUBLIC_ADDRESS, family: 4 }])) as typeof lookup);
    addresses = [{ address: "169.254.169.254", family: 4 }];
    redirects = [redirectTo("/v1/standings/2026-10-17")];
    await expect(fetchNhlProxyText(TARGET)).rejects.toThrow("NHL address unavailable");
    expect(connectedAddresses).toEqual([PUBLIC_ADDRESS]);
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it("applies one deadline across a stalled redirect hop", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    redirects = [redirectTo("/v1/standings/2026-10-17")];
    fixture.stall = "body";
    const result = expect(fetchNhlProxyText(TARGET)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(transport).toHaveBeenCalledTimes(2);
    expect(destroyAgent).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])("enforces the decoded-body limit with compression=%s", async (compressed) => {
    const oversized = "x".repeat(4 * 1024 * 1024 + 1);
    fixture.body = compressed ? gzipSync(oversized) : Buffer.from(oversized);
    if (compressed) fixture.headers["content-encoding"] = "gzip";
    await expect(fetchNhlProxyText(TARGET)).rejects.toMatchObject({ type: "max-size" });
    expect(destroyAgent).toHaveBeenCalledTimes(1);
  });

  it.each(["dns", "headers", "body"] as const)("aborts stalled %s within the total 10-second deadline", async (stall) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fixture.stall = stall;
    const result = expect(fetchNhlProxyText(TARGET)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(destroyAgent).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the deadline on success", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await expect(fetchNhlProxyText(TARGET)).resolves.toMatchObject({ bodyText: '{"ok":true}' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
