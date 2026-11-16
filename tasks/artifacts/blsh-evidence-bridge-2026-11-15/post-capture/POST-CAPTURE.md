# BLSH Nov 17 pilot: post-capture runbook

What Chef runs after the operator's single capture (2026-11-17 14:05Z, source date 2026-11-11), in order. It turns the operator's handoff into a proposed acceptance entry for the reviewer.

- **Offline except step 5:** step 5 makes 6 GETs to the official NHL API, and needs TJ approval 3. No other step uses the network, credentials or `.env`.
- **Rehearsed end to end:** `dress-rehearsal.sh` ran the same CLIs in scratch on the v5 tree: v5 36/36, the parked 11-18 fallback 31/31 (see "Dress rehearsal").
- **The candidate is always explicit:** `CAND=v5` for the 11-17 slot. The parked 11-18 fallback is `CAND=v5-1118`, and only after TJ approves it (see "Fallback: 2026-11-18 slot"). Convert, assemble and the attestation check refuse with `candidate_required` / `candidate_unknown` rather than guess.
- **Every stop is final:** never re-run, retry or hand-edit a step. Quarantine the inputs and report to Chef's parent and the reviewer.

## Fixed values

```bash
CAND=v5                                  # the 11-17 slot; v5-1118 = the parked 11-18 fallback (see its section)
B=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15
IN="$B/approved/$CAND"                   # that candidate's pins and verifier
PREP=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-native-packet-preparation-2026-11-08
WEB=/Users/tim/Code/fhfhockey.com/web
PKT="/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z"        # operator output (read only)
ATT=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/OPERATOR-ATTESTATION.json
ACQ="/Users/tim/Library/Application Support/fhfh-blsh-boxscores-20261111"             # written only by step 5
WORK="/Users/tim/Library/Application Support/fhfh-blsh-postcapture-20261117"          # new; every other output goes here
NODE=/usr/local/bin/node          # sha256 daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef (APPROVED.nodeSHA256)
PY=/opt/anaconda3/bin/python3     # has bs4, which nst_lineage.py needs; /usr/bin/python3 does not
LINEAGE=/Users/tim/Documents/Codex/2026-10-27/task-3/nst-lineage-and-gs-alternatives-20261101-01/nst_lineage.py
INTAKE="$($NODE -e 'console.log(require(process.argv[1]).intake.path)' "$PREP/SOURCE-PINS.json")"
E=<planned evaluation time, ISO UTC>    # the installed gate's evaluation; must pass step 7
```

`LINEAGE` and `INTAKE` are the paths pinned in `$PREP/SOURCE-PINS.json`. `UPSTREAM-PINS.json` hash-checks both.

## Step 0: preconditions (T−1 day and again just before step 1)

| Check | Command | Must be |
| --- | --- | --- |
| Bridge folder at its reviewed hashes | `cd "$B" && shasum -a 256 -c SHA256SUMS` | every line `OK` |
| Canonical tree is v5 | `shasum -a 256 "$WEB"/scripts/blsh/nativeProcessCapture{Runner,Bootstrap}.ts` | `a74cbb0a…`, `dbf69c47…` (committed in `348a122d6`) |
| Node | `shasum -a 256 $NODE` | `daa77e22…` |
| Python | `$PY -I -c 'import bs4'` | exit 0 |
| Fixed paths | `ls -d "$ACQ" "$WORK"` | both **absent** |
| Tool listed | `grep -n APPROVED_ACQUISITION_TOOLS "$B/frames.mjs"` | exactly `["aa8a9cb7…"]` |
| Suite | `cd "$B" && env -u GIT_DIR TMPDIR=<scratch> BRIDGE_PINS=$B/approved/v5/expected-pins.json $NODE --test tests/bridge.test.mjs` | 21/21 |

Create the work folder once: `mkdir -m 700 "$WORK"`.

## The sequence

Every CLI prints one JSON object. Exit 0 means the result shown here. **Exit 2, or any other result, is a stop.**

### 1. Verify the packet (independent readback)

