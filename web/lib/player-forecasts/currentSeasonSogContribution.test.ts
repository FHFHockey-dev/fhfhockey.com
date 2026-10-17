// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleCurrentSeasonSogBaseline, CURRENT_SEASON_SOG_SCOPE as scope,
  CURRENT_SEASON_SOG_GAME_SCOPE_VERSION, type CurrentSeasonSogGameScope } from "./currentSeasonSogBaseline";
import { admitsCurrentSeasonSogContribution, buildCurrentSeasonSogContribution,
  buildCurrentSeasonSogContributionBundle, CURRENT_SEASON_SOG_INPUT_VERSION,
  type CurrentSeasonSogContributionInput } from "./currentSeasonSogContribution";
import { contributionBundleCandidateInputHash, contributionBundleChecksum, loadApprovedContributionBundle, persistContributionBundle } from "./contributionStore";
import { loadNativeContributionBundle } from "./nativeContributionAdmission";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import { resolveContribution } from "./contributions";
import { buildGameExpectations } from "./gameExpectations";
import type { PlanningData } from "../rosterScheduleOptimizer/planningTypes";

const now = new Date("2026-10-15T22:10:00Z"), issuedAt = "2026-10-15T22:05:00Z";
// Synthetic public-response fixtures only; none qualify genuine readback or publication.
function fixture() {
  const response = (payload: unknown, url: string) => { const rawBody = JSON.stringify(payload);
    return { rawBody, url, capturedAt: "2026-10-15T19:00:00Z", bodySha256: createHash("sha256").update(rawBody).digest("hex") }; };
  const games = [8, 10].map((day, i) => ({ id: 2026020001 + i, season: scope.seasonId, gameType: 2,
    gameDate: `2026-10-${String(day).padStart(2, "0")}`, startTimeUTC: `2026-10-${String(day).padStart(2, "0")}T23:00:00Z`,
    homeTeam: { id: 13 }, awayTeam: { id: 23 }, gameState: "OFF" }));
  const packet = assembleCurrentSeasonSogBaseline({ schedule: response({ games: [...games,
    { ...games[0], id: scope.targetGameId, gameDate: "2026-10-15", startTimeUTC: "2026-10-15T23:00:00Z", gameState: "FUT" }] },
  "https://api-web.nhle.com/v1/club-schedule-season/VAN/20262027"), boxscores: games.map((game, i) => response({ ...game,
    playerByGameStats: { homeTeam: { forwards: [{ playerId: 1 }], defense: [], goalies: [{ playerId: 2 }] },
      awayTeam: { forwards: [{ playerId: scope.nhlPlayerId, toi: "20:00", sog: i * 4 }], defense: [], goalies: [{ playerId: 3 }] } } },
  `https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`)) }, new Date("2026-10-15T20:00:00Z"));
  const binding: CurrentSeasonSogContributionInput["binding"] = { playerId: scope.playerId, nhlPlayerId: scope.nhlPlayerId, teamId: scope.teamId,
    seasonId: scope.seasonId, gameId: scope.targetGameId, scheduledAt: "2026-10-15T23:00:00Z",
    scheduleRevision: "a".repeat(64), rosterRevision: "b".repeat(64), observedAt: "2026-10-15T22:00:00Z" };
  const input: CurrentSeasonSogContributionInput = { version: CURRENT_SEASON_SOG_INPUT_VERSION, packet, binding };
  const source = buildCurrentSeasonSogContribution(input, issuedAt, now);
  const row = { provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player",
    entity_key: `20262027:${scope.playerId}`, available_at: binding.observedAt, payload_hash: hash(input), payload: input };
  return { input, source, row };
}
function database(replies: unknown[][]) {
  let i = 0;
  const query: any = { select: () => query, eq: () => query, in: () => query, limit: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: replies[i++] ?? [], error: null }).then(resolve) };
  return { from: () => query } as any;
}
function releasedFixture() {
  const f = fixture(), bundle = buildCurrentSeasonSogContributionBundle(f.input, issuedAt, now);
  const policyId = "11111111-1111-4111-8111-111111111111", reviewId = "22222222-2222-4222-8222-222222222222",
    bundleId = "33333333-3333-4333-8333-333333333333";
  const sources = bundle.sources.map(source => ({ ...source, released: true }));
  const { checksum: _checksum, ...initial } = bundle.manifest;
  const unsigned = { ...initial, released: true, evaluationPolicyId: policyId, reviewId };
  const published = { sources, manifest: { ...unsigned, checksum: contributionBundleChecksum({ manifest: unsigned, sources }) } };
  const candidateInputHash = contributionBundleCandidateInputHash(published);
  const policy = { version: "baseline-evaluation-policy-v1", seasonId: scope.seasonId, policyVersion: f.source.policyVersion,
    candidateInputHash, status: "owner_approved", allowedPublicUses: ["conditionalTieBreak"],
    prospectiveEvidenceRef: "synthetic source capture only", ownerApprovalRef: "synthetic conditional-use approval",
    approvedAt: "2026-10-15T22:01:00Z" };
  const review = { version: "baseline-validation-review-v1", seasonId: scope.seasonId, policyVersion: f.source.policyVersion,
    candidateInputHash, policyHash: hash(policy), bundleChecksum: published.manifest.checksum, status: "owner_approved",
    eligible: true, prospectiveEvidenceRef: policy.prospectiveEvidenceRef, ownerApprovalRef: policy.ownerApprovalRef,
    reviewedAt: "2026-10-15T22:06:00Z" };
  const receipt = <T>(id: string, dataset: string, kind: string, payload: T, at: string) => ({ id, provider: "fhfh",
    dataset_key: dataset, entity_kind: kind, entity_key: "20262027", available_at: at, payload_hash: hash(payload), payload });
  const bundleRow = receipt(bundleId, "contribution-bundle-v1", "seasonal_rate_bundle", published, issuedAt);
  const policyRow = receipt(policyId, "baseline-evaluation-policy-v1", "baseline_evaluation_policy", policy, policy.approvedAt);
  const reviewRow = receipt(reviewId, "baseline-validation-review-v1", "baseline_validation_review", review, review.reviewedAt);
  return { ...f, published, bundleRow, policyRow, reviewRow, environment: { PLAYER_FORECAST_BASELINE_RELEASE_IDS: bundleId } };
}

