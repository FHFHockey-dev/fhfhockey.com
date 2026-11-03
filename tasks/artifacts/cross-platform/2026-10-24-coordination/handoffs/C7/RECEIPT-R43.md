# C7 review R43: `074694095` (FORGE reserve pass, flag off) and `6fb1812c1` (R42 fixes)

**Verdict: accept with limits.**
- **Reserve pass:** with the flag off it behaves as before. It reads reserve rows only for proof-admitted runs, keeps them out of every other reader, and follows TJ's counting answer.
- **R42 fixes:** A1, A2, A4 and A7 each close their finding.
- **Limits:**
  - **X1 (release gate):** the producer closure at HEAD is a new, **unlisted** `c1f0129a…`. A release of HEAD as it stands would withhold its own uncaptured runs until that closure gets a commit-backed receipt.
  - **M1 (low-medium):** the unapplied migration gives anon and authenticated the default `ALL` grants (insert, update, delete, truncate), unlike the existing FORGE tables.
  - Other notes: N1–N4.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commits** (`git archive` at `/private/tmp/c7-r43`), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_RESERVE_PASS_ENABLED` and `GAME_PREDICTIONS_REQUIRE_FORGE_PROOF` unset.
- Evidence is in `r43-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **HEAD `6fb1812c1`**: the reserve suites, bridge, payload, local-attempt, proof, allowlist, featureBuilder, publicPredictions, workflow | **242/243.** The one failure is **my environment**: `reserveProjections.test.ts` "is read and written only by…" shells out to `git grep`, and my archive isn't a Git checkout. My own `git grep forge_reserve_projections` at `6fb1812c1` finds exactly the 4 non-test files the test expects (`reserveProjections.ts`, the `run-forge-projections.ts` source audit, `persistence-stage.ts`, `forgeDailyBridge.ts`). |
| **Reserve parent** (`595ab13d9`, with the commit's reserve tests) | **80/94**, and `reserveProjections.test.ts` can't load. All 14 new reserve and payload cases fail, plus 1 local-attempt case. |
| **Fixes parent** (`074694095`, with the fix tests) | **133/143.** The 10 new A1, A2, A4 and A7 cases fail. |
| **Flag-off regression** (the **parent's** unchanged `forgeDailyBridge.test.ts`, run against the reserve commit's bridge code) | **71/71** |

## 074694095: FORGE reserve pass

| Question | Evidence | Result |
| --- | --- | --- |
| **Flag off: identical behaviour, 4 MB budget, no reads of the new table?** | `forgeReservePassEnabled()` is exactly `"true"`, so it's off by default. **Writer:** the skater stage builds `reserveCandidates = []` **before** any `fetchPlayerMetaByIds` or `fetchRollingRows` call, and the goalie stage loops over `[]`, so there are no extra reads or writes (the `rosterGoalieIds` field is carried but unused). **Bridge:** the read is `Promise.resolve(undefined)`, so `reserves === undefined` keeps the expanded budget at **`FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET` = 4 MB**. Reserve maps are empty, the goalie guard reduces to the old `p === undefined \|\| !source`, the limitation text is unchanged, the wire row size and fitting are unchanged (no row has a reserve code), and `PLANNING_RESPONSE_BYTE_BUDGET` stays 4 MB. **Measured:** the parent's own bridge tests pass unchanged on the new code (71/71). | Holds |
| **Reserve rows only for admitted runs?** | They're read with `.in("run_id", runIds)`, where `runIds` are the proof-admitted latest runs per date. The builder then also requires `runs.has(row.run_id)` (only proven runs enter `runs`), `horizon_games === 1`, the team's **latest** run date, and the matching class and conditioning. | Holds |
| **Do they stay out of Start Chart, team totals, accuracy and game revisions?** | They're written only by `persistForgeReserveProjectionRows` to `forge_reserve_projections`, **after** the team row (skaters) and goalie row (goalies). The only reader is the RSO bridge (`git grep` above). `excluded_from_team_totals: true` is recorded. The local-attempt test asserts lineup rows, team totals, goalie rows and the output hash are unchanged. | Holds |
| **Is the count-0 labelled and per TJ's answer?** | `emitReserve` gives `stats` **zeroed** (null stays null) and **`conditionalStats`** = the full conditional line (kept visible), with `appearanceProbability` **null** (participation unknown). A per-row note says "plans count 0 (a conservative assumption, not a zero chance); the conditional line is kept separately". Goalies with no start share: `startProbability` null, an "if he starts" line, counted 0, labelled `goalie:start_unknown`. A run-level limitation counts the reserve player-games. Reserve rows that don't fit the budget are withheld **all together**, with a stated reason. | Holds |
| **Confirmed in and confirmed out** | `skater:confirmed_lineup` counts the full line with appearance **1**. `skater:confirmed_out` counts 0 with appearance **0**, keeping the line. Every unconfirmed state (projected lineup or scratch, return, uncertain, disputed, ruled out at run, no evidence, evidence unavailable) counts 0 and is named. A lineup line issued for that game always beats a reserve line. | Holds (N2) |
| **Is the producer closure still free of pundit reads?** | At `074694095` and at `6fb1812c1`: **`c1f0129a…cc4aa`**, **194 modules** (now including `reserveProjections.ts`), **0 findings**. | Holds, but see **X1** |
| **Is the migration schema sound (not applied)?** | The PK is `(run_id, game_id, player_id, horizon_games)`, matching the upsert target. FKs go to `forge_runs`, `games`, `players` and `teams`, with types matching `forge_player_projections` (`bigint`/`smallint`). There's a class and conditioning `CHECK`, a shutout range check, an `uncertainty jsonb not null`, run and player indexes, and RLS enabled with a `public_read` select policy. The "not cleared on resume" gap is acknowledged; the bridge prefers lineup lines, and resumed runs fail single-invocation admission unless captured. | Sound, except **M1** |

| # | Severity | Finding |
| --- | --- | --- |
| **X1** | **Release gate** (availability, not safety) | **The producer closure changed and isn't listed.** The reserve pass adds `reserveProjections.ts` and edits the stages, so the closure at `074694095` and `6fb1812c1` is **`c1f0129aca9b2520cbd922cf81c292661b1499fa50b024f76ca6283d362cc4aa`** (194 modules, 0 findings), **even with the flag off**. The allowlist lists only `4c06fd9e` (`595ab13d9`). A deploy of HEAD would stamp `c1f0129a`, so its uncaptured runs (production capture is off) are **unproven**, and RSO, Start Chart and the FORGE routes would serve only older proven runs within their lookbacks. Before release, add a **commit-backed** receipt for the release commit's closure (verifier `--` that commit). It fails closed, but the flag being off doesn't avoid it. |
| **M1** | **Low-medium** (migration) | **No `revoke` before the grants.** The baseline's `ALTER DEFAULT PRIVILEGES … GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon/authenticated` (`production_schema_baseline.sql:44823-44824`) applies to new public tables. This migration only **adds** `grant select`, so anon and authenticated keep insert, update, delete and **truncate**. RLS blocks DML through PostgREST, and PostgREST can't issue `TRUNCATE`, but this is broader than the comment's "same exposure as the FORGE projection tables" (`forge_player_projections` has **only** `SELECT` for anon and authenticated, baseline `:43715-43716`). Add `revoke all on table public.forge_reserve_projections from public, anon, authenticated;` before the grants, as the reviewed-object-grants migration does. |
| **N1** | Info | **Turning the flag on before the migration is applied fails runs:** `persistForgeReserveProjectionRows` throws, and the migration comment says so. Keep the order: apply, then flag. |
| **N2** | Info | **An unconfirmed "out" outranks confirmed lineup news.** In `skaterState`, an unconfirmed availability "out" returns `projected_scratch` (count 0) before a **confirmed** lineup assertion is checked. That's conservative, but a confirmed-in skater with a stale unconfirmed scratch report counts 0. |
| **N3** | Info | **The structural reader test needs a Git checkout:** it runs `git grep --untracked` in the working tree. It's fine in the repo and in CI, but it fails in archive-based runs, and it would be fragile if `GIT_DIR` were ever set during tests (the 10-19 incident pattern). |
| **N4** | Info | **With the flag on, the stand-in "if he starts" line can be the team starter's.** A goalie with neither his own reserve row nor his own starter row gets `teamGoalieLatest` (the team starter's line) as his "if he starts" line, labelled `goalie:start_unknown`. That's the existing fallback design, but the label doesn't say the line is the team starter's. |