```bash
cd /tmp && env -i PATH=/usr/bin:/bin $NODE "$IN/verify-packet.mjs" "$PKT" "$IN/expected-pins.json"
```
- **Expected:** exit 0, `"verdict":"complete_pending_review"`, `"evidenceClass":"candidate_pending_independent_source_review"`, `"reasons":[]`.
- **Stop:**
  - `vetoed`, or any reason at all (for example `source_not_frozen_candidate:*`, `runtime_not_launched_by_bootstrap`, `runtime_adapter_environment_absent`, a `tls_*` reason);
  - the `--synthetic-adapter-ok` flag must **never** be added.

### 2. Operator attestation (before any conversion; RUNTIME-RECEIPT-PLAN §3c)

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/post-capture/check-attestation.mjs" --candidate "$CAND" --attestation "$ATT" --packet "$PKT"
```
- **Expected:** exit 0, `"ok":true,"operatorCandidate":"v5-1117"` (or `"v5-1118"` for the fallback), `"g3BothMatch":true,"launcherDyldKeysPresent":false`.
- **What it checks.** The attestation is the one the operator's `operator-attestation.py write` makes from the launcher's real log:
  - the attestation's `candidate` matches `--candidate` (`v5` → `v5-1117`, `v5-1118` → `v5-1118`);
  - `g3.bothMatch === true` and `launcher.dyldKeysPresent === false`, strictly;
  - re-derives both G3 runs from their verbatim stdout: exit 0, `match`, tree `76c7d466…`, `uncovered: []`, `differences: []`, the full loaded census, and the stdout hash;
  - the pinned G3 tool, and the candidate's baseline and launcher hashes:
    - **v5:** `4534fd65…` / `31c370c3…`;
    - **v5-1118:** `e9c7ec5a…` / `2670353d…`;
  - **the launcher's G3 line is unwrapped** (RECHECK-11 C1): `{"launcher":"g3","exitCode":0,"stdout":"<G3 line>"}`, and the inner line must match;
  - **the exec line is bound to the real capture** (C2): `argv0` `/usr/local/bin/node`, `cwd` the canonical `web/`, and `atUTC` inside `<slot date>T14:05:00–14:05:50Z`;
  - there is no launcher refuse line, and the capture exited 0;
  - the attestation is not inside the packet.
- **Stop:** any refusal (for example `g3_both_match_not_true`, `launcher_dyld_keys_present_not_false`, `g3_tPlus0_not_match`). The packet is **quarantined**.
- **Standing:** custody only. G3 ran outside the capture process.

### 2b. The operator's own check (both 2 and 2b must accept; RECHECK-11 C2)

Run the `check` command **exactly as printed** in the operator RUNBOOK, `blsh-pilot-operator-2026-11-15/RUNBOOK.md` §4 ("T+0: right after the capture exits"), on the same `$ATT`. It is deliberately not copied here, so it cannot drift.
- **Versions as of 2026-11-15 ~22:30Z:** operator RUNBOOK `236aace4…`; `tools/operator-attestation.py` **`de0982a6…`**, which adds RECHECK-11 B2's ordering checks. Confirm with `shasum -a 256` first. A different tool hash is a stop until Chef confirms it was reviewed.
- **The candidate:** `--candidate v5-1117` for the 11-17 slot; `--candidate v5-1118` for the fallback.
- **Expected:** exit 0, `{"conversion": "accept", "reasons": []}`. The tool belongs to the operator lane, not this one.
- **What it adds:** the launcher's 8-key env allowlist, the interpreter (`-I`, the CommandLineTools `python3`) and the operator-shell DYLD count, recomputed from its own pins.
- **Stop:** exit 1, `"conversion": "reject"` with any reason, or exit 2 (refuse). Quarantine, exactly as at step 2.

### 3. Convert (approved inputs)

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/convert.mjs" --candidate "$CAND" --packet "$PKT" --pins "$IN/expected-pins.json" \
  --verifier "$IN/verify-packet.mjs" --node-sha256 daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef \
  --lineage "$LINEAGE" --out "$WORK/conversion"
```
- **Expected:** `{"ok":true,"evidenceClass":"candidate_pending_independent_review","date":"2026-11-11"}`.
- **Stop:**
  - **Wrong inputs:** `pins_not_approved`, `verifier_not_approved`, `node_pin_not_approved`, `lineage_not_approved`.
  - **Packet:** `packet_vetoed:*`.
  - **TLS or runtime:** any `tls_*` or `runtime_*` refusal.
  - **Freshness:** `future_incomplete_or_stale_date` (the 8-day rule at retrieval).
  - **Output:** `output_exists`.
  - **Mode:** `--synthetic-adapter-ok` is never used here.

