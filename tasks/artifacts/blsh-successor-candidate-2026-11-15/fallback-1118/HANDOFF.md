# BLSH native capture: 2026-11-18 fallback (v5-1118)

**Status:** parked fallback. Not applied, not approved. Built offline against `348a122d6` (v5 as committed). Nothing in `web/` or in the live successor files was changed.

| | sha256 |
| --- | --- |
| `FALLBACK.patch` | `209b34ebe121a3de08c91ec74aaabd61844ad09e1ae0538cd045872bfc2fe8cf` |
| bootstrap (new) | `849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465` (replaces `dbf69c47…`) |
| runner | `a74cbb0a…` (unchanged) |
| adapter | `aa6237bd…` (unchanged) |
| preparation and the six `lib/` roles | unchanged |
| `rehearsal/verify-packet.mjs` | `b86af692…` (unchanged bytes, copied) |
| `rehearsal/expected-pins.json` (new) | `3f61f9d4725fb66efc3d0f2f201e74c46998d67856b84f9c9c7230357b866376` (replaces `a2a1e694…`; only `_bootstrapSHA256` and `_source` differ) |

## 1. Timing verdict: tight but usable

**Capture side.** The rule is `nativeProcessCapturePreparation.ts:48`: `now - 2026-11-11T00:00Z < 8 days`.
- A 2026-11-18 14:05Z start is 7 d 14 h 05 m after the source date.
- That leaves 9 h 55 m before the 2026-11-19T00:00Z expiry. The bridge's `nativeDateFresh` (`convert.mjs:179-181`) applies the same rule to the retrieval time.

**Where the "evaluation UTC date ≤ 2026-11-18" comes from.**
- The rule is in `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts:210` and `:215`. `today` is the UTC midnight of `evaluatedAtUTC`.
- `eventRecent = today − 2026-11-11T00:00Z ≤ maxEventAgeDays`. The retained policy sets 7 days (`blsh-capture-reader-v1-event7days-capture24hours`, used in `WINDOW-FEASIBILITY.json`).
- So the evaluation's UTC date must be ≤ 2026-11-18. If not, `:231` turns current use into `current_use_evidence_stale_or_unknown`.
- **The 7 is a request policy value, not a code constant.** `request.freshnessPolicy.maxEventAgeDays` is validated in `currentInput.ts:194`. The formula is code; the 7 comes from the retained request's policy. A different request policy would move the deadline.
- **I checked the other recency gates; none is stricter.** They all use `≤ 7` with the same anchor:
  - `currentProcessEvidence.server.ts:252`: the window's latest event against the evaluation UTC date;
  - `currentInput.ts:165`/`:172`: `cutoffAgeDays`, from the `asOfUTC` date to `eventThroughDate`;
  - `currentInput.ts:257`/`:260`: `eventAgeDays` against `eventThroughDate`, and `captureAgeHours ≤ 24` against the request's `asOfUTC`.

**The 24 h rule.**
- The rule is in `:211` and `:213-214`: `evaluatedAt − earliest(native retrieval, frame observation, calendar/wgo/group feed captures) ≤ maxCaptureAgeHours (24)`.
- Every feed capture must also be at or before `evaluatedAt`.

**Window an 11-18 capture gets.**
- It runs from about 2026-11-18T14:07Z (capture done) to 23:59:59.999Z: **about 9 h 53 m** (09:07–18:59 EST).
- From that window, subtract the conversion, the six boxscore frame reads, and the `CURRENT-REQUEST` capture.
- Here the date rule binds; the 24 h rule would allow until about 2026-11-19 14:05Z.
- For comparison, the v5 11-17 slot gets about 24 h, bound by the 24 h rule instead.
- Evaluated on 2026-11-19 UTC, current use fails. Source-observation qualification (`:230`) alone survives until 24 h after the earliest evidence.

**Verdict.** Not too tight to be useful, with one condition: the frame read, conversion, request capture and evaluation must be approved before the slot and run the same UTC day. A slip past midnight UTC leaves only diagnostic evidence.

