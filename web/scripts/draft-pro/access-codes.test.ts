import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const getServiceRoleClient = vi.hoisted(() => vi.fn(() => ({ rpc })));
vi.mock("../../lib/supabase/server", () => ({ getServiceRoleClient }));
import { parseAccessCodeCommand, runAccessCodeCommand } from "./access-codes";

describe("Draft Pro access-code CLI", () => {
  beforeEach(() => vi.clearAllMocks());
  it("parses issue and revoke apply flags without consuming arguments", () => {
    expect(parseAccessCodeCommand(["issue", "user", "gift", "2027-07-01T04:00:00Z", "--apply"])).toEqual({ action: "issue", targetUserId: "user", reason: "gift", expiresAt: "2027-07-01T04:00:00Z", apply: true });
    expect(parseAccessCodeCommand(["revoke", "code", "requested", "--apply"])).toEqual({ action: "revoke", codeId: "code", reason: "requested", apply: true });
  });
  it("returns a reviewable dry-run without generating or persisting a code", async () => {
    const command = parseAccessCodeCommand(["issue", "user", "gift", "2027-07-01T04:00:00Z"]);
    await expect(runAccessCodeCommand(command)).resolves.toEqual(expect.objectContaining({ dryRun: true, targetUserId: "user", reason: "gift" }));
    expect(getServiceRoleClient).not.toHaveBeenCalled();
  });
  it("rejects missing revoke audit reason", () => { expect(() => parseAccessCodeCommand(["revoke", "code", "--apply"])).toThrow(); });
  it("persists only the hash and returns the raw code once on an applied issue", async () => {
    rpc.mockResolvedValue({ data: "code-id", error: null });
    const result = await runAccessCodeCommand({ action: "issue", targetUserId: "target", reason: "gift", expiresAt: "2027-07-01T04:00:00Z", apply: true }, "admin");
    expect(result).toMatchObject({ dryRun: false, action: "issue", codeId: "code-id" });
    expect(result).toHaveProperty("code");
    expect(rpc).toHaveBeenCalledWith("issue_draft_pro_access_code", expect.objectContaining({ p_issued_by_user_id: "admin", p_target_user_id: "target", p_reason: "gift", p_expires_at: "2027-07-01T04:00:00Z", p_code_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_code");
  });
  it("sends the required audit reason on an applied revocation", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(runAccessCodeCommand({ action: "revoke", codeId: "code", reason: "requested", apply: true }, "admin")).resolves.toEqual({ dryRun: false, action: "revoke", codeId: "code" });
    expect(rpc).toHaveBeenCalledWith("revoke_draft_pro_access_code", { p_issued_by_user_id: "admin", p_code_id: "code", p_reason: "requested" });
  });
});