## 6fb1812c1: R42 fixes

| R42 finding | Fix | Closed? |
| --- | --- | --- |
| **A1:** unreproducible `6613c9ef` allowlisted | It's de-listed. Every closure entry now needs a `commit`, and its receipt must have `sha === commit`, a recorded tree, and no `source` (no worktree export). `4c06fd9e` is backed by `595ab13d9`, whose receipt sha256 `8b651750…7f42` matches; the receipt declares `sha 595ab13d9…`, 0 findings, closure `4c06fd9e`, 193 modules. **I reproduced `4c06fd9e` from `595ab13d9` in R42.** The test can't re-derive the closure offline, but an auditor can. | **Yes** |
| **A2:** a failed proof read hid contradiction | **Feature builder:** a failed classification means **no** FORGE team row is used, with a fallback flag and a warning. **Snapshot reuse:** a failed read means **rebuild** (no reuse). **Public payload:** a failed read labels predictions `proof_unavailable`, never `unproven`. | **Yes**, with one note: stored predictions stay **visible** while the proof is unreadable (labelled), so one built from a contradicted run can still be shown during an outage. That's a deliberate availability choice, and it's disclosed. |
| **A4:** pre-V2 stamps were admitted | `verifiedRunAttribution` denies a stamp without an array `code_versions` before parsing. | **Yes** |
| **A7:** "contradicted" overstated | Split into `claim_withheld` (the snapshot lacks the claim) and `malformed_capture` (claim present, but the receipt or identity is invalid). Both are withheld (`forgeProjectionAdmissible` admits only `proven` or `unproven`). Public ranks: withheld, then `proof_unavailable`, `unproven`, `proven`. | **Yes** |
