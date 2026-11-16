# Stats landing, player, game and legacy catalogue pages

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; four complete files / 2,616 lines. `pages17-probe.cjs` passed; manifest and TSV retain full source hashes and per-symbol review. No supplied suite, production read or live rendering ran.

## AFULL-STATSP1-01 — P1: missing season totals select the hard-coded 2024–25 season

- Location: `web/pages/stats/player/[playerId].tsx:88–91,608–610,684–702,769–782,895–909`.
- Claim: the default player page uses the appropriate current/latest season, retaining the full selected-season log.
- Evidence: the local `getCurrentSeason` mock is called by SSR. With a known player, no season-total rows and twelve stored 2026–27 game logs, the exact SSR selects 20242025, finds no matching logs, then takes only ten unrestricted recent rows and marks the result as fallback. The explicit `season=20262027` control returns all twelve, with fallback false. The fallback warning is honest, but it was unnecessarily triggered by the wrong default; schedule context is consequently withheld and other season-bound reads target 2024–25.
- Fix direction: resolve the real season and distinguish unavailable totals from unavailable games. Preserve the date-bounded log and honest fallback semantics. Test a current-season debutant or temporarily absent totals with more than ten valid logs. Fixture database, date and NST/team dependencies are finite doubles; the source window helper is real. No actual rookie or data outage is asserted.

## AFULL-STATSP1-02 — P1: a nonstarter with no ice time can be called Starter

- Location: `web/pages/stats/game/[gameId].tsx:79–86,312–314,336–338`.
- Claim: the goalie matchup's Starter status has a positive starter witness.
- Evidence: exact `getStarter` receives one goalie with `starter:false`, `toi="00:00"`, no decision, and returns that goalie through its final array fallback. The JSX uses `decision || (goalie ? "Starter" : "Unavailable")`, producing Starter. Empty-array and explicit-starter controls behave correctly. This can affect pregame/unknown-start boxscores; no observed game or confirmed-start feed was queried.
- Fix direction: separate a candidate or appearing goalie from an official starter. Keep uncertain roles visibly unknown and require explicit starter evidence for that label. Test a roster-only boxscore, relief-only appearance and a confirmed starter.

## AFULL-STATSP1-03 — P2 legacy: ascending power-score sort is immediately undone

- Location: `web/pages/statsPlaceholder.tsx:63–79,81–108,244–250`.
- Evidence: the click handler sorts the state ascending, but `fantasyPowerRankings` always copies and sorts that state descending. Both displayed tables use the latter. The exact derived callback given ascending scores [1,2] returns [2,1]. The surface carries an explicit legacy notice; no current primary ranking is implicated.
- Fix direction: preserve a single canonical rank independently of the chosen display order, and render the selected order. Pin both sort directions without changing the numeric model. This is an exact callback fixture, not a click/browser test.

## Existing findings and contract extensions

- **PS10-04 P1** now has its entire page producer read: both goalie SELECT lists at player page 762–779 omit numeric elapsed time and quality-start classification, despite downstream summaries requiring them. Existing exact producer/projection/summary evidence remains valid; not rerun here.
- **LIB1-01 P1** reaches the full Stats landing through `fetchStatsData` at 627. The page preserves supplied leader values, qualified ratio empty states and per-position populations; its caller does not repair the upstream nullable-count-to-zero conversion.
- **UNDER18-02 P2** extends to the game page's head-to-head date label at 479: exact source expression for `2026-11-14`, run with `TZ=America/New_York`, displays November 13. Scores and winner selection are unchanged. This is the same date-only/UTC parsing defect already recorded for expanded-row charts.

## Full-source review

- Game page: strict ten-digit ID admission on client and SSR; boxscore envelope and matching ID; bounded keyed rail/boxscore/schedule reads; loading/error/unavailable states; explicit market source and client fetch-time label; no FHFH model substituted for missing market odds. Final head-to-head admission checks OFF/OVER/FINAL, known nonnegative scores and a nontied winner. Unknown score bars are withheld; 0–0 bars are neutral 50/50, 1–3 gives 25/75. Save fraction .9 displays .900. Percentage formatting heuristically accepts fractions and percentages; no provider-scale violation is claimed without that contract. Top skaters sort points/goals/shots/TOI; numeric fallback-to-zero and string clock ordering are limitations of the provider-shaped adapter, not newly proven malformed-row incidents.
- Stats landing: one server-season resolution for teams and leaderboards, canonical current-team identities, deterministic abbreviation sorting, independent team-load failure handling, all/position/goalie filters, qualified rate labels, empty states and shared desktop/mobile populations. Quick values preserve null as an em dash. Filter keyboard navigation wraps correctly by option count; team hover and viewport state are presentation behavior. No live leader or hydration behavior was checked.
- Player page: validated player ID; identity and position-specific stat families; selected-season totals and bounded paged WGO logs; date-indexed NST joins; explicit ten-game fallback; separately bounded playoff-year query; ascending histories and shared time-window/rolling helpers across tabs. Advanced/calendar/table consumers receive their declared season, fallback, missed-game and as-of contracts. The hard-coded current-season fallback is the new defect above. Query errors can become empty/fallback data with logs; no independent upstream outage was diagnosed.
- Player schedule: availability requires a usable season window and resolved season team, filters regular/playoff types, keeps future games separate, and requires team boxscore coverage before calling a past missing row a confirmed absence. Fallback logs suppress schedule context. Multi-team membership handling belongs to the previously reviewed resolver; no current-team-only accusation was added. Deployment tallies remain selected-season regular-season context, independent of the chosen last-N stat filter; they are not recalculated as last-N totals here.
- Player goalie precision: the known primitive projection omission remains PS10-04. Guarded summary calculations must not be loosened to compensate. Current code's fallback log does not pretend to be a complete season. Available-season labels derive from totals and can be empty when totals are unavailable; fixture evidence does not prove provider completeness.
- Legacy catalogue: canonical current team membership, current-season descriptive SOS version, one latest snapshot date and exact-date fetch, honest empty SOS state and hourly ISR. It reads legacy power rankings separately without a season/date filter and displays the same power-score population under both power/fantasy headings. Its explicit legacy notice is retained; no current forecasting qualification is inferred. An absent SOS snapshot also suppresses the otherwise independent power table. Sorting defect is recorded above; no database or model rebuild occurred.

No app changes, capture/Scout collisions, actual clients or environment values, production queries, page loads, provider requests, screenshots or messages.