The frames approval itself has to be re-issued for the fallback, because the boxscore tool's hash changes (§3, bridge item 2).

## 2. What the patch changes

Only slot-pinned values change. The source date (2026-11-11), the plan date, the freshness rule, the runner and the adapter are untouched.

| File | Change |
| --- | --- |
| `nativeProcessCaptureBootstrap.ts:13` | OUTPUT `…20261117T140500Z` → `…20261118T140500Z` |
| `nativeProcessCaptureBootstrap.ts:14` | SLOT `2026-11-17T14:05:00.000Z` → `2026-11-18T14:05:00.000Z`. `LAST_START` follows, so the start window is 14:05:00–14:06:00Z. |
| test `:23`, `:25` | OUTPUT and SLOT, the same as the source |
| test `:31` | fixture `approvedAtUTC` 11-16T20:00Z → 11-17T20:00Z (shifted one day) |
| test `:115` | wrong-slot tamper: was 11-18 14:05Z (now the right slot), now 11-17 14:05Z. So a v5-slot receipt is refused. |
| test `:116` | future-approval tamper 11-18 14:05Z → 11-19 14:05Z |
| test `:122` | window edges 11-18T14:04:59.999Z and 11-18T14:06:00Z. 2026-11-19T00:00Z is kept: it is the source-date expiry and is still outside the window. |
| test `:177` | recheck-after-adapter clock 11-18T14:06Z |

**Applying it replaces v5 in the checkout.** There is one bootstrap file, so after the apply the 11-17 slot can no longer run. Apply only once the 11-17 slot is abandoned or missed. A v5 authorization receipt cannot authorize the fallback: the bootstrap hash, slot and output all differ, so TJ must issue a new receipt.

## 3. Knock-on pins forced by the new bootstrap hash (listed, not edited)

Line numbers are as read at 2026-11-15T20:13Z. Other lanes may still be editing these files.

### This lane
- `fallback-1118/rehearsal/expected-pins.json` holds the new `_bootstrapSHA256`. `verify-packet.mjs` is unchanged and has no slot or output pin.
- With the v5 pins (`a2a1e694`), a fallback packet is vetoed `runtime_bootstrap_not_candidate`; see `rehearsal/CROSS-PINS.txt`.

### Evidence bridge (`blsh-evidence-bridge-2026-11-15/`)
1. **`convert.mjs:22-26` `APPROVED`:**
   - `pinsSHA256` `a2a1e694…` → `3f61f9d4…`;
   - `bootstrapSHA256` `dbf69c47…` → `849009ee…`;
   - `verifierSHA256` (`b86af692`) and `nodeSHA256` unchanged.
   - `APPROVED` is a single set, so the bridge must switch candidates or accept either one; that is the bridge's design call.
2. **`acquire-boxscores.mjs:26-29`:** `pinsSHA256` `a2a1e694…` → `3f61f9d4…`; the verifier is unchanged.
   - **This changes the frames tool's own hash** (`aa8a9cb7…`), which is pinned in code and in an approval:
     - `frames.mjs:31` `APPROVED_ACQUISITION_TOOLS`;
     - `tests/bridge.test.mjs:475`;
     - TJ's separate frames approval (`PILOT-APPROVAL-PACKET-v3.md:130`, `APPROVAL-SHEET.md`), which also says "before 2026-11-18 14:05 UTC". For the fallback, that becomes after the 11-18 capture and before 2026-11-18 23:59:59Z.
   - **So the fallback needs a re-reviewed tool and a new frames approval,** not just new pins. If `acquire-boxscores` instead accepted either pins file, the same holds: its bytes still change.
   - `convert.mjs`'s own hash (`54e3d624`) is pinned only in `SHA256SUMS` and in docs, not in code.
3. **`approved/`:** vendor a new folder, for example `approved/v5-1118/`, with `FALLBACK.patch`, `expected-pins.json` (`3f61f9d4`) and `verify-packet.mjs` (`b86af692`). Add those entries to `approved/UPSTREAM-PINS.json`; the v5 entries are at `:39-54`.
4. **`tests/fixtures.mjs`:**
   - `:23-24` and `:31` point at `approved/v5/…`;
   - `:80` `CANDIDATE_BOOTSTRAP_SHA256` is `dbf69c47…`.
