# FORGE audit triage (Chef, 2026-11-16 ~14:55Z)

Inputs:
- the blind audit (`blind/AUDIT.md`), whose author was told nothing about TJ's observations;
- the Chef's re-checks (`CHEF-VERIFICATION.md`);
- the advisor's comparison with TJ's notes.

## TJ's observations, explained

| TJ saw | Cause (evidence) | Status |
|---|---|---|
| Many players have no projection on RSO | Three causes stack. (1) **Serving gate (C1):** every run since 11-13 is withheld because its producer hash `ee5581d9…` is missing from `verifiedForgeReleases.ts`; today RSO re-aims 11-09 lines for 70 players and withholds 49. (2) **Pipeline (C2, H1):** completed on 4 of the last 16 days; today it is stuck in `projection_execution` since 10:20Z with no retake. (3) **Design:** only the last game's dressed 18 skaters get a line, and the reserve pass ("if he dresses" lines for everyone else) is off. | Observed |
| Injured players have no projection | FORGE has **no injury input at all**: `forge_roster_events` has 0 rows ever and `player_status_history` has been dead since 04-22. A player who missed the team's last game falls outside the lineup and gets no line, because the reserve pass is off (`reserveProjections.ts:25-27`; `forge_reserve_projections` has had 0 rows ever). The RSO bridge drops players missing from their team's latest run (`forgeDailyBridge.ts:583`). RSO also leaves Yahoo-Out (IR/O) players out of lineups (`planning.ts:743-770`). Today: 23 skaters on 4 teams who dressed this season have no line, among them Schmaltz, Cooley, Guenther and Demidov. The cause is "not in the last lineup", not an injury signal. | Observed |
| Slow projection loading | The audit read the code: every edit re-reads everything with `no-store` and a 20 s abort; FORGE results have no server cache; nine paged reads run serially. The server job took 4.5–5.6 s on good days and 141–182 s on 11-13 and 11-14. | **Not measured** in a browser |
| Slow Yahoo connection or refresh | Tracer claim: about 65 Yahoo reads per provider sync, then up to three planning loads. Provider refresh every 5 min, full snapshot every 30 min (`RosterScheduleOptimizer.tsx:48,51`). | **Not measured** |

## Checks that unblocked the next step
- **Closure:** `forge-producer-closure.ts` run on clean exports.
  - `e1ab46318e` reproduces `ee5581d9…`.
  - `master` `5c42cb14f` and HEAD give `9944628e4582…`, which is **not listed**.
  - Appending to the allowlist leaves the hash unchanged, so one release can fix C1.
- **Production deploy:** a Git deploy of `5c42cb14f` (Vercel `githubCommitSha` set), so its runs carry a real SHA. Tomorrow's runs will stamp `9944628e…` and be withheld unless it is listed.
- **Timing:** the 11-09 lines expire about 05:16–05:36 ET tomorrow (11-17 10:16–10:36Z). The pipeline starts at 05:05 ET.
- **Ownership:** `verifiedForgeReleases.ts` has been in the Codex RSO admission lane's custody (last entries 11-09 and 11-10). The mailbox shows no current claim on these hashes.
- **Reserve pass:** shipped in #430 behind `FORGE_RESERVE_PASS_ENABLED` (default off).
  - It writes `forge_reserve_projections` only, outside team TOI reconciliation, so it doesn't dilute teammates.
  - The table exists with 0 rows. The L9c diary queued the flag for TJ on 11-12.
  - Its runtime cost against the one spare cron slot is unmeasured.

## Lanes (proposed)
1. **C1 release:**
   - list `9944628e…` (current build) and `ee5581d9…` (11-13 runs), each with a verify-script receipt;
   - commit on octoberBranch, then release to master: 1 fhfhockey build and 3 cancels.
2. **Injured display, RSO:**
   - project every rostered player ("if he dresses");
   - Yahoo-Out players get a greyed or red value tagged "Injured, not counted", left out of totals;
   - the value counts as soon as the status clears.
   - Then turn the reserve flag on after a runtime check, with a separate approval.
3. **Gate guard:** a build-time check that the stamped closure is listed, plus a cron-report alert. Must land with or before any pipeline fix.
4. **Pipeline reliability:**
   - C2: retake a stage after its lease expires; give child steps a deadline; NHL fetch timeouts.
   - H1: a game rejected at precheck degrades the stage instead of failing it.
   - M4: the PP step says "deferred", not success.
5. **Read paths:**
   - H3: choose the run per game, not per date;
   - H5: page the `rosters` read;
   - H6: no fallback to another slate;
   - L3: ET default dates.
6. **Projection math (after tonight's capture; changes parity oracles):**
   - H4: scale a short pool's team target;
   - M3: count the roster-row drop.
7. **Slowness:** one bounded measurement of the RSO load and the Yahoo refresh.

Not proposed: re-running today's stuck pipeline (a separate approval, and it shouldn't run near the capture window).
