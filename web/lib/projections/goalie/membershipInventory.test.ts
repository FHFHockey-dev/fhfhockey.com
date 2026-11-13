import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readMembershipInventory, type MembershipInventorySelection } from "./membershipInventory";

const observationId = "00000000-0000-4000-8000-000000000001";
const sourceHash = "a".repeat(64);
function fixture() {
  const envelope = { contract: "goalie-membership-inventory-v1", projectId: "fyhftlxokyjtpndbkfse",
    capturedAt: "2026-11-12T13:00:00Z", observations: [{ id: observationId, season_id: 20262027,
      fhfh_player_id: 501, nhl_player_id: 9001, observation_kind: "official_transaction", event_type: "trade",
      organization_team_id: 4, roster_status: "active_nhl", source_key: "trade:fixture",
      source_url: "https://www.nhl.com/news/fixture", source_hash: sourceHash,
      observed_at: "2026-10-20T13:00:00Z", available_at: "2026-10-20T13:00:00Z",
      effective_at: null as string | null, created_at: "2026-10-20T14:00:00Z", supersedes_id: null }] };
  const pin: MembershipInventorySelection = { projectId: envelope.projectId, sha256: "", seasonId: 20262027,
    sourceCutoff: "2026-11-12T12:00:00Z", readAt: "2026-11-12T14:00:00Z",
    identity: { goalieId: 101, fhfhPlayerId: 501, nhlPlayerId: 9001 },
    teams: [{ teamId: 1, abbreviation: "NJD" }, { teamId: 4, abbreviation: "PHI" }],
    rows: [{ observationId, sourceHash }] };
  return { envelope, pin };
}
function retained(f: ReturnType<typeof fixture>) {
  const body = JSON.stringify(f.envelope);
  return { body, pin: { ...f.pin, sha256: createHash("sha256").update(body).digest("hex") } };
}
function read(f: ReturnType<typeof fixture>) {
  const { body, pin } = retained(f);
  return readMembershipInventory(body, pin);
}

describe("retained membership inventory admission", () => {
  it("admits exact selected rows while preserving missing interpretation and effective time", () => {
    const result = read(fixture());
    expect(result.requestedRowCount).toBe(1); expect(result.returnedRowCount).toBe(1);
    expect(result.admission.events).toEqual([]);
    expect(result.admission.records[0].reasons).toEqual(["boundary_interpretation_missing", "effective_time_unknown"]);
    expect(result.admission.coverage).toBeNull(); expect(result.admission.membershipComplete).toBe(false);
  });

  it("does not manufacture the effective time even with a separately supplied interpretation", () => {
    const { body, pin } = retained(fixture());
    const result = readMembershipInventory(body, pin, [{ resolutionId: "review:1", revision: "r1", observationId,
      sourceHash, basis: "official_nhl_membership_boundary", fromTeamId: 1, toTeamId: 4,
      recordedAt: "2026-10-20T15:00:00Z" }]);
    expect(result.admission.events[0]).toMatchObject({ fromTeam: "NJD", toTeam: "PHI", effectiveAt: null });
    expect(result.admission.membershipComplete).toBe(false);
  });

  it("checks byte integrity before JSON admission", () => {
    const { body, pin } = retained(fixture());
    expect(() => readMembershipInventory(`${body} `, pin)).toThrow(/byte integrity/);
  });

  it("enforces the UTF-8 byte cap before parsing an otherwise short character string", () => {
    const { pin } = retained(fixture());
    const oversized = '"' + "😀".repeat(32768) + '"';
    expect(oversized.length).toBeLessThan(128 * 1024);
    expect(() => readMembershipInventory(oversized, pin)).toThrow(/byte bound/);
  });

  it("rejects missing, additional and duplicate rows even after an export is rehashed", () => {
    const missing = fixture(); missing.envelope.observations = [];
    const additional = fixture(); additional.envelope.observations.push({ ...additional.envelope.observations[0], id: "00000000-0000-4000-8000-000000000002" });
    const duplicate = fixture(); duplicate.envelope.observations.push(duplicate.envelope.observations[0]);
    for (const f of [missing, additional, duplicate]) expect(() => read(f)).toThrow(/requested rows/);
  });

  it("rejects a changed immutable source hash and duplicate selection pins", () => {
    const changed = fixture(); changed.envelope.observations[0].source_hash = "b".repeat(64);
    expect(() => read(changed)).toThrow(/requested rows/);
    const duplicate = fixture(); duplicate.pin.rows.push(duplicate.pin.rows[0]);
    expect(() => read(duplicate)).toThrow(/Duplicate/);
  });

  it("rejects wrong project, season or player despite an internally consistent file hash", () => {
    const project = fixture(); project.envelope.projectId = "a".repeat(20);
    expect(() => read(project)).toThrow(/project or clock/);
    const season = fixture(); season.envelope.observations[0].season_id = 20252026;
    const player = fixture(); player.envelope.observations[0].fhfh_player_id = 9001;
    for (const f of [season, player]) expect(() => read(f)).toThrow(/identity/);
  });

  it("preserves exact capture/read and cutoff/capture microsecond boundaries", () => {
    const future = fixture(); future.envelope.capturedAt = "2026-11-12T14:00:00.000001Z";
    const cutoff = fixture(); cutoff.pin.sourceCutoff = "2026-11-12T13:00:00.000001Z";
    for (const f of [future, cutoff]) expect(() => read(f)).toThrow(/clock mismatch/);
    const source = fixture(); source.envelope.observations[0].created_at = "2026-11-12T12:00:00.000001Z";
    expect(read(source).admission.records[0].reasons).toContain("source_clock_invalid");
  });

  it("rejects a cap-sentinel row and oversized source coordinates", () => {
    const cap = fixture(); cap.envelope.observations = Array(33).fill(cap.envelope.observations[0]);
    expect(() => read(cap)).toThrow();
    const text = fixture(); text.envelope.observations[0].source_key = "é".repeat(257);
    expect(() => read(text)).toThrow(/coordinate exceeds/);
    const padded = fixture(); padded.envelope.observations[0].source_key = " ".repeat(512) + "key";
    expect(() => read(padded)).toThrow(/coordinate exceeds/);
  });

  it("rejects invented coverage in the transport envelope", () => {
    const f = fixture(); const body = JSON.stringify({ ...f.envelope, membershipComplete: true });
    const pin = { ...f.pin, sha256: createHash("sha256").update(body).digest("hex") };
    expect(() => readMembershipInventory(body, pin)).toThrow();
  });
});
