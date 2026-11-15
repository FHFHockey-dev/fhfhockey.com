# FxTwitter source coverage: one confirmed parser gap (goalie matchup "A vs B in goal")

Offline only: no X/Browserless requests, no production DB reads, no capture-key, schedule or deploy changes.

## Receipt traced
The newest locally retained FxTwitter-derived Lines receipt is `tasks/artifacts/drm-ddatv-2026-11-12/archive-public-sample.json`.
It holds two stored reports for one post:

- **Post:** `ByMHarrington`, original tweet 2119520323309617358, 2026-11-08 19:59:58Z.
  Text: "Colten Ellis vs Adin Hill in goal".
- **Copies:** relay 2119520673500741782 and the original. Both have `attributionStatus` resolved.

| Stage | Result |
| --- | --- |
| Source receipt | Present: received 20:02:08Z (relay) and 20:08:18Z (original) |
| Fetch | OK (stored, so no fetch failure) |
| Team and game matching | Matched team 54 (VGK) and game 2026020278 (BUF/VGK by hashtags, 11-08), report_date 2026-11-08, context `game` |
| Line parse (`interpretTweetUnits`) | `units: []`. This is correct: the post has no line structure. |
| Goalie events (`extractTweetPlayerEvents`) | **Gap.** Hill gets `goalie / confirmed / starter`. **Ellis gets no event**, even with both goalies in the roster. |
| Panel | Not traced (no API or DB read). By code: on the VGK row, Hill's confirmed event sets `observation_status` (`sourceObservations.ts:380-395`). Ellis had no event, so a BUF row could not be confirmed from this post. |

**Cause:** `web/lib/sources/tweetPlayerEvents.ts`.
- Each mention's evidence ends at the next mention.
- `coordinated()` joins mentions only on `,`, `&` or `and`.
- So Ellis's clause is just " vs ". The shared predicate "in goal" attaches only to Hill.

**Fix:**
- `vs` / `vs.` / `versus` between two **goalie** mentions shares the predicate only when the two goalies resolve to
  **opposite sides of the bound game**. Ingestion passes the bound game's two team ids (`boundGameTeamIds` in
  `linesCccIngestion.ts`), and only when the post's context is `game`.
- No game binding, a one-team or unknown game, a goalie with no team, a goalie outside the game, or two goalies on the same
  team: no sharing, so only the second goalie is confirmed (the old behaviour). Other callers pass no game and are unchanged.
- The matchup link joins only a lone goalie on each side. "Ellis and Lyon vs Hill in goal" no longer confirms both Sabres
  goalies (reproduced on cd5ab85b2, fixed after). A plain "and" list ("A and B in goal") still confirms both, as before.
- Production feeds the gate (code read): `update-line-sources.ts:380-388` and `update-lines-ccc.ts:256-264` map both home
  and away teams to the game and drop teams with two games that day (the gate then stays closed). Roster entries carry
  `teamId` from `rosters` (`lineSourceProcessing.ts:181-186`).
- First cut (f42acc8aa) shared the predicate for any two goalies, so two same-team goalies could both become confirmed
  starters, and the team filter downstream could not catch it. The follow-up commit closes that.
- Tests: `tweetInterpretation.test.ts` ("goalie matchup 'A vs B in goal'": opposite sides, same team, unresolved sides) and
  `linesCccIngestion.test.ts` (the retained post splits into a BUF and a VGK starter only when both teams share the game).
  Same-team, unresolved and ingestion cases fail on f42acc8aa and pass now.

**Version:** `TWEET_INTERPRETATION_VERSION` is bumped `2026-11-06.1` → `2026-11-15.1`. It is part of the immutable report
key and the claim version, so new reports sit beside the old ones. `projectedLineups.test.ts` checks that the pre-bump
report stays unchanged, both rows coexist, the internal reader returns both, and the public reader selects the current one.
Claims: `lib/lines/sourceClaims.test.ts` checks that the same post under both versions gets distinct claim ids and versions
and that `activeLineClaims` keeps only the newer one. The DRM history reader lists every version by design (existing test
"keeps claim versions/corrections"). No historical replay was run.
- **Release:** `tweetPlayerEvents.ts`, `linesCccIngestion.ts` and `tweetInterpretation.ts` must ship together.

