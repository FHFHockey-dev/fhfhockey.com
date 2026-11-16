// File-only inspection of TJ's supplied expanded export; never fetches or edits the input.
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const repo = resolve(__dirname, '../../../../..');
const { snapshotSchema, workspaceSchema } = require(resolve(repo, 'web/lib/in-season/workspaceSchema'));
const { timestampMicros } = require(resolve(repo, 'web/lib/projections/evidenceTime'));
const { capacityPlanningSnapshot, currentBridgeIsAuthorized } = require(resolve(repo, 'web/lib/rosterScheduleOptimizer/currentPlanningRead'));
const { evaluatePlan, scheduleAdmissionProblem } = require(resolve(repo, 'web/lib/rosterScheduleOptimizer/planning'));
const { readBoundedFile } = require(resolve(__dirname, '../../saved-input-preflight-2026-11-09/inspect-saved-planning'));
const hash = value => createHash('sha256').update(value).digest('hex');
const encoded = value => JSON.stringify(value);
const countBy = values => Object.fromEntries([...new Set(values)].sort().map(key => [key, values.filter(value => value === key).length]));
const prefix = 'forge-daily-bridge-v1:';
let stage = 'source_pins';

try {
  const pins = JSON.parse(readBoundedFile(resolve(__dirname, 'SOURCE-PINS.json'), 16_000).toString('utf8'));
  for (const pin of pins.files) if (hash(readBoundedFile(resolve(repo, pin.path), 4_000_000)) !== pin.sha256)
    throw new Error('application_source_drift');
  stage = 'parse_export';
  const bytes = readBoundedFile(process.argv[2], 16_000_000), body = JSON.parse(bytes.toString('utf8'));
  if (body.version !== 'rso-planning-evidence-v1') throw new Error('unsupported_export');
  stage = 'snapshot_schema';
  const snapshot = snapshotSchema.parse(body.snapshot);
  stage = 'provider_snapshot_schema';
  const provider = body.providerSnapshot === null ? null : snapshotSchema.parse(body.providerSnapshot);
  stage = 'intent_schema';
  const intent = workspaceSchema.shape.intent.parse(body.intent);
  stage = 'manager_overrides_schema';
  workspaceSchema.shape.managerRuleOverrides.parse(body.managerInputs?.rules);
  stage = 'input_analysis';
  const original = encoded(body), evaluatedAt = new Date().toISOString(), now = timestampMicros(evaluatedAt);
  const exported = timestampMicros(body.exportedAt), checked = timestampMicros(body.readerCheckedAt);
  const asOf = timestampMicros(snapshot.context.asOf), providerAsOf = provider && timestampMicros(provider.context.asOf);
  const fields = ['rules', 'roster', 'lockedAssignments', 'realized', 'opponent'];
  const scopeFields = ['provider', 'seasonId', 'leagueId', 'teamId', 'startDate', 'endDate', 'timeZone'];
  const rows = snapshot.forecasts, players = new Map(snapshot.players.map(row => [row.id, row]));
  const games = new Map(snapshot.games.map(row => [`${row.id}|${row.teamAbbreviation}`, row]));
  const forecastKeys = new Set(rows.map(row => `${row.playerId}|${row.gameId}`));
  const rosterCoverage = { activePlayersWithoutForecasts: 0, activeMissingPlayerGames: 0,
    inactivePlayersWithoutForecasts: 0, inactiveMissingPlayerGames: 0 };
  for (const entry of snapshot.roster) {
    const player = players.get(entry.playerId);
    if (!player) continue;
    const opportunities = snapshot.games.filter(game => game.teamAbbreviation === player.teamAbbreviation
      && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate);
    const missing = opportunities.filter(game => !forecastKeys.has(`${entry.playerId}|${game.id}`)).length;
    const active = entry.position === 'active' || entry.position === 'bench';
    rosterCoverage[active ? 'activeMissingPlayerGames' : 'inactiveMissingPlayerGames'] += missing;
    if (missing > 0 && missing === opportunities.length)
      rosterCoverage[active ? 'activePlayersWithoutForecasts' : 'inactivePlayersWithoutForecasts']++;
  }
  const stats = { expiredAtInput: 0, expiredNow: 0, invalidClocks: 0, futureIssuance: 0, identityMismatch: 0, expiryAfterGame: 0, nullStats: 0, zeroStats: 0 };
  for (const row of rows) {
    const issued = timestampMicros(row.issuedAt), cutoff = timestampMicros(row.cutoffAt), expiry = timestampMicros(row.expiresAt);
    if (issued === null || cutoff === null || expiry === null || cutoff > issued) stats.invalidClocks++;
    else { if (issued > asOf) stats.futureIssuance++; if (expiry <= asOf) stats.expiredAtInput++; if (expiry <= now) stats.expiredNow++; }
    const player = players.get(row.playerId), game = player && games.get(`${row.gameId}|${player.teamAbbreviation}`), context = row.issuedContext;
    if (!player || !game || !context || context.playerId !== row.playerId || context.gameId !== row.gameId
      || context.nhlPlayerId !== player.nhlId || context.teamId !== player.nhlTeamId || context.seasonId !== snapshot.context.seasonId
      || context.scheduledAt !== game.startsAt || context.scheduleRevision !== game.scheduleRevision || context.rosterRevision !== player.rosterRevision) stats.identityMismatch++;
    if (game && expiry !== null && timestampMicros(game.startsAt) !== null && expiry > timestampMicros(game.startsAt)) stats.expiryAfterGame++;
    for (const value of Object.values(row.stats)) { if (value === null) stats.nullStats++; if (value === 0) stats.zeroStats++; }
  }
  const bridgeRows = rows.filter(row => row.revisionId.startsWith(prefix));
  const revisions = new Set(bridgeRows.map(row => row.revisionId));
  const declared = snapshot.forecastManifest?.rsoUsePolicy?.bridgeRevisionIds ?? [];
  const policy = snapshot.forecastManifest?.rsoUsePolicy?.revision ?? '';
  const forecastRunTimes = countBy(rows.map(row => row.issuedAt));
  const expiryTimes = rows.map(row => timestampMicros(row.expiresAt)).filter(value => value !== null).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const expiryIso = value => value === undefined ? null : new Date(Number(value / 1000n)).toISOString();
  const capacity = capacityPlanningSnapshot(snapshot);
  // Two bounded baseline evaluations only: no candidate search, hypothetical move or runtime authority constructor.
  stage = 'capacity_baseline';
  const baseline = evaluatePlan(capacity, intent, 'agp', [], false);
  stage = 'serialized_outcome_baseline';
  const savedOutcome = evaluatePlan(snapshot, intent, 'outcome', [], false);
  stage = 'report';
  const summarize = value => ({ legal: value.legal, budgetVerified: value.budgetVerified, objective: value.objective,
    scheduledGames: value.scheduledGames, activeGames: value.activeGames, benchGames: value.benchGames,
    projectedValue: value.projectedValue, comparisonEligible: value.comparisonEligible ?? null,
    selectionMethod: value.selectionMethod ?? null, recommendationEligible: value.recommendation?.eligible ?? null,
    coverage: value.recommendation?.coverage ? { requiredCount: value.recommendation.coverage.requiredCount,
      assignmentEligibleCount: value.recommendation.coverage.assignmentEligibleCount,
      totalsEligibleCount: value.recommendation.coverage.totalsEligibleCount,
      comparisonEligibleCount: value.recommendation.coverage.comparisonEligibleCount } : null,
    limitationCount: value.limitations.length,
    limitationTopics: ['forecast', 'schedule', 'goalie', 'minimum', 'reserve', 'lock', 'budget', 'acquisition', 'eligibility', 'unknown', 'unsupported']
      .filter(word => value.limitations.some(text => text.toLowerCase().includes(word))) });
  const report = { version: 'rso-current-export-inspection-v1', inputSha256: hash(bytes), inputBytes: bytes.length,
    evaluatedAt, exportedAt: body.exportedAt, readerCheckedAt: body.readerCheckedAt,
    snapshotAsOf: snapshot.context.asOf, providerSnapshotAsOf: provider?.context.asOf ?? null,
    clockOrderValid: exported !== null && checked !== null && asOf !== null && exported <= now && checked <= exported && asOf <= checked
      && (providerAsOf === null || providerAsOf <= asOf),
    snapshotAgeSeconds: asOf === null ? null : Number(now - asOf) / 1e6,
    providerScopeMatches: !!provider && scopeFields.every(key => provider.context[key] === snapshot.context[key]),
    schemaPreservedFields: Object.fromEntries(fields.map(key => [key, isDeepStrictEqual(snapshot[key], body.snapshot[key])])),
    providerRosterMatches: !!provider && isDeepStrictEqual(provider.roster, snapshot.roster),
    schemaPreservedMatchupWeeks: isDeepStrictEqual(snapshot.matchupWeeks, body.snapshot.matchupWeeks),
    schemaPreservedForecastsAndEvidence: isDeepStrictEqual(snapshot.forecasts, body.snapshot.forecasts)
      && isDeepStrictEqual(snapshot.evidence, body.snapshot.evidence),
    actualSlotConfigurationUsed: isDeepStrictEqual(capacity.rules.rosterSlots, body.snapshot.rules.rosterSlots),
    populations: { players: snapshot.players.length, roster: snapshot.roster.length, games: snapshot.games.length,
      forecasts: rows.length, bridgeRows: bridgeRows.length, bridgeRuns: revisions.size,
      lockedAssignments: snapshot.lockedAssignments.length, selectedSteps: intent.steps.length,
      protectedPlayers: intent.protectedPlayerIds.length, excludedPlayers: intent.excludedPlayerIds.length },
    rosterCoverage, missingRosterIdentities: snapshot.roster.filter(row => !players.has(row.playerId)).length,
    duplicatePlayerIdentities: snapshot.players.length - players.size,
    duplicateGameSides: snapshot.games.length - games.size,
    duplicateForecastIdentities: rows.length - new Set(rows.map(row => `${row.playerId}|${row.gameId}`)).size,
    bridgeManifestMatches: declared.length === revisions.size && new Set(declared).size === declared.length && declared.every(id => revisions.has(id)),
    serializedBridgeRowsAuthorizedHere: bridgeRows.filter(row => currentBridgeIsAuthorized(row, policy)).length,
    originalResponseOnlyProofPresent: false, forecastRunTimes, forecastChecks: stats,
    earliestForecastExpiry: expiryIso(expiryTimes[0]), latestForecastExpiry: expiryIso(expiryTimes.at(-1)),
    scheduleAsOf: snapshot.evidence.schedule?.asOf ?? null, scheduleAdmittedAtInput: scheduleAdmissionProblem(snapshot) === null,
    lineupMode: snapshot.rules.lineupMode, unsupportedRuleCount: snapshot.rules.unsupported.length,
    scheduleOnlyBaseline: summarize(baseline), serializedOutcomeBaseline: summarize(savedOutcome),
    inMemoryInputUnchanged: original === encoded(body),
    authority: { currentAuthenticatedAcceptance: false, forecastUseGranted: false, servingBranchEstablished: false,
      sourceAuthenticityIndependentlyVerified: false, originalHttpResponseRecovered: false, restorableBackup: false },
    remaining: ['tj_selected_move_and_undo_reopen_acceptance', 'original_served_run_proof_and_source_selection',
      'manager_confirmation_of_actual_league_rules', 'refresh_preferences_not_in_this_export'] };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  const issuePaths = Array.isArray(error?.issues) ? error.issues.slice(0, 20).map(issue => ({
    code: issue.code, path: issue.path.filter(part => typeof part === 'number' || /^[a-zA-Z][a-zA-Z0-9]*$/.test(part)) })) : [];
  process.stderr.write(JSON.stringify({ error: 'current_export_inspection_failed', stage, issuePaths }) + '\n');
  process.exitCode = 2;
}
