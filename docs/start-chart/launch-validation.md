# Live Starter Board execution record

## Goal and boundaries

The active execution goal is **Launch and Validate the Live Starter Board**.
Completion requires a live shared board, today-only Yahoo/Draft Pro acceptance,
prospective forecasts and outcomes, and published day-14/day-30 operational and
modeling reviews. Code completion and elapsed calendar time are insufficient.
FORGE retention is a successful modeling decision. This goal remains active.

Production migrations, deployment, scheduler activation and substantial backfills
still require approval of a concrete package. No such actions have been executed.
Existing private Player Forecasts contracts and the January 3–April 16, 2026
holdout are preserved. No paid provider or automatic Yahoo transaction was added.

## Implemented and checked locally

- Independent capture/computation/public-serving/challenger/scheduler flags.
  Capture, computation and serving retain the legacy flag fallback; explicit new
  flags override it. Challenger and scheduler activation default off.
- Capture-enabled IFTTT receivers process immediately by default, retaining an
  explicit `process=false` override. Credential-bearing follow-ups use a configured
  origin, refuse redirects and have a 25-second timeout. The minute scheduler
  independently retries up to five current-day pending reports from each of the
  three GDL sources; source delays do not block dispatch of accepted game work.
  Capture-only scheduling is supported before computation/serving activation.
- Eastern slate dates govern ingestion. Older publications cannot be assigned to
  the requested game's slate; unresolved relative-day references are preserved
  with an explicit review reason. Automatic retries exclude historical receipts.
- Required capture failures leave raw events pending. Capture-enabled lineup
  snapshots, assertions and news triggers commit atomically; exact retries do not
  count as new news, and changed duplicate inputs fail without rewriting history.
- Capture-enabled goalie reports likewise commit observations, conflict versions,
  conflict members and news queue changes in one transaction. Per-game/team locks
  serialize competing captures. Reporter corrections supersede their earlier
  publications; a late old report cannot reopen a newer assertion. Independent
  confirmed disagreement within the board's ten-minute recency window creates a
  complete review record. Existing review resolutions are not rewritten.
- A minute scheduler definition and authenticated dispatcher for up to 16 games,
  each receiving a separate worker invocation. Claims have 210-second leases;
  computation targets 150 seconds. Expired workers are fenced from publication,
  and their associated active runs no longer impose the ten-minute exclusion.
- Explicit revision selection/reset, append-only selection history, immutable
  final pregame selection, and scheduler freezes for today/yesterday.
- Private append-only accepted-news, dispatch and browser-visibility observations.
  An authenticated release endpoint supports selection and visibility receipts.
  A Playwright probe reads the revisions rendered by the public browser. This is
  instrumentation, **not evidence that deployed latency meets the SLO**.
- A bounded, private operational report joins accepted news to leased game runs,
  immutable revision timing and browser receipts. Later revisions can deliver
  coalesced news; a stale rollback cannot satisfy a newer event. Cutoff-aware
  reports retain overdue events without visibility, every breach, p50/p95/p99,
  separate provider delay, and preseason/regular-season cohorts. Identical repost
  assertions count once from first acceptance; changed assertions remain separate.
  The sample gate counts distinct original reports per game, and unknown source
  identity remains a limitation.
- A read-only, bounded daily-board historical exporter; checksummed private
  datasets; four fitted baseline policies; deterministic logistic and goalie
  temperature fitting helpers that refuse inappropriate labels.
- A private/no-store Yahoo endpoint using existing token refresh and Draft Pro
  entitlement. It selects only owned, account-scoped, current-season teams,
  refreshes roster/settings and explicitly queries league player ownership.
- Deterministic maximum-weight assignment over eligible slots; locked and
  inactive players remain fixed. Unknown identities, locks or unconditional
  values make the result incomplete. Streaming math supports feasible drops;
  provider acquisition timing is currently unknown, so real streaming gains are
  withheld. Availability discovery checks up to 100 Yahoo available players,
  including waivers, and discloses pagination, matched forecasts and limitations.
- An expandable Yahoo comparison on the board, clearing private data on sign-out;
  an initial validation notice; no invented calibration percentage or intervals.

### Current verification

- Starter Board pipeline: 30 Vitest cases, including a 16-game simultaneous
  dispatch test and assignment compared with an exhaustive small-roster oracle.
- Yahoo parser/server/roster/API tests cover reused token behavior, resource
  scope, entitlement, cross-account rejection, private caching and partial rules.
- Start Chart API: 29 tests. Page: 15 tests including private load/sign-out.
- Python daily-board tests: 14 passed, including development/evaluation isolation,
  official settlement, pregame issuance, accounting and missing-label handling.
- Source receiver/scheduler: nine tests passed. Processing/release routes:
  14 passed. Existing forecast suite: 20 passed. Coverage includes bounded retries,
  independent dispatch, Eastern midnight, stale-report applicability, failed
  capture, private processor destinations, report bounds and safe errors.
  The latest combined pipeline/routes/forecast run passed all 64 tests.
- PostgreSQL integration passes publication, rollback/freeze, supersession,
  expired-lease fencing, telemetry idempotency, atomic lineup capture/retry and
  service-only access. Operational SQL checks verify coalesced delivery, immutable
  timing after mutable run changes, report cutoffs and stale-rollback exclusion.
- All seven migrations rehearse successfully on a clone of the complete local
  application/auth/storage schema. Existing ownership/ACLs are omitted; cron
  table shapes are mirrored without scheduling or activating anything.
- TypeScript passed after the ingestion/scheduler work with an 8 GiB heap; the
  default 4 GiB invocation exhausted its heap. Narrow desktop/mobile
  Playwright scoring/participation checks passed at 1440px and 390px.
- Two additional Playwright cases passed at 1440px/390px for stale responses,
  revision/row refresh, suspended background polling and return-to-foreground
  refresh. These use controlled time/lifecycle signals and mocked API responses;
  they do not measure deployed cache or news-to-visible latency.
- Release/review verification: pipeline 34, public route 30, processing/private
  release route 16, and page 18 tests passed. The registry SQL integration checks
  inactive tracking, preseason/historical exclusion, code identity, daily
  deduplication, policy matching, early milestone rejection, immutable reviews,
  preserved launch dates and private access. Desktop/mobile scoring cases also
  passed with the expanded notice, including Day 31 without settled evidence.
- Yahoo provider workflow: 11 roster/provider tests, four NHL transport tests,
  34 pipeline tests and 18 page tests passed. The new cases run the full private
  loader with controlled provider/database responses, including idle players,
  bidirectional identity ambiguity, current-team changes, explicit roster locks,
  stale/partial availability and a five-second aborted schedule request. These
  fixtures are not a signed-in provider acceptance result.
- Atomic goalie verification: 23 forecast/source, 16 processing/private-route and
  34 pipeline tests passed; TypeScript passed. SQL fault injection fails the
  second conflict member and proves rollback of both the observation and all
  conflict/news/queue changes. Retrying then commits one complete capture; exact
  retries create no additional news. Tests cover changed retries, mixed batches,
  future timestamps, two-goalie reports, correction ordering and private access.

No live Yahoo acceptance, production browser probe, production migration,
deployment, observed five-minute SLO or promotion is claimed.

## Real-data audit and initial results

Private artifacts are preserved outside the repository at:

`/Users/tim/Library/Application Support/FHFH/starter-board/artifacts/20260916/`

The read-only export covers October 7, 2025–January 2, 2026: 24,432 skater/goalie
rows across 643 completed regular-season games. One row lacks verified game-time
team membership and is excluded where that identity is necessary. Skater team
identity comes from historical shifts, not the player's current team. Official
participation candidate lists and goalie-start labels are not available in this
freeze. Missing box-score rows are not labeled as nonparticipants.

**Strength-data correction:** that original freeze's PP/PK times are ingestion
placeholders, and its derived EV time incorrectly equals total time. All 23,148
skater rows are affected. Those three usage fields are unusable for strength
training; the original immutable file is retained for audit. The reported
total-rate fantasy baselines did not consume those fields. The corrected exporter
and its real-data check are described below.

| Artifact | SHA-256 |
| --- | --- |
| `history-2025-development/history.jsonl` | `4d8ca95c5b43d081a69245db11457f7fab230588610d10652d26e10d49269662` |
| Baseline policy | `b87cda51d07e4c6311d8b62b3391322d8684cf82eb88a6ecf7ac8846249982ba` |
| Evaluation forecasts | `7878dfd7385798e49eee9155b4e3de4faaac7635e3cd32e26861681de83f507c` |

Development ends November 30; evaluation is December 1–January 2. A disclosed
two-calendar-day outcome lag is a historical reconstruction assumption, not a
fabricated receipt timestamp. The evaluation covers 238 games, 30 historical
slates and 8,519 scored skater forecasts. These counts **do not satisfy the
prospective sample gate**.

| Baseline | Default skater fantasy-point MAE |
| --- | ---: |
| Season rate | 1.4418 |
| Recent/season | 1.4415 |
| Role-aware total usage × rate | 1.4434 |
| Empirical Bayes | 1.4475 |

The recent/season paired game improvement interval is approximately
[-0.00421, 0.00452]; it includes zero. No model was promoted. Separate strength
usage/rate baselines, context ablations and formal calibration partitions remain
unfinished. Legacy FORGE data has only 180 deduplicated pregame rows across five
games on one slate after postgame computations are excluded. Unknown legacy
conditioning prevents a formal current-FORGE comparison.

### Corrected historical strength export

`daily_board_data.py` now identifies its normalizer as
`starter-board-history-normalizer-v2`. Legacy PP/PK time strings are preserved
as audit metadata, never used as observed usage. Replacement EV/PP/PK usage
requires one derived row and one strength-owned shift row, matching recorded
game-time team/opponent, player, game/date, season and home/away identities.
Source timestamps and the shift-row ID remain explicit. The authoritative
`games.type` establishes the cohort when a legacy shift's duplicate type field
is missing; that absence remains flagged. Contradictory metadata is rejected.

Each derived usage component must match the stored shift component, and summed
usage must agree with box-score TOI within one second. Strength-specific goals,
assists and shots additionally require nonnegative integer counts, agreement
with box-score totals and PP points, goals no greater than shots, and no positive
count assigned to zero usage. Failed rate checks retain independently verified
usage and ordinary box-score totals while withholding the affected strength
categories. Missing/duplicate/conflicting sources remain unknown. This is stored
source reconciliation, not independent replay of raw NHL events.

