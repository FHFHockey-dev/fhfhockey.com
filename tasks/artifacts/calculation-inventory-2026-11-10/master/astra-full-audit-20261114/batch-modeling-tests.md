# Modeling test audit — target89da739cb

All three assigned files were read fully, reusing previously completed ranges. Independently byte-compared against `git show 89da739cb:<path>`: all match. The TSV contains **254 rows:248 definitions (including nested helpers/classes) and6 module assignments**, covering167 top-level test functions. Parametrized case counts differ from function counts.

No application code or tests edited. No model training, DB connection, provider/network/page calls, PG startup/retry, or whole-suite execution. The prior51 passing selected cases were not rerun. Only one new standard-library AST probe ran, with a fake database driver and no application imports. Current serving reach remains unverified; all existing ADV/PY findings are treated as dormant/research **P2** under governing§5, irrespective of stale P1 labels in the source advanced report.

| File | Read extent | Bytes | SHA256 |
|---|---|---:|---|
| `modeling/player_forecasts/tests/test_harness.py` | 1–4484, full | 237987 | `caff68ff6e975c8450f8641558d3b37f5ee982268fd69423f1cc125ba9848810` |
| `modeling/player_forecasts/tests/test_l15_label_queries_pg.py` | 1–174, full | 7977 | `acfd3c01fdc492768b0571b5c99bc0b160708a059733756886e61668fddaf7a1` |
| `modeling/player_forecasts/tests/test_l15_season_evaluator.py` | 1–457, full | 22729 | `4f9917b51b16ac5a6d33989818d2ee3a6dd62c3ef2f145a52dde89b3fd8e8e43` |

## New source/test finding

**AFULL-TEST-01 — disposable-local PG restriction is documentation only (P2, test-only).**

- **Location:** `test_l15_label_queries_pg.py:1-4,17-18,69-74`.
- **Claim checked:** the test says its DSN is for a disposable local Postgres, never production. Its fixture performs writes to public schema.
- **Evidence:** target89da739cb; exact `cursor` function body compiled from AST with its pytest decorator removed and a fake driver, using DSN `postgresql://audit.invalid/disposable`. `/tmp/astra-modeling-tests/pg_fixture_probe.py` printed connect with that unchanged remote-looking DSN, then `execute('create table public.games (…')`, then rollback. Exit0. **No real driver import, socket, DB call, PG startup or credential used.**
- **Wrong behavior/scenario:** if `L15_PG_DSN` is accidentally set to a nonlocal database, module skip checks only nonemptiness; fixture forwards it to psycopg and issues DDL. A populated database may reject the first existing table, but that still makes a remote connection/write attempt; an otherwise empty remote schema accepts transaction-local creation. Rollback is useful cleanup, not enforcement of the local-only boundary.
- **Suggested fix:** parse/restrict the connection target to an explicit local Unix socket/loopback allowlist before connecting, refuse ambiguous/multi-host remote targets, and require an explicitly disposable fixture database. Add a fake-driver test showing rejection occurs before connect/DDL. Preserve transactional isolation.
- **Readers affected:** only this opt-in pytest fixture and its two SQL label tests; no production runtime path identified. This is not evidence any remote DB was previously contacted.

## What the tests establish—and what they miss

The TSV records each function's actual assertion/exception oracles, a coverage limitation, and whether it ran previously or was only read. `audited` denotes reviewed test source, **not** a test pass or proof of the implementation. Names alone are not treated as evidence. Helpers have their local calls and owning fixture listed; they do not become independent tests. Existing finding IDs on a test row mean the test **misses or partly covers** that finding, not that the existing test reproduces it.