### 4. Fresh request and contexts (the request reader; **its own TJ approval**)

Run the reader's single command **right after step 3, at about 14:10Z**, **exactly as printed** in `blsh-request-reader-20261111/RUNBOOK.md`, section "The single command (11-17, right after POST-CAPTURE step 3)". Use `R`, `WORK` and `SCOPE` as its "Fixed values" define them.
- **Not copied here, so it cannot drift.** An earlier copy here went stale: RECHECK-12 C4.
- **Versions as of 2026-11-15 ~22:30Z:**
  - reader RUNBOOK **`8e27a427…`**;
  - `run_live_read.py` **`c23eb286…`**;
  - scope (`LIVE-READ-SCOPE.json`) **`d84a9547…`**.
- **Confirm first:** check those hashes with `shasum -a 256`, and that TJ's approval names the same scope. A mismatch is a stop until Chef confirms it.
- **The candidate:** the command carries `--candidate v5` (`v5-1118` on the fallback day), and `-X pycache_prefix=/var/empty` in the interpreter flags. Without the flag, the reader refuses `bytecode_cache_not_disabled`.
- **The run:** one bounded read-only Supabase read (one connection, ≤ 35 statements, ≤ 10,000 rows, read-only transaction, `ROLLBACK`). It is a production DB touch, covered **only** by TJ's approval of that exact command and scope.
- **Timing:** the reader itself refuses unless it runs after the latest native retrieval and **within 12 h of the earliest**. The request is then captured after the natives, so it never moves step 7's deadline.
- **Expected:** exit 0, `{"state":"REQUEST_AND_CONTEXT_EXPORTED",…,"export":{"ok":true,"nativeDateCoverage":{"date":"2026-11-11",…}}}`. The output is `$WORK/request.json` (`eventThroughDate` 2026-11-11, policy 7 d / 24 h) and `$WORK/context.json`.
- **Stop:** the reader RUNBOOK's stop table (no second read, no hand edit). `wgoRowsComplete: false` is reported, not a stop.
- **The fallback:** that approval does not cover the 11-18 fallback (`WORK` …`-20261118`); it needs its own.

### 5. Official boxscores (**TJ approval 3**; the only network step)

```bash
cd "$WEB" && env -i PATH=/usr/bin:/bin HOME="$HOME" TMPDIR="$TMPDIR" \
  $NODE "$B/acquire-boxscores.mjs" --conversion "$WORK/conversion"
```
- **Expected:** `{"ok":true,"requests":6,"outDir":"…/fhfh-blsh-boxscores-20261111"}`.
- **The run:**
  - **Calls:** 6 GETs to `api-web.nhle.com/v1/gamecenter/{2026020293…298}/boxscore`, with ids re-derived from the conversion's verified schedule; 0 retries, 1 s apart.
  - **Output:** fixed path, `MANIFEST.json` last.
  - **Hash:** the tool is `aa8a9cb7…`.
- **Stop:**
  - a `FAILED.json` in `$ACQ`, or a refusal (for example `conversion_not_approved`, `schedule_ids_drift`, `global_dispatcher_preinstalled`, `global_dispatcher_changed`, `send_headers_count_not_one`, `output_exists`);
  - **no rerun:** a rerun needs a new approval and a new path, and the tool's path is fixed.
- **Hand-off:** do not touch `$ACQ` after it completes; step 6 reads it untouched (custody).

