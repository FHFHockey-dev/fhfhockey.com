# FORGE pipeline reliability · local verification

Local implementation on `octoberBranch` at `2493d5e9e`. The Master Task List records released web SHA `69317010`. Release reconciliation and hosted acceptance remain pending.

## Retained evidence

The two-invocation November 16 slate run `26373189-3ebd-4380-b4f4-c6797d469ca9` completed games 2026020331 and 2026020332. Its totals cover 132 eligible skater-games, 69 lineup projections, zero reserves and 63 unknowns. Its detailed receipt contains only Utah and Vancouver, accounting for 32 of those unknowns. It attributes Nick Schmaltz's missing Utah line to `reserve_pass_disabled`. The 31 unknowns inferred for the other game lack individual reasons in this receipt. The live RSO toggle retained a count of three missing players without identifying them. [Retained producer metrics](../forge-projection-audit-2026-11-16/blind/sql/021.csv) · [Schedule](../forge-projection-audit-2026-11-16/blind/sql/051.csv)

## Local results

- On a forced handoff, the producer preserved all eight team-game records across four fixture games, with the same player IDs, reasons and totals as uninterrupted execution. The interrupted game took the cutoff of its successful retry. Missing evidence in older checkpoints stayed absent.
- Ordinary public runs record a conservative availability time after acknowledgement of the succeeded row. The accuracy metadata and witness writers preserve each other's fields in both write orders. The existing public input snapshot supplies a post-success observation for captured runs. The worktree verifier found zero violations across 239 producer modules. [Source verifier receipt](worktree-closure.json)
- The RSO loader selected an earlier published line one millisecond before the resumed run's observation. Its original source supplied 0.20 projected goals. After publication both the exact and reused lines carried 0.35 goals and the original game's cutoff through the wire. In the separate Schmaltz replay, a one-center roster legally started him with unknown points. A conditional estimate stayed out of totals. Confirmed-out evidence yielded a known zero. That replay supplied timing evidence in the repaired shape. The historical database run lacks those new fields.
- The served snapshot's existing response now counts usable exact and reused bridge lines, confirmed outs, conditional-only estimates and unavailable player-games against the identified pregame universe. Exact versus reused follows the ledger's run-slate-date comparison. Per-target eligibility and scoring still have their own rules.
- The portable host adapter called the owner's queue at concurrency one against local fixtures. Duplicate wakes made one claim and one save. Killing the process after save left the game unqualified through recovery. A reported source timeout stopped a second independently invoked game across restart. A subsequent game could proceed after a qualified first game. The fixture provided custody and timestamping.

## Reproduction

The combined run passed all 422 tests in 15 files. The focused publication replay also passed with the prior run admitted by captured proof and the resumed run admitted by its two matching producer stamps. The release verifier produced the attached worktree receipt.

```sh
cd web
npm test -- \
  lib/projections/run-forge-projections.resume.test.ts \
  lib/projections/run-forge-projections.local-attempt.test.ts \
  lib/projections/run-forge-projections.external-inputs.test.ts \
  __tests__/pages/api/v1/db/run-projection-accuracy.test.ts \
  __tests__/pages/api/v1/db/run-projection-v2.test.ts \
  lib/projections/externalInputProof.test.ts \
  lib/rosterScheduleData/forgeDailyBridge.test.ts \
  lib/rosterScheduleData/laterImpactInputs.test.ts \
  lib/rosterScheduleData/forgeReservePayload.test.ts \
  lib/rosterScheduleOptimizer/lineupGaps.test.ts \
  lib/player-forecasts/servedForecastLedger.test.ts \
  __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts \
  scripts/forge-pregame-host.test.ts \
  scripts/forge-pregame-slate.test.ts \
  lib/projections/pregameCapture/slateQueue.test.ts \
  --maxWorkers=1 --reporter=dot --silent
npm test -- lib/rosterScheduleData/forgeDailyBridge.test.ts -t 'replays the last published'
npm run typecheck
NODE_PATH=. node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/verify-forge-release-sha.ts --worktree \
  --receipt ../tasks/artifacts/forge-pipeline-reliability-2026-11-17/worktree-closure.json
git diff --check
```

## Release and hosted acceptance

Chef owns the reconciled release candidate, the existing release and oracle checks, and the #463 carry-forward. The verified local closure hash is `ed6b86763d8642b1371206f04debb3719c7f030103c3a7fe629d3127a8825f84`. After release, compare the existing scheduled receipts on a quiet slate and a busy slate. Check publication time, per-game cutoff and coverage, RSO readback and the identified universe. Historic ambiguous rows may withhold or fall back to an earlier eligible run.

Chef owns the private hosted pilot. Approve one future game, start time, exact clean candidate, host and shared private state root. On the host set `FHFH_ENV_FILE` and pin the installed PostgreSQL client with `FHFH_PSQL_BIN`. The existing Mac executable remains the default. The focused command `npm test -- scripts/forge-pregame-host.test.ts -t 'operator load gate'` passed after the 422-test run. It exercised the real load-gate script with a local fixture executable, including its busy and missing-client refusals. Require a single claim/save and separately verified database readback and trusted timestamp by T−60 with the Mac offline. The existing live queue gives writer and verifier separate clients using the same service-role key. Credential separation and independent operator readback remain hosted acceptance matters. No deployment, schedule change, live capture or historical rerun was performed.

TJ subsequently selected Supabase Cron and Vercel for the hosted pilot. The selected path keeps the dispatch state in PostgreSQL and runs the existing capture in one Next.js invocation. It has no local disk or `psql` dependency at runtime. The connected local rehearsal delivered a SQL-signed request to the endpoint, saved and independently verified one committed fixture packet, then delivered the same request again and read the existing result. Chef owns the one-game hosted acceptance on a reconciled release candidate. [Deployment prerequisites, local check and canary procedure](../forge-pregame-capture-2026-11-14/operator/hosted-dispatch.md)

The hosted checks used a disposable database with 44 dispatch assertions, including the connected canary enqueue. The Pages route, Vercel duration configuration, hosted adapter, capture runner and two existing pilot CLIs passed 47 Vitest cases across these invocations.

```sh
# repository root
LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_hosted_dispatch.py --with-route
cd web
npm test -- --run __tests__/pages/api/v1/db/forge-pregame-capture.test.ts lib/blsh/nativeCaptureV6/handler.test.ts
npm test -- --run lib/projections/pregameCapture/runner.test.ts lib/projections/pregameCapture/hostedGame.test.ts scripts/forge-pregame-capture.test.ts scripts/forge-pregame-slate.test.ts
npm run typecheck
```