| Area / strongest evidence | Material boundary or missing regression |
|---|---|
| PP engineering `test_harness.py:19-127`: selected-window units, canonical zero, invalid parameters, prior bounds, unchanged baseline fallback; L15 pin tests429-457 | Engineering rate fixtures and historical hash pins only. No qualified original packet, count forecast, held-out score, live integration or promotion. |
| PP receipt capture130-557: byte preservation, immutable versions, zero certificates, scope/identity/cutoff/selection/order/budgets and invalid hashes | Fictional receipts deliberately disclose their status. Validating self-supplied metadata does not authenticate an actual producer or qualify forecasts. |
| Official/candidate/settlement560-1109: explicit starts/scratches, unknown participation, late predictions, identity conflicts, missing scoring category, checksum tampering and rehashed semantic tampering | Valuable non-tautological negative tests. Mocked provider payloads do not establish production prevalence, full real parser coverage, or database-export authenticity. |
| Runner1117-1392: cached receipts checked again, failures isolated, locks/concurrency bounded, latest eligible candidate,128-checkpoint cap, atomic partial cleanup | Runtime bodies are mocked where needed. Assertions about request counts/local threading do not prove production cost/concurrency behavior. |
| Strength/context1395-1743: source conflicts keep totals, measured zero separate, matched exposure math, future-poison invariance, known ridge result, fit/evaluation separation | Useful hand-computable oracles. No retrospective fixture should be relabelled prospective. Training functions in several tests were **not executed in this batch**. |
| Issuer1790-1853 and L15:274-306: replay, same policy, late cutoff/publication, fixed baseline label | Missing/null selectionEvidence accepted is not covered (AFULL-PY-04). Default fixed-baseline issuance is correctly named; it does not prove policy selection. |
| Daily-board evaluator2022-2152: matched pairs, checkpoint separation, conditioning, CRPS .5, Brier .04, joint fantasy [6,6], unknown comparators excluded | Repeated result/hash equality proves determinism. Metadata `captured_live` in synthetic fixtures is not authenticated live evidence. |
| Controlled scenario2179-2321: per-draw accounting, one credited win, shootout distinction, OT termination, positive pace covariance, expected shot mean and deadline crossing | These are stronger than labels alone but explicitly unvalidated simulation. No relief, scientific calibration, real population fit, or production accuracy is established. |
| Contracts2424-2463 | Version, checksum verifier and literal policy checks detect document drift. They do not establish implementation semantics; team identity test2446 is only SQL string presence. |
| Advanced receipt2788-2839 | Despite “requires every target,” all targets are supplied and none removed. Only acceptance is tested; no losing loss, absent target, uncalibrated interval or mismatched emitted coverage mutation. Corroborates ADV-05. |
| Advanced “golden” vectors2808-2822 | `expectedHash=sha256(canonical_json(vector_input))` for arbitrary players[1,2,3]/teams[1,2]. Evaluator acceptance establishes a copied input hash, not executed numerical replay. ADV-08 already captures this; do not duplicate it. |
| Advanced settlement2842-3057 | One complete single-model fixture and one late timestamp. No null on-ice head, removed source, duplicate event version, missing champion, or penalty-shot xG population mutation. Leaves ADV-01/02/03/06 exposed. |
| Advanced L15:182-241 | Pins explicit assist variance .3456 versus clipped-interval reconstruction; sigma=residual/z(.9); empty-net .6 excluded. Unknown moment-helper check does not prove null settlement preservation. Empty-net fixture uses approvedModels=[] and cannot prove champion admission; no penalty-shot counterpart. |
| Advanced simulation2745-2785 | Name says “reconciles each draw,” but assertions inspect only returned quantiles, repeatability, cap and one nonadditive endpoint. No raw-draw identity/covariance or calibration check. |
| v4 receipt3060-3102 | Positive target/rookie metadata only; no invalid target/rookie gate and no proper-score-vs-MAE counterexample. ADV-07 is not closed by it. |
| Season3562-3606 | Weighted-exposure arithmetic is independently pinned. The second half explicitly expects supplied EV values overwritten into residuals: .1→.4/.45/.2. This is a policy oracle needing Chef reconciliation with current derive-or-use/clamp rules, not automatic proof the intended policy is correct. |
| GLM3715-3769 | Coefficients merely nonnull and predicted result within[0,100). These do not check a known solution, de-shrinkage correctness, hurdle mass or predictive fit. No new model training was run. |
| Tournament3772-3799 | Fallback fixture pins legacy MAE and randomized-conformal metadata, not proper-score mean selection or emitted interval coverage. Preserve historical receipts; add new disclosed evidence rather than rewriting old experiment history. |
| Challenger verifier3877-3894 | Promotion flag is changed **without rehashing**; checksum failure occurs before semantic promotion guard. No validly rehashed forbidden-promotion/consumed-lockbox mutation. |
| Challenger features3967-4001 and L15:378-411 | Default full targets and a player with at least one complete split. Thus no all-unknown split, no-current-season split, individually requested non-hit target, or null raw counts. AFULL-PY-01/02/03 remain reproducible despite these passing tests. |
| Horizon inference4004-4036 | One valid H3 case confirms estimate/variance/label; name does not establish rejection of mismatched/missing horizon or late issuance. |
| Legacy training/lockbox4043-4162 | Fixture training and synthetic confirmation/single-use protocol, not a real untouched evaluation. These functions were read but not executed; `_freeze:2408` calls `train_baseline`. |
| Walk-forward4174-4484 | Good availability, true-zero, duplicate, paired denominator, late receipt, immutable deadline/attempt, partial settlement, independent lock and sealed-code checks. Native prediction/provider methods are injected or guarded; full native operation/final reporting and prospective accuracy remain outside proof. Legacy MAE vs new squared-error choice is explicitly differentiated by L15:311-329. |
| L15 Python/TS parity72-84 | Re-executes actual Python evaluator against expected TS outputs, including hashes, all nested fields and aggregates; stronger than advanced copied-input “golden.” Still twin agreement can preserve shared bugs; no golden regeneration/independent scientific oracle performed here. |
| L15 unknowns/variance99-138,244-252 | Bernoulli .25 and .2475, one multiplier fallback, omitted missing head/undefined ratios, DNP atom and null actual propagation are concrete. They do not automatically cover all downstream writers. |
| L15 deployment141-156 | Tie-order reversal, projected-ice-time label and PP/PK withheld are meaningful. `math.isfinite(len(goalieOrder))` is tautological for a Python list and supplies no goalie-order validation. |
| SQL tests91-174 | Pulled starter versus reliever, credited relief win, QS threshold, absent WGO, per-game placeholders and real-zero/faceoff arithmetic. Schema has no game-state field; no invalid GA-SA pair, duplicates, malformed scalar or null-league-denominator case. PG runtime remains **blocked/not rerun**, not passed. |

