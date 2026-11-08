// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CURRENT_INPUT_SEASON, PRODUCTION_INPUTS, qualifyCurrentResearchInputs, type Capture, type CurrentInputRequest } from "./currentInput";
import { assembleProfiles, currentSlot, devSlot, windowEvidence, type DevRow } from "./currentWindows";
import { explainSupportGap, type TrainingBlock } from "./supportGap";

const day = (start: string, n: number) => new Date(Date.parse(`${start}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const stats = (i: number, pid: number) => ({
  goals: (i + pid) % 3 === 0 ? 1 : 0, assists: (i * pid) % 4 === 0 ? 1 : 0, pp_points: i % 5 === 0 ? 1 : 0, shots: (i + pid) % 5, hits: i % 3, blocked_shots: (i + 1) % 2,
  total_primary_assists: (i * pid) % 4 === 0 ? 1 : 0, total_secondary_assists: 0, penalties_drawn: i % 2, penalties: (i + 1) % 3 === 0 ? 1 : 0, total_fow: 0, total_fol: 0,
  sat_for: 8 + (i % 4), sat_against: 7 + (pid % 3), es_goals_for: (i + pid) % 3 === 0 ? 1 : 0, pp_goals_for: 0, sh_goals_for: 0, es_goals_against: i % 4 === 0 ? 1 : 0, pp_goals_against: 0, sh_goals_against: 0,
});
function devRows(pid: number, n = 50, overrides: (i: number) => Partial<DevRow> = () => ({})): DevRow[] {
  return Array.from({ length: n }, (_, i) => {
    const toi = 900 + 10 * ((i + pid) % 7);
    return { id: pid * 1000 + i, player_id: pid, season_id: 20232024, date: day("2023-10-10", i), position_code: "C", team_abbrev: "AAA", games_played: 1, _research_correction_status: "not_target_raw_complete",
      toi_per_game: toi, es_toi_per_game: toi - 100, pp_toi_per_game: 100, ...stats(i, pid),
      nst_individual: [{ nst_gp: 1, nst_toi: toi, nst_ixg: 0.1 + 0.02 * ((i + pid) % 5) }], nst_onice: [{ gp: 1, toi, xgf: 0.6 + 0.05 * (i % 3), xga: 0.5 + 0.05 * (pid % 3) }], ...overrides(i) };
  });
}
function blocks(): TrainingBlock[] {
  const x = [[1, 2, 3], [2, 1, 3], [3, 2, 2], [1, 4, 1], [2, 2, 4], [4, 3, 2]], coefficient = [[1, 0.2, 0.1], [0.3, 0.1, 0.2], [0.1, 0.05, -0.1]];
  return [11, 12].flatMap(pid => x.map((row, k) => ({ player_id: pid, position: "F", season_id: 20222023, source_ids: [0, 1, 2, 3, 4].map(j => pid * 1000 + 5 * k + j),
    dates: [0, 1, 2, 3, 4].map(j => day("2023-01-01", 5 * k + j)), seconds: 5000 + 100 * k, X: row, Y: [0, 1, 2].map(c => row.reduce((s, v, i) => s + v * coefficient[i][c], 0) + 10 * pid),
    qualified_process_exposure: true, teams: Array(5).fill("AAA"), positions: Array(5).fill("F") })));
}
function request(pid: number, games: number, edit: (row: Record<string, any>, i: number) => void = () => {}): CurrentInputRequest {
  const capture = (source: Capture["source"]): Capture => ({ source, sha256: "a".repeat(64), retrievedAtUTC: "2026-10-08T00:00:00Z", sourceAvailableThroughUTC: null, revisionId: null });
  const wgo = Array.from({ length: games }, (_, i) => {
    const row: Record<string, any> = { id: 500 + i, player_id: pid, game_id: 2026020001 + i, season_id: CURRENT_INPUT_SEASON, date: day("2026-10-01", i), player_name: "Test Player",
      team_abbrev: "AAA", position_code: "C", games_played: 1, toi_per_game: 960, es_toi_per_game: 840, pp_toi_per_game: 120, counts: {} as Record<string, number | null> };
    const s = stats(i, pid) as Record<string, number>;
    for (const f of Object.values(PRODUCTION_INPUTS).flat()) row.counts[f] = s[f];
    edit(row, i);
    return row;
  });
  return {
    seasonId: CURRENT_INPUT_SEASON, eventThroughDate: "2026-10-07", asOfUTC: "2026-10-08T01:00:00Z", freshnessPolicy: { id: "synthetic", maxEventAgeDays: 7, maxCaptureAgeHours: 24 },
    calendar: { capture: capture("public.games"), rows: wgo.map(r => ({ id: r.game_id, seasonId: CURRENT_INPUT_SEASON, date: r.date, type: 2 })) },
    wgo: { capture: capture("public.wgo_skater_stats"), rows: wgo as never },
    individual: { capture: capture("public.nst_gamelog_as_counts"), strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds",
      rows: wgo.map((r, i) => ({ id: 800 + i, player_id: pid, season: CURRENT_INPUT_SEASON, date_scraped: r.date, gp: 1, toi: r.toi_per_game, ixg: 0.05 * (i % 3), goals: r.counts.goals, shots: r.counts.shots })) },
    onIce: { capture: capture("public.nst_gamelog_as_counts_oi"), strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds",
      rows: wgo.map((r, i) => ({ id: 900 + i, player_id: pid, season: CURRENT_INPUT_SEASON, date_scraped: r.date, gp: 1, toi: r.toi_per_game, xgf: 0.7, xga: 0.4 + 0.1 * (i % 2) })) },
  };
}
const history = [...devRows(1), ...devRows(2), ...devRows(3), ...devRows(10)];
const run = (req: CurrentInputRequest, arm: "A_development_reference" | "B_development_plus_2026_prefix" = "A_development_reference") =>
  assembleProfiles({ current: qualifyCurrentResearchInputs(req, null).records, history, blocks: blocks(), arm, eventThroughDate: req.eventThroughDate });

describe("currentWindows slots", () => {
  it("applies the disclosed history gate and keeps genuine zeros", () => {
    const [ok] = devRows(1, 1, () => ({ nst_individual: [{ nst_gp: 1, nst_toi: 960, nst_ixg: 0 }], toi_per_game: 960 }));
    expect(devSlot(ok).ixG).toBe(0);
    const [mismatch] = devRows(1, 1, () => ({ nst_individual: [{ nst_gp: 1, nst_toi: 959, nst_ixg: 0.2 }], toi_per_game: 960 }));
    expect(devSlot(mismatch)).toMatchObject({ ixG: null });
    expect(devSlot(mismatch).reasons).toContain("history_nst_individual_gate_failed");
    const [absent] = devRows(1, 1, () => ({ nst_onice: [] }));
    expect(devSlot(absent)).toMatchObject({ onIceXGF: null, onIceXGA: null });
    expect(devSlot(absent).reasons).toContain("history_nst_onice_absent");
  });
  it("uses the input checker's qualification for current slots", () => {
    const req = request(10, 1);
    (req.individual!.rows[0] as { toi: number }).toi = 900;
    const slot = currentSlot(qualifyCurrentResearchInputs(req, null).records[0]);
    expect(slot.ixG).toBeNull();
    expect(slot.reasons).toContain("individual:process_WGO_exposure_mismatch");
    expect(slot.tracks.every(v => v !== null)).toBe(true);
  });
});

describe("currentWindows profiles", () => {
  it("builds the last five games, a strictly earlier reference and a reconciled explanation", async () => {
    const [p] = await run(request(10, 6));
    expect(p.window.dates).toEqual(["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(p.window.seconds).toBe(5 * 960);
    expect(p.reference.personalN).toBe(50);
    expect(p.reference.dates.at(-1)! < p.window.dates[0]).toBe(true);
    expect(p.reference.staleDevelopmentReference).toBe(true);
    expect(p.result.value).not.toBeNull();
    expect(p.explanation.tracks).toHaveLength(3);
    p.explanation.tracks.forEach(t => expect(Math.abs(t.reconciliationResidual)).toBeLessThan(1e-9));
    expect(p.explanation.coverage.map(n => n.reason)).toContain("dry_run_simplified_gate_not_sealed_transport");
    expect(p.window.spanDays).toBe(4);
    expect(p.explanation.scoreWindow.identity).toEqual({ playerId: 10, currentSourceIds: p.window.sourceIds, referenceSourceIds: p.reference.sourceIds });
    const withheld = p.explanation.coverage.filter(n => n.component.endsWith("_window_context")).map(n => n.reason);
    expect(withheld).toEqual([]);
    // The synthetic stats give more assists than teammate on-ice goals; that must surface as a data conflict, not a number.
    expect(p.explanation.context.filter(x => x.status === "unavailable").map(x => [x.metric, x.reason])).toEqual([["assists_per_teammate_on_ice_goal", "assists_exceed_teammate_on_ice_goals_data_conflict"]]);
    expect(p.explanation.context.find(x => x.metric === "shots_per_60")!.revisionVerified).toBe(false);
    expect(p.exploratory).toBe(true);
  });
  it("withholds another player's or other games' windows when explaining an assembled profile", async () => {
    const req = request(10, 6), other = request(77, 6);
    const [p] = await run(req);
    const otherSlots = qualifyCurrentResearchInputs(other, null).records.map(currentSlot).slice(-5);
    const e = explainSupportGap(p.result, { current: windowEvidence(77, otherSlots), reference: null });
    expect(e.coverage.map(n => n.reason)).toContain("context_identity_differs_from_scored_window");
    const ownSlots = qualifyCurrentResearchInputs(req, null).records.map(currentSlot);
    const shifted = explainSupportGap(p.result, { current: windowEvidence(10, ownSlots.slice(0, 5)), reference: null });
    expect(shifted.coverage.map(n => n.reason)).toContain("context_identity_differs_from_scored_window");
    expect(p.production).toMatchObject({ player_id: 10, current_source_ids: p.window.sourceIds, reference_source_ids: p.reference.sourceIds });
  });
  it("labels on-ice goal revisions per game and marks mixed windows", () => {
    const rows = devRows(1, 2);
    rows[1]._research_correction_status = "evidence_corrected";
    expect(windowEvidence(1, rows.map(devSlot)).provenance.onIceGoals?.revision).toBe("mixed:official_evidence_corrected+wgo_raw");
    expect(windowEvidence(1, [devSlot(rows[0])]).provenance.onIceGoals?.revision).toBe("wgo_raw");
  });
  it("keeps each game's on-ice revision so equal mixed labels cannot hide opposite compositions", () => {
    const rows = devRows(1, 5).map((r, i) => ({ ...r, _research_correction_status: i === 0 ? "evidence_corrected" : "not_target_raw_complete" }));
    const flipped = rows.map((r, i) => ({ ...r, _research_correction_status: i === 0 ? "not_target_raw_complete" : "evidence_corrected" }));
    const [a, b] = [rows, flipped].map(x => windowEvidence(1, x.map(devSlot)).provenance.onIceGoals!);
    expect(a.revision).toBe(b.revision);
    expect(a.gameRevisions).toEqual(["official_evidence_corrected", "wgo_raw", "wgo_raw", "wgo_raw", "wgo_raw"]);
    expect(b.gameRevisions).toEqual(["wgo_raw", "official_evidence_corrected", "official_evidence_corrected", "official_evidence_corrected", "official_evidence_corrected"]);
  });
  it("validates counts and exposure per game so a negative value cannot cancel a positive one", () => {
    // Development rows: goals -1 and +1, ES seconds -100 and +100.
    const rows = devRows(1, 5, i => (i === 1 ? { goals: -1, es_toi_per_game: -100 } : i === 2 ? { goals: 1, es_toi_per_game: 1000 } : {}));
    const slots = rows.map(devSlot);
    expect(slots[1]).toMatchObject({ goals: null, esSeconds: null });
    expect(slots[1].reasons).toEqual(expect.arrayContaining(["invalid_goals", "invalid_es_toi"]));
    expect(windowEvidence(1, slots)).toMatchObject({ goals: null, esSeconds: null });
    // Current rows: the input checker leaves the tracks unqualified, and the slot leaves the counts unavailable.
    const req = request(10, 6, (r, i) => { if (i === 3) { r.counts.goals = -1; r.pp_toi_per_game = -120; } if (i === 4) r.counts.goals = 1; });
    const current = qualifyCurrentResearchInputs(req, null).records.map(currentSlot);
    expect(current[3]).toMatchObject({ goals: null, ppSeconds: null });
    expect(current[3].reasons).toEqual(expect.arrayContaining(["invalid_goals", "invalid_pp_toi"]));
    expect(windowEvidence(10, current.slice(-5))).toMatchObject({ goals: null, ppSeconds: null });
  });
  it("reports invalid current and reference games as unavailable context with reasons, never a cancelled total", async () => {
    const bad = (i: number) => (i === 47 ? { goals: -1, assists: -1 } : i === 48 ? { goals: 1, assists: 1 } : {});
    const histories = [...devRows(1), ...devRows(2), ...devRows(3), ...devRows(10, 50, bad)];
    const req = request(10, 6, (r, i) => { if (i === 2) r.counts.goals = -1; if (i === 3) r.counts.goals = 1; });
    const [p] = await assembleProfiles({ current: qualifyCurrentResearchInputs(req, null).records, history: histories, blocks: blocks(), arm: "A_development_reference", eventThroughDate: req.eventThroughDate });
    expect(p.coverage).toEqual(expect.arrayContaining([{ component: "reference_slot", reason: "invalid_goals", count: 1 }, { component: "current_window_slot", reason: "invalid_goals", count: 1 }]));
    expect(p.production.current_goals).toBeNull();
    const finishing = p.explanation.context.find(x => x.metric === "goals_minus_individual_xG_per_60")!;
    expect(finishing).toMatchObject({ current: null, reference: null, reason: "goals_or_individual_xG_missing", referenceReason: "goals_or_individual_xG_missing" });
    expect(p.explanation.context.find(x => x.metric === "assists_per_teammate_on_ice_goal")!.reference).toBeNull();
  });
  it("adds only strictly earlier 2026 games to the reference in arm B", async () => {
    const [b] = await run(request(10, 6), "B_development_plus_2026_prefix");
    expect(b.reference.dates.at(-1)).toBe("2026-10-01");
    expect(b.reference.seasons).toEqual([20232024, 20262027]);
    expect(b.reference.dates.every(d => d < b.window.dates[0])).toBe(true);
  });
  it("scores a zero-shot player and keeps missing process as an estimate with a reason", async () => {
    const req = request(10, 5, r => { r.counts.shots = 0; });
    req.individual!.rows = req.individual!.rows.map((r, i) => ({ ...r, shots: 0, ixg: i === 4 ? r.ixg : 0 }));
    req.individual!.rows.splice(2, 1);
    const [p] = await run(req);
    expect(p.result.value).not.toBeNull();
    expect(p.result.process!.modes[0]).toBe("missing_current_linear_estimate");
    expect(p.coverage).toContainEqual({ component: "current_window_slot", reason: "individual:no_matching_process_record", count: 1 });
  });
  it("leaves the score unavailable when a window game has unknown exposure", async () => {
    const [p] = await run(request(10, 5, (r, i) => { if (i === 3) r.toi_per_game = null; }));
    expect(p.result.value).toBeNull();
    expect(p.result.status).toBe("unavailable");
    expect(p.coverage.map(c => c.reason)).toContain("missing_or_nonpositive_total_TOI");
  });
  it("uses a labelled cohort reference when the player has no history", async () => {
    const req = request(77, 5);
    const [p] = await run(req);
    expect(p.reference.personalN).toBe(0);
    expect(p.reference.reason).toBe("no_personal_history_cohort");
    expect(p.production.tier).toBe("cohort_reference");
    // The 2023-24-only history does not cover 2024-25 or 2025-26, so no games there is unknown, not zero.
    expect(p.reference).toMatchObject({ historyStatus: "unknown", missingSeasons: [20252026, 20242025], insufficientHistory: true, baseline: null });
    expect(p.comparisons.map(c => c.reference)).toEqual([[null, null, null], [null, null, null]]);
  });
  it("compares the window with the reference per game and per 60 in matching units", async () => {
    const [p] = await run(request(10, 6));
    const [perGame, perSixty] = p.comparisons;
    expect([perGame.unit, perSixty.unit]).toEqual(["per_game", "per_60"]);
    const y = p.production.raw_observed as number[];
    expect(perGame.window).toEqual(y.map(v => v / 5));
    expect(perSixty.window.map((v, j) => v! - (3600 * y[j]) / (5 * 960))).toEqual([0, 0, 0]);
    expect(p.reference.historyStatus).toBe("personal");
    // Arm A's reference: the last 50 2023-24 games, unweighted.
    const h = history.filter(r => r.player_id === 10).map(devSlot);
    expect(perGame.reference[1]).toBeCloseTo(h.reduce((a, s) => a + s.tracks[1]!, 0) / 50, 12);
    perGame.delta.forEach((d, j) => expect(d).toBeCloseTo(perGame.window[j]! - perGame.reference[j]!, 12));
  });
});

describe("currentWindows arm C (weighted personal baseline)", () => {
  // 2024-25 history beside the 2023-24 rows, as the database export supplies it.
  const later = (pid: number, n: number) => devRows(pid, n).map((r, i) => ({ ...r, id: pid * 1000 + 500 + i, season_id: 20242025, date: day("2024-10-10", i), _research_correction_status: "wgo_db_raw" }));
  const runC = (pid: number, rows: DevRow[], coveredSeasons?: number[]) =>
    assembleProfiles({ current: qualifyCurrentResearchInputs(request(pid, 7), null).records, history: rows, blocks: blocks(), arm: "C_weighted_personal_baseline", eventThroughDate: "2026-10-07", coveredSeasons });

  it("weights 2024-25 at 0.3, 2023-24 at 0.1 and pre-window 2026-27 games at 1.0, and labels the missing 2025-26 season", async () => {
    const [p] = await runC(10, [...history, ...later(10, 30)]);
    const b = p.reference.baseline!;
    expect(b.missingSeasons).toEqual([20252026]);
    expect(b.seasons.map(s => [s.season, s.games])).toEqual([[20252026, 0], [20242025, 30], [20232024, 50], [20262027, 2]]);
    const total = 0.3 * 30 + 0.1 * 50 + 1.0 * 2;
    expect(b.seasons.map(s => s.share)).toEqual([0, 0.3 * 30 / total, 0.1 * 50 / total, 1.0 * 2 / total].map(x => expect.closeTo(x, 12)));
    expect(p.reference).toMatchObject({ personalN: 82, historyStatus: "personal", missingSeasons: [20252026], insufficientHistory: false });
    expect(p.reference.dates.at(-1)! < p.window.dates[0]).toBe(true);
    expect(p.reference.sourceIds).toEqual(b.sourceIds);
    expect(p.production.reference_source_ids).toEqual(b.sourceIds);
    expect(p.comparisons[0].reference).toEqual(b.perGame);
    expect(p.comparisons[1].reference).toEqual(b.per60);
    expect(p.window.seconds).toBe(5 * 960);
    expect(p.result.value).not.toBeNull();
    p.explanation.tracks.forEach(t => expect(Math.abs(t.reconciliationResidual)).toBeLessThan(1e-9));
    expect(p.coverage).toContainEqual({ component: "reference_context", reason: "explanation_reference_totals_unweighted_over_baseline_games", count: 1 });
  });
  it("leaves 2022-23 games, four seasons back, out of a 2026-27 baseline", async () => {
    const old = devRows(10).map(r => ({ ...r, season_id: 20222023, date: day("2022-10-10", r.id % 1000) }));
    const [p] = await runC(10, [...history.filter(r => r.player_id !== 10), ...old]);
    // Two current-season games before the window are the only lookback games.
    expect(p.reference).toMatchObject({ personalN: 2, historyStatus: "personal", insufficientHistory: true });
    expect(p.reference.seasons).toEqual([20262027]);
  });
  describe("opportunity (decision 3)", () => {
    // PP points never exceed goals plus assists, so the PP split is defined for every game.
    const consistent = (rows: DevRow[]) => rows.map(r => ({ ...r, pp_points: Math.min(r.pp_points as number, (r.goals as number) + (r.assists as number)) }));
    const rows = consistent([...history, ...later(10, 30)]);
    const runPp = (windowPp: (i: number) => number | null) => assembleProfiles({ history: rows, blocks: blocks(), arm: "C_weighted_personal_baseline", eventThroughDate: "2026-10-07",
      current: qualifyCurrentResearchInputs(request(10, 7, (r, i) => {
        r.counts.pp_points = Math.min(r.counts.pp_points!, r.counts.goals! + r.counts.assists!);
        if (i >= 2) { r.pp_toi_per_game = windowPp(i); r.es_toi_per_game = windowPp(i) === null ? null : 960 - windowPp(i)!; }
      }), null).records });

    it("shows a PP promotion in the adjusted comparison, not in the per-game baseline", async () => {
      const [steady] = await runPp(() => 120), [promoted] = await runPp(() => 400);
      const g = (p: typeof steady) => p.opportunity.tracks[1];
      expect(promoted.opportunity.changes.pp.delta).toBeGreaterThan(0);
      expect(g(promoted).adjusted.available).toBe(true);
      // Same games and baseline: the per-game expectation is unchanged, the adjusted one rises with PP time.
      expect(g(promoted).perGame.expected).toBe(g(steady).perGame.expected);
      expect(g(promoted).adjusted.expected!).toBeGreaterThan(g(steady).adjusted.expected!);
      expect(promoted.opportunity.headline).toBe(promoted.opportunity.tracks[0].assessment);
      expect(promoted.opportunity).toMatchObject({ retrospective: true, forecast: false, trusted: false, calibratedProbability: null });
    });
    it("leaves the adjusted comparison unavailable when a window game has no PP time", async () => {
      const [p] = await runPp(i => (i === 4 ? null : 120));
      expect(p.opportunity.tracks[0].adjusted).toMatchObject({ available: false, reason: "window_pp_toi_unavailable", expected: null, gap: null });
      expect(p.opportunity.tracks[0].perGame.available).toBe(true);
      expect(p.opportunity.changes.pp.current).toBeNull();
    });
    it("keeps the window and later games out of the opportunity history", async () => {
      const [steady] = await runPp(() => 120), [promoted] = await runPp(() => 400);
      // The baseline PP time is the weighted mean of pre-window games only: 2024-25 and 2023-24 at
      // 100 s (history fixture) and two 2026-27 games at 120 s, whatever the window's PP time is.
      const expected = (0.3 * 30 * 100 + 0.1 * 50 * 100 + 1.0 * 2 * 120) / (0.3 * 30 + 0.1 * 50 + 1.0 * 2);
      expect(promoted.opportunity.changes.pp.baseline).toBeCloseTo(expected, 9);
      expect(steady.opportunity.changes.pp.baseline).toBe(promoted.opportunity.changes.pp.baseline);
      expect(promoted.opportunity.changes.pp.current).toBe(400);
    });
  });
  it("reports confirmed zero history only when every prior season is covered", async () => {
    const pre = (pid: number) => assembleProfiles({ current: qualifyCurrentResearchInputs(request(pid, 5), null).records, history, blocks: blocks(),
      arm: "C_weighted_personal_baseline", eventThroughDate: "2026-10-07", coveredSeasons: [20252026, 20242025, 20232024] });
    const [p] = await pre(77);
    expect(p.reference).toMatchObject({ personalN: 0, historyStatus: "confirmed_none", reason: "no_personal_history_cohort", missingSeasons: [] });
    expect(p.production.tier).toBe("cohort_reference");
    const [q] = await runC(77, history);
    expect(q.reference).toMatchObject({ personalN: 2, historyStatus: "personal", insufficientHistory: true });
    const [r] = await assembleProfiles({ current: qualifyCurrentResearchInputs(request(77, 5), null).records, history, blocks: blocks(), arm: "C_weighted_personal_baseline", eventThroughDate: "2026-10-07" });
    expect(r.reference).toMatchObject({ personalN: 0, historyStatus: "unknown", reason: "personal_history_unknown_cohort", missingSeasons: [20252026, 20242025] });
  });
});
