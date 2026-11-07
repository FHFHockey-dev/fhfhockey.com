# Independent offline NST mapper review

Decision for Scout: no actionable mapper defect found in this bounded review. The frozen change is suitable for acceptance as an offline supplied-data mapper, subject to Scout's final decision. This is not acceptance of observed values, league rankings, source proof, live activation, or premium activation.

## Scope and evidence

Reviewed `nstCapture.ts` and its author tests, plus direct `adapter.ts`, `windows.ts`, `aggregation.ts`, `ranking.ts`, and the author handoff/reconciliation code and recorded output. Author tests and recorded checks were treated as claims; none were rerun as acceptance evidence. No broader audit was performed.

The requested frozen SHA256 values matched on entry:

- `web/lib/player-cards/nstCapture.ts`: `8febc82875c998d9b89c9e8d70194ddf25f204b6fcca8ef08b32d338c16bebb5`
- `web/lib/player-cards/nstCapture.test.ts`: `7c88e4a14687c325858eb4ca7b4c297368179dfedfc6d1a1837539a5829914ed`

`preservation-before.json` and `preservation-after.json` verify all 39 frozen/direct source and original author-packet files captured for this review were unchanged afterward. No Git/index operations were used. Branch is the canonical octoberBranch assignment, not independently verified with Git.

## Findings and contract checks

No defect with a failing reproduction was found. The following substantive checks passed:

- `nstCapture.ts:46–59,75–79`: table/strength guard and exact player/season/date matching; wrong identities cannot substitute for a missing selected row, and duplicate source rows are not pooled.
- `nstCapture.ts:64–82`: official frame appearances drive records. Multiple same-date game IDs are blocked; explicit zero PP exposure remains an appearance, while absent data stays missing.
- `nstCapture.ts:76–91`: each group's pre-final capture is blocked before timestamps are combined. Fresh individual data cannot conceal stale on-ice data, and independent individual values survive.
- `nstCapture.ts:93–100` through the direct window/adapter gates: invalid UTC basis, insufficient history-through, unknown participation, absent finality reference, and absent model reference produce missing qualified selected values. Mapping itself can retain diagnostic components from an unverified frame; it must not be used as display qualification.
- The mapper→adapter path retains distinct player appearance windows and known-short samples. A synthetic three-player PP case produces an ATOI pool of three (including measured zero), and a SOG/60 pool of two (excluding only the mathematically undefined zero-exposure value). A missing peer's shots blocks SOG/60 ranking rather than silently narrowing its pool, while unrelated on-ice rankings remain available. No GP/TOI/position threshold is introduced by this mapper.

These are synthetic contract probes, not synthetic proof of NHL population coverage. The actual historical capture still has unverified history/finality/date/model/population evidence. The author reconciliation records all 12 observed values unavailable and zero ranks; this was inspected, not reexecuted or promoted to new independent capture evidence.

## Actual execution

One independent suite was run once, using `/usr/local/bin/node` v22.11.0 and existing `web/node_modules/esbuild`; six grouped probes passed, exit 0. It ran from `web/`, bundled the frozen modules in memory, created no source/build outputs, and acquired/released `/private/tmp/fhfh-heavy.lock` atomically with an owner token. Fetch was replaced with a throwing offline guard; zero fetch attempts were recorded. The inspected import closure contains no transport/production calls.

Reproduction from repository root:

```sh
python3 tasks/artifacts/player-cards-2026-10-25/observed-adapter-01-review/run-probes.py
```

See `probes.mjs`, `probe-results.json`, `probes.log`, and `command.json` for exact cases, assertions, command, and receipt. No historical suite, typecheck, lint, browser/server, dependency install, network/provider/model call, remote read, deployment, or production request was executed. npm was not needed; existing installed packages were used without changing package-manager artifacts.

## Remaining acceptance boundary

The API deliberately accepts typed, explicit evidence declarations and opaque references; it does not authenticate their contents. `source.definition/version` are stamped onto output records from the declared source contract, and `population.complete/reference/expectedPlayerIds` remain supplied assertions. The reviewer cannot turn those declarations into genuine provider/model or same-definition all-NHL population evidence. Before any observed ranking is accepted, Scout must inspect those actual receipts, including every applicable NHL player's metric state and real appearance/finality/history/date proof. No code finding here removes that gate.

Only the new review directory and the separate reviewer diary were written. The worker did not delegate. Actual Chef model/effort hierarchy is not exposed and is not claimed verified. Scout owns final acceptance; the one-review/one-suite budget is complete.
