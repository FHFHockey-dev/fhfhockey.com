# Game stats, CTPI, ratings, SOS and CSV writers

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; all5files/2062lines fully read. Exact identities in batch-pages-11.tsv/manifest. `pages11-probe.cjs` passed after fixing a harness closing brace; passed again with a more realistic two-team scoring fixture. No application edits. All database/provider/persistence calls are inert finite doubles; the real source/batch completeness and clock/ratio guards ran. No SQL, real providers, supplied suites or hosted reads.

## AFULL-GSTATR1-01 — P1: absent landing scoring becomes zero special-team production

- Location: `web/pages/api/v1/db/update-stats/[gameId].ts:363–414,426–452,643–673`.
- Claim: persisted PPP/SHG/SHP represent known game totals, not absent scoring-summary evidence.
- Scenario/evidence: finished valid-identity game with both teams' boxscore arrays and complete right-rail categories, home skater1 has1assist/1point on a PP goal. When landing.summary.scoring is absent, the exact handler warns, constructs empty count maps, and sends PPP0/SHG0/SHP0 to the transaction double. Adding the actual PP scoring summary produces PPP1. Real source/batch guards accept both; they test structure/cardinality, not complete scoring-event coverage. Missing scoring cannot prove zero. Transaction identity validation likewise has no scoring witness (bounded source trace).
- Suggested fix: require a complete reconciled scoring summary before derived special-team fields are published, or preserve unknown with an explicitly incomplete outcome. Pin absent/partial summary and valid scoreless-game controls in the existing writer suite.
- Readers: playerGameStats and downstream PPP/SH fantasy/stat consumers. Transactional atomicity is preserved; no actual persisted wrong row claimed.

## AFULL-CTPIR1-01 — P1: partial CTPI snapshots can be classified unchanged

- Location: `web/pages/api/v1/db/update-team-ctpi-daily.ts:226–259,262–294,385–410`; helper `web/lib/trends/recentTeamFormV2Provenance.ts:203–291`.
- Claim: replay planner detects an incomplete destination before declaring a dated snapshot unchanged.
- Scenario/evidence: expected snapshot has2team scores; persisted list has just1row with matching formula/input/cutoff/fingerprint/watermark. Exact planner returns replay=[]/unchangedDates=[Nov15]. The query discards team identity, and planner checks only agreement of present provenance. Chunked500-row writes can leave a partial date after a later chunk fails; default rechecks that date but can now skip it. Other deletion/partial prior-state causes also reach the comparison. Synthetic snapshot isolates the coverage test; numerical CTPI was not recomputed.
- Suggested fix: persist and verify exact expected materialized team identity/count plus a completed snapshot receipt; atomically replace each dated set or reject incomplete publication. Regression: missing one team, partial chunk, duplicate identities and legitimate unavailable teams.
- Readers: team_ctpi_daily v2/beta and operational replay completeness. No current hosted missing team asserted.

## AFULL-CTPIR1-02 — P1: newly unavailable teams retain old CTPI rows

- Location: `web/pages/api/v1/db/update-team-ctpi-daily.ts:262–294,397–444`.
- Claim: replayed snapshots reflect the current qualified population and unknownness.
- Scenario/evidence: stored date contains AAA and BBB; corrected source makes BBB unavailable. Materialization separates BBB into omitted, while writer upserts only AAA and never deletes or invalidates BBB. Exact upsertRows with finite Map double leaves old BBB ctpi_raw9 beside refreshed AAA1. If all teams become unavailable, no_scorable_teams returns before any invalidation. This is distinct from unchanged partial destination: source changes can trigger replay and still leave obsolete scores.
- Suggested fix: publish a complete per-date replacement or explicit unavailable tombstones under the existing version/history rules; validate and acknowledge the replacement. Test one team and all teams becoming unscorable.
- Readers: current team_ctpi_daily v2/beta; old scores can remain served despite corrected missing inputs. No actual data correction/publish performed.

## AFULL-TPWR1-01 — P1: local-calendar iteration skips or duplicates UTC dates at DST

- Location: `web/pages/api/v1/db/update-team-power-ratings.ts:154–177`.
- Claim: an inclusive requested UTC date window processes every date exactly once.
- Scenario/evidence: exact handler with process timezoneAmerica/New_York and Nov1–Nov2,2026 processes onlyNov1 and reports processedDays1/windowDays2. UTC-initialized Nov1 midnight advances by local setDate to Nov2 01Z, beyond the Nov2 00Z end. UTC control processes both dates. The same local/UTC mismatch can duplicate a date in spring. Hosted timezone was not read; finding applies when executed in a non-UTC zone.
- Suggested fix: advance UTC dates with setUTCDate or strict date-only helpers and independently assert processed dates equal the requested set. Pin DST spring/fall and UTC controls.
- Readers: team_power_ratings_daily and operational repair receipts. The probe returns no computed rows and writes nothing; it isolates the date loop, not rating math.

## AFULL-CSVR1-01 — P1: CSV data can override the resolved player identity