**Production effect (code read, not run):**
- Rosters: the processor passes every team's roster (`linesCccIngestion.ts:1640,1770` flatten `rosterByTeam`), so Ellis is in scope.
- VGK row: the consumer drops events for another team (`sourceObservations.ts:160`), so Ellis's event cannot land on it.
- BUF row: `expandLinesCccGoalieClaims` now splits this post into a BUF child and a VGK child once it is reinterpreted.
  Whether a BUF row exists today in production is still unknown (the sample holds team 54 only).

**Checks:**
- New regressions fail on f42acc8aa and pass with the fix.
- Vitest across `lib/sources`, `lib/lines`, `lib/player-forecasts`, news feed, Lines API and line-source route tests:
  108 files, 3009 passed, 0 failed.
- Scoped eslint: exit 0. `npm run typecheck`: exit 0.

## Newest FORGE capture is not FxTwitter evidence
Pilot 3, CGY @ ANA, game 2026020328, cutoff 2026-11-15 20:10Z. Packet: `~/forge-pilot/capture-2026020328-20261115T201009Z/`.

- It reads no tweet-derived table. `preflight-stage.ts:253` loads board evidence only when `STARTER_BOARD_COMPUTE_ENABLED`
  is on, and it is off in production (also stated in `SPLIT-PARITY-EVIDENCE.md:69`).
- **`goalie_start_projections` is a baseline, not a confirmation path.**
  - `update-goalie-projections-v2.ts:449` always writes `confirmed_status: false`.
  - All six rows for this game show `updated_at` 2026-11-09T10:15:57Z, six days before the game.
  - Reading that as "the baseline was not refreshed after 11-09" is an inference, not checked.
- Classifying CGY @ ANA itself needs production reads. The five checks are below.

| Class | Evidence needed |
| --- | --- |
| No source post | FxTwitter shadow/intake rows from 2026-11-15 00:00Z to 2026-11-16 01:00Z that name CGY/ANA goalies or lines. Absence cannot separate "never posted" from an FxTwitter feed omission without X. |
| Failed fetch | `x_timeline_poll_runs` per-account read status over the same window |
| Parse rejection | `line_source_snapshots` / `lines_ccc` rows for those tweet ids: `classification`, `nhl_filter_status`, `status` |
| Unmatched | `line_claim_revisions` and `player_forecast_goalie_start_observations` / `lineup_assignments` for game 2026020328, plus team 20/24 rows with a null `game_id` |
| Not rendered | Prefer SELECTs. The `/api/v1/lines/projected` GET triggers fresh NHL observations. |

## Other checks
- **xPollerHealth report correction: on master.** When posts were stored inside the longest gap, the warning now says
  "the gap is in the run capture" (`web/lib/cron/xPollerHealth.ts:316-326`). It landed in 0e6fd60a8 (11-09), an ancestor
  of origin/master. The branch and master copies are identical.
- **Lines and DRM history files are on master** (`lines/history.ts`, `lines/projected.ts`, `LineHistory.tsx`).
  This shows the files exist on master, not that they are deployed.
- `web/lib/cron` differs from master only in `withCronJobAudit.ts`; the xPollerHealth files are unchanged.

## Where I searched for receipts
- `tasks/artifacts/` and the coordination handoffs (X-TIMELINE-SHADOW, IFTTT-TO-FXTWITTER-CUTOVER).
- The side-session notes.
- `~/forge-pilot/`.

- `x-poller-run-capture-2026-11-09/findings.md` (aggregates only).

The DRM sample above is the only raw post-level Lines receipt found. The Master Task List item text is not in the repo and was not located; I worked from the brief.