A bounded read-only December 30, 2025 export contains 190 rows across five games:
180 skaters and ten goalies. All 180 skaters pass usage checks; 173 also pass
strength-category checks. Seven category disagreements remain excluded. All 180
legacy shift rows lack the duplicate game-type field, explicitly recorded in
the manifest. Offline normalization reproduced the exported rows byte-for-byte.

- Artifact: `strength-history-sample-v2-verified` under the private artifact root.
- Normalized history SHA-256: `510b9f625c652b16bb2e6bc20003bdf37dd77ab85d3c5980a404a713228deabe`.
- Freeze manifest SHA-256: `de3a41a45d05142d6f856405c5a26537c616150abdbb0b0fe58f5bd42f1ea63a`.
- Four focused export/baseline tests and one training-artifact test passed;
  Python compilation and diff checks passed. No database writes occurred.

This research exporter correction follows the immutable private-canary candidate
submitted for approval; it does not modify that candidate tree or authorize any
production action. The bounded follow-up comparison below extends this evidence.
No serving coefficients changed.

### Strength usage × rate comparison

`modeling/player_forecasts/daily_board_strength.py` compares an observed-history
rate, total usage × rate, separate EV/PP/PK usage × rates, and strength-specific
shrinkage. The fixed policy blends historical and recent-five usage equally,
uses a 180-minute same-position prior, and admits history only after a two-day
game-date lag. Missing recent usage excludes a forecast rather than reaching
back for older complete games. Verified zero usage remains a valid zero.
Outputs are conditional on playing. There is no participation, full fantasy,
FORGE, or distribution comparison in this component yet.

The read-only coverage audit found no derived strength rows during November
17–30. The export stopped after inspecting November 24–25; its files and the
coverage decision remain in private storage. Dates were then selected by source
availability, before inspecting model results. The December 1–14 freeze contains
4,104 rows across 108 games, including 3,888 skater rows. Of these, 3,523 pass usage
reconciliation and 3,406 pass rate reconciliation. Exclusions include 216 identity,
149 usage-accounting, and 117 category-accounting conflicts. No missing value
was converted to zero. The protected holdout was not accessed.

December 8–14 evaluation includes 1,192 of 1,908 skater appearances across 53
games and seven slates. The remaining 716 appearances lack sufficient eligible
history. This is a selected, short historical sample with truncated history—not
a full-season baseline or untouched calibration partition. Training history
advances chronologically under the fixed policy; coefficients were not tuned
against these results.

| Target MAE | Observed-history rate | Total usage × rate | Strength usage × rate | Strength shrinkage |
| --- | ---: | ---: | ---: | ---: |
| Goals | 0.271644 | 0.272067 | 0.273093 | 0.271949 |
| Assists | 0.394379 | 0.395272 | 0.397307 | 0.405707 |
| Shots on goal | 1.125951 | 1.127741 | 1.127166 | 1.047248 |
| PP points | 0.146435 | 0.147244 | 0.151547 | 0.150542 |

Shrinkage's shots improvement has a paired game 95% interval of
[0.047760, 0.123472] shots of MAE reduction against total usage × rate, but
assists and PP-point error worsen. Separate unshrunk rates also worsen several
targets. These descriptive intervals do not satisfy prospective promotion gates.
**Decision: retain FORGE; do not publish intervals or promote this component.**
The next rate experiment needs broader reconciled history and prospective
forecasts under a frozen policy, with paired secondary-metric checks.

- Private artifact: `strength-history-dec01-dec14-v2/evaluation-v1` under the
  September 16 artifact root; source SQL/rows, source manifest, freeze, report,
  forecasts and byte-identical replay are retained.
- History SHA-256: `d33d6b8b88962f56ef4e6f4ece082aa1a2e539883448cb5d4f84fedb5fe941af`.
- Forecast SHA-256: `2623b159fe076b132944891965d0d912b2caaca7a5d485e6d8f1f5c93a9080e2`.
- Three focused tests passed for hand-calculated rates and shrinkage, current/
  future-data exclusion, accounting, legitimate zeros, incomplete histories,
  holdout/duplicate rejection, checksum validation and private deterministic
  artifacts. Python compilation and diff checks passed.

This research follow-up is outside the immutable candidate awaiting production
approval. It does not activate the scheduler, change public projections, or
establish live latency or calibration.

### Joint game scenario challenger

`modeling/player_forecasts/daily_board_scenarios.py` now generates seeded private
game draws. It requires an explicitly identified joint probability artifact,
conditional strength rates, goalie effects and a supplied variance policy.
Unknown probabilities, parser confidence, future features, incomplete strength
rates, inconsistent deployment, and protected-holdout dates are rejected.
Controlled fixtures are labeled separately from historical reconstruction and
captured-live inputs. A live artifact must finish after its cutoff and before
puck drop; replay cannot manufacture a historical issue timestamp. The deadline
is checked again after data and report writes. If publication crosses puck drop,
the artifact has no completed report and cannot qualify as an issued forecast.

Each draw selects one complete joint roster/deployment/goalie scenario. This
applies participation and goalie starts once and preserves their supplied
correlations. Shared game pace affects both teams. Shots create goals; goals
create up to two distinct teammate assists. EV/PP/PK totals reconcile, PP points
equal PP goals plus assists, and opposing skater shots/goals determine goalie
shots faced, saves and goals allowed. Unselected skaters and goalies retain zero
outcomes under the explicit no-relief assumption.

