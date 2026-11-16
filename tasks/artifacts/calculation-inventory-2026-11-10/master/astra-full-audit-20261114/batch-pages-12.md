# DRM, FORGE, forecast and Lines API readers

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; all7files/1557lines read completely. Full symbols/hashes in batch-pages-12.tsv/manifest. Exact finite `pages12-probe.cjs` passed once. It runs the goalie calibration adapter and full skater reader without imports, with real pure forgeSkaterContext/modeledHeadTotals and inert DB/proof/identity/freshness doubles. No model scoring, hosted DB, provider, page, actual client/environment or supplied suite.

## AFULL-FORGER1-01 — P1: null goalie calibration and legacy team-win fields become zero

- Location: `web/pages/api/v1/forge/goalies.ts:154–157,174–200,438–455`.
- Claim: unknown performance/probability values remain unknown.
- Scenario/evidence: explicitnulls for starterBrier/savesMAE/intervalhit and samplecount pass through Number(null) and become0 in the exact calibration response. Undefined control remainsnull. The same adapter converts a stored explicitnull legacy team win probability to0. A null Brier/MAE now looks like perfect accuracy while a null interval hit rate looks like observed0coverage.
- Suggested fix: use the existing skater nullable parser or equivalent explicit null/blank guard, enforce field domains where appropriate, and pin null/undefined/realzero separately.
- Readers: FORGE goalie calibration hints and legacy team-win response. No live null row was read; no wrong-live claim.

## AFULL-FORGER1-02 — P1: historical skater output is filtered by the current roster

- Location: `web/pages/api/v1/forge/players.ts:120–137,383–398`.
- Claim: a dated proven run serves its issued eligible cohort with honest coverage.
- Scenario/evidence: queryOct1, stored proven run containsplayer1, current season roster now contains onlyplayer2. Exact reader returnsdata[]/stateempty despite the issued projection. Matching-current-roster control returns1row; completelyempty-roster control also returns1row because filtering is skipped. The query uses is_current=true, without as-of membership or a snapshot witness. A player removed from the current roster afterOct1 disappears from historical output.
- Suggested fix: retain the run's captured cohort/team identity for historical reads; if a separate current-roster view is intended, name it and report excluded counts instead of silently changing the dated run. Pin roster changes after issuance and missing roster source.
- Readers: dated FORGE skater API/page and consumers comparing issued populations. No current roster or private player record accessed.

## AFULL-FORGER1-03 — P1: unmodeled faceoff fields are emitted as zero

- Location: `web/pages/api/v1/forge/players.ts:414–440`.
- Claim: projections expose unknown/unmodeled categories as unknown.
- Scenario/evidence: row has no faceoff heads; exact reader still returnsfw0/fl0. These fields are unconditional constants, while neighboring absenthit/blk correctly remainnull. The retained response establishes wrong numeric semantics at the API boundary; no specific UI use or actual fantasy-point error claimed.
- Suggested fix: emit null/unavailable for unmodeled faceoff categories, with declared category support, and pin consumer handling of unknown. A real predictedzero must require a modeled value.
- Readers: FORGE skater API consumers usingfw/fl fields. No production output loaded.

## AFULL-FORGER1-04 — P2: the explicit unmodeled-PK basis is dropped

- Location: `web/pages/api/v1/forge/players.ts:411–436`; shared totals contract `web/lib/projections/modeledHeadTotals.ts:20–28,81–109`.
- Claim: an ES+PP legacy/unmodeled-PK total carries its basis note, as required by the shared helper contract.
- Scenario/evidence: exact pure totals helper classifies a legacy row withoutPKheads/strengthmetadata aspk_unmodelled; reader returnsnumericgoals/points, pk_statusnull and no pkBasis/basisnote. The raw uncertainty is empty, so it cannot restore the dropped distinction. Arithmetic is correct for its defined partial basis; this is a label-only loss.
- Suggested fix: forward totals.pkBasis and its existing note, with matching display labels; retain missing-head withholding for actualpk_headrows. Pin legacy and known-unmodeled exposure cases.
- Readers: canonical skater response and its labels. No new model defect alleged.

