# Trace: five unpriced Nov 22 plays in the RSO lane's 22:53Z readback

Chef, Nov 21 ~23:30–00:10Z. Sources: retained evidence plus bounded read-only DB reads (`default_transaction_read_only=on`), and one local read-only run of master's `loadExternalInputProof`. No reader GETs, no reruns, no writes.

**Verdict: no code defect. All five are expected next-slate timing.**
- The daily pipeline failed Nov 17–20.
- So these three teams' newest *proven* FORGE lines were issued Nov 13 and expired under the Daily bridge's 8-day validity.
- Edmonton's Nov 21 line sits in a private pregame publication, which is kept out of Daily by design.
- Each opponent in the affected games is priced, because it played on Nov 21 under recovery run `ced8d73f`.
- The natural Nov 22 10:05Z run should price all five. The 13:00Z signed-in recheck in the morning stays the confirmation.

## Rules that decide it (master `523ba0108`)
- **Lookback:** the bridge reads succeeded runs by `as_of_date` over a 7-day lookback and only admits runs with external-input proof (`forgeDailyBridge.ts:884-902`).
- **Line validity:** each served line expires at min(puck drop, `run.created_at` + 8 days) (`VALID_DAYS = 8`, line 477).
- **Pregame publications:** a run whose snapshot is a `qualified_pregame_receipt` proves exclusion only to its own game-scoped readback (`externalInputProof.ts:66-67`), so Daily treats it as unproven (withheld).

## Per player: first stage where the row is missing or refused

| Player (game) | Schedule/roster binding | Newest FORGE row | Proof | First failing stage, exact reason |
|---|---|---|---|---|
| McDavid 8478402 (0375 EDM@STL) | OK: EDM, 0375 on 11-22 | `f55203dc` as_of 11-21, game 0359 (live pregame, 18 EDM rows) | **unproven for Daily** (snapshotKind `qualified_pregame_receipt`) | **Daily bridge admission.** The pregame run is fenced by design. His older proven line `6b37dea6` (as_of 11-19, created **11-13 10:41Z**) expired 11-21 10:41Z. `lineWithheld(EDM)` then blocks even a labelled no-line row. |
| Carlson 8474590 (0374 BUF@TBL) | OK: TBL | `6b37dea6` as_of 11-19, game 0349 | proven (e1ab46318 attribution) | **Daily bridge serving:** line expired 11-21 10:41Z (created 11-13 + 8 d). TBL has no fresher run: daily runs failed 11-17..20, and TBL didn't play 11-20/21. |
| D'Astous 8480426 (0374) | OK: TBL | `6b37dea6`, game 0349 | proven | Same as Carlson. |
| Heiskanen 8480036 (0376 PIT@DAL) | OK: DAL | **none since as_of 11-07** | n/a | **FORGE generation (lineup), correct at the time:** missing from DAL `lineCombinations` for 0272–0327 (injured after 11-03, TOI 581 s) and back in 0342 (11-17) and 0358 (11-19). Run `6b37dea6` was built 11-13, while he was out. Its `skater_coverage` for 0358 lists him `unknown_by_reason.reserve_pass_disabled` (lineup 17/39). Rolling rows through 11-19 exist, so the 11-22 run can include him. **Not a defect.** |
| Oettinger 8479979 G (0376) | OK: DAL | goalie row `6b37dea6`, game 0358, starter_probability 0.9713 | proven | **Missing forecast, not a conditional goalie line:** the only goalie row is expired (same 11-13 issuance). Nothing current is served, so this isn't an "if he starts" line (compare Hart's "2.7/4.1 if GS"). |

## Control and teammates
- **Lekkerimäki 8483476 (0377 CHI@VAN):** priced 2.6 from `ced8d73f` (as_of 11-21, VAN 0371, created 11-21 18:13Z, proven via verified producer attribution), valid to puck drop.
- **Opponents in the affected games are all priced:** BUF (0374), STL (0375), PIT (0376), and CHI in the control game all have 18 skaters in `ced8d73f`. EDM, TBL and DAL have none there (EDM's 11-21 game was the live run).

## Optional low-severity follow-up (not a coverage defect)
McDavid's no-line reason reads as "a newer run cannot prove it excluded third-party projections". The run is actually a game-scoped pregame publication, proven within its own scope. A wording or classification fix would label it "private pregame publication". It doesn't change any value: points stay null either way.

Regression plan if wanted: a bridge unit test with an unproven `qualified_pregame_receipt` run for the team's latest date, asserting the new limitation text and unchanged `forecasts`.

## Morning checks (kept separate)
- 11:15Z: scheduled strict acceptance of the natural run (`acceptance/`).
- ~13:00Z: the RSO lane's signed-in Best projected points recheck. If the 11-22 run succeeds, all five plays should price; any still missing then is a real finding.