5. **`post-capture/dress-rehearsal.sh`:**
   - `:13` `V5=$B/approved/v5`;
   - `:18` FIXED native path `…20261117T140500Z` → `…20261118T140500Z`.
6. **`post-capture/check-attestation.mjs:12` and `:14`:** `G3_BASELINE_SHA256` (`4534fd65…`) and `LAUNCHER_SHA256` (`31c370c3…`) both change; see the operator items below.
7. **`post-capture/rehearsal-inputs.mjs:23`, `:27` and `:29`:** the launcher hash and baseline hash in the rehearsal fixtures.
8. **`SHA256SUMS`:**
   - `:15-16` carry the v5 pins and patch;
   - the lines for `acquire-boxscores.mjs`, `convert.mjs`, `frames.mjs`, `tests/*` and `approved/UPSTREAM-PINS.json` change with those files.
9. **Docs:** `README.md`, `REVIEWER-BRIEF.md`, `ACQUISITION-SPEC.md` (11-17 timing) and `post-capture/POST-CAPTURE.md`.
10. **Unchanged:** the boxscore fixed path `fhfh-blsh-boxscores-20261111` is per source date (`acquire-boxscores.mjs:24`, `tests/fixtures.mjs:215`). The six games 2026020293–298 are unchanged too.

### Operator (`blsh-pilot-operator-2026-11-15/`)
1. **`evidence/DEPENDENCY-TREE-BASELINE.json:5`:** `bootstrapSHA256` → `849009ee…`, plus its `.json.sha256` sidecar. The new file hash replaces `4534fd65…`.
   - I ran their `dependency-tree-hash.mjs` read-only against the patched export, with output to scratch.
   - `treeSHA256` stays `76c7d466…`.
   - Against the current baseline, the only difference is `bootstrap_differs_from_baseline`. The prediction is in `PREDICTED-DEPENDENCY-TREE.json`; it carries run timestamps, so it is a prediction, not their baseline.
2. **`tools/nst-pilot-launcher.py`:**
   - `:52` `G3_BASELINE_SHA256`;
   - `:54` `LOCK_PATH` `launcher-20261117T1405Z.lock`;
   - `:56-62` `SLOT` dict (open 14:03, close 14:05, wake 14:05:05, exec 14:05:00–14:05:50 on 11-17 → 11-18);
   - `:16` docstring.
   - `G3_TOOL_SHA256` and `G3_TREE` are unchanged. The launcher's own hash changes.
3. **`tools/operator-attestation.py:25` and `:27`:** `G3_BASELINE_SHA256` and `LAUNCHER_SHA256`. `:23` and `:26` are unchanged.
4. **`tools/write-authorization-receipt.py:2` and `:26`:** `BOOTSTRAP_SHA256` `dbf69c47…` → `849009ee…`. SLOT and OUTPUT are read from the bootstrap source (`:55`), so they follow automatically.
5. **`tools/test-nst-pilot-launcher.py`:**
   - `:80`, `:138`, `:151`, `:165-167`, `:187` and `:205` are 11-17 times;
   - `:167` "wrong-day" uses 11-18, so it must become another day;
   - `:263` asserts the lock path.
6. **`tools/dress-rehearsal.sh`:** this file was being edited while I listed it, so these are by content, not line:
   - `RECEIPT=…authorization-20261117T140500Z.json`;
   - `OUTPUT=…native-20261117T140500Z`;
   - `REAL_RECEIPT`;
   - `hdr "T-1 (2026-11-16)"`;
   - the `…20261116`/`…20261117T1405Z` receipt reference names;
   - both launcher calls at `2026-11-17T14:04:00` with `launcher-20261117T1405Z.lock`.
