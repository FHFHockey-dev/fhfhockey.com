// One date and skater. These comparisons produce no v1 NativeReceipt or accepted witness.
import { isDeepStrictEqual } from "node:util";
import { readdirSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { load } from "cheerio";
import { GROUPS, MIB, SEASON, isHash, need, parseJson, readBound, sha, stamp } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs";

import { BUDGET, captureBinding, officialUrl, verifyOfficialTLS, liveRoots } from "./acquireV6Official.mjs";

import { evidenceMicros as micros, readHostedOfficialV6Export } from "./readHostedOfficialV6.mjs";
const reviewedCleanHostTool = "f11ca1bd86a057874513bd47d3507a7a9b2043c9656f71122a334e3a2b206e2c";
const TABLES = { wgo: "public.wgo_skater_stats", calendar: "public.games", individual: "public.nst_gamelog_as_counts", onIce: "public.nst_gamelog_as_counts_oi" };
const one = (rows, code) => { need(rows.length === 1, code); return rows[0]; };
const positive = n => Number.isSafeInteger(n) && n > 0;
const fields = { individual: ["gp", "toi", "goals", "shots", "ixg"], onIce: ["gp", "toi", "xgf", "xga"] };
const keys = (obj, names) => isDeepStrictEqual(Object.keys(obj).sort(), [...names].sort());

function literal(text, field) {
  if (field === "toi" && /^\d{1,3}:[0-5]\d$/.test(text)) {
    const [m, s] = text.split(":").map(Number);
    return m * 60 + s;
  }
  need(text.length <= 64 && /^\d+(?:\.\d+)?$/.test(text), "native_cell_unmeasured");
  if (field === "toi") {
    const [whole, fraction = ""] = text.split(".");
    const scale = 10n ** BigInt(fraction.length), seconds = BigInt(whole + fraction) * 60n;
    return Number((2n * seconds + scale) / (2n * scale));
  }
  const n = Number(text);
  need(Number.isFinite(n) && (!["gp", "goals", "shots"].includes(field) || Number.isSafeInteger(n)), "native_cell_invalid");
  return n;
}

function compareCells(body, group, playerId, team, stored) {
  const $ = load(new TextDecoder("utf-8", { fatal: true }).decode(body));
  const table = one($("table").toArray(), "native_table_ambiguous");
  const rows = $(table).find("tbody tr").toArray();
  need(rows.length > 0, "native_rows_missing");
  const width = $(rows[0]).children("td").length;
  const head = one($(table).find("thead tr").toArray().filter(tr => $(tr).children("th").length === width), "native_header_ambiguous");
  const heads = $(head).children("th").map((_, th) => $(th).text().replace(/\s+/g, "").toLowerCase()).get();
  for (const name of ["player", "team", ...fields[group]]) one(heads.filter(h => h === name), "native_required_column_ambiguous");
  const matching = [];
  for (const row of rows) {
    const cells = $(row).children("td").toArray();
    need(cells.length === width, "native_row_width_mismatch");
    const ids = [];
    for (const a of $(cells[heads.indexOf("player")]).find("a[href]").toArray()) {
      const url = new URL($(a).attr("href"), "https://www.naturalstattrick.com/");
      const values = url.searchParams.getAll("playerid");
      if (!values.length) continue;
      need(["https:", "http:"].includes(url.protocol) && ["www.naturalstattrick.com", "data.naturalstattrick.com", "naturalstattrick.com"].includes(url.hostname)
        && !url.port && !url.username && !url.password && url.pathname === "/playerreport.php" && values.length === 1 && /^\d+$/.test(values[0]), "native_player_link_ambiguous");
      ids.push(Number(values[0]));
    }
    if (ids.includes(playerId)) {
      need(ids.length === 1, "native_player_link_ambiguous");
      matching.push(cells);
    }
  }
  const cells = one(matching, "native_player_row_ambiguous");
  need($(cells[heads.indexOf("team")]).text().trim() === team, "native_team_mismatch");
  return Object.fromEntries(fields[group].map(name => {
    const rawText = $(cells[heads.indexOf(name)]).text().trim(), nativeValue = literal(rawText, name);
    need(Number.isFinite(stored[name]) && stored[name] >= 0 && stored[name] === nativeValue, "native_stored_cell_mismatch");
    return [name, { rawText, nativeValue, storedValue: stored[name] }];
  }));
}

// The capture, projection and review stages use the same replay of the complete slate.
export function deriveOfficialFrame(read, officialNames, day, target, pins, profile, runBytes, fixtureOnly = false) {
  const files = read("official/MANIFEST.json", 4 * MIB, pins.acquisitionManifestSHA256);
  const manifest = parseJson(files);
  need(manifest.status === "acquisition_complete_pending_review" && Array.isArray(manifest.files), "acquisition_incomplete");
  const games = [...day.games].sort((a, b) => a.id - b.id);
  need(games.length <= BUDGET.maxGames, "official_slate_bound");
  const names = ["ACQUISITION-RUNTIME.json", "ACQUISITION-PINS.json", "source-tool.mjs", ...games.flatMap((g, i) =>
    [`operation-${i + 1}-STARTED.json`, `boxscore-${g.id}.body.json`, `boxscore-${g.id}.receipt.json`])];
  need(isDeepStrictEqual(manifest.files.map(f => f.file).sort(), [...names].sort()), "acquisition_manifest_file_set");
  need(isDeepStrictEqual([...officialNames].sort(), ["MANIFEST.json", ...names].sort()), "acquisition_directory_file_set");
  const get = name => {
    const meta = manifest.files.find(f => f.file === name);
    need(isHash(meta.sha256) && positive(meta.bytes) && meta.bytes <= 4 * MIB, "acquisition_metadata_invalid");
    const bytes = read("official/" + name, meta.bytes, meta.sha256);
    need(bytes.length === meta.bytes, "acquisition_size_mismatch");
    return bytes;
  };
  const runtime = parseJson(get("ACQUISITION-RUNTIME.json")), pinBytes = get("ACQUISITION-PINS.json"), pinned = parseJson(pinBytes);
  // The separately pinned acquisition binary need not match the offline review machine's binary.
  need(isHash(pinned.nodeSHA256), "official_node_hash_invalid");
  const current = captureBinding(profile, runBytes, pinned.nodeSHA256), inputHash = sha(pinBytes);
  let expected = current;
  // The reviewed pre-extraction v2 launcher contained its own immutable transport.
  if (pinned.toolSHA256 === reviewedCleanHostTool) {
    const { transportSHA256, ...prior } = current;
    expected = { ...prior, toolSHA256: reviewedCleanHostTool };
  }
  need(isHash(pins.acquisitionPinsSHA256) && pins.acquisitionPinsSHA256 === inputHash
    && isDeepStrictEqual(pinned, expected) && expected.toolSHA256 === sha(get("source-tool.mjs")), "official_independent_capture_pins_mismatch");
  need(runtime.version === "fhfh.blsh.v6-official-acquisition-runtime.v1" && runtime.toolSHA256 === expected.toolSHA256
    && runtime.acquisitionPinsSHA256 === inputHash && manifest.acquisitionPinsSHA256 === inputHash
    && manifest.requests === games.length && manifest.retries === 0 && isDeepStrictEqual(games.map(g => g.id), expected.gameIds), "acquisition_runtime_source_mismatch");
  const klass = fixtureOnly ? "loopback_fixture_only" : "direct_https";
  need(runtime.acquisitionClass === klass && keys(runtime, ["version","acquisitionClass","acquisitionPinsSHA256","toolSHA256","rootStoreSHA256",
    "outputDirectory","startedAtUTC", ...(fixtureOnly ? ["fixtureCA"] : [])]), "official_acquisition_class_mismatch");
  need(fixtureOnly || (isAbsolute(runtime.outputDirectory) && basename(runtime.outputDirectory) === ".fhfh-blsh-official-v6-" + profile.sourceDate),
    "official_one_shot_directory_mismatch");
  const roots = fixtureOnly ? [runtime.fixtureCA] : liveRoots();
  need(sha(roots.join("\n")) === runtime.rootStoreSHA256 && (fixtureOnly || runtime.rootStoreSHA256 === expected.bundledCASHA256),
    "official_trust_store_mismatch");
  const started = micros(runtime.startedAtUTC), completed = micros(manifest.completedAtUTC);
  need(micros(expected.ledgerClosedAtUTC) <= started && started <= completed && completed <= micros(pins.evidenceAsOfUTC)
    && completed - started <= BUDGET.totalMs * 1000, "official_acquisition_chronology");
  return replayOfficialSlate({ games, get, target, pins, profile, runtime, inputHash, roots, klass, started, completed,
    provenance: { profileSHA256: pinned.profileSHA256, toolSHA256: pinned.toolSHA256 } });
}

export function deriveHostedOfficialFrame(directory, day, target, pins, profile, runBytes, fixtureOnly, keep) {
  const ledger = readHostedOfficialV6Export(directory, pins, profile, runBytes, fixtureOnly);
  const games = [...day.games].sort((a, b) => a.id - b.id);
  need(isDeepStrictEqual(games.map(game => game.id), ledger.gameIds), "official_hosted_native_slate_mismatch");
  if (keep) {
    keep("official-ledger-run.json", ledger.runBytes);
    keep("official-ledger-objects.json", ledger.objectsBytes);
    for (const [name, bytes] of ledger.files) keep("evidence-official-" + name, bytes);
  }
  return replayOfficialSlate({ ...ledger, games, get: name => ledger.files.get(name), target, pins, profile, inputHash: pins.acquisitionPinsSHA256 });
}

function replayOfficialSlate({games, get, target, pins, profile, runtime, inputHash, roots, klass, started, completed, provenance}) {
  const scheduleFact = profile.bodies.schedule;
  let previous = started;
  const matches = [], seenPlayers = new Set();
  for (const [i, game] of games.entries()) {
    const id = game.id, body = get(`boxscore-${id}.body.json`), receiptBytes = get(`boxscore-${id}.receipt.json`);
    const journalBytes = get(`operation-${i + 1}-STARTED.json`), journal = parseJson(journalBytes), box = parseJson(body), receipt = parseJson(receiptBytes);
    const url = officialUrl(id), observed = micros(receipt.retrievedAtUTC), began = micros(journal.startedAtUTC);
    need(keys(receipt, ["version","acquisitionPinsSHA256","journalSHA256","acquisitionStartedAtUTC","operation","url","finalUrl","method","httpStatus",
      "redirected","writeEvents","dispatchedAtUTC","retrievedAtUTC","sha256","bytes","tls"]) && receipt.version === "fhfh.blsh.v6-official-boxscore-receipt.v2"
      && keys(journal, ["operation","method","url","acquisitionPinsSHA256","startedAtUTC"]) && receipt.operation === i + 1 && journal.operation === i + 1 && receipt.journalSHA256 === sha(journalBytes)
      && journal.acquisitionPinsSHA256 === inputHash && receipt.acquisitionPinsSHA256 === inputHash && journal.method === "GET" && receipt.method === "GET"
      && receipt.url === url && receipt.finalUrl === url && journal.url === url && receipt.redirected === false && receipt.httpStatus === 200
      && receipt.sha256 === sha(body) && receipt.bytes === body.length && receipt.acquisitionStartedAtUTC === runtime.startedAtUTC
      && receipt.writeEvents === 1 && previous + (i ? BUDGET.spacingMs * 1000 : 0) <= began && observed - began <= BUDGET.perRequestTimeoutMs * 1000
      && observed <= completed, "official_receipt_or_chronology_mismatch");
    const dispatched = micros(receipt.dispatchedAtUTC), timeout = BUDGET.perRequestTimeoutMs * 1000;
    need(began <= dispatched && dispatched < began + timeout && dispatched <= observed
      && dispatched + timeout <= started + BUDGET.totalMs * 1000, "official_receipt_or_chronology_mismatch");
    verifyOfficialTLS(receipt.tls, roots, observed / 1000);
    previous = observed;
    need(box.id === id && box.gameDate === pins.sourceDate && box.season === SEASON && box.gameType === 2
      && ["FINAL", "OFF"].includes(box.gameState) && box.gameScheduleState === "OK", "official_game_scope");
    for (const side of ["homeTeam", "awayTeam"]) {
      const team = box[side]?.abbrev, roster = box.playerByGameStats?.[side];
      need(team === game[side].abbrev && box[side]?.id === game[side].id
        && ["forwards", "defense", "goalies"].every(position => Array.isArray(roster?.[position])), "official_roster_scope");
      let sideHasSkaterExposure = false;
      for (const position of ["forwards", "defense", "goalies"]) for (const player of roster[position]) {
        need(positive(player?.playerId), "official_player_identity");
        need(!seenPlayers.has(player.playerId), "official_player_date_ambiguous");
        seenPlayers.add(player.playerId);
        if (position !== "goalies") {
          need(typeof player.toi === "string" && /^\d{1,3}:[0-5]\d$/.test(player.toi), "official_skater_or_exposure_missing");
          if (literal(player.toi, "toi") > 0) sideHasSkaterExposure = true;
        }
        if (player.playerId !== target) continue;
        need(position !== "goalies" && /^\d{1,3}:[0-5]\d$/.test(player.toi), "official_skater_or_exposure_missing");
        const completedByUTC = scheduleFact.retrievedAtUTC;
        matches.push({ gameId: id, team, totalToiSeconds: literal(player.toi, "toi"), completedByUTC, observedAtUTC: receipt.retrievedAtUTC,
          goals: player.goals, shots: player.sog,
          boxscoreSHA256: sha(body), boxscoreReceiptSHA256: sha(receiptBytes) });
      }
      need(sideHasSkaterExposure, "official_roster_scope");
    }
  }
  const fact = one(matches, "official_player_date_ambiguous");
  need(positive(fact.totalToiSeconds) && [fact.goals,fact.shots].every(n => Number.isSafeInteger(n) && n >= 0), "official_skater_or_exposure_missing");
  const frame = { seasonId: SEASON, playerId: target, gameId: fact.gameId, date: profile.sourceDate, team: fact.team,
    final: true, gamesPlayed: 1, totalToiSeconds: fact.totalToiSeconds, completedByUTC: fact.completedByUTC, observedAtUTC: fact.observedAtUTC,
    gamesOnNativeDate: 1, dateMembershipComplete: true,
    provenance: { acquisitionClass: klass, runId: profile.runId, captureManifestSHA256: profile.manifestSHA256,
      acquisitionManifestSHA256: pins.acquisitionManifestSHA256, acquisitionPinsSHA256: inputHash, ...provenance, scheduleSHA256: scheduleFact.sha256, boxscoreSHA256: fact.boxscoreSHA256, boxscoreReceiptSHA256: fact.boxscoreReceiptSHA256 } };
  return { fact, frame };
}

export function compareV6ObservationInputs(profile, packetFiles, evidenceDir, pins, keep, runBytes, fixtureOnly, verifiedContext) {
  need(keys(pins, ["sourceDate", "runId", "playerId", "evidenceAsOfUTC", "contextSHA256", "requestSHA256", "frameSHA256", "acquisitionManifestSHA256", "acquisitionPinsSHA256",
    "contextRunId", "contextManifestSHA256", "contextDeploymentId", "contextGitCommitSha", ...(Object.hasOwn(pins,"hostedOfficial") ? ["hostedOfficial"] : [])])
    && pins.sourceDate === profile.sourceDate && pins.runId === profile.runId && positive(pins.playerId)
    && [pins.contextSHA256, pins.requestSHA256, pins.frameSHA256, pins.acquisitionManifestSHA256, pins.acquisitionPinsSHA256].every(isHash), "independent_observation_pins_invalid");
  const root = realpathSync(evidenceDir);
  function read(name, limit, pin) {
    const path = join(root, name);
    need(realpathSync(path) === path, "evidence_symlink_refused");
    const bytes = readBound(path, limit);
    need(sha(bytes) === pin, "independent_evidence_digest_mismatch");
    keep("evidence-" + name.replaceAll("/", "-"), bytes);
    return bytes;
  }
  function readContext(name, pin) {
    const bytes = verifiedContext.files.get(name);
    need(Buffer.isBuffer(bytes) && sha(bytes) === pin, "independent_context_digest_mismatch");
    keep("evidence-" + name, bytes);
    return bytes;
  }
  const { receipt: context, request } = verifiedContext;
  readContext("CURRENT-REQUEST.json", pins.requestSHA256);
  readContext("DB-CONTEXT.json", pins.contextSHA256);
  const frame = parseJson(read("OFFICIAL-FRAME.json", 64 * 1024, pins.frameSHA256));
  const sourceDate = profile.sourceDate, target = pins.playerId, asOf = stamp(pins.evidenceAsOfUTC);
  const fromDate = new Date(Date.parse(sourceDate + "T00:00:00Z") - 28 * 86400000).toISOString().slice(0, 10);
  need(context.dateFrom === fromDate && context.eventThroughDate === sourceDate && request.eventThroughDate === sourceDate,
    "request_capture_date_scope_mismatch");
  const nativeStamps = GROUPS.map(group => profile.bodies[group].retrievedAtUTC);
  const nativeTimes = nativeStamps.map(micros), snapshot = micros(context.snapshotUTC), statement = micros(context.statementUTC);
  const captured = micros(request.asOfUTC);
  need(Math.max(...nativeTimes) <= snapshot && snapshot <= statement && statement <= captured
    && captured <= Math.min(...nativeTimes) + 12 * 3600000000 && captured <= micros(pins.evidenceAsOfUTC), "request_capture_outside_native_window");
  const schedule = parseJson(packetFiles.get("schedule.raw.json"));
  const day = one(schedule.gameWeek.filter(d => d.date === sourceDate), "schedule_day_ambiguous");
  let derived;
  if (Object.hasOwn(pins, "hostedOfficial")) {
    const directory = join(root, "official-ledger");
    need(realpathSync(directory) === directory, "official_export_path_mismatch");
    derived = deriveHostedOfficialFrame(directory, day, target, pins, profile, runBytes, fixtureOnly, keep);
  } else {
    const officialNames = readdirSync(join(root, "official"));
    need(!officialNames.includes("FAILED.json") && !officialNames.includes(".MANIFEST.json.tmp"), "acquisition_incomplete");
    derived = deriveOfficialFrame(read, officialNames, day, target, pins, profile, runBytes, fixtureOnly);
  }
  need(isDeepStrictEqual(frame, derived.frame), "supplied_frame_original_bytes_mismatch");
  const frameFacts = { ...derived.fact, frameSHA256: pins.frameSHA256, ...frame.provenance };
  need(stamp(sourceDate + "T00:00:00Z") <= stamp(frameFacts.completedByUTC), "completion_precedes_event");
  const selected = {};
  for (const [key, table] of Object.entries(TABLES)) {
    const feed = request[key], capture = feed?.capture;
    need(capture?.source === table && isHash(capture.sha256) && Array.isArray(feed.rows), "request_feed_missing");
    readContext("RAW-" + key + ".json", capture.sha256);
    const matches = key === "calendar" ? r => r.id === frameFacts.gameId :
      r => r.player_id === target && (key === "wgo" ? r.date : r.date_scraped) === sourceDate;
    const row = one(feed.rows.filter(matches), "stored_date_identity_ambiguous");
    need(positive(row.id) && feed.rows.filter(r => r.id === row.id).length === 1, "stored_source_id_ambiguous");
    selected[key] = row;
  }
  const wgo = selected.wgo, calendar = selected.calendar;
  need(wgo.game_id === frameFacts.gameId && wgo.season_id === SEASON && ["D", "F", "L", "R", "C", "LW", "RW"].includes(wgo.position_code)
    && wgo.team_abbrev === frameFacts.team && wgo.games_played === 1 && wgo.toi_per_game === frameFacts.totalToiSeconds
    && calendar.date === sourceDate && calendar.seasonId === SEASON && calendar.type === 2, "official_stored_identity_or_exposure_mismatch");
  for (const field of ["goals", "shots"]) need(Number.isSafeInteger(frameFacts[field]) && frameFacts[field] >= 0
    && wgo.counts[field] === frameFacts[field] && selected.individual[field] === frameFacts[field], "official_wgo_native_count_mismatch");
  const cells = {};
  for (const group of GROUPS) {
    const stored = selected[group], observed = profile.bodies[group];
    need(stored.season === SEASON && stored.gp === 1 && stored.toi === frameFacts.totalToiSeconds
      && stamp(frameFacts.completedByUTC) <= stamp(observed.retrievedAtUTC) && stamp(observed.retrievedAtUTC) <= asOf, "native_scope_or_chronology_mismatch");
    const body = packetFiles.get(group + ".parser-input.html");
    need(sha(body) === observed.sha256, "native_parser_bytes_drift");
    cells[group] = { storedSourceId: stored.id, parserInputSHA256: observed.sha256, fields: compareCells(body, group, target, frameFacts.team, stored) };
  }
  return { wgoSourceId: wgo.id, official: frameFacts, cells, dbContext: { dateFrom: context.dateFrom, eventThroughDate: context.eventThroughDate,
    snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC, capturedAtUTC: request.asOfUTC,
    individualRetrievedAtUTC: nativeStamps[0], onIceRetrievedAtUTC: nativeStamps[1] } };
}
