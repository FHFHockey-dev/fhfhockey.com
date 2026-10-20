# P2 handoff - SKO Outlook / VuDu Phase 0

Status: **local Phase0 candidate complete; Chef review pending**. No release, hosted-data, calibration or predictive-qualification claim. Existing source defects are documented proposals, not repaired or closed.

## Ownership and runtime

- Worker `/root/p2_sko`; actual `gpt-6.1-sol`, `high` verified from own turn_context metadata before edits; Chef `xhigh` confirmed in assigned ticket/register. No FAST or further delegation.
- Canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; starting HEAD `8a6ac8adccee73fae8e07045c86b374ce8c98008` from Chef's pinned register. Local branch/status read confirmed concurrent dirty files. No Git mutation, hosted/provider call, credential inspection, existing-source edit, UI/API/database/FORGE change, installation or build.
- Exact paths declared to Chef before edits. Sustainability tests are read-only to P2; P7 retains their ownership. REGISTER.md, STATUS-CHECK.md and P2-TICKET.md are Chef-owned and unchanged by P2.

## Exact created files

All paths below are relative to the canonical checkout. These five files are the complete P2 write set; there are no modified preexisting files:

1. `web/lib/sko/gap.ts` - pure basis-tagged native/oriented gap, explicit missingness, display normalization, pooled-rate/VuDu math and watch labels.
2. `web/lib/sko/gap.test.ts` - 19 fixture-only test cases including all four named scenarios, examples, lower-is-better, basis/invalid input, pooled SV%/GAA and zero exposure.
3. `tasks/codex-sprint-2026-10-19/sko-vudu/PHASE0-CONTRACT.md` - cited score/sign/band inventory, four defect verdicts, exact source map, executable contract and phase crosswalk.
4. `tasks/codex-sprint-2026-10-19/sko-vudu/PLAN-EXCERPTS.md` - exact relevant PDF section5/section7 text from pages3-5, source SHA-256, Phase0-3 acceptance lines for P5.
5. `tasks/codex-sprint-2026-10-19/sko-vudu/P2-HANDOFF.md` - this receipt; its own SHA-256 is supplied separately to Chef to avoid a self-referential hash.

| Created file | SHA-256 |
| --- | --- |
| `web/lib/sko/gap.ts` | `a7447d66b99d89207d5d7c4e1330a7bb4475414c79beb05596c58f891bf197a3` |
| `web/lib/sko/gap.test.ts` | `3cc39295db378b2ccf53771b952f3d8ff10b2bd60c254047c6d849f40efd0be3` |
| `tasks/codex-sprint-2026-10-19/sko-vudu/PHASE0-CONTRACT.md` | `c2c9fc753cb08aa441ad805b44620ee078068d3c33ef1023f45dd625cd7368aa` |
| `tasks/codex-sprint-2026-10-19/sko-vudu/PLAN-EXCERPTS.md` | `7d47fd0f8c3139139eedddcf0a07e03704b4da6031fbb0d03ca0e3cacc9bbbed` |

## Verification receipt