7. **Docs** citing 11-17 or `dbf69c47`: `RUNBOOK.md`, `RUNTIME-RECEIPT-PLAN.md`, `OPERATOR-ACCEPTANCE.md`, `SLOT-CLEARANCE.md` (`:65` already names the 11-18 slot), and `evidence/DEPENDENCY-TREE-TESTS.md`.
   - `RUNBOOK.md` and `RUNTIME-RECEIPT-PLAN.md` also cite the hashes of every changed tool: `operator-attestation.py` `d252d358`, `write-authorization-receipt.py` `15a70300`, `test-nst-pilot-launcher.py` `2c01f08a` and `dress-rehearsal.sh` `6bab1050`.
   - No code pins those four tool hashes. The launcher hash is pinned in code (operator item 3, and bridge items 6 and 7).
8. **Keep unchanged:** `tools/dependency-tree-hash.mjs:56` mentions `4534fd65` in a comment only. Editing it would change `G3_TOOL_SHA256` (`912041a5`) in the launcher, the attestation and `check-attestation.mjs`.

### Chef / readiness (`blsh-pilot-readiness-2026-11-14/`)
- `APPROVAL-SHEET.md` and `PILOT-APPROVAL-PACKET-v3.md` cite the slot, output, `dbf69c47`, `a2a1e694`, launcher `31c370c3`, frames tool `aa8a9cb7` and the evaluation deadline. For the fallback, the deadline becomes "evaluation UTC date 2026-11-18, about 9 h 53 m".
- `BLOCKERS.md` and `PILOT-APPROVAL-PACKET.md` and `-v2.md` are older docs citing 11-17.
- These evidence files were run against v5 bytes, so they need a rerun:
  - `g1-canonical/BOOTSTRAP-CHECK.json`;
  - `g1-canonical/G3-LOADED*.json`;
  - `g1-canonical/LAUNCHER-TESTS*.log`;
  - `bridge-verification/FULL-SUITE-RERUN-acq2.log` and `NOTE.md`.

### Review lane (`blsh-evidence-bridge-review-2026-11-15/`)
- `RECHECK*.md`, `REVIEW.md` and `repro/**` cite v5 hashes and 11-17 times; the repro scripts include 11-17 clocks.
- Re-review is needed for the changed bridge tool (`acquire-boxscores`), the launcher and the bridge `APPROVED` set.

### Mailbox
- `cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` cites v5 values; it is a message log, not a pin.

### Swept and clean
- `web/`: only the two patched bootstrap files carry slot pins.

### Outside the repository
- A new TJ authorization receipt (new `bootstrapSHA256`, slot and output).
- A new coordination and slot receipt for 2026-11-18 14:05Z.
- The `fhfh-blsh-native-20261118T140500Z` output must be absent before the run.

## 4. Checks

All checks ran offline, under `env -i`, with `GIT_DIR` unset and `TMPDIR` in scratch. Logs are in `logs/`.

| Check | Result |
| --- | --- |
| Fresh `git archive 348a122d6` + `FALLBACK.patch`, four capture suites | **209/228**. All 19 failures are `bootstrap_wrong_checkout`, the same as v5. |
| Relocated copy (only the `WEB` literal changed; non-candidate bytes) | **228/228** |
| Scoped `tsc` | 0 errors (`logs/tsc-exp.log` is empty with no exit code; see the next row) |
| `npm run typecheck`, `web`+`supabase` export of `348a122d6` | unpatched exit 0; patched exit 0 (`logs/typecheck.log`) |
| Mutation: old SLOT | 11/35 bootstrap tests fail |
| Mutation: old OUTPUT | 12/35 bootstrap tests fail |
| Rehearsal at `CLOCK=2026-11-18T14:05:30Z` (`rehearsal/RESULTS.jsonl`) | 41 lines, outcome-identical to v5 (0 differences); 0 network attempts; 0 ledger entries |
| Expiry cases | 2026-11-19T00:00Z refused before output; 23:59:59Z complete |
| Cross-pins | v5 pins veto a fallback packet; fallback pins accept it |
| `git apply --check` on HEAD `348a122d6` | passes (check only) |

**Not verified:**
- `--check` and the bootstrap suite in the canonical tree. They need the real `web/` path, so they run only after Scout applies the patch.
- The operator's launcher and attestation tests: those are their files.