## Inherited findings and full-file boundaries

- DRM23lines: GETonly, repeatedparametersreject, typed identity/date/seasonType/location/opponent handoff to already-reviewed readDeploymentMatrix; positive responses60scache, scope400/unavailable503no-store. No independent arithmetic, no new finding.
- Goalie677lines: GETqueryschema horizon1–10/runUUID/datefallback, strict grid date/range≤10/currentseasonhistory, proven releasedrun admission before rows, nullablecandidate versus explicitlylegacy slot contracts, creditedwin separated fromteamwin, candidate-start probability/unconditionalproduct preserved. Missingnamequery doesnotinventidentity. Nonselectedtiers withheld, legacy multi-game shutout withheld. Scenario mode/count aggregation is descriptive and can hide mixed metadata; no mismatch observed. Shared source **SOCIAL1-01** is reached via game-grid-workload loadGoalieGridHistory at302; no new arithmetic qualification. Historical/current freshness semantics remain fromsharedhelper. Fallback cansearchfuture afterpastmiss and lacksold-agecap; requested/resolveddate, servingseverity anddiagnostics disclose this legacypolicy, not newly called a silent-date defect. Fetches are cappedcandidate30 plus up to30countchecks/pass; rowdataquery unpaged. No actual queries.
- Skater579lines: provenreleasedrun first, fallback past3days and thenfuture, same-datefullslate priority, requested horizonneverinvented/scaled, season-awareteamidentity, conditionalifplays availability and unqualifiedparticipation preserved. Missingrequired modeledheads withholdtotals; missinghit/blk staynull. Confidence/range/degradedcontext forwarded frompurehelper; candidatecontract/calibrationmodels not newlyqualified. Rosterfilter iscurrent (findingabove). DefaultUTCdate, loosehorizonclamp and unvalidateddate forwarding are source limits; historicalfallback's requested/resolveddates disclosed. On same-date fallback to another run, fallbackApplied staysfalse although runchanges; diagnostic naming limit, no new numeric finding. Projection androsterreads unpaged; actualpopulation/cap unqueried. Rawuncertainty anddiagnostics API contentnot automatically a UIdebugleak; page rendering still pending.
- Scoreboard94lines: GET/days1–60/scope, ETday window, settled-onlyrowquery,120kcount/deadline/stableidentity pagination, finite numeric conversion preservesnull; independentlycaptured universeflag, day-level/pooledcoverage, like-basispairedmetrics and disabledmarketbranch read. Numerical scoring was already audited inservedForecastLedger; no new scoringexecution. Daily dates derive fromsettledledger, so universe-onlydates do not getdailyrows; pooledfulluniverse still supplied whenallobservedledgerdateshaveuniverse. This absent-day presentation limit is not promoted without a stronger contract. Error may exposemessage but no secret/errorobserved.
- Gameforecast108lines: POST/GET butqueryparamsonly; scalarfirstvalue, integerdefaults, UTCoffsetdates, source/cutoff andliveIssuance distinction, explicit no-modelskip, pergamefailurestatus. Existing **GAME4-01/02** write-time/issuance-pairing defects reachgeneratePregamePredictionsForWindow at73–88. Scoring/promotion findings03–06 are not assigned to this generation-only route. No forcedbootstrap/model selection or actualforecast invocation. This is an operational writer despite its URL; it must not be used as a live-page GET probe.
- Linehistory18lines: GET, private/no-store, exactscopeparser andread-onlysharedreader, validation400/unavailable503. No new arithmetic/finding.
- ProjectedLines58lines: strictpositiveintegerIDs, entryServing branch requiresidentity andexactgame/notfound,15scache; legacytweetflag, exactgamecalendarlookup, teamonly≤7dayfallback labeledrequestedDate/reportDate,30scache. Exactgame never uses teamfallback. Source reports/unitselection alreadyreviewed, no added arithmetic or new finding. No source/provider calls.

Current capture claims were rechecked in the mailbox; none of these seven files is claimed for capture. Their findings remain against frozen source only. No overlapping edit, new capture review, source fix, production action, live page or new approval request.
