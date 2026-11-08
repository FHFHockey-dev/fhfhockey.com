import { createHash } from "node:crypto";
import { createCurrentProcessEvidenceGate, processEvidenceRowSHA256, type ProcessEvidencePolicy } from "./currentProcessEvidence.server";
import { PRODUCTION_INPUTS, type CurrentInputRequest } from "./currentInput";

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
type Group = "individual" | "onIce";
const groups: Group[] = ["individual", "onIce"];
const AT = "2026-11-01T20:00:00Z";
function seed() {
  const capture = (source: "public.games" | "public.wgo_skater_stats" | "public.nst_gamelog_as_counts" | "public.nst_gamelog_as_counts_oi") => ({
    source, sha256: "a".repeat(64), retrievedAtUTC: "2026-11-01T19:00:00Z", sourceAvailableThroughUTC: null, revisionId: null,
  });
  const request: CurrentInputRequest = {
    seasonId: 20262027, eventThroughDate: "2026-10-31", asOfUTC: "2026-11-01T20:00:00Z",
    freshnessPolicy: { id: "synthetic-test-only", maxEventAgeDays: 7, maxCaptureAgeHours: 24 },
    calendar: { capture: capture("public.games"), rows: [{ id: 2026020001, seasonId: 20262027, date: "2026-10-31", type: 2 }] },
    wgo: { capture: capture("public.wgo_skater_stats"), rows: [{ id: 1, player_id: 8470001, game_id: 2026020001, season_id: 20262027,
      date: "2026-10-31", player_name: "Synthetic Player", team_abbrev: "TST", position_code: "F", games_played: 1,
      toi_per_game: 900, es_toi_per_game: 800, pp_toi_per_game: 100,
      counts: { ...Object.fromEntries(Object.values(PRODUCTION_INPUTS).flat().map(k => [k, 0])), points: 0 } }] },
    individual: { capture: capture("public.nst_gamelog_as_counts"), strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown",
      rows: [{ id: 2, player_id: 8470001, season: 20262027, date_scraped: "2026-10-31", gp: 1, toi: 900, ixg: 0, goals: 0, shots: 0 }] },
    onIce: { capture: capture("public.nst_gamelog_as_counts_oi"), strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown",
      rows: [{ id: 3, player_id: 8470001, season: 20262027, date_scraped: "2026-10-31", gp: 1, toi: 900, xgf: 0, xga: 0 }] },
  };
  const producer = bytes({ synthetic: "producer" }), redactor = bytes({ synthetic: "redactor" });
  const bodies = { individual: Buffer.from("SYNTHETIC native individual fixture; not provider evidence"), onIce: Buffer.from("SYNTHETIC native on-ice fixture; not provider evidence") };
  const receipt = (group: Group) => ({
    url: "https://data.naturalstattrick.com/playerteams.php?" + new URLSearchParams({ fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all", stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0", gpfilt: "gpdate", fd: "2026-10-31", td: "2026-10-31", lines: "single", draftteam: "ALL" }),
    status: "success", httpStatus: 200, TLSVerified: true, representation: "parser_input_after_redaction",
    parserInputSHA256: sha(bodies[group]), parserInputBytes: bodies[group].byteLength,
    producerSHA256: sha(producer), redactorSHA256: sha(redactor), retrievedAtUTC: "2026-11-01T19:10:00Z",
    toiParsingContract: "minutes_decimal_or_mmss_to_seconds_half_up",
  });
  return { request, bodies, producer, redactor, receipts: { individual: receipt("individual"), onIce: receipt("onIce") },
    frame: { seasonId: 20262027, playerId: 8470001, gameId: 2026020001, date: "2026-10-31", team: "TST", final: true,
      gamesPlayed: 1, totalToiSeconds: 900, completedByUTC: "2026-10-31T23:00:00Z", observedAtUTC: "2026-11-01T19:15:00Z" },
    overrides: { individual: {}, onIce: {} } as Record<Group, Record<string, unknown>> };
}
function fixture(change?: (s: ReturnType<typeof seed>) => void) {
  const s = seed(); change?.(s);
  const artifacts = new Map<string, Uint8Array>();
  const add = (b: Uint8Array) => { const key = sha(b); artifacts.set(key, b); return key; };
  const producer = add(s.producer), redactor = add(s.redactor), frame = add(bytes(s.frame));
  const definition = add(bytes({ synthetic: true, acceptedUse: "exact fixture cells/scope/model", publicationUTC: null }));
  const review = add(bytes({ synthetic: true, reviewScope: "exact_rows_native_cells_scope_and_model" }));
  const requestBytes = bytes(s.request);
  const witnesses = groups.filter(g => s.request[g] !== null).map(group => ({
    group, wgoSourceId: 1, processSourceId: s.request[group]!.rows[0].id,
    playerId: 8470001, gameId: 2026020001, date: "2026-10-31", team: "TST",
    wgoRowSHA256: processEvidenceRowSHA256(s.request.wgo!.rows[0]), processRowSHA256: processEvidenceRowSHA256(s.request[group]!.rows[0]),
    nativeBodySHA256: add(s.bodies[group]), nativeReceiptSHA256: add(bytes(s.receipts[group])),
    producerSHA256: producer, redactorSHA256: redactor, definitionSHA256: definition, officialFrameSHA256: frame,
    nativeValuesMatched: true, qualifiedScope: { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds" }, ...s.overrides[group],
  }));
  const bundle = { version: "fhfh.blsh.reviewed-process-evidence.v1", sourceRequestSHA256: sha(requestBytes), witnesses };
  const bundleBytes = bytes(bundle);
  const policy: ProcessEvidencePolicy = { acceptances: [{ bundleSHA256: sha(bundleBytes), requestSHA256: sha(requestBytes), reviewSHA256: review,
    reviewScope: "exact_rows_native_cells_scope_and_model", requiredArtifactSHA256: [...artifacts.keys()] }] };
  return { s, requestBytes, bundle, bundleBytes, artifacts, policy };
}
const evaluate = (f: ReturnType<typeof fixture>) => createCurrentProcessEvidenceGate(f.policy)(f.requestBytes, AT, f.bundleBytes, f.artifacts);
function repack(f: ReturnType<typeof fixture>) {
  f.bundleBytes = bytes(f.bundle);
  f.policy = { acceptances: [{ ...f.policy.acceptances[0], bundleSHA256: sha(f.bundleBytes) }] };
}


export { fixture, AT };
