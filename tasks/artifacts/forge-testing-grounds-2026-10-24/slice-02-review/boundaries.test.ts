import { afterEach, describe, expect, it, vi } from "../../../../web/node_modules/vitest/dist/index.js";
import { createTestingGroundsOwnerPolicy, type ResolveServerPrincipal } from "../../../../web/lib/forge-testing-grounds/ownerPolicy";

const OWNER = "abcdefab-cdef-4abc-8def-abcdefabcdef";
const OTHER = "bcdefabc-defa-4bcd-9efa-bcdefabcdefa";
const make = (resolveServerPrincipal: ResolveServerPrincipal, configuredOwnerUserId: unknown = OWNER) =>
  createTestingGroundsOwnerPolicy({ configuredOwnerUserId, resolveServerPrincipal });
afterEach(() => vi.unstubAllGlobals());

describe("Independent TJ-only policy boundary", () => {
  it("canonicalizes an exact UUID but does not coerce invalid owner config or run authentication for it", async () => {
    const invalid = [undefined, null, false, 0, 7, {}, [], new String(OWNER), { toString: () => OWNER }, "", "admin", "owner@example.invalid",
      "00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff", OWNER.replace("-4abc-", "-0abc-"), OWNER.replace("-8def-", "-7def-"), ` ${OWNER}`, `${OWNER} `];
    for (const configuredOwner of invalid) {
      const resolver = vi.fn(async () => ({ userId: OWNER }));
      expect(await createTestingGroundsOwnerPolicy({ configuredOwnerUserId: configuredOwner, resolveServerPrincipal: resolver }).authorizeOwner()).toEqual({ allowed: false, status: 503, code: "owner_not_configured" });
      expect(resolver).not.toHaveBeenCalled();
    }
    expect(await make(async () => ({ userId: OWNER.toUpperCase() }), OWNER.toUpperCase()).authorizeOwner()).toEqual({ allowed: true, ownerUserId: OWNER });
  });
  it("rejects owner configuration with trailing line terminators before authentication", async () => {
    for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
      const resolver = vi.fn(async () => ({ userId: OWNER }));
      expect(await make(resolver, OWNER + suffix).authorizeOwner()).toEqual({ allowed: false, status: 503, code: "owner_not_configured" });
      expect(resolver).not.toHaveBeenCalled();
    }
  });
  it("rejects malformed principal IDs without coercion, including matching malformed config/principal pairs", async () => {
    for (const userId of [undefined, null, false, 12, [], {}, { toString: () => OWNER }, ` ${OWNER}`, `${OWNER} `, `${OWNER}\n`]) {
      expect(await make((async () => ({ userId })) as ResolveServerPrincipal).authorizeOwner()).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    }
    expect((await make(async () => ({ userId: `${OWNER}\n` }), `${OWNER}\n`).authorizeOwner()).allowed).toBe(false);
  });
  it("does not grant access to a different verified admin, cron/service claim or localhost request", async () => {
    const claims = { userId: OTHER, role: "admin", app_metadata: { role: "admin" }, verified: true, isOwner: true, isCron: true, serviceRole: true, local: true,
      headers: { host: "localhost", authorization: "Bearer SYNTHETIC_PRIVATE_CRON" }, body: { userId: OWNER }, query: { owner: OWNER } };
    const resolver = vi.fn(async () => claims), policy = make(resolver);
    expect(await policy.authorizeOwner()).toEqual({ allowed: false, status: 403, code: "forbidden" });
    expect(await policy.authorizeStoredResource(OWNER)).toEqual({ allowed: false, status: 403, code: "forbidden" });
    expect(resolver.mock.calls.every(args => args.length === 0)).toBe(true);
  });
  it("ignores caller-provided authorization arguments and boolean-only principal claims", async () => {
    const policy = make(async () => null);
    const call = policy.authorizeOwner as unknown as (...args: unknown[]) => ReturnType<typeof policy.authorizeOwner>;
    expect(await call({ userId: OWNER, authenticated: true, verified: true, admin: true }, true, OWNER)).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    for (const claims of [{ verified: true }, { authenticated: true, role: "admin" }, { body: { userId: OWNER }, verified: true }]) {
      expect(await make((async () => claims) as ResolveServerPrincipal).authorizeOwner()).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    }
  });
  it("treats the injected resolver as its trust root and cannot itself verify a session", async () => {
    // This deliberately fabricated resolver is accepted: only trusted integration
    // can establish that its userId came from actual server authentication.
    const synthetic = make(async () => ({ userId: OWNER, verified: false, authenticated: false }));
    expect(await synthetic.authorizeOwner()).toEqual({ allowed: true, ownerUserId: OWNER });
  });
  it("denies a missing/nonfunction verifier and normalizes synchronous/asynchronous failures", async () => {
    for (const resolver of [undefined, null, {}, true, "verified"]) {
      expect(await make(resolver as ResolveServerPrincipal).authorizeOwner()).toEqual({ allowed: false, status: 503, code: "verification_unavailable" });
    }
    const secret = "SYNTHETIC_SECRET_TOKEN_AND_EMAIL";
    const getterPrincipal = Object.defineProperty({}, "userId", { get() { throw new Error(secret); } });
    for (const resolver of [() => { throw new Error(secret); }, async () => { throw secret; }, async () => getterPrincipal]) {
      const result = await make(resolver as ResolveServerPrincipal).authorizeOwner();
      expect(result).toEqual({ allowed: false, status: 503, code: "verification_unavailable" });
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });
  it("does not disclose resource owner or verifier errors in any denial", async () => {
    const noSession = make(async () => null), mismatch = make(async () => ({ userId: OTHER }));
    for (const result of [await noSession.authorizeStoredResource(OTHER), await mismatch.authorizeStoredResource(OWNER), await make(async () => ({ userId: OWNER })).authorizeStoredResource(OTHER)]) {
      expect(Object.keys(result).sort()).toEqual(["allowed", "code", "status"]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(JSON.stringify(result)).not.toContain(OWNER); expect(JSON.stringify(result)).not.toContain(OTHER);
    }
  });
  it("requires trusted stored owner equality and never grants mismatched/malformed resources", async () => {
    const policy = make(async () => ({ userId: OWNER }));
    for (const value of [undefined, null, false, 2, {}, [], OTHER, { userId: OWNER }, ` ${OWNER}`, `${OWNER}\n`]) {
      expect(await policy.authorizeStoredResource(value)).toEqual({ allowed: false, status: 404, code: "resource_not_found" });
    }
    expect(await policy.authorizeStoredResource(OWNER.toUpperCase())).toEqual({ allowed: true, ownerUserId: OWNER });
  });
  it("re-verifies on every owner/resource call and survives session loss or verifier outage without a cached allow", async () => {
    const resolver = vi.fn<ResolveServerPrincipal>()
      .mockResolvedValueOnce({ userId: OWNER }).mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("SYNTHETIC_SECRET"))
      .mockResolvedValueOnce({ userId: OTHER }).mockResolvedValueOnce({ userId: OWNER });
    const policy = make(resolver);
    expect((await policy.authorizeOwner()).allowed).toBe(true);
    expect(await policy.authorizeStoredResource(OWNER)).toMatchObject({ allowed: false, code: "unauthenticated" });
    expect(await policy.authorizeOwner()).toMatchObject({ allowed: false, code: "verification_unavailable" });
    expect(await policy.authorizeStoredResource(OWNER)).toMatchObject({ allowed: false, code: "forbidden" });
    expect((await policy.authorizeStoredResource(OWNER)).allowed).toBe(true);
    expect(resolver).toHaveBeenCalledTimes(5);
  });
  it("denies defined browser window values before invoking the verifier", async () => {
    for (const windowValue of [{}, null, false]) {
      vi.stubGlobal("window", windowValue);
      const resolver = vi.fn(async () => ({ userId: OWNER }));
      expect(await make(resolver).authorizeOwner()).toEqual({ allowed: false, status: 403, code: "server_context_required" });
      expect(resolver).not.toHaveBeenCalled(); vi.unstubAllGlobals();
    }
  });
  it("captures request-scoped configuration/verifier and returns frozen minimal allow decisions", async () => {
    const options = { configuredOwnerUserId: OWNER, resolveServerPrincipal: async () => ({ userId: OWNER }) };
    const policy = createTestingGroundsOwnerPolicy(options);
    options.configuredOwnerUserId = OTHER; options.resolveServerPrincipal = async () => ({ userId: OTHER });
    const decision = await policy.authorizeOwner();
    expect(decision).toEqual({ allowed: true, ownerUserId: OWNER });
    expect(Object.keys(decision).sort()).toEqual(["allowed", "ownerUserId"]);
    expect(Object.isFrozen(policy)).toBe(true); expect(Object.isFrozen(decision)).toBe(true);
  });
});
