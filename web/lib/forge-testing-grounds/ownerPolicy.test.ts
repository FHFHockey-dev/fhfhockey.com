// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestingGroundsOwnerPolicy, type ResolveServerPrincipal } from "./ownerPolicy";

// Entirely synthetic identities; no real account configuration is loaded.
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const principal = () => Promise.resolve({ userId: OWNER });
afterEach(() => vi.unstubAllGlobals());

describe("Testing Grounds TJ-only owner policy", () => {
  it("allows only the explicitly configured owner after server verification", async () => {
    const resolveServerPrincipal = vi.fn(principal);
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER.toUpperCase(), resolveServerPrincipal });
    expect(await policy.authorizeOwner()).toEqual({ allowed: true, ownerUserId: OWNER });
    expect(resolveServerPrincipal).toHaveBeenCalledTimes(1);
    expect(resolveServerPrincipal).toHaveBeenCalledWith();
  });

  it("fails closed on missing or invalid owner configuration without invoking authentication", async () => {
    for (const configuredOwnerUserId of [undefined, null, "", "admin", "owner@example.test", ` ${OWNER}`,
      "00000000-0000-0000-0000-000000000000", [OWNER], { userId: OWNER }]) {
      const resolveServerPrincipal = vi.fn(principal);
      const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId, resolveServerPrincipal });
      expect(await policy.authorizeOwner()).toEqual({ allowed: false, status: 503, code: "owner_not_configured" });
      expect(resolveServerPrincipal).not.toHaveBeenCalled();
    }
  });

  it("does not grant ownership to another verified administrator", async () => {
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER,
      resolveServerPrincipal: async () => ({ userId: OTHER_ADMIN, role: "admin" }) });
    expect(await policy.authorizeOwner()).toEqual({ allowed: false, status: 403, code: "forbidden" });
    expect(await policy.authorizeStoredResource(OWNER)).toEqual({ allowed: false, status: 403, code: "forbidden" });
  });

  it("rejects absent or malformed verified principals", async () => {
    for (const value of [null, undefined, {}, { userId: "admin" }, { userId: OWNER, role: "admin", user_id: OWNER }]) {
      if (value?.userId === OWNER) continue;
      const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER,
        resolveServerPrincipal: (async () => value) as ResolveServerPrincipal });
      expect(await policy.authorizeOwner()).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    }
  });

  it("cannot be authorized by request-body/query roles or a cron/local flag", async () => {
    const resolveServerPrincipal = vi.fn(async () => null);
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER, resolveServerPrincipal });
    const untrusted = { body: { userId: OWNER, role: "admin", verified: true }, query: { owner: OWNER },
      headers: { authorization: "Bearer synthetic-cron-secret", host: "localhost" }, local: true, admin: true };
    // @ts-expect-error The policy intentionally has no request/claim input.
    expect(await policy.authorizeOwner(untrusted)).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    expect(resolveServerPrincipal).toHaveBeenCalledWith();
  });

  it("denies stored resources whose owner is absent, malformed or different", async () => {
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER, resolveServerPrincipal: principal });
    for (const storedOwner of [undefined, null, "", OTHER_ADMIN, { userId: OWNER }]) {
      expect(await policy.authorizeStoredResource(storedOwner)).toEqual({ allowed: false, status: 404, code: "resource_not_found" });
    }
    expect(await policy.authorizeStoredResource(OWNER)).toEqual({ allowed: true, ownerUserId: OWNER });
  });

  it("re-verifies on every call and does not reuse an authorization after session loss", async () => {
    const resolveServerPrincipal = vi.fn<ResolveServerPrincipal>()
      .mockResolvedValueOnce({ userId: OWNER }).mockResolvedValueOnce(null);
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER, resolveServerPrincipal });
    expect((await policy.authorizeOwner()).allowed).toBe(true);
    expect(await policy.authorizeStoredResource(OWNER)).toEqual({ allowed: false, status: 401, code: "unauthenticated" });
    expect(resolveServerPrincipal).toHaveBeenCalledTimes(2);
  });

  it("returns no upstream exception, token or private identity on failure", async () => {
    const privateError = `Bearer private-token; identity=${OWNER}; private-league`;
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER,
      resolveServerPrincipal: async () => { throw new Error(privateError); } });
    const denial = await policy.authorizeOwner();
    expect(denial).toEqual({ allowed: false, status: 503, code: "verification_unavailable" });
    expect(JSON.stringify(denial)).not.toContain(privateError);
    expect(JSON.stringify(denial)).not.toContain(OWNER);
  });

  it("denies a browser-side invocation without running the verifier", async () => {
    vi.stubGlobal("window", {});
    const resolveServerPrincipal = vi.fn(principal);
    const policy = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER, resolveServerPrincipal });
    expect(await policy.authorizeOwner()).toEqual({ allowed: false, status: 403, code: "server_context_required" });
    expect(resolveServerPrincipal).not.toHaveBeenCalled();
  });

  it("does not read mutable request-like configuration after construction or accept a missing verifier", async () => {
    const options = { configuredOwnerUserId: OWNER, resolveServerPrincipal: principal };
    const policy = createTestingGroundsOwnerPolicy(options);
    options.configuredOwnerUserId = OTHER_ADMIN;
    expect((await policy.authorizeOwner()).allowed).toBe(true);
    const invalid = createTestingGroundsOwnerPolicy({ configuredOwnerUserId: OWNER,
      resolveServerPrincipal: undefined as unknown as ResolveServerPrincipal });
    expect(await invalid.authorizeOwner()).toEqual({ allowed: false, status: 503, code: "verification_unavailable" });
  });
});
