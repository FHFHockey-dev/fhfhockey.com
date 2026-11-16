# Line history and odds sources

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; four files fully read, 1,772 lines, 555 unique ledger entries. Exact hashes in `batch-lib-sources-1-manifest.json`. Verdict: accept with findings. The first combined source output truncated; each line-history file was subsequently read in full in bounded output before receiving credit.

## AFULL-SOURCE1-01 — P1 — odds matched to a different game date

- **Location/claim:** `web/lib/sources/oddsSourceIngestion.ts:340–348,446–457,674–682`; market and prop inputs must refer to the selected game, with stable identity and date basis.
- **Evidence:** exact frozen normalizers in `sources1-probe.cjs`, output `sources1-probe-output.json`; pinned caller `web/pages/api/v1/db/update-market-prices.ts:222–274,330–357` inspected as context, without full-file credit.
- **Scenario/defect:** a local TBL–MTL game on November 14 is matched to an external TBL–MTL event commencing November 16 because `findLocalGameByTeams` checks only home/away IDs. The later event's prices receive the November 14 local game ID; `matchedEvents` also requests that later event's props against the earlier local game. Likewise an NHL weekly-schedule row dated November 16 with a different explicit game ID falls back to the November 14 game by team pair. The probe confirms both wrong assignments. A multi-day schedule/provider response is accepted input; the normalizers do not check its date. No actual erroneous production row is claimed.
- **Suggested fix:** require exact NHL game identity; for external events require a unique pairing by team IDs and a verified schedule date/start-time basis. Do not fall back from a mismatched known game ID to team-only matching. Validate the returned prop event against the selected event/game before attribution.
- **Readers/writers:** update-market-prices deduplicates and upserts these rows into `market_prices_daily`, `prop_market_prices_daily` and provenance; native market queries, goalie market blending and player-prop comparisons can receive wrong-game prices.
- **Tests:** supplied tests cover matching-date happy paths only. Exact offline mismatched-date probes passed (reproduced failure); no Vitest or route execution.

## AFULL-SOURCE1-02 — P1 — market freshness uses a different clock

- **Location/claim:** `oddsSourceIngestion.ts:459–466,501–502,570–582,614–615`; a quote's age and expiry must come from its own supported observation, with unknown clocks preserved.
- **Evidence:** same exact-code probe, plus exact `isFreshAt` extracted from `web/lib/projections/queries/market-queries.ts:69–80`.
- **Scenario/defect:** market timestamp 12:00, bookmaker timestamp 14:00 yields a quote observed at 12:00 but expiring at 14:15. The reader accepts it at 14:05 despite the declared featured TTL being 15 minutes. Prop normalization repeats the mismatch with its ten-minute TTL. If both publication clocks are missing, kickoff time substitutes for observation and yields kickoff-plus-TTL freshness; it is not evidence of quote publication. Reader rejection of future observations protects the pre-kickoff interval, but does not repair fabricated provenance or the old-market/new-book case.
- **Suggested fix:** normalize one qualified market observation timestamp and derive that row's expiry from it. Keep absent provider publication time explicit, with any transport receipt time separately named and governed by an explicit policy; never use event start as publication time. Test mixed book/market clocks, absent clocks and stale-market admission through the reader.
- **Readers:** both persisted market tables, source provenance and native market summaries/comparisons. This concerns producer timestamps, distinct from the previously recorded cross-market source-rank selection defect.
- **Controls:** NHL decimal `1.75` still yields null American price and implied probability `1/1.75`; no truncation regression. Synthetic probes only; no live quote, provider, database or hosted-number claim.

## Retained checks

- Line-history cursors bind mode/team/date/as-of, reject filter grammar injection and preserve submillisecond keyset boundaries. Reads use bounded 50+1 pages, a 200-game scope guard, explicit prefix progression and no automatic unbounded walk. Invalid payloads count as skipped rather than vanishing from progress.
- Game-linked claims require identity, publication, semantic spans, schedule identity, team participation and supported claim context. Practice/unresolved publication browsing remains separate, with game linkage unverified and coverage unknown. Revisions/corrections remain visible rather than being collapsed into current units. Publication dates use the Eastern calendar, and public DTOs withhold private evidence and unsafe attribution.
- Odds formats are declared at the boundary; decimal metadata and null American columns survive. Same-provider NHL pairs are formed before row creation. Source rankings, TTL units, markets and redacted provenance URLs are explicit. No provider URL was fetched.
- Supplied two test files were completely read, not executed. Probe runs full frozen pure ingestion, team catalog and odds parser dependencies plus the exact reader freshness predicate; imports of production application code and services were not used.