### 6. Frames (production)

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/frames.mjs" --conversion "$WORK/conversion" --acquisition "$ACQ" --out "$WORK/frames"
```
- **Expected:** `{"ok":true,"frames":<skaters on the 6 games>}`.
- **Stop:** any `acquisition_*` or `boxscore_*` refusal, for example:
  - `acquisition_tool_not_reviewed`;
  - `acquisition_failed_or_partial`;
  - `acquisition_incomplete_or_extra`;
  - `boxscore_wire_or_dispatcher_unqualified`;
  - `acquisition_output_path_not_fixed`.

### 7. Deadline check (before any review is requested)

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/post-capture/deadline-check.mjs" --request "$WORK/request.json" \
  --conversion "$WORK/conversion" --frames "$WORK/frames" --evaluated-at "$E"
```
- **Expected:** `"ok":true`, with `deadlineUTC`, `bindingRule` and `marginMinutes`.
- **Rules:** it restates the gate's own time rules (`currentProcessEvidence.server.ts:129, 201–214`), with inclusive limits:
  - evaluation ≥ `request.asOfUTC`;
  - all evidence ≤ evaluation;
  - frame chronology holds;
  - **evaluation − earliest evidence ≤ 24 h**, where the earliest is taken over the native retrievals, frame observations and the calendar/WGO/group captures;
  - **evaluation date − 2026-11-11 ≤ 7 days**, so `E` must fall on or before **2026-11-18** (UTC).
- **Expected deadline:** about **2026-11-18T14:05Z**, the native capture + 24 h. It is earlier if the request in step 4 was captured earlier. `deadlineUTC` is the authority.
- **Conservative by design:** it uses one global earliest time. So it gives the deadline of the group retrieved first (individual); on-ice stays current a few seconds longer in the gate (rehearsal step B12b).
- **Stop:** `capture_age_exceeded`, `event_age_exceeded`, `evaluation_precedes_source_request`, `evidence_after_evaluation`, `evidence_chronology_unqualified`. Late evidence is never refreshed by a re-capture; that would be a second live run.
- **Applies to the installed gate:** the installed gate's evaluation, not the review, must happen by `deadlineUTC`. The review and the install must both fit inside `marginMinutes`. Re-run this check with the actual evaluation time just before installing.

### 8. Assemble

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/assemble.mjs" --candidate "$CAND" --request "$WORK/request.json" --context "$WORK/context.json" \
  --conversion "$WORK/conversion" --frames "$WORK/frames" --out "$WORK/assembly"
```
- **Expected:** `{"ok":true,"proposedEntries":>0,...}`.
- **Stop:** `proposedEntries: 0` (wrong request or contexts), or `conversion_not_approved`, `duplicate_native_date`, `selected_wgo_row_missing`, `output_exists`.

### 9. Prepare the bundle (`prepare_packet.py`; not in the original list, but propose needs its output)

```bash
env -i PATH=/usr/local/bin:/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 $PY -I "$PREP/prepare_packet.py" \
  --request "$WORK/request.json" --context "$WORK/context.json" \
  --receipt-manifest "$WORK/assembly/native-inputs.json" --producer-allowlist "$WORK/assembly/producer-allowlist.json" \
  --intake-source "$INTAKE" --lineage-source "$LINEAGE" --evaluated-at "$E" --out "$WORK/prepared"