No new product-code defect is inferred solely from missing tests. Existing ADV/PY gaps are evidence supporting those already reproduced findings. Other limits are regression suggestions for their owning source audit, not fabricated failures.

## Reading and verification record

- Prior `batch-modeling-small.md` reading was reused: harness1-129,707-752,1740-1860,3967-4006,4165-end; L15 evaluator1-45,255-335,378-411,427-end. Remaining nonblank sections were read now: harness130-706,753-1746,1856-3966,4007-4164; L15 evaluator46-254,336-377,412-426; entire PG file1-174. Shared boundary lines were harmless overlap. All three files are complete; no unread assigned section.
- Chef's `batch-advanced.md` findings and coverage/consumer boundary text read; its retained probes were not independently rerun. It reports two exact-AST fixture tests; that is parent-provided evidence, separate from this worker's prior51 pytest cases.
- Command: `PYTHONDONTWRITEBYTECODE=1 python3 -I /tmp/astra-modeling-tests/pg_fixture_probe.py` → exit0. Function body extracted from pinned test source; only decorator removed for direct generator invocation. Fake driver records three calls above. No real psycopg import or connection.
- AST enumeration cross-checked every definition and module assignment against TSV rows. AST supplied inventory and assertion extraction; full source reading supplied the review. No test was newly run simply to improve a pass count.
- Supporting read outside assigned files: `tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/batch-advanced.md`, findings and coverage only. Its current hash/size is recorded below; not an immutable acceptance record. Prior governing documents and producer traces are enumerated in `readfirst-lanes.md` and `batch-modeling-small.md`.

## Explicit remaining boundaries

Root owns season.py and canonical severity/ledger. This batch reviews tests and their assertions; it does not recursively audit every imported implementation, inspect all golden fixture values, certify actual TS parity execution, or qualify live release readers. No app imports or training occurred for the new probe. Local PG runtime proof is unavailable because of the already-reported sandbox shared-memory failure; no retry was attempted. No source files changed.

Supplemental advanced report at readback: 10901 bytes; SHA256 `f7a780b7dcee55b6cd841dbda0e56081d48152e8e94707bca53ea0392f07e213`.
