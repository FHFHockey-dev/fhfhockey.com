/** Synthetic in-memory evidence for the five-appearance contract. Never install these pins. */
import { createHash } from "node:crypto";
import { PRODUCTION_INPUTS, type CurrentInputRequest } from "./currentInput";
import { PRODUCTION_REFERENCE_VERSION } from "./productionReference";
import { processEvidenceRowSHA256, type ProcessEvidencePolicy } from "./currentProcessEvidence.server";
import { REVIEWED_FIVE_GAME_VERSION } from "./reviewedFiveGameWindow.server";

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const groups = ["individual", "onIce"] as const;
export function createReviewedFiveGameFixture(referencePacketBytes = json({ synthetic: "reference" }),
  scorerVersion = "support-conditioned-production-gap-v1", mapperVersion = "blsh-display-profile-v3", productionMethod: "zero_assist" | "summary" = "zero_assist", originalPrimaryAssists?: number) {
  const artifacts = new Map<string, Uint8Array>();
  const put = (b: Uint8Array) => { const h = createHash("sha256").update(b).digest("hex"); artifacts.set(h, b); return h; };
  const save = (v: unknown) => put(json(v));
  const seasonId = 20262027, playerId = 8470001, evaluatedAtUTC = "2026-11-07T12:00:00.000Z", asOfUTC = "2026-11-07T11:00:00.000Z";
  const dates = ["2026-10-29", "2026-10-31", "2026-11-02", "2026-11-04", "2026-11-06"], eventThroughDate = dates[4];
  const team = "TST", producerSHA256 = save("fixture producer"), redactorSHA256 = save("fixture redactor"), definitionSHA256 = save("fixture definition");
  const processAcceptances: ProcessEvidencePolicy["acceptances"][number][] = [];
  const packets = dates.map((date, i) => {
    const at = date + "T23:00:00.000Z", evaluated = date + "T23:30:00.000Z", reviewed = date + "T23:25:00.000Z", framed = date + "T23:15:00.000Z", sourceId = 101 + i, gameId = 2026020101 + i;
    const capture = (source: NonNullable<CurrentInputRequest["calendar"]>["capture"]["source"]) =>
      ({ source, sha256: save({ date, source }), retrievedAtUTC: at, sourceAvailableThroughUTC: null, revisionId: null });
    const wgoRow = { id: sourceId, player_id: playerId, game_id: gameId, date, season_id: seasonId, player_name: "Synthetic Window Skater", team_abbrev: team,
      position_code: "F", games_played: 1, toi_per_game: 900, es_toi_per_game: 800, pp_toi_per_game: 100,
      counts: { ...Object.fromEntries(Object.values(PRODUCTION_INPUTS).flat().map(k => [k, 0])), points: productionMethod === "summary" ? 1 : 0, assists: productionMethod === "summary" ? 1 : 0, total_primary_assists: originalPrimaryAssists ?? (productionMethod === "summary" ? 1 : 0), pp_points: productionMethod === "summary" ? 1 : 0, shots: 2 } };
    const common = { player_id: playerId, season: seasonId, date_scraped: date, gp: 1, toi: 900 };
    const scope = { strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown" } as const;
    const request: CurrentInputRequest = { seasonId, eventThroughDate: date, asOfUTC: at,
      freshnessPolicy: { id: "blsh-capture-reader-v1-event7days-capture24hours", maxEventAgeDays: 7, maxCaptureAgeHours: 24 },
      calendar: { capture: capture("public.games"), rows: [{ id: gameId, seasonId, date, type: 2 }] },
      wgo: { capture: capture("public.wgo_skater_stats"), rows: [wgoRow] },
      individual: { ...scope, capture: capture("public.nst_gamelog_as_counts"), rows: [{ id: 201 + i, ...common, ixg: 0.2, goals: 0, shots: 2 }] },
      onIce: { ...scope, capture: capture("public.nst_gamelog_as_counts_oi"), rows: [{ id: 301 + i, ...common, xgf: 1, xga: 0.4 }] } };
    for (const feed of ["wgo", "calendar", ...groups] as const) {
      const selected = request[feed]!;
      const records = selected.rows.map(row => {
        if (!("counts" in row)) return row;
        const { counts, ...context } = row;
        return { ...context, ...counts };
      });
      selected.capture.sha256 = save({ source: selected.capture.source, capturedAtUTC: at, snapshotUTC: at, records, columns: Object.keys(records[0]) });
    }
    const requestSHA256 = save(request), reviewSHA256 = save({ syntheticReview: date });
    const observedCounts = { goals: 0, assists: wgoRow.counts.assists, sog: 2, hits: 0, blockedShots: 0, powerPlayGoals: 0 };
    const officialBoxSHA256 = save({ id: gameId, season: seasonId, gameDate: date, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
      homeTeam: { abbrev: team }, awayTeam: { abbrev: "OTH" }, playerByGameStats: { homeTeam: { forwards: [{ playerId, toi: "15:00", ...observedCounts }], defense: [], goalies: [] },
        awayTeam: { forwards: [], defense: [], goalies: [] } } });
    const officialFrameSHA256 = save({ seasonId, playerId, gameId, date, team, final: true, gamesPlayed: 1, totalToiSeconds: 900,
      completedByUTC: date + "T22:00:00.000Z", observedAtUTC: framed, provenance: { boxscoreSHA256: officialBoxSHA256 } });
    const witnesses = groups.map(group => {
      const body = json({ date, group, synthetic: true }), nativeBodySHA256 = put(body);
      const row = request[group]!.rows[0];
      const url = "https://data.naturalstattrick.com/playerteams.php?" + new URLSearchParams({ fromseason: String(seasonId), thruseason: String(seasonId),
        stype: "2", sit: "all", score: "all", stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0",
        gpfilt: "gpdate", fd: date, td: date, lines: "single", draftteam: "ALL" });
      const nativeReceiptSHA256 = save({ url, status: "success", httpStatus: 200, TLSVerified: true, representation: "parser_input_after_redaction",
        parserInputSHA256: nativeBodySHA256, parserInputBytes: body.length, producerSHA256, redactorSHA256,
        toiParsingContract: "minutes_decimal_or_mmss_to_seconds_half_up", retrievedAtUTC: at });
      return { group, wgoSourceId: sourceId, processSourceId: row.id, playerId, gameId, date, team, wgoRowSHA256: processEvidenceRowSHA256(wgoRow),
        processRowSHA256: processEvidenceRowSHA256(row), nativeBodySHA256, nativeReceiptSHA256, producerSHA256, redactorSHA256, definitionSHA256,
        officialFrameSHA256, nativeValuesMatched: true, qualifiedScope: { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds" } };
    });
    const bundleSHA256 = save({ version: "fhfh.blsh.reviewed-process-evidence.v1", sourceRequestSHA256: requestSHA256, witnesses });
    processAcceptances.push({ requestSHA256, bundleSHA256, reviewSHA256, reviewScope: "exact_rows_native_cells_scope_and_model",
      requiredArtifactSHA256: [producerSHA256, redactorSHA256, definitionSHA256, officialFrameSHA256, reviewSHA256,
        ...witnesses.flatMap(w => [w.nativeBodySHA256, w.nativeReceiptSHA256])] });
    const fields = Object.fromEntries(Object.entries({ goals: 0, assists: observedCounts.assists, shots: 2, hits: 0, blocked_shots: 0 })
      .map(([key, value]) => [key, { state: "matched", official: value, method: "official_box_field" }]));
    fields.pp_points = { state: "matched", official: wgoRow.counts.pp_points, method: productionMethod === "summary" ? "retained_direct_PPP_report" : "official_box_zero_assist_check" };
    const summary = productionMethod === "summary" ? {
      observedAtUTC: framed, url: "https://api.nhle.com/stats/rest/en/skater/summary?" + new URLSearchParams({ isAggregate: "false", isGame: "true",
        start: "0", limit: "2", sort: '[{"property":"playerId","direction":"ASC"}]', factCayenneExp: "gamesPlayed>=1", cayenneExp: `gameId=${gameId} and gameTypeId=2 and playerId=${playerId}` }),
      bodySHA256: save({ total: 1, data: [{ playerId, gameId, gameDate: date, gamesPlayed: 1, teamAbbrev: team, timeOnIcePerGame: 900,
        goals: 0, assists: 1, shots: 2, points: 1, ppPoints: 1, ppGoals: 0, evPoints: 0, evGoals: 0, shPoints: 0, shGoals: 0 }] }),
    } : undefined;
    const productionReviewSHA256 = save({ version: "fhfh.blsh.row-production-review.v1", scope: "official_fhfh_operands_and_exact_wgo_game_score_primitives",
      sourceId, playerId, gameId, date, team, reviewedAtUTC: reviewed, requestSHA256, officialBoxSHA256, wgoRowSHA256: processEvidenceRowSHA256(wgoRow),
      fields, summary, wgoRevision: "wgo_db_raw", definitionSHA256: save({ version: "fhfh.blsh.reviewed-production-definition.v1", source: "public.wgo_skater_stats",
        track: "wigoGameScore", scorerVersion: PRODUCTION_REFERENCE_VERSION, revision: "wgo_db_raw", fields: PRODUCTION_INPUTS.wigoGameScore }) });
    const qualificationReceiptSHA256 = save({ version: "fhfh.blsh.original-row-qualification.v1", evidenceClass: "contemporaneous_gate_execution",
      outcome: "qualified_both_native_groups_and_production", rule: request.freshnessPolicy.id, gateVersion: "fhfh.blsh.current-process-provenance-gate.v1",
      playerId, gameId, sourceId, requestSHA256, bundleSHA256, productionReviewSHA256, processReviewSHA256: reviewSHA256, evaluatedAtUTC: evaluated });
    const member = { gameId, sourceId, requestSHA256, bundleSHA256, officialBoxSHA256, productionReviewSHA256, qualificationReceiptSHA256 };
    const revisionMember = { ...member, date, team, acquisitionAtUTC: at, originalEvaluationUTC: evaluated, officialFrameSHA256, wgoRowSHA256: processEvidenceRowSHA256(wgoRow),
      process: witnesses.map(w => ({ group: w.group, sourceId: w.processSourceId, rowSHA256: w.processRowSHA256, nativeBodySHA256: w.nativeBodySHA256,
        nativeReceiptSHA256: w.nativeReceiptSHA256, reviewSHA256 })) };
    return { member, revisionMember, inventoryGame: { gameId, wgo: structuredClone(wgoRow), official: { boxSHA256: officialBoxSHA256, seconds: 900, team },
      native: witnesses.map(w => ({ group: w.group, sourceId: w.processSourceId, rowSHA256: w.processRowSHA256, nativeBodySHA256: w.nativeBodySHA256 })),
      reviews: { productionReviewSHA256, processReviewSHA256: reviewSHA256, qualificationReceiptSHA256 } }, appearance: { gameId, gameDate: date, teamAbbrev: team, toi: "15:00" } };
  });
  const log = { seasonId, gameTypeId: 2, gameLog: packets.map(p => p.appearance).reverse() };
  const landing = { playerId, seasonTotals: [{ season: seasonId, gameTypeId: 2, leagueAbbrev: "NHL", gamesPlayed: packets.length }] };
  const census = { version: "fhfh.blsh.official-appearance-census.v1", playerId, seasonId, throughUTC: asOfUTC, observedAtUTC: asOfUTC,
    gameLogURL: `https://api-web.nhle.com/v1/player/${playerId}/game-log/${seasonId}/2`, gameLogSHA256: save(log),
    landingURL: `https://api-web.nhle.com/v1/player/${playerId}/landing`, landingSHA256: save(landing) };
  const censusSHA256 = save(census), referencePacketSHA256 = put(referencePacketBytes);
  const inventory = { version: "fhfh.blsh.authoritative-revision-inventory.v1", authorityId: "synthetic-source-custodian", playerId, seasonId, eventThroughDate,
    referencePacketSHA256, games: packets.map(p => p.inventoryGame),
    coverage: Object.fromEntries(["wgo", "official", "individual", "onIce", "activeReviews", "reference"].map(domain =>
      [domain, { state: "complete_for_selected_player_and_games", throughUTC: asOfUTC, observedAtUTC: asOfUTC }])) };
  const inventorySHA256 = save(inventory);
  const revision = { version: "fhfh.blsh.reviewed-window-revisions.v1", playerId, seasonId, throughUTC: asOfUTC, checkedAtUTC: asOfUTC,
    status: "all_selected_sources_and_reference_rechecked", inventorySHA256, referencePacketSHA256, censusSHA256, members: packets.map(p => p.revisionMember) };
  const revisionSHA256 = save(revision), target = { playerId, eventThroughDate };
  const manifest = { version: REVIEWED_FIVE_GAME_VERSION, ...target, seasonId, asOfUTC, builtAtUTC: asOfUTC,
    scorerVersion, mapperVersion, censusSHA256, revisionSHA256, referencePacketSHA256, members: packets.map(p => p.member) };
  const input = { target, manifestBytes: json(manifest), artifacts };
  const policy = { inventories: [{ ...target, authorityId: inventory.authorityId, inventorySHA256 }], originalQualifications: packets.map(p => ({ playerId, gameId: p.member.gameId, receiptSHA256: p.member.qualificationReceiptSHA256,
    evaluatedAtUTC: p.revisionMember.originalEvaluationUTC })), productionReviews: packets.map(p => ({ playerId, gameId: p.member.gameId, reviewSHA256: p.member.productionReviewSHA256 })), process: { acceptances: processAcceptances }, windows: [{ ...target, manifestSHA256: put(input.manifestBytes), censusSHA256, revisionSHA256 }] };
  return { input, policy, evaluatedAtUTC, manifest, census, revision, inventory, log, landing, save };
}