```
- **Why this `PATH`:** it runs the pinned gate replay with `node` from `PATH`, so `/usr/local/bin` must come first. With `PATH=/usr/bin:/bin` it fails with `packet_preparation_failed_no_acceptance_created`.
- **Expected:** exit 0, JSON with `proposedWitnesses > 0` and `holdReasons`.
- **Expected holds, not stops:**
  - rows for teams NST prints dotted, which are **TBL (`T.B`) and SJS (`S.J`) on this slate** (`native_team_mismatch_or_ambiguous`);
  - any row of a player whose window lacks a native date.
- **Stop:** non-zero exit.

### 10. Propose

```bash
env -i PATH=/usr/bin:/bin $NODE "$B/propose-policy.mjs" --prepared "$WORK/prepared" --assembly "$WORK/assembly" > "$WORK/PROPOSAL.json"
```
- **Expected:** `status: "PROPOSAL_ONLY_not_installable_until_independent_review"`, `acceptance.reviewSHA256: null`.
- **Stop:** `synthetic_or_unknown_evidence_class`, `frames_not_from_reviewed_acquisition`, a `TEST_ONLY_*` status, or any refusal.
- **Never install as-is:** the gate constructor rejects `reviewSHA256: null`.

### 11. Reviewer handoff

Send the reviewer the following, all read-only:
- `$WORK/PROPOSAL.json`, `$WORK/prepared/` (bundle, `CURRENT-REQUEST.json`, `artifacts/`) and `$WORK/assembly/ASSEMBLY.json`;
- the step 1, 2 and 7 outputs and the attestation;
- `$B/REVIEWER-BRIEF.md`.

The reviewer writes a review artifact, then sets:
- `reviewSHA256 = sha256(review artifact)`;
- `requiredArtifactSHA256 += [reviewSHA256]`.

The reviewer, not Chef, edits the entry.

### 12. Installer handoff

The filled entry goes into the gate's acceptance policy. `CLOSED_PROCESS_EVIDENCE_POLICY` lives in `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts`, so installing is a reviewed code change by its owner. Not this lane.

The installer:
- re-runs step 7 with the real evaluation time;
- supplies `$WORK/prepared/artifacts/` plus the review artifact as the gate's artifacts;
- confirms the evaluation lands **≤ `deadlineUTC`**. After that, current-use rows drop to stale, and source observations too (the gate's age check sits inside the same `try`).

## Stop rules (summary)

| Stop | Then |
| --- | --- |
| Any step's exit ≠ 0 or an unexpected field | Stop. Quarantine every input. Report to Chef's parent and the reviewer. **No retry, no edit, no second live run.** |
| Attestation refusal (step 2 or 2b) | Packet quarantined; no conversion at all. |
| Acquisition `FAILED.json` or refusal (step 5) | No frames. A new acquisition needs a new TJ approval and a new path. |
| Deadline refusal (step 7), or the margin can't fit review + install | Stop before review. The evidence has expired. |
| `proposedEntries: 0` (step 8) | Wrong or missing request/contexts (step 4). |
| Any `TEST_ONLY`, `diagnostic_only` or synthetic marker anywhere | Stop. These never reach a reviewer. |

## Dress rehearsal (`dress-rehearsal.sh`)

```bash
bash /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/post-capture/dress-rehearsal.sh <new scratch dir> v5
bash /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/post-capture/dress-rehearsal.sh <new scratch dir> v5-1118
```

**Result: v5 36/36 PASS (about 70 s); v5-1118 31/31 PASS. Both exit 0 on the canonical v5 tree.** The candidate argument is required. The script writes only to the scratch directory, with no network or credentials. Two guards are checked on every run:
- the four real fixed paths (`…native-20261117T140500Z`, `…native-20261118T140500Z`, `…boxscores-20261111`, `…boxscores-20261001`) are unchanged (absent);
- the bridge folder is byte-unchanged.

**Leg A: the applied tree's `rehearse.ts` happy packet.** It uses a synthetic adapter and has no candidate facts, so it shows the stops the real run must not hit:
- **A1:** the packet is complete, with 0 network attempts;
- **A2:** the v5 verifier vetoes it (`source_not_frozen_candidate:adapter`, `runtime_adapter_environment_absent`, `runtime_not_launched_by_bootstrap`);
- **A3:** convert with the approved inputs refuses it;
- **A4:** the synthetic flag gives only the diagnostic class;
- **A5:** the real `acquire-boxscores.mjs` CLI refuses that conversion (`conversion_not_approved`) before any write or request.

**Leg B: the full chain to a candidate proposal.** The inputs:
- a candidate packet with the **real v5 runner, adapter and bootstrap bytes** and the real 2026-10-01 NST counts page;
- **hand-written** TLS and RUNTIME facts, as in test 3;
- the real retained 10-01 stored rows as the request and contexts.

The steps:
- **RECHECK-11 C1 repro:** the operator dress rehearsal's own attestation (stub node, fake `web/`) is refused by the CLI only on `argv0`, as C2 requires.
  Through the function seam `checkAttestation({…, expect: {argv0: <stub>, cwd: <fake web>}})`, the same seam the operator's `check(expect=…)` uses, it returns `ok:true`. The CLI never passes `expect`.
- **B1 and B2:** verify, then the attestation checks.
  - **The fixtures are real-contract:** every attestation is **written by the operator's own `operator-attestation.py write`**, from launcher-shaped files: the launcher's exact `json.dumps(…, sort_keys=True)` g3 wrapper and exec lines, the real G3 `--loaded` line, and real tool and baseline hashes.
  - **B2:** step 2 accepts. **B2op:** step 2b (the operator CLI) accepts.
  - **B2a–B2h, refusals:** T+0 not match; operator-shell DYLD; launcher G3 exit 1; the old raw-`g3Line` shape; a stub `argv0`; a fake `cwd`; an exec outside the window; checked as the other candidate.
  - **B2i:** step 2b rejects too.
- **B3:** convert gives the candidate class.
- **B4:** the real tool, via its function API, against a **loopback** TLS server: 8 GETs, one per game, with 0 non-loopback connects.
- **B5:** the frames CLI **refuses** that loopback output (`acquisition_runtime_missing_or_shape`).
- **B6 and B7:** a hand-built acquisition directory with the real tool bytes; the frames CLI gives 288 production frames.
- **B8 to B8c:** the deadline check:
  - passes at `E`;
  - passes at exactly `deadlineUTC`;
  - refuses `capture_age_exceeded` 1 ms later, and on day 8.
- **B9 to B11:** assemble (576 entries), `prepare_packet.py`, then propose: `PROPOSAL_ONLY_not_installable_until_independent_review` with `reviewSHA256: null`.
- **B12 to B12c:** the **real gate** with a labelled synthetic review:
  - 234 + 234 qualify on time, and still at exactly the deadline;
  - 1 ms later the individual group drops to 0;
  - 1 h later both are 0;
  - the CLOSED policy admits 0 throughout.

### Where the real run differs

| Step | Rehearsal | Real run |
| --- | --- | --- |
| Packet | Leg A: `rehearse.ts` (synthetic adapter). Leg B: fixture packet, real v5 bytes, hand-written TLS/RUNTIME, date 2026-10-01 | The operator's bootstrap capture at `$PKT`, date 2026-11-11, TLS/RUNTIME written in-process |
| Attestation | Synthetic, built from a real G3 stdout line | The operator's `OPERATOR-ATTESTATION.json` |
| Request / contexts | Retained 10-01 rows, re-stamped | Fresh capture covering 11-11 (step 4, gap) |
| Acquisition | Real tool via function API against loopback (refused by frames); then a hand-built directory | The real tool CLI, 6 real GETs, fixed path |
| Paths | Scratch `--out` paths (the CLIs' own arguments) | `$WORK/...`, the fixed `$PKT` and `$ACQ` |
| Review | Synthetic review artifact, only to show the gate on time and late | The reviewer's artifact (step 11) |

The CLIs, their arguments (apart from paths and the evaluation time), the approved pins, verifier, node and lineage, the tool bytes and the gate are identical.

## Fallback: 2026-11-18 slot (`v5-1118`, PARKED until TJ approves it)

`FALLBACK.patch` `209b34eb…` (vendored in `approved/v5-1118/`) changes only the bootstrap's slot and output. The bootstrap becomes `849009ee…` and the pins `3f61f9d4…`. The verifier (`b86af692…`), runner, adapter, node and parser are unchanged.

Applying the patch replaces v5 in the checkout, so it is applied only once the 11-17 slot is abandoned or missed.

**What changes in this runbook:**

| Item | v5 (11-17) | v5-1118 (11-18) |
| --- | --- | --- |
| `CAND` / `IN` | `v5` / `approved/v5` | `v5-1118` / `approved/v5-1118` |
| `PKT` | `…/fhfh-blsh-native-20261117T140500Z` | `…/fhfh-blsh-native-20261118T140500Z` |
| `ACQ` | `…/fhfh-blsh-boxscores-20261111` | the same (it follows the source date, 2026-11-11) |
| `WORK` | `…/fhfh-blsh-postcapture-20261117` | `…/fhfh-blsh-postcapture-20261118` (new) |
| Step 0 tree check | bootstrap `dbf69c47…` | bootstrap `849009ee…` (after the fallback is applied) |
| Step 7 binding rule | `capture_age`: about **2026-11-18T14:05Z** | `event_age`: **2026-11-18T23:59:59.999Z**, about **9 h 53 m** after a 14:07Z capture end. The 24 h rule would allow until about 11-19T14:05Z, but the evaluation's UTC date must be ≤ 2026-11-18. |

- **The deadline is very tight.**
  - **Everything runs before UTC midnight:** the frame read, conversion, request capture, review, install and the gate's evaluation, all in the same UTC day.
  - **After midnight:** current use is lost for every row at once. Only source observation survives, until 24 h after the earliest evidence (rehearsal B12b).
  - **Late is final:** a deadline refusal at step 7 is a stop, with no re-capture.

**Blockers before the fallback can run** (found offline):
1. **The acquisition tool refuses every v5-1118 conversion.**
   - **Cause:** `acquire-boxscores.mjs` (`aa8a9cb7…`, reviewed) pins the v5 pins file (`a2a1e694…`), so it refuses with `conversion_not_approved` before any write or request. The test suite (test 20) and rehearsal B4 both show this.
   - **Fix, staged:** TJ chose "accept either pins file", staged until reviewed. `proposed/acquire-boxscores.mjs` (`b4b563f4…`) accepts the v5 and v5-1118 pins and is otherwise byte-identical (tests 18 and 19; rehearsal B4s).
   - **Live tool unchanged:** `aa8a9cb7…` stays live and listed, so v5 is unaffected.
   - **Before the fallback can run:** a review, a non-author swap plus a list entry, and TJ's frames approval for the new hash (`proposed/SWAP.md`).
2. **Operator pins (resolved, fallback review H1).** `OPERATOR_PINS["v5-1118"]` now holds launcher-1118 `2670353d…` and baseline-1118 `e9c7ec5a…`, from the operator lane's `operator-attestation.py`. Rehearsal B2 accepts a 1118 attestation written by that tool.
3. **TJ approvals:** a new authorization receipt (bootstrap, slot, output), a new slot receipt, and a frames approval for the re-reviewed tool, run after the 11-18 capture and before 2026-11-18 23:59:59Z.

**How the rehearsal maps the fallback:**
- **Dates:** it keeps the real offsets from the source date. Native date 2026-10-01 is captured at 10-08T14:05Z (= 11-11 → 11-18T14:05Z), with evaluation at 10-08T20:00Z.
- **Steps that pass:** the deadline check passes at 20:00Z and at exactly 23:59:59.999Z.
- **Refusals:** `event_age_exceeded` 1 ms later and on the next day (the 11-19 case, B8b/B8c). The real gate drops both groups' current use at the next UTC midnight (B12b).
- **What it does not cover:** Leg A is skipped, because the canonical tree holds v5; the fallback's own `rehearse.ts` results are in `fallback-1118/rehearsal/`. The live tool's loopback acquisition stops at blocker 1 (B4). The staged either-pins tool serves the same conversion over loopback (B4s), and the frames CLI refuses that loopback output as usual (B5). So the frames come from the hand-built directory.

## CLI gaps that force a manual step on the day

1. **Fresh CURRENT-REQUEST and CONTEXTS (step 4).** Produced by the request reader, `blsh-request-reader-20261111/RUNBOOK.md`.
   - **What it runs:** one bounded, read-only Supabase read, right after step 3 at about 14:10Z, within its own 12 h ceiling.
   - **Manual part:** TJ's separate approval of that exact command and scope. Without it, assemble gives 0 entries.
2. **Operator attestation.** Two checks must both accept: `check-attestation.mjs` (step 2) and the operator's `operator-attestation.py check` (step 2b). Its folder `blsh-pilot-operator-2026-11-15/attestation/` does not exist until T−0.
3. **Deadline.** No existing CLI computed it. **Filled here:** `deadline-check.mjs` (step 7). It is conservative: one global earliest time.
4. **`prepare_packet.py` (step 9):**
   - it was missing from the sequence;
   - it needs `/usr/local/bin` on `PATH` for `node`;
   - it needs a Python with `bs4`;
   - its errors collapse to `packet_preparation_failed_no_acceptance_created` with no detail.
5. **Propose:** it writes only to stdout (redirect to a file) and takes no evaluation time. The deadline lives only in step 7's output, so carry `deadlineUTC` into the reviewer and installer handoff by hand.
6. **Review and install** are manual by design (steps 11–12). The install is a code change outside this lane.
7. **On-ice:** no real all-strength on-ice counts page has ever been parsed offline (the rehearsal's on-ice page is synthetic). The first real one is the pilot's. A parser hold there is a hold, not a stop.