- Location: `web/pages/api/v1/db/upsert-csv.ts:138–175,195–217,263–285,287–317`.
- Claim: an import links each row only to its exact disambiguated player match.
- Scenario/evidence: name lookup resolvesJohnSmith toID1, but accepted uploaded column player_id=2 is assigned after supabaseRow.player_id=1. Exact handler sendsID2 to the insert double and responds success. Scenario uses an existing upload table so CREATE TABLE IF NOT EXISTS is a no-op; fresh-table duplicate-column rejection does not protect existing-table insertion. No PostgreSQL execution asserted. Name standardizer is an identity double to isolate post-resolution overwrite.
- Suggested fix: reserve player_id/upload_batch_id and reject all caller-defined collisions before any DDL or writes; assign trusted identity after validated user columns. Test both existing and fresh targets.
- Readers: uploaded datasets and player-linked downstream joins. No actual CSV or private player data was imported.

## AFULL-CSVR1-02 — P1: permissive numeric/boolean conversion silently changes CSV values

- Location: `web/pages/api/v1/db/upsert-csv.ts:287–317`.
- Claim: imported typed measurements preserve meaning or reject unsupported text.
- Scenario/evidence: NUMERIC text1,234 becomes1 through parseFloat; unknown BOOLEAN becomesfalse. Exact handler sends both to the insert double with success. INTEGER likewise accepts numeric prefixes/truncates decimals. Invalid nonempty boolean vocabulary is an invented measuredfalse, not unknown.
- Suggested fix: define accepted full-string numeric/boolean grammar, handle thousands separators only with an explicit format contract, reject/report invalid values or preserve null; retain zero and false as legitimate values. Extend existing CSV tests with comma/prefix/decimal/unknown cases.
- Readers: uploaded numeric/stat and boolean datasets. No production prevalence measured.

## Existing findings and full-source coverage

- Game stats721lines: identity, OFF/FINAL admission, complete team source, player source/batch and atomic persistence fully traced; existing CRON-W01 one-sided participant admission remains at source guard/flatten/persist. CRON-W02 quarantine malformed-tail finding is not newly attached to this path. PPTOI prefers validated right-rail clock then GS HTML fallback with exact two parsed side rows; failures remainnull. Goalie ratios/clock nullable, unsupported skaterfaceoffs/PPTOI/SHTOInull. Optional ordinary boxscore values default0, but no additional malformed-player scenario promoted beyond missing scoring witness. IDs/season/score have source validation; dependency errors normalized/sanitized. HTML fetch is not run. UnusedBaseType and all type contracts read.
- CTPI472lines: v2-only writer, v1frozen, canonical identity/version validation,31date bound, UTC date helpers, sourcegame gp1, date/team paginated joins, nullable PP/PK/count partners and latest timestamp, provenance fingerprints and omitted counts fully read. Automatic latestdate overlap handles late input but not earlier corrections outside its window. First run todayonly; old gaps warned and require explicit backfill. Four source streams concurrently read whole season; no snapshot transaction across them. Existing CTPIL1-01 rates-vs-exposure finding passes through replay/materialization, not repaired here. No fresh mathematical qualification. Destination writes chunk500, no per-date atomic replacement/completion receipt. Explicit all-empty source correctly skipped.
- Ratings342lines: method/query/body parsing, one-date dryRun, empty-table backfill, explicit-range and defaulttwo-daylate-arrival repair, genuinegames/fiveonfivegoalie v4, dailyall-teamnormalization, pooledspecialtiers and legacycarryversion/source-date fully read. Dormant POWER1-01 adapter is NOT called; active special-team context is used. TEAMR1-02 concerns a variance-series consumer, not the trend override used here, so it is not attached. Count-query errors not checked, range has no hard maximum; impossible calendar days can normalize. These remain bounded source limitations, no separate reproduced failure. Successful dryrun returns computedrows and skipsaudit; smokeTest alone canwrite and is not a dryrun. Stored fallback preserves legacyversions. No numericalmodel rerun.
- SOS153lines: currentcutoff-only rejects historicalstart, allclub schedules concurrent,429up to5attempts/exponentialbackoff, observation timestamps and pending/finality adaptation, versioned dailyupsert fully read. Existing SOSL1-01 missing/partialschedule coverage reaches writer unchanged. Response nhlRequests countsclubs, not retries; this is a diagnostic label limitation. No oldhistory repair or actual32requests.
- CSV374lines: exactname and position disambiguation, inputname requirement, identifier/type syntax validation, CREATEIFNOTEXISTS, sequentialidentitylookups, skip/unmatched accounting and finalINSERT fully read. No fuzzy identity fallback. Route is insertion, not idempotentupsert; repeated submissions can addnew UUIDrows. No deliberate uniqueness contract assumed. No table allowlist or row bound, weak creation-error substring filtering and malformedcsvData access beforetry are source limitations; no injection exploit attempted. Reserved-column and coercion findings are concrete reachable write-boundary failures.

No app source/test/config/ownership changes. All findings remain proposed fixes awaiting TJ after the complete report. No new source credit for bounded helper excerpts; provenance helper receives a new finding annotation in the canonical ledger only.
