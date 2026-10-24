# FORGE-GATE-HARNESS offline portability packet

Scope: parent delegation after reconciled sprint commit `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, on canonical `octoberBranch`. Only `tasks/artifacts/forge-gate-kit-2026-10-23/` is changed. Register owner `01a16391-47f8-74d9-9cab-9f20cf1b50e0` and release owner `01a1637a-4222-70c0-8439-cb3cc46b20c4` were notified of the exact artifact lease before implementation. No helper agents were created.

## Diagnosis and change

The supplied `mz.py` imported a nonexistent adjacent `score_gate.py`. The handover's task3 `score_pair.py` had the same external dependency, while the task2 helper lived in a different directory. `gate_ci.py` accepted a scorer path but still addressed literal `va/vc`. Three independently implemented joins disagreed on dates, per-head missingness and position extraction; duplicate IDs silently overwrote rows; sparse/zero/constant categories divided by zero or printed NaN.

Added a local standard-library `score_gate.py` shared by portable `score_pair.py`, `gate_ci.py` and `mz.py`. The paired scorer's five-argument workflow supports arbitrary variant names. Documented the deliberate `gate_ci` CLI signature replacement. Kept the legacy Task2 `score_gate` defaults and numeric checks. Shared pairing, explicit denominators, duplicate errors, date checks and stable identities now make category statistics comparable. Structural player positions replace the whitespace-sensitive regex.

All numerical thresholds, FP weights, 2,000 bootstrap repetitions, seed 1 and historical percentile indices are preserved. The missingness correction uses head-eligible games in every script; undefined intervals retain their failed-draw count rather than reporting a conditioned interval. Full ticket/model qualification is not automated or claimed.

## Review correction R1 — variant-name namespace

Independent review found that valid names `delta_bias` and `delta_rmse` collided with bootstrap bookkeeping. Corrected only the bootstrap storage/result namespace and its paired/CI report consumers: paired deltas retain their fixed keys, while caller-provided names live under `variants`. Names equal to `variants` are also safe inside that nested mapping. CLI signatures, math, thresholds, seed/reps and reference bytes are unchanged.

Two new regression tests cover eight name-pair subcases in the core (both reported names in either position, together in both orders, and the new container name in either position) and six name-pair subcases through all three bootstrap-backed report entry points. The new core regression first reproduced the six reported collision cases against the reviewed source, then the full 26-test suite passed on the corrected source in 18.936s. The exact tested bytes were installed with hash preconditions; the next independent recheck belongs to reviewer `01a168ee-3844-74ba-ad3c-dcbb8a958010` and is pending.

Revision diff: [review-r1.patch](review-r1.patch), covering all eight changed pre-existing packet files relative to the reviewed packet (not the original Git baseline). Before/after hashes and preserved input/reference pins: [review-r1-pins.json](review-r1-pins.json). These two added correction-evidence files supplement the original 13-file path list below. No claim that the independent BLOCK has been cleared before that recheck.

## Verification

**26 synthetic tests passed** with `python3 -B -m unittest discover -s "$KIT/tests" -p 'test_*.py' -v`; receipt: [tests/RESULTS.log](tests/RESULTS.log).

Coverage includes composite player-game IDs across games; canonical integer/string IDs; both directions of unpaired rows; dressed actual presence/date; source versus paired counts; horizon filtering; duplicate actual/hits-blocks/capture/cross-file IDs; unpaired capture files and replay flags; structural F/D and unknown/conflicting positions; per-head paired missingness and dependent FP; numeric zeros/null/nonfinite/boolean categories; signed bias, relative bias, RMSE and decile ratios; unequal game clusters with replacement; paired deltas against an independent random-draw oracle; exact default seed/reps and CI indices; empty and partly undefined intervals; MZ slope/intercept and constant predictions; both historical top-decile count conventions; unchanged legacy numerical thresholds; imports without execution; standalone CLI runs from an isolated directory.

A 36-row/three-game synthetic cohort reproduces the historical task3 paired report's all/F/D metrics, paired CIs and deciles, supplied gate_ci's complete-data CIs, and task4 MZ/D representation. The old D/PPP relative-bias NaN becomes explicit unavailable because that fixture has zero actual PPP in D. Reference source blobs and fixture generator hashes are recorded in [tests/legacy_reference.json](tests/legacy_reference.json). The initial parity assertion assumed all reference cells were finite; it was corrected to recognize this historical NaN and the final suite is green.

No application build/test, dependency installation, forecast application edit, retained model-capture read, new capture, production request, credential access, DB write, Git index/commit operation, push or deploy occurred. Release/model and Game Grid leases were preserved.

## Exact changed paths

All paths below are relative to `tasks/artifacts/forge-gate-kit-2026-10-23/`:

| Path | Change |
|---|---|
| `gate_ci.py` | Replace hard-coded external adapter with explicit pair and shared core |
| `mz.py` | Shared paired join, structural positions, missing/degenerate handling |
| `score_gate.py` | Add portable shared parser, joins, metrics, bootstrap and legacy CLI |
| `score_pair.py` | Add portable paired overall/F/D report |
| `README.md` | Add commands, contracts, compatibility details and limits |
| `REPORT.md` | This scoped handoff |
| `WORK-DIARY.md` | Scoped task diary; kept here under the exact artifact-only user lease |
| `tests/fixtures.py` | Synthetic fixture generator |
| `tests/test_gate_kit.py` | 26 offline regression tests |
| `tests/legacy_reference.json` | Synthetic historical scorer reference with source hashes |
| `tests/make_legacy_reference.py` | Optional source-pinned synthetic reference generator |
| `tests/RESULTS.log` | Final focused verification receipt |
| `SHA256SUMS` | Changed executable/test/reference file integrity pins |

The three supplied cohort JSON files and `games-all.txt` are preserved byte-for-byte. Historical scorer directories remain untouched.

## Limits and next gate

**Actual model qualification remains unrun.** No 62-game/2,079-row model result is inferred from these fixtures. The historical actuals are a source universe, not a persisted complete dressed universe. A selected real pair still requires capture provenance, date/coverage/replay review, and the handover's full ticket-specific gate review. Every new or repeated capture requires TJ's explicit approval and separately bounded read budget; this packet supplies no such approval.

Compatibility differences are intentional and documented: `gate_ci` now takes explicit pair names; missing/invalid dates and duplicate identities fail; MZ shares the paired category denominator; all bootstrap scripts use head-eligible game clusters; numeric and ranking ties are deterministic; undefined values display as unavailable. Legacy floating-point threshold comparisons and the MZ floor(n/10) representation convention are retained. No release timing, held-model disposition, priors or ledger-week changes are included.
