# SKO ingest and targeted retrieval

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; all2,080 lines of `web/pages/api/v1/db/update-sko-stats.ts` fully read. Symbols/hashes are in batch-pages-10.tsv/manifest. Exact frozen AST probe `sko-route-probe.cjs` passed after correcting its child-process options argument; no application change. Pure date-fns/shift normalization and finite inert query/Fetch doubles only, no application/client imports or actual requests/writes.

## AFULL-SKOR1-01 — P1: latest stored date is treated as a completion watermark

- Location: `update-sko-stats.ts:568–620,835–1004,1675–1689,2000–2046`.
- Claim: default incremental refresh completes the current season through today.
- Evidence/scenario: exact window helper given season startOct1, latest storedOct1 and todayOct1 returns upToDate=true/startDate=null. The MAX-date query supplies no completion receipt. A day with only one primary player row, a still-missing companion report, or an early partial game population is upserted and advances that date. Late same-day games and report completion are then excluded from subsequent default runs; tomorrow startsOct2. This does not assume partial commit of one atomic upsert.
- Suggested fix: advance a separately verified complete-day watermark, with finalized source population/companion coverage; explicitly revalidate incomplete latest dates. Pin early-day/late-game and missing-companion recovery cases.
- Readers: stored sko_skater_stats and downstream SKO pooled metrics. No actual partial date or historical wrong value was queried.

## AFULL-SKOR1-02 — P1: capped shift reads can create false confirmed zeros

- Location: `update-sko-stats.ts:195–228,248–269,276–316,894–930`.
- Claim: a missing goalsForAgainst report becomes zero only when stored shifts independently confirm no on-ice goals.
- Evidence/scenario: exact loader against a finite1000-row cap receives1000 of1001 available shifts. Targetplayer1 has one early shift in the retained set and a later100–110 shift in the omitted row; a goal at105 is returned. Capped path countsGF0/GA0 and resolves shift_confirmed_zero. Complete-data control countsGF1 and correctly leaves the missing report unknown. Neither shift nor event query paginates, orders or proves complete coverage. The1000 cap is a synthetic counterexample, not a measured hosted setting.
- Suggested fix: stable paginated reads plus required shift/event completeness/finality evidence; preserve unknown when a cap or partial ingest cannot be excluded. Test a goal-bearing omitted shift and missing goal-event page.
- Readers: persisted ES/PP/SH goals-for and pooled SKO IPP. No live zero or bad database write asserted.

## AFULL-SKOR1-03 — P1: targeted player retrieval ignores the requested ID

- Location: `update-sko-stats.ts:1751–1814,1875–1955,2055–2064`.
- Claim: playerId/name mode fetches that player's data.
- Evidence/scenario: exact function requested ID1/nameJohnSmith accepts and returns summary playerId2 from a same-name response. All16 emitted requests use a substring name predicate and none uses the ID; no result-ID filter is applied. The passed playerId is unused.
- Suggested fix: filter each provider report by canonical playerId and validate every returned row; treat a name as display/search input only. Pin same-name and omitted-name cases.
- Readers: admin targeted inspection response; this branch does not persist data. Reachable wrong-player response, not a live occurrence claim.

## AFULL-SKOR1-04 — P1: targeted bios date bounds are reversed

- Location: `update-sko-stats.ts:1795–1801`.
- Claim: targeted reports cover season start through today.
- Evidence/scenario: fixedNov15 clock/Oct1 season start emits bios gameDate<=Oct1 23:59:59 AND gameDate>=Nov15; all other reports use the opposite correct bounds. This bios interval is empty after opening day. Exact captured URL is retained in probe-output.json.
- Suggested fix: share a correctly ordered date predicate across all reports; test start/end equality and later dates.
- Readers: skatersBio in the targeted inspection response. No bios provider request was made.

## Full-file arithmetic, control flow and limits

- Explicit28-column projection excludes unsupported/undefined values. Finite normalization preserves null/undefined/empty as unknown. Per60 derives from seconds using3600; source percentage/rate units retained; single-game IPP is alwaysnull. Pooled IPP requires at least2rows, all components, positive summedGF and points<=GF; exact control2points/4GF=50, singleton/nullcomponent remainnull.
- Shift normalization is the exact frozen shared pure module. Goal boundary is(start,end], SO excluded; absent shifts or unknown goal time/team stayunknown. Type505 shift records excluded. The capped-read finding is independent of correct arithmetic on complete inputs.
- Daily fetching16report families/page100 continues when any report fills the page, with player-ID sort ties. Regularseason gameType2/date-inclusive scope; no HTTP-ok/schema admission or hard page/runtime bound. Those are source limitations, not independently reproduced provider failures.
- Active writer matches companion rows by playerID, resolves/validates season and leaves absent companions unknown unless zero is qualified. Shift read failure leavesunknown. Diagnostics record counts/date hints without proving provider completeness. Inclusive date loop has no deadline/cursor. Full mode uses active date-window function; it does not call the old season implementation.
- Dormant updateSkaterStatsForSeason1007–1660 was fully read: legacy repeated field maps, nested loops/date mutation/early return and inert null-update counter are not treated as active runtime findings. No dormant function executed.
- Handler/auth/offseason/audit, GET/POST query parameter precedence and error response fully read. Explicit incremental mode precedes date/player; full mode uses season bounds, default follows MAX-date selection. No flag values/environment were inspected. Supplied tests were source-reviewed in earlier batches and not rerun. No source fixes, live pages, providers, DB operations, capture/Scout edits or suites.