describe("current-season SOG one-game contribution adapter", () => {
  it("keeps original forecast clocks distinct from later binding/issuance and defaults unreleased", async () => {
    const { input, source } = fixture(), before = JSON.stringify(input);
    expect(source).toMatchObject({ mean: 2, gameId: scope.targetGameId, targetKey: "SHOTS_ON_GOAL", released: false,
      cutoffAt: "2026-10-15T20:00:00.000Z", issuedAt, expiresAt: "2026-10-15T23:00:00Z", participationIntegrated: false });
    expect(source.allowedUses).toBeUndefined();
    expect(source.limitations?.join(" ")).toContain("Original conditional forecast generated: 2026-10-15T20:00:00.000Z");
    expect(source.sourceWatermark).toBe(hash(input)); expect(source.sourceWatermark).not.toBe(input.packet.payloadHash);
    expect(JSON.stringify(input)).toBe(before);
    const bundle = buildCurrentSeasonSogContributionBundle(input, issuedAt, now);
    const noDatabase = new Proxy({}, { get() { throw new Error("Database forbidden"); } });
    expect(await persistContributionBundle(noDatabase as never, bundle)).toMatchObject({ dryRun: true, snapshotId: null });
    const later = buildCurrentSeasonSogContributionBundle(input, "2026-10-15T22:07:00Z", now);
    expect(contributionBundleCandidateInputHash(later)).toBe(contributionBundleCandidateInputHash(bundle));
  });
  it.each(["version", "mean", "body", "player", "nhl", "team", "season", "game", "start", "scheduleRevision",
    "rosterRevision", "earlyBinding", "futureBinding", "futureIssue", "expired"])("rejects %s input/clock before transport", kind => {
    const { input } = fixture(); let issue = issuedAt, asOf = now;
    if (kind === "version") input.version = "unknown" as never;
    if (kind === "mean") input.packet.target.mean = 999;
    if (kind === "body") input.packet.sourceReceipts.boxscores[0].rawBody += " ";
    if (kind === "player") input.binding.playerId++;
    if (kind === "nhl") input.binding.nhlPlayerId++;
    if (kind === "team") input.binding.teamId++;
    if (kind === "season") input.binding.seasonId = 20252026;
    if (kind === "game") input.binding.gameId++;
    if (kind === "start") input.binding.scheduledAt = "2026-10-15T23:00:00.000001Z";
    if (kind === "scheduleRevision") input.binding.scheduleRevision = "unverified";
    if (kind === "rosterRevision") input.binding.rosterRevision = "unverified";
    if (kind === "earlyBinding") input.binding.observedAt = "2026-10-15T19:59:59.999999Z";
    if (kind === "futureBinding") input.binding.observedAt = "2026-10-15T22:05:00.000001Z";
    if (kind === "futureIssue") issue = "2026-10-15T22:10:00.000001Z";
    if (kind === "expired") asOf = new Date("2026-10-15T23:00:00Z");
    expect(() => buildCurrentSeasonSogContribution(input, issue, asOf)).toThrow();
  });
  it("requires original native input reproduction even after adversarial rehashing", () => {
    const { source, row } = fixture(); source.released = true;
    expect(admitsCurrentSeasonSogContribution(source, row, now)).toBe(true);
    row.payload.packet.target.mean = source.mean = 999;
    row.payload_hash = source.sourceWatermark = hash(row.payload);
    source.sourceId = `baseline:${hash({ policyVersion: source.policyVersion, inputHash: source.sourceWatermark, targetKey: source.targetKey })}`;
    expect(admitsCurrentSeasonSogContribution(source, row, now)).toBe(false);
  });
  it.each(["game", "start", "schedule", "roster", "season", "nhl", "expiry"])("withholds a transported source with mismatched %s context", kind => {
    const { input, source } = fixture(); source.released = true;
    source.allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
    const game = { ...input.binding };
    if (kind === "game") game.gameId++;
    if (kind === "start") game.scheduledAt = "2026-10-15T23:00:00.000001Z";
    if (kind === "schedule") game.scheduleRevision = "c".repeat(64);
    if (kind === "roster") game.rosterRevision = "c".repeat(64);
    if (kind === "season") game.seasonId = 20252026;
    if (kind === "nhl") game.nhlPlayerId++;
    const result = resolveContribution({ game, targetKey: "SHOTS_ON_GOAL", now: kind === "expiry" ? source.expiresAt : now.toISOString(), baseline: source });
    expect(result.sourceKind).toBeNull(); expect(result.conditionalMean).toBeNull();
  });
  it("does not invent participation or blend the finite canary into a different forecast", () => {
    const { input, source } = fixture(); source.released = true;
    source.allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
    const participation = { ...input.binding, released: true, allowedUses: source.allowedUses, basis: "appearance" as const,
      probability: 1, revisionId: "synthetic-confirmation", cutoffAt: issuedAt, issuedAt, expiresAt: source.expiresAt };
    const conditional = resolveContribution({ game: input.binding, targetKey: "SHOTS_ON_GOAL", now: now.toISOString(), baseline: source, participation });
    expect(conditional.conditionalMean).toBe(2); expect(conditional.unconditionalMean).toBeNull();
    expect(conditional.participationRevisionId).toBeNull();
    expect(conditional.allowedUses).toEqual({ assignment: false, totals: false, comparison: false, conditionalTieBreak: true });
    const detailed = { ...source, kind: "detailed" as const, policyVersion: "existing-detailed-v1", mean: 10 };
    const selected = resolveContribution({ game: input.binding, targetKey: "SHOTS_ON_GOAL", now: now.toISOString(), baseline: source, detailed });
    expect(selected.sourceKind).toBe("detailed"); expect(selected.conditionalMean).toBe(10); expect(selected.blendWeight).toBeNull();
  });
  it("reads through existing explicit policy/review/native admission without DB writes", async () => {
    const f = releasedFixture();
    const result = await loadNativeContributionBundle(database([[f.bundleRow], [f.policyRow, f.reviewRow], [f.row]]),
      scope.seasonId, now, { environment: f.environment });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ gameId: scope.targetGameId, scheduledAt: f.input.binding.scheduledAt,
      mean: 2, allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: true } });
    const resolved = resolveContribution({ game: f.input.binding, targetKey: "SHOTS_ON_GOAL", now: now.toISOString(), baseline: result.sources[0] });
    expect(resolved.conditionalMean).toBe(2); expect(resolved.unconditionalMean).toBeNull();
    expect(resolved.participationRevisionId).toBeNull();
    const snapshot: PlanningData = { players: [{ id: String(scope.playerId), nhlId: scope.nhlPlayerId, nhlTeamId: scope.teamId,
      rosterRevision: f.input.binding.rosterRevision, name: "Synthetic SOG Skater", teamAbbreviation: "VAN", eligiblePositions: ["RW"],
      playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
    games: [scope.targetGameId, scope.targetGameId + 1].map((id, index) => ({ id: String(id), date: index ? "2026-10-17" : "2026-10-15",
      startsAt: index ? "2026-10-17T23:00:00Z" : f.input.binding.scheduledAt, teamAbbreviation: "VAN", opponent: "FLA", home: false,
      status: "scheduled" as const, scheduleRevision: f.input.binding.scheduleRevision })), forecasts: [], baselineSources: result.sources,
    evidence: { schedule: { source: "synthetic", seasonId: scope.seasonId, asOf: now.toISOString(), completeness: "complete", limitations: [] } } };
    const view = buildGameExpectations(snapshot, { seasonId: scope.seasonId, startDate: "2026-10-15", endDate: "2026-10-18",
      timeZone: "UTC", mode: "next_n", games: 2 }, now);
    expect(view.players[0].games.map(game => game.targets.SHOTS_ON_GOAL.conditional)).toEqual([2, null]);
    expect(view.players[0].games[0].targets.SHOTS_ON_GOAL.sources[0].methodVersion).toBe(f.source.policyVersion);
    expect(view.players[0].totals.SHOTS_ON_GOAL.expected).toBeNull();
    expect(view.players[0].expectedAppearances).toBeNull();
  });
  it("keeps default serving disabled and rejects permission broadening", async () => {
    const f = releasedFixture();
    expect((await loadApprovedContributionBundle(database([]), scope.seasonId, now, { environment: {} })).sources).toEqual([]);
    f.policyRow.payload.allowedPublicUses.push("comparison"); f.policyRow.payload_hash = hash(f.policyRow.payload);
    expect((await loadApprovedContributionBundle(database([[f.bundleRow], [f.policyRow, f.reviewRow]]), scope.seasonId, now,
      { environment: f.environment })).sources).toEqual([]);
  });
  it.each(["gameId", "scheduledAt"])("preserves legacy strict shape rejection for an explicit null %s", async field => {
    const { input } = fixture(), initial = buildCurrentSeasonSogContributionBundle(input, issuedAt, now);
    const source = { ...initial.sources[0], policyVersion: "synthetic-legacy-global-v1" };
    delete source.gameId; delete source.scheduledAt;
    const { checksum: _checksum, ...base } = initial.manifest;
    const manifest = { ...base, policyVersion: source.policyVersion };
    const sources = [{ ...source, [field]: null }];
    const bundle = { sources: sources as any, manifest: { ...manifest,
      checksum: contributionBundleChecksum({ manifest, sources: sources as any }) } };
    const noDatabase = new Proxy({}, { get() { throw new Error("Database forbidden"); } });
    await expect(persistContributionBundle(noDatabase as never, bundle)).rejects.toThrow(/Invalid or incomplete/);
  });
});

