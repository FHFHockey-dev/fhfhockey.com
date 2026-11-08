# C7 review R49 (urgent, pre-release): `107673704` (D6 timing inference ungated) and `eff1b377a` ("no FORGE line" labelled 0)

**Verdict: accept with limits.**
- **Must change before release: P1 (release gate).** `eff1b377a`'s producer closure **`bf23edfe…`** (194 modules, 0 findings) reproduces from the commit but **isn't allowlisted**. List it with a commit-backed receipt, or every new uncaptured run is withheld.
- Both commits otherwise do what they claim.
- Known limits, accepted by design, are L1–L4.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I used `git archive` snapshots at `/private/tmp/c7-r49` of `eff1b377a` and both parents.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `RSO_YAHOO_DIET`, `FORGE_RESERVE_PASS_ENABLED` and `FORGE_PROJECTION_DAYS_AHEAD` unset.
- Evidence is in `r49-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **`eff1b377a`** (both commits): bridge, payload, planning, the RSO data route, the manual, e2e and Yahoo acceptance packets, Yahoo rosterPlanning, yahooDiet | **429/429** |
| **D6 parent** (`fe285adcf`, with its tests) | **158/164.** All 6 inference cases fail with `expected 'unknown' to be 'same_day'/'next_day'` (flag off), including the Y1 limitation-wording case. |
| **No-line parent** (`107673704`, with its tests) | **88/100.** The new no-line, withheld-run, conditional-never-counted, confirmed-out, goalie `start_unknown(_team_line)` and payload/budget cases fail (`expected 4000000 to be 6000000`; `expected [1880] to have a length of 3196`). |
| **Regression** (the **parent's** unchanged bridge tests, run against the new bridge) | **80/89.** All 9 failures are the intended change. Cases that asserted "no forecast" now see the labelled 0 (`expected +0 to be null`, `true to be false` for presence checks). The old "1 goalies with no start share get no forecast" wording is replaced. A maximal week (pass off) now carries the "labelled 0s withheld" limitation. Lineup rows are unchanged (2,240 served in the maximal week, as before). |
| **Closure** | `eff1b377a`: **`bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b`**, 194 modules, **0 findings** (the parent is `5644e3fd`). The allowlist at `eff1b377a` now lists `5644e3fd` (**R48 P1 closed**) but **not `bf23edfe`**. `rosterPlanning.ts` isn't in the closure, so D6 doesn't move it. |

## 107673704: D6 ungated

| Question | Evidence | Result |
| --- | --- | --- |
| **Is a manager override still first?** | `supplementProviderRules` is unchanged and applies the manager's explicit timing over the inferred one, dropping the inferred-evidence label (test "lets the manager's explicit timing replace the inferred one": `next_day` over inferred `same_day`, no conflicts). | Holds |
| **Do unknown values stay unknown?** | `inferredTiming = fresh ? yahooInferredAcquisitionTiming(settings) : null`. Only `"intraday"` gives `same_day` and `"tomorrow"` gives `next_day`. `"1"`, `""`, `null`, `"weekly"` and anything from a non-fresh read give `unknown`, with **no** evidence entry (tests). The note and evidence entry follow `inferredTiming` only. `capabilities.rules` stays false. The unreported-rules text says "whether the add timing inferred … is right". | Holds |
| **Is diet-flag-on behaviour unchanged?** | Flag on, the result was already `diet && fresh ? … : null`; now it's `fresh ? … : null`. Same value. yahooDiet's flag-`"1"` cases are unchanged; only the flag-`""` expectations moved. The flag still gates only the read reductions. | Holds |
| **Production effect** | Every connected Yahoo daily league with a fresh settings read now gets labelled inferred timing, so candidate plans become evaluable (the P1 cause). | Intended (TJ D6) |

**Carry-over (info, R39 Y4):** an override with the **same** value as the inferred one drops the inferred label without adding a manager-evidence label. This now affects all users. It's minor.

## eff1b377a: "no FORGE line" labelled conservative 0

| Question | Evidence | Result |
| --- | --- | --- |
| **Is the conditional line ever counted?** | The row is emitted with `stats` = **all 0** (every template key, plus every key the conditional line names) and the last proven line only as `conditionalStats`. Bridge `allowedUses.conditionalTieBreak` is `false`, and planning reads `stats` for totals. The test "keeps the last proven line as 'if he plays', visible but never counted" shows `candidateHorizonPoints` = **0**, not 0.35×… and not null. | Never counted |
| **Can a withheld or unproven run's player get a masking 0?** | No. A 0 needs a **proven** anchor run for the team (`teamRun` from proven skater rows; with none, there's no 0). It's suppressed when **any withheld run** is dated **on or after** the team's latest proven date **and** the team plays that date. With no schedule rows, every withheld run counts as possibly covering the team. Withheld runs are exactly the loader's newer-than-proven or no-proven-per-date unproven runs, whose rows are never read. Such players get **no forecast**, counted in "N players have no proven FORGE line because a newer run … cannot prove …; they get no forecast rather than a 0". Every run withheld still means schedule-only. A failed proof read still fails the bridge. | Holds |
| **Is participation null?** | `startProbability` is `null`. The skater `appearanceProbability` comes from `reserveAppearanceProbability("skater:no_forge_line")`, which is `null` (only `confirmed_lineup`/`confirmed_out` give 1 or 0); goalies get none. | Holds |
| **Are real lines and confirmed outs unchanged?** | The pass runs **after** the lineup, reserve and goalie paths and fills only `(player, game)` pairs not already served. Players whose line exists but is unreadable (`unknownHeads`, unknown power play) are **skipped**, so they stay unknown. The test "still counts a confirmed out as 0 and leaves players with real lines unchanged" passes (and fails on the parent). **One intended change with the pass off:** goalies with no start share now get the existing labelled-0 `goalie:start_unknown(_team_line)` row where they used to get nothing. | Holds |
| **Expanded budget 4 MB to 6 MB for all users; payload and trim** | `FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET` is now 6 MB for everyone, and the reserve budget is an alias. The wire budget (2.5 MB) and the response budget (4 MB) are unchanged. "No FORGE line" rows join the all-or-nothing reserve group (`isReserveLine`), so when full coverage doesn't fit they're withheld **together**, before any lineup trim. **Measured (author's receipt; the payload test reproduces the row counts):** typical 7-day: 3,196 rows, 5.26 MB expanded, 1.31 MB wire, 5.68 MB unpacked snapshot, full coverage. Maximal 7-day: 6.26 MB, so the 0s are withheld and 2,240 rows (lineup) served. 14-day: withheld, lineup as before. The unpacked snapshot stays under the 8 MiB preservation ceiling. | Holds, with L1 |

| # | Severity | Note |
| --- | --- | --- |
| **P1** | **Release gate** | **`bf23edfe` isn't allowlisted** (only `bridgeForecastWire.ts`'s two note codes changed in the closure). |
| **L1** | Medium (acknowledged) | **In a maximal week (4 games per team) or a window over 7 days, all labelled 0s are withheld together.** One uncovered rostered player then blanks every candidate's net points again (the original P1). The limitation says so, and the fix is the forecast/snapshot split. Worth tracking, since playoff-heavy or back-to-back weeks can hit "maximal". |
| **L2** | Info (by design) | **"Missing from the team's latest run" and "traded" skaters now count 0, not unknown.** That means injured, scratched or moved players, the latter with no conditional line because their old line is for another team. It's labelled. It changes totals for every user, not just those with uncovered players. |
| **L3** | Info | **The full-week unpacked snapshot is ~5.7 MB.** The local workspace save doesn't hold forecasts, but the preservation journal (`sessionStorage`, rare) embeds the provider snapshot and may exceed a ~5 MiB Web Storage quota. Its write would fail closed. This already applied with the reserve pass on. |
| **L4** | Info | **`goalie:team_line` is still emitted only with the reserve pass on**, while `start_unknown_team_line` now appears with it off. With the pass off, a known-share goalie using his team starter's line isn't labelled as such (the pre-existing flag-off behaviour). |
