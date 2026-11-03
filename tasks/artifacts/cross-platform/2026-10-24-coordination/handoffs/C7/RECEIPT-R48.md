# C7 review R48 (pre-release): `02153acba` (FORGE preflight freshness anchor) and `2d1798003` (route-runner "Copy all")

**Verdict: accept with limits.**
- Both commits are correct.
- **Must change before release: P1 (release gate).** `02153acba` changes the producer closure to **`5644e3fd…`** (194 modules, 0 findings), and it isn't allowlisted. List it with a commit-backed receipt, as `1da7239c4` did for `87edd78f`.
- Info note: A1 (UTC "today" in ET evenings).

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I used `git archive` snapshots at `/private/tmp/c7-r48` of `02153acba` and both parents.
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- Evidence is in `r48-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **`02153acba`**: preflight, `run-projection-v2`, pipeline, runner | **107/107** |
| **Preflight parent** (`2d1798003`, with the new preflight test) | **2/10.** The future-slate pass cases (4, 5 and 6 days ahead, and after an off-day), the goalie-priors-for-future-slate case, the past-slate anchor case and the helper case all fail. "Today's slate" fails only on the new `freshnessAnchorDate` field in the summary. The 2 **stale-as-of-today** cases pass on **both**: they already failed on the parent and still fail on the commit. |
| **Runner parent** (`9b462e9c9`, with the new runner test) | **6/8.** "copies every terminal line as plain text and confirms it" and "falls back to a plain-text copy when the clipboard API is unavailable" fail. |
| **Closure** (the committed scanner) | `02153acba`: **`5644e3fdb1e230e0a063a27b52519cc8e70b88272e92f27ca5aadc8f53d1dea4`**, 194 modules, **0 findings**. The parent is `87edd78f`. The allowlist at `02153acba` lists `4bf0fce7`, `4c06fd9e`, `c1f0129a` and `87edd78f`, **not `5644e3fd`**. `pages/db/runner.tsx` isn't in the closure, so `2d1798003` doesn't affect it. |

## 02153acba: FORGE preflight

| Question | Evidence | Result |
| --- | --- | --- |
| **Are today's and past dates' strictness exactly unchanged?** | `preflightFreshnessAnchorDate(asOfDate) = asOfDate < today ? asOfDate : today`, so for any `asOfDate ≤ today` the anchor **is** `asOfDate`, and every replaced use (`fetchRecentTeamLineCombinations`, derived skater, team and goalie freshness `[anchor−7, anchor)`, the ingest window `[anchor−14, anchor)`, goalie-game staleness `[anchor−30, anchor)`, and line-combo age) gets the same argument as before. The existing `run-projection-v2` suite passes at the commit (21/21), and "anchors a past slate at its own date, not today" passes. | Unchanged (by construction and test) |
| **Do inputs stale as of today still fail?** | For a future date the windows end at **today**, the same windows today's own run checks. "fails a future slate whose inputs are stale as of today, exactly as today's run does" and "fails a future slate whose line combinations are hard-stale as of today" pass. | Holds |
| **Are goalie start priors still required per scheduled game?** | Scheduled games, teams and the goalie start-prior gate stay on `asOfDate` (`.eq("date", asOfDate)`; remediation `update-goalie-projections-v2?date=${asOfDate}`). "still requires goalie start priors for the future slate's scheduled games" passes, and fails on the parent only because the old windows also failed. | Holds |
| **Is `bypassPreflight` untouched?** | The `bypassed` early return (`preflight_bypass` gate) has no diff lines. | Untouched |
| **UTC "today" versus ET-evening runs** | The scheduled pipeline runs at **10:05–10:55 UTC** (`vercel.json`), when the UTC and ET dates agree, so scheduled runs are exact. A **manual** run in an ET evening (UTC already the next day): the ET run date and "ET tomorrow" anchor at their own dates (unchanged). Dates **beyond** ET tomorrow anchor at UTC today, which is ET tomorrow, one day later than an ET anchor would give. Their windows then end at ET tomorrow, so they include ET today's not-yet-ingested games and drop the oldest day. That's slightly **stricter** (it may 422 a team whose last game was exactly 7 days back), **never laxer**. This matches the route's own UTC default `asOfDate`. | Acceptable (A1) |
| **422 body** | It carries `freshnessAnchorDate`, so failures are diagnosable. | — |

| # | Severity | Note |
| --- | --- | --- |
| **P1** | **Release gate** | **`5644e3fd` isn't allowlisted.** Any release containing `02153acba` stamps it, so its uncaptured runs are withheld until a commit-backed receipt lists it. |
| **A1** | Info | **In ET-evening manual runs, the UTC anchor can be one day stricter** for dates two or more days ahead. If those runs become routine, consider anchoring at the pipeline's ET run date. It can't admit stale data. |

## 2d1798003: route-runner "Copy all"

- **Plain text only:** `navigator.clipboard.writeText(events.map(terminalLine).join("\n"))`. The text uses the same `terminalLine` the terminal renders, now shared, so it's exactly what's shown, in order. The fallback is a hidden read-only `<textarea>` with `document.execCommand("copy")`, removed in `finally`.
- **Behaviour:** the button is disabled with no events and shows "Copied" or "Copy unavailable" for 1.5 s.
- **No new surface:** no API, fetch or auth change, and no HTML or rich-text clipboard.
- **CSS:** the new `.terminalTools` is a **pure** class selector, so it's safe under the CSS Modules purity rule.
- **Accept.**