describe("explicit future-game SOG contribution replay (synthetic only)", () => {
  const asOf = new Date("2026-10-20T22:10:00Z"), issue = "2026-10-20T22:05:00Z";
  function futureFixture() {
    const { input } = fixture(), receipts = input.packet.sourceReceipts;
    const requested: CurrentSeasonSogGameScope = { ...scope, scopeVersion: CURRENT_SEASON_SOG_GAME_SCOPE_VERSION,
      targetGameId: 2026020200, targetGameDate: "2026-10-20", targetStartTimeUTC: "2026-10-20T23:00:00Z",
      isHome: false, cutoffAt: "2026-10-20T20:00:00.000Z", expiresAt: "2026-10-20T23:00:00Z" };
    for (const row of [receipts.schedule, ...receipts.boxscores]) row.capturedAt = "2026-10-20T19:00:00Z";
    const schedule = JSON.parse(receipts.schedule.rawBody);
    Object.assign(schedule.games[2], { id: requested.targetGameId, gameDate: requested.targetGameDate,
      startTimeUTC: requested.targetStartTimeUTC });
    receipts.schedule.rawBody = JSON.stringify(schedule);
    receipts.schedule.bodySha256 = createHash("sha256").update(receipts.schedule.rawBody).digest("hex");
    input.packet = assembleCurrentSeasonSogBaseline(receipts, new Date(requested.cutoffAt), requested);
    Object.assign(input.binding, { gameId: requested.targetGameId, scheduledAt: requested.targetStartTimeUTC,
      observedAt: "2026-10-20T22:00:00Z" });
    return input;
  }
  it("replays at the original declared cutoff, binds later issuance and retains conditional-only permission", () => {
    const input = futureFixture(), before = JSON.stringify(input);
    const source = buildCurrentSeasonSogContribution(input, issue, asOf);
    expect(source).toMatchObject({ gameId: 2026020200, mean: 2, cutoffAt: "2026-10-20T20:00:00.000Z",
      issuedAt: issue, expiresAt: "2026-10-20T23:00:00Z", released: false, participationIntegrated: false });
    expect(source.allowedUses).toBeUndefined();
    source.released = true;
    source.allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
    const resolved = resolveContribution({ game: input.binding, targetKey: "SHOTS_ON_GOAL", now: asOf.toISOString(), baseline: source });
    expect(resolved.conditionalMean).toBe(2); expect(resolved.unconditionalMean).toBeNull();
    expect(resolved.participationRevisionId).toBeNull();
    expect(resolved.allowedUses).toEqual({ assignment: false, totals: false, comparison: false, conditionalTieBreak: true });
    const next = { ...input.binding, gameId: 2026020201 };
    expect(resolveContribution({ game: next, targetKey: "SHOTS_ON_GOAL", now: asOf.toISOString(), baseline: source }).conditionalMean).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["player", "nhl", "team", "season", "game", "start", "history", "cutoff", "expiry", "scopeVersion",
    "dropScopeVersion", "tamperMean", "expired", "invalidIssue"])("rejects %s tampering even with rehashed input", kind => {
    const input = futureFixture(); let at = asOf, issued = issue;
    if (kind === "player") input.binding.playerId++;
    if (kind === "nhl") input.binding.nhlPlayerId++;
    if (kind === "team") input.binding.teamId++;
    if (kind === "season") input.binding.seasonId = 20252026;
    if (kind === "game") input.binding.gameId++;
    if (kind === "start") input.binding.scheduledAt = "2026-10-20T23:00:00.000001Z";
    if (kind === "history") (input.packet.scope as CurrentSeasonSogGameScope).startDate = "2026-10-09";
    if (kind === "cutoff") input.packet.cutoffAt = "2026-10-20T20:00:01.000Z";
    if (kind === "expiry") input.packet.expiresAt = "2026-10-21T23:00:00Z";
    if (kind === "scopeVersion") (input.packet.scope as any).scopeVersion = "unknown";
    if (kind === "dropScopeVersion") delete (input.packet.scope as any).scopeVersion;
    if (kind === "tamperMean") input.packet.target.mean = 999;
    if (kind === "expired") at = new Date(input.packet.expiresAt);
    if (kind === "invalidIssue") issued = "invalid";
    const { payloadHash: _oldHash, ...unsigned } = input.packet;
    input.packet.payloadHash = hash(unsigned);
    expect(() => buildCurrentSeasonSogContribution(input, issued, at)).toThrow();
    const row = { provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player",
      entity_key: `20262027:${scope.playerId}`, available_at: input.binding.observedAt, payload_hash: hash(input), payload: input };
    const source = buildCurrentSeasonSogContribution(futureFixture(), issue, asOf);
    source.sourceWatermark = row.payload_hash;
    if (kind === "invalidIssue") source.issuedAt = issued;
    expect(admitsCurrentSeasonSogContribution(source, row, at)).toBe(false);
  });
});
