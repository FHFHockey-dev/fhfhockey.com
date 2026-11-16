# BLSH native capture: offline operator-path rehearsal (2026-11-15 UTC)

**Result: the safeguards fail closed and a complete packet reads back cleanly offline. The frozen candidate itself can no longer run: its Nov 7 source date is stale and its Nov 13 slot has passed. This rehearsal is the baseline the successor candidate must reproduce. It is not pilot evidence.**

No live call was made. All runs used `env -i`, which leaves no project, credentials, `.env` or lifecycle flag. Sockets, TLS, DNS and `fetch` were blocked and counted in-process, and the count was 0 in every run. `TMPDIR` and every packet lived in a session scratch directory, and the NST local-ledger directory never appeared (`ledgerDirEntries: 0`). The real adapter factory, NST client, ledger, admission and lifecycle modules were never imported. No source file was edited.

> **Superseded for successor packets (2026-11-15).** Use `blsh-successor-candidate-2026-11-15/rehearsal/verify-packet.mjs` (sha256 `fc4e3d04…`) for packets from SUCCESSOR.patch (`40dd64bc…`). That verifier requires per-operation `tls` and `RUNTIME.json`. This older verifier vetoes them: its credential-echo scan matches the key *name* `SUPABASE_SERVICE_ROLE_KEY` in the presence-only RUNTIME.json. That is a false positive on a name, not a leaked value.

## What ran

| Stage of the operator path | How it was exercised | Result |
| --- | --- | --- |
| **Preflight (real CLI)** | `nativeProcessCaptureBootstrap.ts --check` under `env -i` | exit 0. 9/9 runtime pins match, bootstrap `d4d2fcac…`, Node v22.23.4, project `unset`, lifecycle `disabled`, 0 network, no output created |
| **Approval gate (real CLI)** | `--run` with a deliberately synthetic 0600 receipt (`approvalReference: SYNTHETIC-REHEARSAL-NOT-APPROVAL`), deleted afterwards | exit 1, sanitized message. No module import, adapter, output dir or network. Consistent with `bootstrap_outside_approved_slot`; the reason is withheld by design |
| **Expired evidence** | Real runner and preparation code on the real clock | `future_incomplete_or_stale_date` before any output dir is created (`nativeProcessCapturePreparation.ts:48`, 8-day bound). **This is the live state of the frozen candidate.** |
| **Source acquisition → parser → retention** | Real `runNativeProcessCapture` plus the real preparation code, a synthetic disabled-mode adapter and a shifted clock (2026-11-09T01:00Z) | 5 ordered operations, real 22 s NST spacing (22.2 s run), `packet_complete_pending_review`, 28 files |
| **Independent readback** | `rehearsal/verify-packet.mjs`, a separate process that imports nothing from the repo | `complete_pending_review`, class `diagnostic_only_synthetic_adapter`, 0 uncertain operations |

## Fail-closed matrix (all reproduced in `rehearsal/RESULTS.jsonl`)

| Case TJ listed | Scenario | Last operation dispatched | Runner | Readback |
| --- | --- | --- | --- | --- |
| Malformed input | `schedule_duplicate_key` | schedule | refused, FAILED.json | vetoed |
| Malformed input | `nst_no_rows` (error page, no data rows) | nst:individual | refused before retention | vetoed |
| Malformed input | `nst_row_cap` (5,001 rows) | nst:individual | refused | vetoed |
| Incomplete window | `schedule_not_final` (game LIVE) | schedule; **no NST admission** | refused | vetoed |
| Incomplete window | `schedule_empty_day` | schedule; no admission | refused | vetoed |
| Wrong scope | `schedule_wrong_season` | schedule; no admission | refused | vetoed |
| Denied permit | `denied_permit` | admission:individual; **no NST GET, no poll** | refused | vetoed (`operation_2_permit_denied`) |
| Expired evidence | `expired` (real clock) | none | refused before output | n/a, no packet |
| Partial write | `partial_write` (ENOSPC on the 2nd page) | all 5 | refused, individual page kept, no MANIFEST | vetoed (`provenance_missing:onIce…`, `no_completion_manifest`) |
| Interrupted attempt | `interrupted` (SIGKILL mid-transport on nst:individual) | 3 started | process killed; no MANIFEST or FAILED | vetoed: `operation_3_started_without_settlement_possibly_dispatched` (counted as uncertain, never as "not sent") |
| Repeated attempt | `repeat` into the complete and the interrupted packet | none | `EEXIST` before any dispatch | tree hash identical before and after (both) |
| Missing provenance | Packet copy with `individual.TRANSPORT-OBSERVATION.json` removed | — | — | vetoed |
| Altered bytes | Packet copy with one byte flipped in `onIce.parser-input.html` | — | — | vetoed: hash mismatch against provenance and manifest |
| Smuggled file | Packet copy with an extra `RETRY.json` | — | — | vetoed: `unlisted_file` |
| Not the frozen candidate | The complete packet checked against the real adapter pin | — | — | vetoed: `source_not_frozen_candidate:adapter`, so a rehearsal packet cannot pass as real |
| Fewer source roles bound | Packet copy whose STARTED binds 8 of 9 roles | — | — | vetoed: `source_role_set_mismatch` |

The readback also checks:
- directory mode 0700 and file mode 0600 with no symlinks;
- an 8 MiB budget;
- that the order matches the five planned operations and their URLs;
- at least 22 s between NST starts;
- that the provenance receipts never overclaim (`TLSVerified: null`, `independentlyAccepted: false`, `score: null`);
- a credential-echo scan of all non-source files.

## Existing coverage reused (not rerun as new evidence of different things)

`SUITES-CURRENT-TREE.log`: 239 passing tests across 7 files on the current tree. The four capture suites cover:
- fsync before each dispatch;
- timeouts, spacing and wall-clock skew;
- no second admission;
- body caps;
- the manifest `wx` / hard-link no-overwrite rule;
- uncertain marker removal.

The other three suites are BlshTradeComparison, trade and market, which carry the two drifted pins. The rehearsal adds only what those unit tests do not show end to end: a separate-process crash, a repeat into an existing packet, readback without repo code, tamper detection, and the real CLI gates.

## Limits (stated, not hidden)

- **Synthetic adapter.** Real adapter behavior, authentication, redaction, TLS and the canonical NST client path are not exercised offline; they are covered only by the existing mocked adapter suite. `TLSVerified` stays `null` until real runtime evidence exists.
- **Shifted clock.** The shifted clock is a test seam. The real clock is shown to refuse.
- **Second packet into a fresh directory.** The runner refuses only an *existing* directory. A second attempt into a *new* directory is prevented only because the bootstrap hard-codes one output path and keeps an in-process `attempted` flag. **The successor must keep a single fixed output path**, or an equivalent cross-process guard.
- **Row counts only.** The runner's NST "parser" counts data rows. Stat parsing and qualification happen later, offline, in `blsh-native-packet-preparation-2026-11-08/prepare_packet.py` and its default-closed gate. See DATA-CONTRACT.md.

## Reproduce

```bash
tasks/artifacts/blsh-pilot-readiness-2026-11-14/rehearsal/run-rehearsal.sh <empty-scratch-dir>
```

The script writes `RESULTS.jsonl` and checks against `expected-pins.json` (the nine frozen runtime roles). For the successor, update `expected-pins.json`, the date and the clock to the new candidate, then rerun.
