# C7 independent review — SS1-3 (SS1-O1…O4)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, no production. **Serverless:** I judged a browser run not essential (see "Byte stability"), so :3110 was never started and had 0 listeners at the end. Evidence is in `r7-evidence/ss1-r1/`.

**Verdict: accepted.** O1–O4 are fixed as specified, there is no new leak, and the default and extra card PNGs are byte-stable.

## Pins

- **Patch:** `SS1-3.patch` `b6dee9e2…c53f`, which matches and `git apply --check --reverse` cleanly against the working tree.
- **Lease files:** all **18** in `HASHES-3.txt` equal the canonical tree (`shasum -c`: 0 mismatches).
- **Changes from `HASHES-2`:**
  - Changed: `server.ts`, `[format].ts` (API), `matchups.ts`, `schedule.test.ts` and the e2e spec.
  - New: `teamRates.ts` and its test.
  - **Unchanged:** `SocialShare.tsx`, `SocialShare.module.scss`, `export.ts`, `mondayGrid.ts`, `schedule.ts`, `types.ts`, `fixtures.ts` and the page.
  - The `matchups.ts` change is **type-only**: the new `ShareTeamRateRow` type and a parameter type.

## Executed

**59/59 pass** (`ss1r1.json`).
- SS1's 45: schedule 28, matchups 8, mondayGrid 6, teamRates 3. This reproduces their 45/45.
- My 14 controls, which use a mocked schedule and a fake anon client, so nothing was read live.

**Mistake of mine (log kept as `ss1r1-run1.json`):** run 1 failed L1 because my fake rows used team codes `T0…T31`, which match no fixture team. The layer became `partial` with no team rates. With real fixture abbreviations, it passes.

| SS1 item | C7 evidence | Result |
| --- | --- | --- |
| **O1** only ready editions shared | O1a sweeps the remaining validity from 0 to 8 h in 17 s steps × opponent state {ready, missing, partial, stale} on a real fixture edition. For every result: `public, max-age=0`; s-maxage ≤ 300; swr ≤ 300; s-maxage + swr ≤ `expiresAt − now − 600 s`; unready opponents ≤ 60 s with no swr; `no-store` only when usable < 60 s. **0 violations.** O1b: partial edition, stale source and blocked format all give `no-store`. O1c (real API handler): a ready 200 gives `public, max-age=0, s-maxage=300, stale-while-revalidate=300`; the out-of-season 400, schedule 503 and POST 405 all stay `no-store`. | Fixed |
| **O2** no stats read on schedule failure | A schedule rejection makes **0** rate reads. A success makes exactly 1 read (`[0,63]`) after the schedule read. | Fixed |
| **O3** out-of-season `weekStart` | With the request pinned to 2026-10-26, `2025-08-04` and `2028-07-31` are accepted (the season edges). `2025-07-28`, `2028-08-07`, `2099-01-05` and `1990-01-01` return **400** "weekStart must fall in the 2025–26, 2026–27 or 2027–28 NHL season." with **0** schedule and **0** rate reads, `no-store`. The check runs before any read, for blocked formats too (code read). | Fixed |
| **O4** explicit limit | The new `teamRates.ts` calls `fetchAllSupabasePages(..., { pageSize: 64, limit: 64 })`. A 70-row source makes **one** range `[0,63]` and then fails closed ("incomplete or over the row limit"), so the layer is `missing`. A 32-row source loads. The select reads **7 columns**, with no `team_name`. | Fixed |
| **No new leak** | Fake rows also carry `team_name` and `secret` columns. The API JSON's per-team keys are exactly `gp, xga, xgf`, with no extra or name. Errors stay generic (unchanged). | Holds |

## Byte stability

- **Reasoning:** card rendering can't change, because every client-side file the cards use is byte-identical to SS1-2 and `matchups.ts` differs only in types. The PNG bytes come from those files plus fixture JSON the e2e mocks; `server.ts` and the API aren't in the e2e data path.
- **SS1's evidence agrees:**
  - The pinned before/after runs (`t3/pinned-before-ss1-3/`, `t3/pinned-after/`) are byte-identical: grid `7f4cf9c0…` (the same value since ticket 1), easiest `d91622b6…`, stream `2676d8b2…`.
  - `t3/evidence/*.sha256` verify against the PNGs on disk (`shasum -c`: 3 OK).
  - SS1's e2e `t3/results.json` shows 12/12 with 0 flaky tests, and asserts all three pins.
- **Not re-run:** I didn't re-run the e2e, as I judged it non-essential given the above.

## Observations (not blockers)

- **SS1-R1-O1 (unverified CDN behaviour):** whether Vercel's edge honours `s-maxage` when the client sends `fetch(..., { cache: "no-store" })` is unverified. SS1 says so too. A preview check needs TJ's approval.
- **SS1-R1-O2:** a request with no `weekStart` (the URL has only `format`) is cached under one URL. Around the Monday rollover in New York it could keep serving the previous week's edition for up to s-maxage + swr (≤ 10 min) while that edition is still valid. This is cosmetic; the card shows its week and check time.
- **SS1-R1-O3:** Game Grid's `loadCurrentSeasonStats` keeps its unbounded pager for Game Grid's own use. SS1 no longer calls it at runtime; adding a limit there is Codex's call.