The regular-season simulator ends overtime on a goal or after five minutes and
then draws the shootout winner. Its separate official score adjustment creates
no individual goal or goalie goal against, consistent with
[NHL 2025–26 Rule 84.4](https://media.nhl.com/site/asset/public/ext/2025-26/2025-26Rules.pdf).
Regulation strength clocks and within-scenario deployment are fixed; relief,
goalie pulling, empty-net goals and overtime penalties are not modeled. Hits
and blocks are independent conditional on usage and the shared pace draw.
These assumptions require evaluation, not implicit acceptance as NHL truth.

The private report scores each complete draw using explicit skater/goalie
weights before calculating fantasy percentiles. Unsupported nonzero categories
fail instead of becoming zero. It retains input, seed, model/code hashes,
unconditional sample means, exact scenario participation/start marginals, and
research-only P10/P90. **All distributions remain unvalidated and ineligible for
public display.** There is no trained scenario/variance policy or real-data
calibration result yet, and no automated adapter from live model artifacts.

```sh
python3 -m modeling.player_forecasts.daily_board_scenarios --input /PRIVATE/GAME.json --scoring /PRIVATE/WEIGHTS.json --output /PRIVATE/NEW_RUN --seed 20260916 --draws 2000
```

A controlled 2,000-draw artifact and replay produced byte-identical draws and
reports. This verifies mechanics and reproducibility only; it is not a real
NHL forecast or calibration sample.

- Private artifact: `joint-scenarios-fixture-v2` under the September 16 root.
- Input SHA-256: `25ebb0882199a3a247a7e3d2a9cca7129b84c5b9b8f717dfa26f8f6ccb539d35`.
- Draws SHA-256: `4943d8d92f868b836dd2d417103c0053992b37dffa6dd6df1239d52b71981dca`.
- Five focused tests passed: complete-draw scoring; deterministic scenarios;
  joint participation and shared pace; strength/skater/goalie accounting;
  analytical unconditional shot means; goalie-context effects; overtime and
  shootout handling; missing/conflicting input rejection; private artifacts;
  and rejection of retroactive or late-published live forecasts. Python compilation and
  diff checks passed. No web/runtime behavior changed.

This module is a local research follow-up outside the immutable canary candidate.
FORGE and means-only serving remain unchanged. Next steps are fitting the input
policies from trustworthy labels, issuing prospective scenarios from captured
revisions, and measuring coverage, width and proper distribution scores against
the baseline before considering public intervals.

### Official outcome settlement

`modeling/player_forecasts/daily_board_settlement.py` now captures one explicitly
bounded game's final official box score and skater/goalie statistical summaries.
It checks identities, game-time membership, explicit starter flags, source
agreement and goalie accounting. Sources, actual receipt times, checksums and
normalizer identity are retained in private artifacts outside the repository.
The protected holdout and repository output paths are rejected before requests;
existing captures cannot be overwritten. The CLI performs three bounded JSON GETs
and one bounded attempt to capture the official final Playing Roster report,
requires the host's `curl`, verifies TLS and performs no database/model writes:

```sh
python3 -m modeling.player_forecasts.daily_board_settlement --game-id GAME_ID --game-date YYYY-MM-DD --output /PRIVATE/NEW_CAPTURE_DIRECTORY
```

The December 30 Toronto–New Jersey check produced 40 player records: 36 skaters,
two appearing goalies and two unused goalies with explicit nonstarter flags.
All six default skater categories and skater usage are present; official wins
and shutouts are present for the appearing goalies. Unused-goalie participation,
wins and shutouts remain unknown where the official summary provides no row.
No negative participation labels are inferred from that absence.

The raw source bundle is `official-settlement-2025020617/sources.json`, checksum
`27f1400ac3d28b584b3164c7c7e92987f842669222a1188b62f3063c385d7cf6`.
The corrected normalization uses the source's skater `timeOnIcePerGame` field;
it preserves the initial artifact and resides at
`official-settlement-2025020617-normalized/settlement.json`, checksum
`e43382a66f30bc1527841072918cc04a0febcb51d818386292115a6f53cca6bc`.
Its normalizer hash is
`6d31c8cd696bc59c8fa0b30577b8351da42b80fc38a913d2f1d2d73cc6ec892a`.
Normalization replayed from captured sources without further network reads.

The outcome join preserves the issued forecast pool, reports players outside that
pool, and rejects late issuance or future features. Prospective evaluation now
requires issuance and settlement evidence rather than only a declared cutoff.

The offline daily join can now create an immutable private artifact from a
forecast JSONL file and an existing official capture:

```sh
python3 -m modeling.player_forecasts.daily_board_settlement --settlement-bundle /PRIVATE/OFFICIAL_CAPTURE --forecasts /PRIVATE/ISSUED_FORECASTS.jsonl --output /PRIVATE/NEW_JOIN_DIRECTORY
```

It checks both capture file hashes and replays official normalization before
joining. Forecast rows must use the daily-board evaluation contract, retain
their snapshot identity, membership verification, actual pregame issuance and
feature cutoffs, explicit conditioning and evidence classification, and contain
no outcome/settlement fields. Historical and live rows cannot share one artifact.
The join retains the original forecast bytes, writes `settled.jsonl` and
`unresolved.json`, and records input/code/output checksums in a manifest written
last. Exact retries verify and return the existing artifact without rewriting it;
different inputs or corrupt artifacts fail. Directories/files use 0700/0600.
Unsupported or missing outcome targets remain unresolved, never zero.

Live evaluation now requires official `game_type`. Regular-season evaluation is
the default; the evaluator's `--game-type 1` explicitly selects a separate
preseason report. Conditional and unconditional rows for the same player/target
remain separate observations. Neither a caller-supplied forecast file nor a
successful join certifies original issuance/candidate-pool provenance; the
scheduled activation and challenger forecast issuance remain open. The frozen
FORGE exporter and bounded runner below supply the serving-model settlement path.

Verification: 17 focused daily-board tests passed, including an offline
join-to-evaluation fixture, idempotent retries, file permissions, altered source
checksums, altered normalization, outcome leakage, scheduled-start/game-type
mismatches and preseason separation. The real 40-player settlement was also
verified from unchanged captured source and corrected-normalization bytes with
zero provider requests. The new private verification bundle is
`official-settlement-2025020617-verified`, manifest SHA-256
`8087fbbcfd546ec9188cc3186b02a6c5ff843c048e48ec1ec0cc2bc3f7b8bd8e`.
This is an outcome replay, not a prospective forecast join or accuracy result.

### Explicit scratch evidence for participation labels

`daily_board_roster_report.py` validates the official final NHL Playing Roster
HTML against the settled game number, date and home/away team names. It requires
both scratch columns, checks row structure and duplicate identities, and rejects
a scratch whose sweater number appears in that team's box-score roster.
It never executes report scripts or follows embedded links.

New official settlement captures attempt one additional public report GET, with
a 15-second transfer deadline and 1 MB limit. Missing reports remain explicitly
unavailable; malformed or contradictory reports remain unusable. Existing
verified performance outcomes are retained. The report payload, actual receipt,
raw checksum and parser-code checksum are preserved. Offline verification
replays parsing and checks the combined source/settlement hashes. Earlier
three-source artifacts continue to verify without being rewritten.

The real December 30 report supplied five explicit scratches across the two
teams. These are stored as separate evidence with names, sweater numbers,
positions and game-time team IDs. **They have not been assigned player IDs or
added to the forecast population.** A unique identity match against a separately
captured pregame candidate list is still required before using them in training
or evaluation. Missing box-score rows remain unknown.

- Private artifact: `official-settlement-2025020617-with-roster`.
- Manifest SHA-256: `ed20a01480f557bcd992cb67005f6df05d4f554feda3a9ca80f97f3c3e80603f`.
- The new artifact reuses three immutable official JSON sources and records one
  new roster-report receipt. The previous 40 player records remain intact.
- Normalization replay passed; all 16 focused settlement, roster-report and daily
  runner tests passed. No production writes, trained participation probabilities,
  prospective accuracy claims or promotion decisions resulted from this check.

### Pregame candidate capture and explicit negative-label joins

`daily_board_candidates.py` captures one selected game's schedule and two official
club rosters before puck drop, using three bounded, read-only NHL requests.
Only today or the next seven Eastern dates are allowed. It checks game/season
identity, exact requested club URLs, complete roster-group structure, unique
player IDs, names, positions, optional sweater numbers and pregame receipt times.
The immutable private bundle retains source payloads, receipt times, checksums,
the fixed selection-policy identity and capture-code hash. Offline verification
reconstructs the pool. A club roster is not a confirmed lineup or proof of playing.

```sh
python3 -m modeling.player_forecasts.daily_board_candidates --game-id GAME_ID --game-date YYYY-MM-DD --output /PRIVATE/NEW_CANDIDATE_DIRECTORY
```

The first actual pregame capture is for DAL–STL on September 19, game
`2026010001`: 90 official club-roster candidates, 43 Dallas and 47 St. Louis,
captured at `2026-09-16T07:48:16.068905+00:00` before the scheduled
`2026-09-19T23:00:00Z` start. One candidate lacks a sweater number, so the strict
scratch identity matcher cannot resolve that candidate from this snapshot alone.
This is a preseason population captured three days before the game; it is not
90 confirmed participants, an issued forecast, or a regular-season evaluation.

- Private artifact: `pregame-candidates-2026010001`.
- Manifest SHA-256: `bc03e6fd2b84924cbcebafd5bb4860edcc648bf75ee3825d0e3c2a7aa49bbc15`.
- Candidate file SHA-256: `7e6e174ae471b0c53d2ba066931fc9e1b3d863e5cfe04e8a291be2b18df38714`.
- Offline normalization/checksum verification passed. No database writes occurred.

The existing settlement CLI now optionally accepts `--candidate-bundle` in join
mode. A negative participation label requires a unique team/name/sweater-number/
population match to explicit verified scratch evidence, and a candidate capture
no later than the issued forecast's cutoff. A conflicting box-score identity,
ambiguous or missing match, or a later candidate capture withholds the label.
No outcome-only player is added to issued forecasts. Joined artifacts retain the
candidate manifest/matcher hashes; resolved rows retain candidate-pool provenance.

Explicit nonparticipation gives zero realized production only for the known
supported categories in an unconditional forecast. Conditional-playing and
conditional-start forecasts are excluded when their condition is not observed;
they are not scored as failed predictions against a scratch or nonstarter.
Unsupported categories and unmatched absences remain unknown.

Candidate capture/matching, artifact provenance and retry checks pass alongside
the focused settlement and daily-runner checks. Coverage includes rejection of
candidate evidence captured after the forecast cutoff. The daily runner now
captures and selects these bundles as described below. Actual future outcomes,
probability fitting and calibration remain pending. No scheduler or serving model
was activated.

The daily settlement path also creates an independent candidate-label artifact,
before attempting the serving-forecast export. It retains every player in the
selected verified pregame pool and adds participation and goalie-start labels
only from matching official outcomes or uniquely resolved explicit scratches.
Missing appearances remain unknown. An unused goalie can have a verified
non-start while participation remains unknown. Team/population conflicts withhold
labels; players first observed postgame remain outside the pool and are counted
in coverage diagnostics. This prevents selecting training candidates solely
because they appeared in the box score or received a serving projection.

Private `candidate-labels-*` directories retain pool/outcome/code hashes,
positive/negative/unknown counts and unresolved scratch identities. Exact retries
verify existing files; changed inputs or labeler versions create separate
artifacts. A missing serving export still reports a failed forecast stage while
preserving the successfully collected candidate labels. No issued probabilities,
complete active-roster certification, fitted model or accuracy claim follows
from this data-collection artifact. Preseason and regular-season game types remain
separate. Twenty-three focused candidate/settlement/runner tests passed, including
missing forecasts, unknown labels, identity conflicts and immutable retries.

### Frozen FORGE forecast export

`web/scripts/export-starter-board-forecasts.ts` now reads one explicitly frozen
pregame revision and its immutable input observation. It never selects a newer
projection or a postgame player table. The export validates snapshot checksums,
game/run/revision/model identities, pregame read/capture/publication timestamps,
and game-time team records inside the captured reads. Missing or conflicting
membership and unclassified legacy production are excluded with reasons.
Missing participation estimates remain missing; this forecast pool is not a
complete participation-training candidate list.

Run from `web/`, with an existing private parent directory:

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/export-starter-board-forecasts.ts YYYY-MM-DD GAME_ID /PRIVATE/NEW_FORECAST_EXPORT
```

The live path permits four bounded GETs to the configured database origin and
rejects writes, RPCs and redirects. `--source /PRIVATE/CAPTURE.json` re-exports a
previously captured source offline and is identified as `provided_capture` rather
than a fresh database read. The artifact contains private `source.json`,
`forecasts.jsonl` and a manifest with source/exporter/file hashes. Exact retries
verify existing bytes without rewriting; different or damaged artifacts fail.
No private source data enters the public board contract.

Forecast rows reuse the serving scoring/conditioning functions. Skater
conditional production, goalie conditional-start production, probability
forecasts and unconditional production remain distinct. Fantasy rows carry the
actual scoring weights. Only FORGE estimates are currently exported; missing
comparison-family forecasts are not fabricated or filled with zero. All
promotion and distribution claims remain withheld.

Join the verified bundle from the repository root:

```sh
python3 -m modeling.player_forecasts.daily_board_settlement --forecast-bundle /PRIVATE/FORECAST_EXPORT --settlement-bundle /PRIVATE/OFFICIAL_CAPTURE --output /PRIVATE/NEW_JOIN_DIRECTORY
```

The join checks both export-file hashes, frozen revision/snapshot links, model
identity and issuance before retaining that provenance in its manifest. Fantasy
outcomes use the stored weights; missing official scoring categories remain
unresolved. A provided capture still requires an independent origin audit.

Verification: five export tests cover semantic parity, membership exclusions,
future/mutated/reconstructed inputs, exact frozen-revision selection, private CLI
files and idempotent retries. TypeScript passed. Eight focused Python settlement
tests passed, including scoring and modified bundle rejection. All selected
database columns were queried successfully against the complete migrated local
schema clone. A controlled TypeScript-CLI → Python-CLI check settled nine targets
and matched hand-calculated fantasy points (3.37 forecast, 4.85 outcome), with no
network or production writes. It is not a real prospective accuracy result.

### Daily candidate/baseline capture and settlement runner

`modeling/player_forecasts/daily_board_daily.py` connects the official daily
schedule, frozen FORGE exports, official outcomes and verified joins. Run from
the repository root to collect outcomes and candidate labels; the serving
forecast-join stage additionally requires frozen pregame revisions from activation:

```sh
python3 -m modeling.player_forecasts.daily_board_daily --output-root /PRIVATE/DAILY_BOARD_ARTIFACTS
```

The default slate is yesterday in Eastern time. `--date YYYY-MM-DD` can select
today or either previous Eastern date; older dates, the protected holdout and
slates above 16 games are rejected. Repeat `--game-id GAME_ID` for a bounded
canary subset. Pending/failed games can be retried within that window using the
same output root; older unresolved games require a separately reviewed recovery
action. This runner does not automatically backfill them.

Before games, use the same private output root to capture candidate pools:

```sh
python3 -m modeling.player_forecasts.daily_board_daily --mode capture-candidates --date YYYY-MM-DD --game-id GAME_ID --output-root /PRIVATE/DAILY_BOARD_ARTIFACTS
```

Capture defaults to today's Eastern slate and permits the next seven dates.
It shares one official schedule response across at most two concurrent game
workers, with two roster requests per selected pregame game. Started, postponed
or unsupported games are skipped explicitly. Each attempt creates a new immutable
snapshot; capture and settlement have independent kernel locks.

To capture fresh candidates and issue the four private baseline families in the
same bounded run, supply an existing private history freeze explicitly:

```sh
python3 -m modeling.player_forecasts.daily_board_daily --mode capture-baselines --date YYYY-MM-DD --game-id GAME_ID --history-freeze /PRIVATE/HISTORY_FREEZE --output-root /PRIVATE/DAILY_BOARD_ARTIFACTS
```

This mode uses the same capture lock, schedule request, two-worker bound and
date/game constraints. The baseline issuer checks the actual clock at calculation
and publication; it writes its completion manifest last and does not rename the
artifact afterward. A candidate capture survives a failed baseline calculation.
The report identifies issued artifacts, missing-history exclusions via their
manifests and the age of the historical freeze. No serving model is changed.

Daily settlement also inspects at most 128 `baselines/issue-*` checkpoints in each
game directory. Each is independently replayed, checked against the official
slate, and joined using its original captured candidate pool. These joins happen
before the FORGE export, so a missing serving revision does not lose baseline
outcomes. Failed/incomplete checkpoints remain visible without discarding verified
peers; a successful FORGE join is also preserved if a research checkpoint fails.
All checkpoints remain separate artifacts, not independent game samples. Matching
evaluation checkpoints and paired FORGE comparisons remain separate requirements.

Settlement verifies up to 128 snapshots per game. Candidate-label collection uses
the latest verified pregame snapshot. Forecast joins independently select the
newest snapshot captured no later than the earliest issued forecast cutoff.
Wrong-game or corrupt bundles
fail that game's candidate-selection stage; missing or late-only snapshots remain
explicitly unavailable. The selected manifest hash and matcher implementation
identify the join directory, preserving prior joins when the selected evidence
changes. The report records the selection time, hash and inspected count.

Two workers isolate per-game failures. Nonfinal/postponed games stay pending;
unsupported game types are explicit. Verified forecast and outcome artifacts
are reused without provider/database requests for those stages. Candidate, outcome
and joined artifacts are built and verified in private staging directories before atomic rename;
an interrupted build cannot expose a partial final directory. A kernel lock
prevents overlapping runs of the same slate and is released on process exit;
the presence of its file alone never blocks a retry. Join implementation changes
create a new versioned directory while preserving previous joins.

Each attempt appends a private report and captured schedule, recording the
runner/schedule identities, selected scope, settled/pending/failed/unsupported
counts, candidate-label coverage, unresolved target counts, revision IDs and join checksums. Failure
reports retain stage and exception type without child output or credentials.
A failure exits nonzero. A successful run means the requested processing
finished, not that participation coverage, comparators or calibration passed.

Verification: 12 focused runner/settlement tests passed, including 16-game
dispatch capped at two workers, failure isolation, exact retries, retained
manifest timestamps, private reports, pending games, backfill rejection,
kernel-lock release and partial-write recovery. A subsequent focused runner
check and Python compilation passed. The real September 15, 2026 schedule smoke
run contained zero games; no frozen forecasts or production writes occurred.
Its private report is under `daily-settlement-smoke/2026-09-15/` with SHA-256
`c935b5d925b5363de36d5c802e914884ed35ed7bdaac8808d392616b78c7223b`.
This verifies the empty-slate path only. Daily scheduler activation, real
postlaunch settlement acceptance, candidate fitting and promotion reviews remain
pending; no automation was created or enabled.

The subsequent candidate-mode check captured and verified both September 19
Eastern preseason canaries: 90 candidates for `2026010001` and 88 for
`2026010003`, received at approximately `2026-09-16T07:59:43Z`.
The private run is `daily-candidates/2026-09-19/run-6ae51b1d54e743db8da33a052c30bc19`;
candidate manifest hashes are respectively
`4266bb7f9b0af144983936de9c21d955d8a97b0127b9d2930e3ac2951c1488b3`
and `0e136e4e8f5bb224cd8280b93867dda2239ff2d14f66459831ca2b21336738e2`.
Twenty-two focused candidate, roster-report, settlement and runner tests passed,
including shared schedule capture, independent locks, immutable repeated
captures, cutoff selection and rejection of corrupt/wrong-game bundles.
These are pregame club-roster populations, not confirmed active lineups,
issued participation probabilities or prospective accuracy evidence. Scheduled
settlement and real postlaunch forecast/outcome acceptance remain pending.

### Real FORGE reconstruction and controlled news replay

Six bounded read-only captures of game **2025020617** (Toronto–New Jersey,
December 30, 2025; cutoff 22:00 UTC) ran the actual FORGE calculation. Each captured
input set replayed to the identical output hash with zero replay network reads.
Intended database writes were captured locally; an independent transport fence
allowed only configured Supabase REST reads. No remote writes or publication ran.

| Controlled scenario | Observed numerical result |
| --- | --- |
| Confirm existing PP1 | No numerical change, as expected for the existing top-unit assumption |
| Move player 8479318 to PP2 | PP time 125 → 76 seconds; PP goals 0.062 → 0.038; EV role/time preserved; 16 skaters changed |
| Scratch player 8479318 | Player removed; 16 teammates changed |
| Confirm goalie 8476932 | Starting probability 1, alternatives 0; 15 opposing skaters changed |
| Conflicting PP assertions | Conflict retained; prior numerical projection preserved |

Private `forge-reconstruction-review.json` contains file, snapshot and output
checksums for every scenario. The baseline input hash is
`8143a68d6b5ff77d9e704ed23c3b2bafaa51c4333e574c90a58cab196551cc89`;
its output hash is
`981fa36cf3a9d34b110cf4e1916f84d2fc844bfeca7e5a61c44705dd8413b94c`.
Shared non-news inputs were checked for equality across scenarios.

These are **controlled news fixtures on historical reconstruction**, not historical
news-arrival evidence or promotion-eligible accuracy results. Mutable roster data
left historical pools at 17 and 15 skaters. Fixed team-shot reconciliation kept
opposing-goalie shots unchanged after the scratch; test this component by ablation
before changing coefficients. Single-game calculations took 8.7–20.1 seconds with
104–107 reads; this does not establish full-slate capacity or production latency.

## Production package preparation — not ready for approval

### Verified deployment base and capacity observations — September 16

Read-only Vercel inspection identifies project `fhfhockey`
(`prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`) on the existing Pro team
`team_KVFicHhQJARTbO6wRD2x6jpq`, Node `22.x`, region `iad1`.
Production aliases, including `fhfhockey.com`, currently point to ready deployment
`dpl_AwERLALFZ7tPaHnudixUP2Z3HVEC`, commit
`820e05265f888ba70da818dbfd5ea60fc3f5d338` on `master`. Revalidate this immediately
before requesting deployment approval; the latest deployment is a different
preview and must not be mistaken for production.

The working branch includes one newer, unrelated Draft Dashboard commit. A
private 77-file Starter Board patch applies cleanly to the verified production
commit using an isolated Git index. Its changed paths exactly match the selected
task files; both committed and dirty Draft changes are excluded. The real index,
working branch and production deployment were not changed.

- Artifact directory: `activation-candidate-20260916T071750Z` under the private
  artifact root documented above.
- Candidate Git tree: `d00dd9b09f97a1ab2ddb459ebe0041eedf1f3c3d`.
- Patch SHA-256: `84e7433a9d88136e258325703aaf895240706a7c9c4d0e14e08a5d60b6d86431`.
- Manifest SHA-256: `a9d0e934726926f9e96b773df50d722c577697544e0e16c6b42b430b064a1395`.

The manifest records per-file hashes and target identities. It is an immutable
preparation snapshot, not an approved release. Regenerate after implementation
changes and before approval; source-worktree tests do not establish isolated
candidate runtime acceptance. This execution record has since been updated.

The deployed public app bundle references
`https://fyhftlxokyjtpndbkfse.supabase.co`, matching the locally linked project
`fhfhockey.com`. The connected project reports `ACTIVE_HEALTHY` in `us-east-1`.
At `2026-09-16T07:18:20Z`, a read-only database query measured 13 client backends,
one active, against `max_connections=60`. This is a point-in-time observation,
not a throughput guarantee or a reason to consume every remaining connection.

Current [Vercel function limits](https://vercel.com/docs/functions/limitations)
and [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) support the
proposed 240-second function ceiling and minute schedule on Pro. Project-specific
Fluid compute/memory settings, remaining usage and database throughput are still
unverified. No capacity increase has been requested or applied.

### Offline concurrent replay measurement

Sixteen independent local processes replayed five captured scenarios for the
same historical game. Every output hash matched; the network fence observed
zero requests. Batch wall time was 2.166 seconds; the slowest process took 2.153
seconds including TypeScript startup. Actual replay calculation time ranged from
169–288 ms under concurrency. Maximum worker RSS was 293.22 MiB; summed individual
peaks were 4,537.25 MiB (not a simultaneous-memory measurement).

Artifact: `concurrent-replay-20260916T071948Z/report.json`, SHA-256
`da6cd6e9fa0caacde68a0aee2d2ba1c8807275b2a489c361425a7718375f5d97`.
The private directory includes the worker script; the report records input,
script and candidate identities. Credentials were removed from child environments;
an offline dummy public-client key allowed import-time client construction.

This measures real calculation/replay work, but not 16 different NHL games,
source ingestion, database/network latency, publication, CDN or browser refresh.
It does not establish production capacity or the 300-second SLO.

The worker computation deadline now starts at worker entry, including the game
lookup; it no longer grants a fresh 150 seconds after that lookup. The lookup
uses a 15-second abort and records a retryable queue failure without starting
FORGE when it times out. Seven dispatch-budget tests passed. A new deterministic
16-worker test exercises the actual dispatcher and worker orchestration with
staggered lookup delays, verifies equal absolute deadlines and leaves the planned
60-second visibility allowance after computation. A stalled-lookup test verifies
abort, no engine invocation, failure acknowledgment and timer cleanup.

Those tests simulate database/engine timing; they are scheduling-contract
evidence, not a full-load database/CDN/browser measurement. Snapshot writes,
publication, cache latency and browser visibility still require the deployed
canary probe before an end-to-end delivery claim.

### Initial slate prerequisite discovered

The hosted `games` table currently ends on June 17, 2026, with zero games for
September 16–23. The official NHL schedule read on September 16 lists preseason
games beginning September 19. Proposed non-overlapping canary games are
`2026010001` (DAL at STL, September 19 at 23:00 UTC) and `2026010003`
(WPG at EDM, September 20 at 00:00 UTC; September 19 Eastern slate).
Both rows are absent from the hosted database; season `20262027` already exists.

The activation package now has a bounded mode on the existing `update-games`
endpoint. Its original mode still fetches a whole season and must not be used
for this canary. The new mode is described below.
Recheck official dates, identities and game status before activation. Preseason
canary measurements stay separate and cannot establish regular-season Day 1.

### Bounded schedule ingestion — implemented locally

Authenticated `POST /api/v1/db/update-games?mode=bounded_slate` accepts:

```json
{"date":"2026-09-19","gameIds":[2026010001,2026010003],"dryRun":true}
```

It reads one official schedule and permits 1–16 distinct games on today or one of
the next seven Eastern dates. Every selected game must appear exactly once, have
consistent season/type/team identities, a known start on the requested Eastern
date, and pregame/normal schedule status. Team and season dependencies must
already exist. Missing, duplicate, postponed, live and inconsistent games fail
without widening the scope. A missing or misspelled mode with bounded request
fields cannot fall through to the whole-season writer.

Dry-run is the default. The response returns the exact rows, existing-row
conflicts, missing dependencies and a deterministic `planHash` where applicable.
Insertion requires `dryRun:false` and `expectedPlanHash` matching a fresh official
response. Only missing games are inserted in one statement; identical existing
rows are retained, changed rows are rejected, and no existing/frozen game's
identity or start time is overwritten. A concurrent duplicate causes failure
and a fresh preview, not an upsert. The existing cron audit wrapper still records
endpoint invocations; “dry run” means no game-table mutation, not no audit record.

The two real canary games passed the pure planner against the September 19 NHL
payload with zero network requests during validation. One prior bounded GET
captured that payload. A separate read-only hosted query confirmed all four team
IDs and season `20262027` exist. No production ingestion endpoint was invoked.

- Private artifact: `bounded-schedule-20260916T073008Z`.
- Reviewed data-plan hash: `3e802df2b26aefd9acdfdc1f8353cb6c9a3a8bf6ecc967777d30c966f7048e64`.
- Manifest SHA-256: `bd6be1ea75b0581fac97bee868bbcfde6428718749e6d639694392e418f7b652`.
- The manifest retains the source payload checksum, rows, preparation-code hash,
  dry-run request and proposed insertion request. Revalidate at activation.
- All eight focused route tests passed, including default preview, reviewed-hash
  enforcement, idempotent retry, conflicts, missing dependencies, invalid source
  records, bounded dates and failed insertion. Database writes in these tests are
  controlled fixtures; actual production insertion remains unapproved/unexecuted.

### Pending migration and activation configuration

Migration order:

1. `supabase/migrations/20260916012353_starter_board_game_revisions.sql`
2. `supabase/migrations/20260916014510_starter_board_news_queue.sql`
3. `supabase/migrations/20260916023000_starter_board_release_control.sql`
4. `supabase/migrations/20260916044919_starter_board_atomic_lineup_capture.sql`
5. `supabase/migrations/20260916045842_starter_board_operational_reporting.sql`
6. `supabase/migrations/20260916052239_starter_board_validation_registry.sql`
7. `supabase/migrations/20260916060521_starter_board_atomic_goalie_capture.sql`

Relevant configuration (no values were changed remotely):

- `STARTER_BOARD_CAPTURE_ENABLED`, `STARTER_BOARD_COMPUTE_ENABLED`,
  `STARTER_BOARD_SERVING_ENABLED`, `STARTER_BOARD_CHALLENGER_ENABLED`,
  `STARTER_BOARD_SCHEDULER_ENABLED`.
- `STARTER_BOARD_CANARY_GAME_IDS`: optional comma-separated list of 1–16 distinct
  positive game IDs. Omission permits the full slate; an empty or invalid value
  fails closed. Claims filter games before leasing, and workers independently
  reject games outside the configured scope. Existing full-slate FORGE runs keep
  their legacy outputs/input capture but cannot publish new board revisions while
  a canary scope is configured. Only explicit in-scope runs can publish them.
- Immutable `FORGE_CODE_VERSION` or deployment commit identity.
- Existing `CRON_SECRET` and trusted `STARTER_BOARD_WORKER_ORIGIN`.
- Existing Yahoo season configuration and Draft Pro recommendations entitlement.

`web/vercel.json` now contains the minute schedule locally. It must not be
deployed as routine verification. At a full slate, the proposed burst is one
dispatcher plus 16 concurrent game workers; 16 × 150 seconds is 2,400 worker
wall-seconds per burst, **not a measured CPU or billing estimate**. Confirm actual
database/function capacity before canary expansion; do not purchase capacity.
The scheduler also permits three bounded source-processing requests in parallel.

Canary scope is now verified locally: a 16-game database fixture leases only the
two selected games and leaves the other 14 pending, with no dispatch records or
attempt increments. Invalid scopes are rejected in both application and SQL.
This updates the existing **unapplied** queue migration; there is no second
overloaded claim function. The complete-schema rehearsal also passed. Scope
changes apply to new invocations; already-running workers must finish or expire
before treating a narrower scope or disabled flag as an operational stop.
Captured news outside the canary remains queued. Do not clear the allowlist for
expansion until the resulting pending workload and available capacity are reviewed.

Rollback before puck drop is authenticated POST to
`/api/v1/db/starter-board-release` with
`{action:"select",gameId,revisionId,reason}`. Null revision resumes latest
publication. At/after puck drop selection is frozen. Disabling public serving
restores the legacy route while preserving capture and all revision history.

The probe runs from `web/`:

```sh
node scripts/probe-starter-board.mjs https://APPROVED-ORIGIN.example EXPECTED_REVISION_UUID
```

It uses the existing `CRON_SECRET` from the execution environment, never from a
command argument or browser session, and writes an authenticated telemetry receipt.
Run it against production only as part of the approved activation/monitoring scope.

The private operational report can be exported after the endpoint is deployed:

```sh
node scripts/report-starter-board-operations.mjs https://APPROVED-ORIGIN.example FROM_ISO UNTIL_ISO /PRIVATE/ARTIFACTS/operations.json
```

Use timezone-qualified ISO timestamps and a window of at most 31 days. The exporter
requires the existing `CRON_SECRET`, refuses repository destinations/overwrites,
saves with mode 0600 and prints a file checksum. Reports also contain an input
checksum and an explicit as-of cutoff. The endpoint is admin-only and no-store;
raw news, accounts and input transcripts are excluded.

SLO latency uses the **server visibility-receipt upper bound**. The probe's render
clock is retained separately and is not assumed synchronized. Observed-delivery
percentiles disclose their sample count; unobserved overdue events stay in the
on-time denominator. A report cannot pass on empty/preseason-only evidence or use
reposts to meet the 100-event gate. Missing original-source identity keeps the
review inconclusive. This report is one input to a milestone review, not an
automatic day-14/day-30 completion or model promotion.

Before requesting canary approval, finish controlled load/crash/cache checks,
review the exact deployment diff (excluding unrelated Draft Dashboard changes),
identify the deployment and database targets, verify existing capacity limits,
and specify the initial game IDs, flag values, bounded run and rollback steps.
The quote-publication checks and local database rollback rehearsal have passed.
The canary scope and full-schema migration checks now have local evidence;
the pipeline suite passed all 41 cases after the scope change.

Live provider receipt, deployed conflict-review retries, deployed cache latency
and production rollback confirmation belong to the **approved canary** checklist;
they cannot be claimed before that deployment exists. Public expansion requires
the resulting measurements and a concrete full-slate capacity assessment. The
current single-game reconstruction timings and parallel-dispatch unit test do
not establish production full-slate capacity or satisfy that expansion gate.

### Release identity and measured review disclosure

The admin-only, no-store release endpoint additionally accepts `register_release`,
`activate_release` and `publish_review`. Registration freezes the release/code
identity, evaluation version and server-hashed policy. The policy records feature,
candidate-selection and refitting artifact hashes, each component's baseline,
primary target/loss and protected secondary target/loss pairs. These contracts do
not substitute for producing the corresponding training/evaluation artifacts.

Activation selects disclosure tracking only. Public serving, capture, computation,
scheduler configuration and challenger activation remain separate controls.
An authenticated browser receipt starts Day 1 only for a currently selected,
matching-code, current-day regular-season revision observed before puck drop.
Preseason, historical browsing and inactive tracking cannot start it. Append-only
activation changes preserve the original launch date and observed slate history.

Reviews require matching frozen policy/evaluation identities, dataset/forecast
hashes, an as-of cutoff, prospective regular-season windows and consistent sample
counts. Day-14/day-30 publication is rejected before its milestone. The public API
whitelists release identity, counts, declared metrics and derived retention or
promotion-review eligibility; it never returns private policies or artifacts.
Eligibility enforces the agreed sample, paired improvement, protected-metric and
probability-label gates. Publishing a report activates neither a challenger nor
uncertainty intervals. The board retains FORGE and means-only output.

The notice remains visible after 30 days when evidence is absent or insufficient.
Unavailable registry reads are explicit. No live registry has been populated or
activated, and no milestone report has been published. Review artifact generation,
operational-report linkage, actual component promotion and distribution validation
remain outstanding; the registry supplies their recording/disclosure boundary.

### Today-only Yahoo schedule and availability evidence

Roster identities are now loaded even when no published forecast exists, with
reverse mapping checks for ambiguity. A fresh Yahoo team assignment plus a
complete official NHL schedule for the exact day establishes `no_game`, a known
zero contribution. Missing forecasts alone never establish that state. Unknown
teams, ambiguous identities, stale rosters and incomplete schedule responses
retain missing values. The official request runs alongside the other reads and
aborts after five seconds; failure remains explicit. The private response exposes
the schedule receipt and per-player schedule/value basis; the page explains idle
players and per-candidate streaming limitations.

Availability freshness is checked separately from roster/settings freshness.
Stale responses and missing ownership fields remain unknown. Actual same-day acquisition and transaction
limit support is still incomplete, so `usableToday` remains unknown and gains
remain withheld. Yahoo's [deadline documentation](https://help.yahoo.com/kb/fantasy-hockey/sln6775.html)
distinguishes Daily–Today from Daily–Tomorrow, while its
[API documentation](https://sports.yahoo.com/developer/docs/) supplies date-based
rosters and league-scoped ownership. The exact league-field/transaction-counter
interpretation still needs representative current hockey responses before it can
authorize positive streaming recommendations. No transactions are submitted.

Lineup locks now use the daily roster type and explicit roster editability,
independently of the acquisition deadline. A player-level editable flag cannot
override a roster-wide lock. Game locks use the fresh official schedule's
time, state and team identity rather than a potentially stale database time;
postponements, invalid times, mismatched teams and incomplete schedules cannot
unlock a player. Started games remain locked. Stale or duplicated availability
cannot establish an unlocked streaming candidate. The redundant database
schedule read was removed.

Fifteen roster/provider tests passed after these changes, covering next-day
acquisition settings with daily lineup edits, conflicting editability flags,
weekly roster types, changed game times, live states and uncertain schedules.
The web TypeScript check and whitespace check also passed.
This verifies local decision logic; real signed-in hockey responses are still
needed for acquisition counters and provider acceptance.

Candidate discovery now uses Yahoo's documented league `status=A` filter
(free agents and waivers), explicit ownership, overall-rank sorting and bounded
pagination. It no longer starts by checking just the highest 25 projections,
which could all belong to other fantasy rosters. A full first page triggers at
most three additional parallel pages, for at most 100 Yahoo-ranked available
players. Only candidates with uniquely matched current projections enter the
today comparison. This is a disclosed shortlist, not an exhaustive league search.

The private response and panel show players checked and matched to today's
projections. Page failures, stale evidence, unmatched identities and the 100-player
cap are explicit. Repeated players across shifting pages have unknown ownership;
the filter alone never establishes free-agent status. An empty available pool
stays empty. Discovery limitations do not invalidate an otherwise complete
roster-only assignment. Acquisition timing and transaction limits still withhold
streaming gains.

Focused verification covers a candidate beyond the first page, isolated page
failure, duplicate ownership, stale and empty results, bounded pagination,
owner-scoped GETs and the coverage display. Thirteen roster/provider, twelve
provider/ownership and eighteen page tests passed. Real signed-in provider
acceptance and acquisition-rule verification remain pending.

### Signed-in Yahoo readiness check and omitted roster type

The September 16 browser check found no in-app sign-in, but the existing Chrome
session was signed in. Its account page reported Yahoo connected, five linked
leagues, a successful prior sync, and active Draft Pro access. This verifies the
existing account UI and connection state, not acceptance of the undeployed
Starter Board endpoint or current Yahoo transaction permissions. No account
settings, connections, roster moves or refresh jobs were changed.

A read-only query, restricted to that signed-in account's owned Yahoo teams,
found five saved league responses with `weekly_deadline=intraday` and omitted
`roster_type`. Their saved weekly add counters were present, but the sync did
not retain acquisition-limit settings. These September 15 snapshots are useful
schema evidence, not fresh authority for today's transaction eligibility.

The board now recognizes explicit `intraday` or `tomorrow` daily settings when
`roster_type` is absent. This follows Yahoo's distinction between
[daily and weekly timing](https://help.yahoo.com/kb/fantasy-hockey/sln6775.html).
An explicit weekly roster, missing/unknown deadline, stale response, roster-wide
lock or started game still prevents an unsupported unlocked recommendation.
Acquisition usability remains separate and streaming gains remain withheld.
No default transaction limit is substituted for a missing league setting;
[Yahoo permits league-specific season and weekly limits](https://help.yahoo.com/kb/fantasy-hockey/weekly-transaction-limits-sln6981.html).

Sixteen roster/provider tests and `NODE_OPTIONS=--max-old-space-size=8192 npx tsc
--noEmit` passed. The added cases cover both daily settings with omitted roster
type, unknown/weekly settings, explicit locks and stale responses. This local
private-endpoint correction is outside the immutable canary candidate awaiting
approval; it must be included in a reviewed follow-up before Yahoo acceptance.
The sanitized evidence note is `yahoo-readiness-20260916.json` under the private
September 16 artifact root. Fresh acquisition settings/counters and complete
signed-in Starter Board desktop/mobile acceptance remain outstanding.

## Quoted-report publication and applicability

The GDL processing path now binds publication time and relative-date checks to
the text actually used. Quoted reports retain their original publication time;
the wrapper timestamp remains separate metadata. Unknown publication no longer
falls back to application receipt when establishing game applicability. Precise
provider timestamps survive oEmbed enrichment. Date-only oEmbed labels remain
labels; publication is decoded from the original X status ID using the
[published Snowflake format](https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala).
This derives publication, never a historical application-arrival timestamp.
Unsupported URLs/IDs remain unknown, and mismatched oEmbed tweet identities are
rejected. Stored timing metadata records the derivation basis.

Evidence capture also reads confirmation/injury wording and deduplication
identity from the selected primary report. Merely linking a quote does not make
that quote the source of a richer wrapper's assertions. Resolved quoted authors
are retained as the evidence reporter; the relay account and URL remain metadata.
Missing original authors are explicitly flagged and retain the relay fallback.
Focused source, capture,
and processing tests cover old reposts, quoted relative dates, missing timestamps,
exact ID precision, oEmbed identity mismatches, and primary-text confirmation.
These are local regression results; live provider acceptance is still pending.

## Private prospective baseline issuance — September 17

`daily_board_baseline_issuance.py` now issues the four comparison families
(season-rate, recent/season blend, role-aware and empirical-Bayes) for verified
pregame club-roster candidates. The existing baseline calculation accepts
explicit candidates without outcome placeholders; candidates never enter the
historical rate pools. The issuer validates source availability, freeze and
candidate checksums, historical membership, category accounting and the actual
pregame publication deadline. It preserves source paths/checksums, fixed policy,
model code hashes and missing-history exclusions in private artifacts.

The policy fixes a 50/50 blend, 300 prior minutes and the existing two-day
completed-game lag. These are comparison baselines, not newly selected serving
coefficients. Skater category and fantasy means remain conditional on playing.
No participation labels/probabilities, goalie predictions, distributions or
missing FORGE estimates are manufactured. This checkpoint is explicitly
`daily_candidate_capture`, not the final-pregame board; paired evaluations must
respect decision checkpoint and conditioning compatibility.

On September 17 at approximately 12:44 UTC, the local issuer produced:

| Preseason game | Captured skater candidates | Forecast skaters | Target rows |
| --- | ---: | ---: | ---: |
| 2026010001, DAL–STL | 80 | 43 | 301 |
| 2026010003, WPG–EDM | 77 | 50 | 350 |

Every target row contains all four baseline means. Candidates without usable
history are listed explicitly. **The supplied history ends January 2 and is 260
days old at these games.** These early private forecasts exercise prospective
issuance and future settlement; they do not establish current accuracy, improve
the public board, start live-validation Day 1, or count toward regular-season
promotion. Source rosters were actually captured September 16. No historical
news-arrival time was invented and no production write occurred.

Artifacts reside outside the repository at
`/Users/tim/Library/Application Support/FHFH/starter-board/artifacts/20260917/prospective-baselines-v1/`,
with original issuance code retained in `code-at-issuance/`. Forecast hashes:

- DAL–STL: `c727822c957633502ac4ac21e4c679fab51355014b945eb78a38717d9845704f`.
- WPG–EDM: `4982ffaa6180515c6e3c69aec311803b3d713f1ce7fb7fae7fd8fd8a7c245381`.

Both artifacts replayed to identical forecast bytes. Exact retries preserved
bytes and file timestamps; differing sources and damaged artifacts are rejected.
The general settlement command accepts these bundles via `--forecast-bundle`,
replays their means against the captured sources, and retains all four estimates
when official outcomes are later joined. The serving-only daily export path still
requires its immutable database FORGE source; research bundles cannot replace it.

From the repository root, issue a new private checkpoint with:

```sh
python3 -m modeling.player_forecasts.daily_board_baseline_issuance --freeze /PRIVATE/HISTORY_FREEZE --candidate /PRIVATE/PREGAME_CANDIDATES --output /PRIVATE/ISSUED_BASELINES
```

Thirty-four focused tests, Python compilation and the scoped diff check passed.
Coverage includes absent current-outcome placeholders, deterministic means,
private artifacts, generic settlement provenance, late source rejection,
publication crossing puck drop, and immutable retries. Candidate fitting,
regular-season prospective collection, compatible issued FORGE comparison,
updated historical coverage, scheduled activation and calibration remain
outstanding. The module is outside the reviewed production canary candidate.

The daily runner integration was then exercised against the actual September 19
slate at approximately 12:51 UTC on September 17. Both selected games successfully
captured new official candidate sources and issued baseline checkpoints: 43 and
50 skaters, respectively, with zero failed jobs. Their candidate and forecast
artifacts replayed offline. This is another checkpoint for the same two preseason
games, not two additional evaluation games or settled outcomes. History remains
260 days old. The report and verification are under
`20260917/daily-research/2026-09-19/run-8983e780e36c4f48b1297cd4022b5a01/`
in the private artifact root. Eleven focused runner/candidate/issuance tests,
Python compilation and the scoped diff check passed. Controlled tests cover
baseline settlement without FORGE, immutable retries, an incomplete checkpoint
alongside a valid one, required input validation and the checkpoint inspection
limit. No scheduler, database write or deployment was activated.

## Yahoo acquisition timing disclosure — September 17

The private Yahoo response now distinguishes verified same-day acquisition rules,
verified next-day rules, and unavailable/stale timing. Fresh Daily–Tomorrow
settings mark streaming candidates `usableToday=false` and explain that an
addition cannot improve today's lineup. Fresh Daily–Today settings identify the
same-day rule but keep usability and gains unknown until acquisition limits and
the team's remaining allowance are verified. Missing, contradictory weekly, and
stale settings remain unknown. Player recommendations expose this distinction
and carry the specific acquisition limitation into the existing details UI.

The current [Yahoo deadline help article](https://help.yahoo.com/kb/fantasy-hockey/sln6775.html)
was read with its lineup and roster sections expanded in the browser. It
distinguishes immediate Daily–Today transactions, next-day Daily–Tomorrow
transactions, and lineup moves until the real game's start. Yahoo's
[older roster-details page](https://hockey.fantasysports.yahoo.com/hockey/details/weekly_deadline)
instead describes a five-minute buffer; that conflicting page is not used to
introduce a new cutoff. The current
[transaction-limit help article](https://help.yahoo.com/kb/fantasy-hockey/weekly-transaction-limits-sln6981.html)
also confirms separate weekly/season acquisition allowances and commissioner
adjustments. A season allowance cannot be inferred from a generic move count.

Yahoo's own hockey site was signed out in the available Chrome session, so
league-specific settings could not be verified through its UI. This is distinct
from the previously verified FHFH account connection and Draft Pro entitlement.
No OAuth tokens, account settings or roster transactions were changed. Positive
streaming gains and signed-in provider acceptance remain outstanding.

The 59 focused Yahoo roster/provider and Start Chart pipeline tests passed, as
did `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` and the scoped diff
check. Tests cover same-day rules with unknown limits, explicit next-day
ineligibility, contradictory weekly settings and stale provider data. These
local changes remain outside the immutable canary candidate pending approval.

## Rechecking prospective provenance during settlement

`daily_board_settlement.verify_forecast_export` now rechecks the complete saved
capture timeline when the daily runner reuses a cached export. Previously the
Python verifier checked file checksums and revision links, relying on the original
TypeScript export for input-capture timing validation. A cached bundle must now
have input receipts no later than its cutoff; a matching revision cutoff;
capture and observation availability before publication; publication before
puck drop; and a consistent final-pregame freeze at or after puck drop.

Forecast rows must agree with the captured latest receipt, source query cutoff,
game type, teams, model identity and final-pregame checkpoint. Historical
reconstruction cannot be relabeled as captured-live evidence through this export
path. Missing receipt evidence and empty/unbounded target files fail closed.
These checks establish artifact consistency and recorded timing; they do not
independently authenticate a caller-supplied capture or replay the hockey engine.

Thirty-five focused settlement, candidate and daily-runner tests passed, including
18 newly checksummed inconsistent-source/row cases. A daily-runner regression
also verifies that an invalid cached export fails before reuse of an existing
join and leaves that previous successful result untouched. Python compilation
and the scoped diff check passed. This is local verification; live issuance and
production end-to-end validation remain pending. The change is recorded in the
pending canary package's follow-up sidecar and is outside its immutable candidate.

## Historical home/opponent challenger and retention decision

`modeling/player_forecasts/daily_board_context.py` adds a private, fixed-policy
category residual model. It compares the existing 50/50 recent/season baseline,
an intercept-only correction, home-only, opponent-only, and combined adjustments.
Each category is fit separately using standardized features and ridge 10;
coefficients and standardization remain frozen after training. The opponent
feature averages prior player residuals equally across the last five eligible
opponent games, requiring at least two. It describes the available appearance
cohort, not a complete defensive team total. Both player and opponent outcomes
have a two-calendar-day reconstruction lag. No news-arrival timestamps are inferred.

The total-stat October 7–January 2 freeze remains usable for this study; its
invalid legacy strength placeholders are unused. Three rows with inconsistent
goal/shot or PP-point accounting and one zero-minute appearance are explicitly
excluded from both history and evaluation. Final predictions enforce goals ≤
shots and PP points ≤ goals + assists, recording reconciliation counts. Fantasy
points are calculated from the resulting category means using the existing
default weights. Missing context is excluded, never silently imputed.

Two chronological historical folds produced the following fantasy-point MAE
(lower is better):

| Training through / evaluation | Player-games | Games / slates | Baseline | Intercept only | Home + opponent |
| --- | ---: | ---: | ---: | ---: | ---: |
| October 30 / November 1–29 | 7,867 | 221 / 28 | 1.427583 | 1.434780 | 1.437784 |
| November 29 / December 1–January 2 | 8,519 | 238 / 30 | 1.450333 | 1.443777 | 1.445366 |

The combined adjustment improves the later baseline by only 0.342%, while
worsening the earlier baseline by 0.715%. Its later game-paired absolute loss
reduction interval is [0.002265, 0.007625], but the intercept-only model performs
better. Relative to that simpler model, the combined adjustment's slate-paired
interval is negative: [-0.005587, -0.000185]. The report includes all six category
losses, game/slate paired comparisons, component ablations, reconciliation counts,
and position/usage/trade segments. These are descriptive historical comparisons;
small segments are inconclusive and none count toward prospective promotion.
**Retain FORGE.** No serving coefficient, probability, or public interval changed.

Private artifacts are under
`/Users/tim/Library/Application Support/FHFH/starter-board/artifacts/20260916/context-history-v2/`:
`first/`, byte-identical `replay/`, `earlier-fold/`, source-code copies and
`verification.json`. The later forecast SHA-256 is
`c414e30abf353decf3b5e9688f9c4a54e3062a26f83cfddc1a7c126cb4f1b8c0`.
The initial `context-history-v1/` artifacts remain preserved and are superseded
by the explicit source-accounting exclusions in v2. Three focused tests passed,
covering lagged features, future-outcome isolation, known ridge coefficients,
category reconciliation, chronological fitting, duplicate/conflicting context,
protected holdout rejection, private permissions, checksum failure, and replay.
Python compilation and the scoped diff check passed.

Rest requires verified schedule history; goalie identity and teammate deployment
require additional evidence. Original FORGE modifier ablations, current-FORGE
comparisons, probability fitting and distribution calibration remain outstanding.
This research-only module is outside the immutable canary candidate pending
approval, as recorded in its follow-up sidecar.

## Yahoo browser workflow verification — September 17

The existing Start Chart Playwright spec now covers the private Yahoo panel at
1440px and 390px using fictional authenticated sessions and intercepted responses.
It verifies team and individual-category selection, preserved assignments,
unavailable next-day streaming gains, entitlement/expired-connection error displays,
removal of previous private results after errors, and sign-out during an outstanding
request. Late responses do not restore the signed-out panel. Both viewports remain
free of horizontal overflow. These fixtures verify browser behavior, not live Yahoo
authorization, lock rules, acquisition permissions, or real-account acceptance.

The two new cases passed, followed by all 10 Start Chart browser cases and
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. The initial new-case failures
were exact-label test selectors; selecting by the combobox's accessible name fixed
them without changing application code. This browser follow-up is outside the
immutable activation candidate. No deployment or provider mutation occurred.

## Recent player residual challenger — September 17

`daily_board_context.py` now uses a new private evaluation policy,
`starter-board-context-v2`, to test recent player residuals alone and alongside
home/opponent context. A residual is observed category production minus the
previously constructed recent/season estimate. Features use up to five same-season
player games, require two, and preserve the two-day outcome lag. Trades preserve
the player's history; seasons do not share residual history. Coefficients and
standardization are fitted only on the training partition. All compared models
use the same eligible cohort. Existing v1 artifacts remain unchanged.

Real-data default fantasy-point MAE (lower is better):

| Historical evaluation | Player-games / games / slates | Recent/season | Home/opponent | Recent residual only | Combined |
| --- | --- | --- | --- | --- | --- |
| Nov 1–29, 2025; trained through Oct 30 | 7,692 / 221 / 28 | 1.432743 | 1.444563 | 1.438651 | 1.441105 |
| Dec 1, 2025–Jan 2, 2026; trained through Nov 29 | 8,428 / 238 / 30 | 1.452581 | 1.448317 | 1.438969 | 1.440562 |

Adding recent residuals improves the home/opponent challenger in both folds, with
positive paired game/slate 95% intervals for that incremental comparison. However,
the residual-only model is 0.41% worse than recent/season in November and 0.94%
better in the later fold. This does not establish the required improvement or
prospective evidence. Retain FORGE and means-only serving. Cohort sizes differ from
v1 because sparse player residual histories are now excluded; compare models
within these reports rather than comparing their aggregate errors across versions.

Three focused context tests, Python compilation and diff checks passed. Tests cover
current/future exclusion, player isolation, season boundaries, sparse histories,
trade continuity, known ridge solutions, policy mismatch and deterministic replay.
The later real-data fold replayed byte-for-byte for model, forecasts and report.
Private artifacts and code copies are under `20260917/context-recent-v2` in the
existing artifact root. Verification SHA-256:
`51533a09857359818d4910d7b0e893fb13cf920b528c88db27c5be218c4831fc`.
No holdout data, private research contracts or serving coefficients changed.

Yahoo acquisition allowances remain unresolved. The current
[Yahoo API guide](https://sports.yahoo.com/developer/docs/) shows weekly
`roster_adds` counters; [Yahoo Help](https://help.yahoo.com/kb/SLN6981.html) confirms
separate weekly/season limits and commissioner-adjusted counters. The inspected
guide does not specify the corresponding limit fields, and existing discovery
does not retain them. This is insufficient to infer an unlimited allowance or
calculate one from transaction history. Fresh provider evidence establishing both
the limits and applicable counters is still required before enabling gains.

## Complete-schema queue recovery verification — September 17

The existing SQL regression now supplies full season/team/player/source fixtures,
projection dates/opponents and immutable source-observation metadata. Earlier SQL
regressions used a reduced schema; the separate complete-schema rehearsal had
verified migration application. This follow-up runs the regression itself against
the complete local schema with foreign keys, required columns and checks intact.
All seven migrations applied successfully in a new isolated database. Restoring
the schema also required `pg_trgm`, `pgcrypto` and `moddatetime`; existing ACL/owner
omissions and inactive mirrored cron tables remain rehearsal limitations.

The expanded transaction passed publication/freeze/rollback, source capture,
telemetry and release checks plus replacement of all 16 crashed workers. Every
expired run was retired without the general ten-minute exclusion; late completion
attempts left each replacement lease and run intact. Another claim could not steal
the live leases. The fixture transaction rolled back.

A separate two-session check held eight claimed games in an open transaction.
The second session claimed the other eight in 0.040 seconds before the first
committed. Their union was the exact 16-game fixture with no overlap; a third owner
received no games. The isolated database was then removed. These are real local
PostgreSQL checks, not a production capacity or acceptance-to-browser benchmark.

Schema snapshots, the tested SQL and reproduction notes are stored privately in
`20260917/queue-full-schema`. Verification SHA-256:
`cb7b72e98770ee5436512e659e16bcf78ae421fbf955d7a0073cc555a4f6eb69`.
Diff checks passed. No runtime code or migration changed; no application suites
were rerun for this SQL-only change. The SQL follow-up remains outside the immutable
activation candidate and is listed in its follow-up sidecar.

## Review sample accounting — September 17

The daily-board evaluator now reports independent target-row, player-game, game
and slate counts, including a separate prospective regular-season count. Every
target/conditioning/evidence group has its own counts; probability groups expose
positive and negative label counts. Category rows and preseason observations
cannot inflate the regular-season game count. Missing comparator counts remain
visible and no missing forecast is replaced with zero.

The evaluator rejects mixed checkpoint policies and disjoint player subsets drawn
from different issues/input snapshots of the same game. Duplicate decisions are
rejected even when comparator estimates are missing. Older inputs without a
checkpoint remain explicitly unspecified and do not establish a frozen selection
policy. These counts cover only the common evaluated comparator cohort.

The existing CLI accepts repeated `--input /private/path/settled.jsonl` arguments
for separately settled games under one selected policy. It retains exact consumed
file hashes and evaluator identity, writes owner-only reports outside the
repository, preserves identical retries and rejects replacement with different
results. Selection of a compatible checkpoint and upstream provenance audits
remain required; this does not automatically combine daily candidate forecasts
with final-pregame FORGE revisions or certify promotion.

Six focused tests passed, including official-settlement integration, multi-file
CLI execution, sample accounting, probability labels, mixed checkpoints, immutable
retry and repository-output rejection. Python compilation and diff checks passed.
The two existing upcoming-game baseline bundles replayed successfully; a private
preseason smoke report correctly excludes all 651 unsettled targets, evaluates
zero forecasts and counts zero prospective regular-season games. No real-data
accuracy or calibration result follows from that smoke check.

Evidence and code copies: `20260917/review-evidence-counts-v1` in the private artifact
root. Verification SHA-256:
`6b00e055b8661ef5efa704bbff468d6172a47f35e01702f9f4f7492bd926942d`.
This follow-up remains outside the immutable activation candidate. No serving
coefficients, protected contracts, database records or production settings changed.

## Execution checkpoint — September 17

The user requested a sanity check after approximately eight hours of execution.
Local database, browser and model verification produced substantive results, but
repeatedly adding local follow-ups has not advanced the pending production gate.
Do not treat further optional implementation as a substitute for activation or
prospective evidence. The immutable activation candidate remains the subject of
the existing unanswered approval request; subsequent work is excluded.

The current bounded follow-up is complete: `daily_board_goalies.py` fits the fixed
goalie temperature grid on a chronological calibration partition and compares it
with FORGE on a later partition. It requires audited frozen settlement bundle
contracts and checksums, intact issued probability pools, official binary labels,
consistent game checkpoints and outcomes received before evaluation cutoffs.
Incomplete labeled pools are excluded as whole teams. Model, forecast and code
hashes accompany private reports. Results are explicitly retrospective; no
prospective challenger issuance or promotion is inferred.

Three focused goalie tests passed, covering numerical stability, probability mass,
strict labels, missing candidates, altered forecasts, mixed checkpoints, future
information, deterministic replay, evaluation-outcome isolation, private output
permissions, duplicate games and checksum failures. Python compilation and the
targeted diff check passed. These are synthetic contract tests, not real-data
calibration or deployed acceptance. No production action occurred.

The launch-critical dependency is the existing canary approval and subsequent
deployment verification. Independent unfinished implementation remains in Yahoo
provider acceptance/acquisition allowances, trustworthy participation training,
daily challenger issuance/refitting, remaining ablations and uncertainty
evaluation. Live five-minute delivery, regular-season sample gates and day-14/30
reviews remain unverified. The goal remains incomplete; local test completion
must not be reported as operational or model validation.

## Approved activation attempt and season-opening policy — September 17

The user fully approved the September 16 activation request. The seven exact
migrations were applied to production and verified. Migration history was aligned
to the seven reviewed repository versions after the MCP assigned execution-time
versions. All 11 new board tables have RLS enabled, no anonymous/authenticated
SELECT grant and service-role access. No unrelated migration was applied.

Deployment `dpl_3ttShF5JuK55bhRaSGWZYHP6mnv5`, from the approved tree
`9d7e26b0808331fd2a7aa7287d31b2c876c41a09`, failed before promotion. The remote
Webpack build found Node `crypto`/`async_hooks` imported into a browser bundle
through the shared Supabase client. Production was checked afterward and still
served `dpl_AwERLALFZ7tPaHnudixUP2Z3HVEC`. No canary schedule insertion, initial
projection run or scheduler activation occurred. The additive migrations remain.

A browser-safe query hook separates the Node capture implementation from shared
client imports. Eight focused capture/replay tests and an isolated local
production build passed. The corrected canary tree is
`08cfb28d1a7fa58e6f4676c2e2e1fb436ca9ccb3`; it changes three runtime files and
one regression-test file. Its amendment is awaiting approval because the original
request authorized an exact tree. It does not include the new season-opening
policy or other follow-ups. The patch, failed deployment record, build log and
verification details are in `20260917/activation-approved` in the private artifact
root. This is a build failure, not an automatic approval-review rejection.

### User-requested preseason support

The user requested recent previous-season games plus Draft Dashboard fantasy
projections as temporary support until current-season observations accumulate.
The dashboard's default public sources are A&G, Cullen, DTZ and 5v5; it has no
dedicated NHL.com source. Component A&G sources and private imports are excluded.

`season-bootstrap-v1` is implemented locally behind
`STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED=true` and requires scoped, captured,
single-game live board computation. It is not enabled in either canary tree.
Initial defaults are 20 previous-season regular-season appearances and a
20-current-season-appearance transition. With `q = min(current appearances / 20, 1)`,
the nominal weights are `q` FORGE, `0.4 * (1-q)` historical and `0.6 * (1-q)` public
fantasy rates. Missing categories redistribute weight among available inputs;
absence is never interpreted as zero. These are explicit uncalibrated defaults.

- Convert each source's counting totals using its projected games played before
  scoring; do not divide existing per-game TOI or percentage fields. Average the
  available default public sources by category. Win/shutout goalie priors require
  projected starts; unsupported fields retain the existing model fallback.
- Select the player's last N regular-season appearances from the previous season,
  across teams. Exclude same/future-date games, playoffs, preseason and zero-TOI
  nonappearances. Read official skater/goalie game-stat rows in bounded pages.
- Keep current team/position checks and explicit availability exclusions. A
  verified season-opening prior prevents a summer gap alone from discarding a
  skater. Existing deployment and game context still affect skater production;
  current PP removal remains effective. Goalies retain today's opponent-driven
  shots faced while the historical/fantasy rates inform save performance.
- Apply participation/start probability once. Do not reinterpret projected season
  games as today's probability of playing. Preserve missing participation.
- Capture the actual history and provider rows in the immutable input transcript.
  Record whether this policy ran so replay follows the same path. Do not attach
  mutable current fantasy imports to historical reconstructions. Provider
  publication times are unavailable and are not fabricated.
- Include safe policy/sample/weight disclosure in player details; withhold fantasy
  intervals. Protected research artifacts and holdout procedures are untouched.

Verification: 179 relevant pipeline, engine, API and page tests passed before the
final goalie-history/context refinements; the five affected prior tests passed
again afterward. All 10 Start Chart desktop/mobile browser cases passed, including
the prior disclosure. TypeScript and scoped diff checks passed. The read-only
real-data smoke performed 11 captured reads and zero writes, finding 20 prior
appearances each for two skaters and two goalies and usable current-year public
projection rates. This proves input integration, not predictive superiority or
live first-game delivery. The existing initial-run preflight requirements remain;
they have not been bypassed or verified against an activated canary.

## Remaining execution stages

1. Extend the completed single-game reconstruction proof with trustworthy historical
   roster pools; establish prospective candidate lists and official outcome
   settlement. Never weaken private promotion gates or equate controlled news
   fixtures with historical arrival evidence.
2. Run the completed operational reporting and browser instrumentation against an
   approved deployed canary; finish full-load end-to-end checks, the activation
   package, and connect generated evaluation/operational artifacts to the completed
   model/release review registry. Public validation fields remain pending until
   approved activation and measured reviews populate this registry.
3. Finish Yahoo provider lock/acquisition rules, remaining full response fixtures,
   and real signed-in desktop/mobile acceptance beyond the mocked browser coverage.
   Unknown timing must continue withholding gains; no automatic roster mutations.
4. Extend chronological folds/calibration, EV/PP/PK rates, regularized context
   challengers and ablations; fit and evaluate the seeded joint game scenarios.
   Train probability models
   only once trustworthy positive and negative labels exist.
5. After concrete approval, activate bounded capture/canary and verify live updates.
   Then create daily scheduled progress checks with failure/decision/milestone-only
   notifications, daily settlement/refits and weekly component promotion reviews.
6. Publish day-14/day-30 reports. Day 1 is the first live regular-season slate.
   Require ≥100 PP/availability/goalie news events for operational review; target
   ≥95% visible within 300 seconds and report p50/p95/p99 plus every breach.
   Promotion requires ≥30 prospective slates/200 games, ≥1% primary improvement,
   positive paired 95% interval, and no demonstrated >2% secondary regression.
   Insufficient samples retain FORGE and means-only output; collection continues.