| Check | Executor / result | Evidence and boundary |
| --- | --- | --- |
| Safety inspection before tests | P2 PASS | New test imports only vitest and pure gap.ts; no network/client/filesystem/process/Git imports. Existing vitest.config.mts and setup inspected; setup uses inert unit-test defaults. No ignored env files opened. |
| `npm test -- lib/sko/gap.test.ts` from web/ | P2 PASS, exit0 | First run 19/19 at 18:45:04; after Chef identified a literal zero-shot contract edge, added positive-saves/zero-shots assertion and early null return, then reran 19/19 at 18:45:46. Nonfatal Node punycode deprecation only. Both completed; no test process running. |
| Independent focused gap suite | Chef-reported PASS 19/19 | Chef message confirms independent rerun against frozen source hashes after zero-exposure correction. Not represented as a second P2 execution. |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` from web/ | Chef-reported PASS, exit0 | Shared check over P2 frozen source hashes and P6 final source; serialized by Chef, not duplicated by worker. |
| `npm run lint` from web/ | Chef-reported PASS, exit0 | 0 errors, 68 existing warnings in other paths; none in P2 files, per Chef receipt. |
| `git diff --check -- web/lib/sko tasks/codex-sprint-2026-10-19/sko-vudu` | P2 PASS, exit0 | Read-only tracked-diff check; new files are untracked, so supplemented with direct whitespace/final-newline inspection. |
| Direct created-file whitespace / citation check | P2 PASS | New source/report files have no trailing whitespace and end in newline. Citation target/first-range existence checked; abbreviated component path expanded. Semantic citations inspected in source; this is not a rendered-browser check. |
| Build, browser, hosted/player trace, backtest, training, provider call, production request | NOT RUN | Out of scope. Focused tests prove arithmetic/validation only. |

No failed application check occurred. Shared checks remain authoritative only at their stated local snapshot. P2 has no running process/session ID; Chef's completed global session was 65226.

## Acceptance matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| One sign/meaning contract with exact citations | PASS for assigned local scope | PHASE0-CONTRACT.md inventory distinguishes canonical sigmoid, additive helper, classifier, band, pressure/tier/quintile and preview meanings. High-score reader mismatch exists in read.ts:23-31 and entitySurface.ts:262-267 via entitySurfaceServer.ts:664-666, versus Durable UI badge. |
| Four known defect verdicts | PASS, defects remain open | Contract confirms uncapped season references, zero coercions, serving identity/freshness bypasses, personalized priors unused by canonical windows. Config validation itself is explicitly distinguished from consumer enforcement. |
| Exact source map | PASS at source-query level | Contract covers all 22 registered band labels, underlying numerator/denominator fields, seven unsupported cases, canonical score/prior inputs, legacy projection/schedule/context queries. Units are consumer interpretations; unknown strength/vintage/rights remain explicit. |
| Pure module/API and four named scenarios | PASS | gap.ts and gap.test.ts frozen hashes above; 19/19 tests, matched source basis and requested basis, missing nulls, exact sign/examples, zero shots including inconsistent positive saves. |
| No new type/lint errors | PASS, Chef receipt | Shared tsc/lint exit0; no warning in owned source. |
| Scope preservation | PASS for P2 actions | Only five created paths enumerated above. Existing sustainability/preview/FORGE sources read only; concurrent changes not attributed to this lane. |
| Phase0-3 wording to P5 | PASS | Sent to Chef; exact PDF acceptance at PLAN-EXCERPTS.md:58-59,66-67,73-74,81. No later-phase work begun. |

## Unresolved inputs and later proposals

No current local implementation blocker. Chef still owns final review/integration. Existing defects and ambiguous input strength/time/vintage semantics require separate authorized work before Phase 1. Provider/version/rights, real-player API/UI trace, goalie adapter acceptance, predictive qualification and production scales/thresholds are unverified and unchosen. The existing fixture UI is an input, not Phase 1 completion.

The new API intentionally requires explicit basis on both expected/recent values and on requested output, with optional lowerIsBetter=false. It preserves missing numeric values as null fields in the gap object; direct nonfinite values throw. Watch thresholds use native oriented-gap units with inclusive bounds; exact zero never labels. Caller still owns target/context/cutoff comparability. The 0.4 display scale and 0.1 watch threshold are illustrative tests only.

## Audited current critical-input hashes

These bind central source citations to the local bytes inspected; no hosted parity assertion follows. P7 may separately edit tests, never these source files in this lane.

| Read-only source | SHA-256 |
| --- | --- |
| `web/lib/sustainability/score.ts` | `027393d9401d8990fd02bba25785c77a83e54b993efc1fc1864b43f7ce795f50` |
| `web/lib/sustainability/config.ts` | `e9913412ad82102c3517e131098db617b48d8d8f73d8892ca179df92eeafb1da` |
| `web/lib/sustainability/bands.ts` | `63f6a5e9ecce21710378e246c3537c1755067dc7844a309bc645f35024668e6a` |
| `web/lib/sustainability/bandCalculator.ts` | `c34751dbfa9a4a09c257c75f0f3168d410713cf3cc59ba9790c7ad9f111fd77a` |
| `web/lib/sustainability/guardrails.ts` | `56d71186ecc0a423d4750470179ec538b4f11f28573217fa31117a81da906116` |
| `web/lib/sustainability/distribution.ts` | `98d51f21b4b84ea885f54e1cbb5ae95eb8f006c2ef32dbb3a2577f0fcfb99c29` |
| `web/lib/sustainability/read.ts` | `b2228e7334f4321f9ed793f62545012f806f80e30afe4cb1e0f684dbe7dc15ab` |
| `web/lib/sustainability/windows.ts` | `dd5bf3e514045027ce44436876088fdb88dea141c120eda0d25bfdfa9ff7c384` |
| `web/lib/sustainability/priors.ts` | `819101c9e50ecc0daf9649129369afdd8042adfce6ec03e534ffc86cb1732e3a` |
| `web/lib/sustainability/trendsIdentity.ts` | `a6558e4f947105348ee17d615a9bfa79be75325c287a8c0bcbfb601501706532` |
| `web/lib/sustainability/entitySurface.ts` | `4481e8bcbc2124bbfaaf8940003dfcfa9c16ad7f073affbacd3a5ab3c4e10f23` |
| `web/lib/sustainability/entitySurfaceServer.ts` | `9fac56eb01947c1baf90d5177a802009e24667e5abeeb5c3d9c2fc36adeed3ee` |
