# Offline native receipt-to-packet preparation

Implemented the missing **executable file-only intake branch** identified in the November 7 [route trace](../blsh-native-route-trace-2026-11-07/FINDINGS.md). It prepares a proposed evidence bundle and explicit held rows, then runs that bundle through the actual default-closed TypeScript gate. It does not fetch, execute the NST client, create an acceptance policy, score, activate a snapshot or use the reserved season.

## Delivered

- `prepare_packet.py`: bounded file intake, exact request/context/artifact bindings, pinned validator reuse, row/group composition and immutable private output.
- `closed_gate.cjs`: hashes the **original request's JavaScript-parsed rows** with `processEvidenceRowSHA256`; compiles the pinned gate/current-input code in memory and performs a closed-policy replay. It accepts no policy CLI input.
- `SOURCE-PINS.json`: exact dependency bytes. The existing `intake.build` and `nst_lineage.check` are loaded from explicitly supplied matching sources; their parser/business logic is not reimplemented. The shared NST client is neither imported nor edited.
- `test_prepare_packet.py`: 23 focused tests, including the real CLI, an explicitly synthetic test-only reviewer policy for gate compatibility, incomplete/invalid evidence and interrupted output.
- `RETAINED-EMPTY-REPLAY.json`: a real **offline replay of already-saved current-season bytes**, with no native receipts supplied. It is not a new observation or a current-source qualification.

## Verified behavior

All **23 tests pass** after the independent-review corrections (33.202 seconds; `review-fixes-tests.log`). The earlier 19-test result is retained separately; it did not cover the two reproduced defects. Before the fix, two focused regression tests reported 14 failures across invalid clock proposals and the interrupted final manifest (`review-regressions-before.log`). No application suite, browser run or build was necessary for this artifact-only Python/CJS correction.

The parent independent review identified two defects, both now corrected and awaiting reviewer recheck:

- Receipt retrieval clocks and both official-frame clocks must pass the pinned gate's ASCII timestamp grammar before Python parsing: valid calendar date, 00–23 hours, 00–59 minutes/seconds, optional 1–6 fractional digits and explicit Z or signed offset. Offset components are checked separately, limited to ±14:00; `-00:00`, offset seconds, overflowing offset minutes, alternate separators and excess precision are rejected. The tests compare 42 invalid cases and 12 valid precision/offset cases with the actual unchanged TypeScript gate under synthetic-only policies. Valid original bytes are preserved; the CLI's own default-policy replay still admits zero.
- The completion manifest is written to an exclusive `.MANIFEST.json.tmp`, flushed and fsynced, then published atomically with a same-directory hard link that cannot overwrite an existing `MANIFEST.json`. Successful publication removes only that temporary file. Injected mid-write and fsync failures leave no final completion manifest; a final-name collision preserves the preexisting file. The tests verify retained packet hashes before publication.

The complete synthetic fixture produces two proposed witnesses. A separately constructed **synthetic-only** test policy demonstrates that their hashes/receipt bindings are consumable by the existing gate. The CLI's own replay still admits **zero** rows and the real policy remains empty. This test policy is not retained as real acceptance or installed anywhere.

The native validator can report structural success while an xG cell is blank, a dash or a numeric discrepancy. The composer now checks **every required field** for `literal_match` before proposing a witness, not just that structural status. A missing/held individual group does not erase a separately matching on-ice group. Original request, receipt and frame bytes/clocks remain unchanged; later evaluation diagnoses stale captured windows without re-dating inputs. The actual gate supplies canonical hashes, avoiding Python/JavaScript number-serialization differences.

File boundaries reject changed hashes/sizes, duplicate manifest entries, unselected identities, unsafe JSON integers/duplicate keys, path traversal, symlinks and non-regular files. Bounds are 32 MiB request, 8 MiB context, 4 MiB input manifest, 64 KiB allowlist, 8 MiB per artifact / 64 MiB total, 2 MiB native body, 64 KiB receipt/frame, 5,000 selected rows and 10,000 witnesses. Each output file is exclusively created with mode 0600 under a new mode-0700 directory. A partial write leaves `STARTED.json`, already-written files and any interrupted temporary manifest, with no completion manifest created by that attempt. Existing output directories are not overwritten. Python socket operations and the Node bridge's network paths are denied.

## Retained-data result

The pre-existing November 1 request and context matched their original SHA-256 pins in the retained pre-correction run. That immutable historical packet was not rewritten or rerun for this correction; its retained composer source is the prior version. The CLI processed **3,461 selected records** from a request containing **8,135 records**. With an empty native manifest/allowlist it emitted **6,922 held groups**:

- 6,821 lack a native receipt.
- 99 lack a unique captured process row (`missing_row`).
- 2 retain the existing captured TOI discrepancy.

Default-policy admissions: **0 individual / 0 on-ice**; current-qualified windows: **0**; scores: **0**. Both original inputs were rehashed unchanged after execution. All 15 retained output-file pins verify. The full private packet is at the exact `/tmp/…/packet` path recorded in `RETAINED-EMPTY-REPLAY.json`; large input copies were kept out of the repository. That temporary location is not permanent archival storage. The receipt preserves the exact command and input/output hashes for reproduction.

## Reproduction and input contract

From this directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 test_prepare_packet.py -v
node --check closed_gate.cjs
```

The test suite uses synthetic fixtures and temporary directories; it reads only the two named pinned validator **source files**, not their historical datasets. Requirements already present here: Python with BeautifulSoup, Node 22.23.4 and the repository's installed TypeScript. No installation or lockfile change was made.

CLI template (replace each input path with an explicitly scoped existing file):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 prepare_packet.py \
  --request /path/to/CURRENT-REQUEST.json \
  --context /path/to/CONTEXTS.json \
  --receipt-manifest /path/to/native-inputs.json \
  --producer-allowlist /path/to/supplied-producers.json \
  --intake-source /path/to/pinned/intake.py \
  --lineage-source /path/to/pinned/nst_lineage.py \
  --evaluated-at 2026-11-08T12:00:00Z \
  --out /path/to/new-private-packet
```

The explicit evaluation time is a replay parameter; it never rewrites source retrieval clocks and must not be reused as a later current-use clock. `SOURCE-PINS.json` gives the existing validator paths and required hashes; a byte-different validator is refused before execution.

`native-inputs.json` has exactly: `version` = `fhfh.blsh.native-packet-inputs.v1`, `sourceRequestSHA256`, `contextSHA256`, `producerAllowlistSHA256`, `artifacts` and `rows`. Each artifact has a relative path below the manifest directory, SHA-256 and byte count. Each row has group (`individual`/`onIce`), `wgoSourceId`, `processSourceId`, and the six hashes `nativeBodySHA256`, `nativeReceiptSHA256`, `producerSHA256`, `redactorSHA256`, `definitionSHA256`, `officialFrameSHA256`. All referenced bytes must be present; additional retained source/review artifacts may also be bound for later review.

The separate supplied allowlist contains `producerSHA256` and `redactorSHA256` arrays. It is **caller-supplied preparation input**, not server configuration or proof of independent review. An empty allowlist is valid and holds matching attempts. Frame bytes use the existing gate fields plus explicit supplied `gamesOnNativeDate: 1` and `dateMembershipComplete: true` assertions; the composer does not invent those assertions from a captured WGO subset. Its identity/exposure/clock checks do not authenticate the assertions' source. Likewise a definition artifact's hash does not establish a qualified model. Independent review must verify these facts against the retained supporting evidence.

Output includes exact request/context/manifest/allowlist/artifact bytes, validator/tool source snapshots, `PROPOSED-BUNDLE.json`, `ROW-DECISIONS.json`, `INTAKE-SUMMARY.json`, `CLOSED-GATE-REPLAY.json`, `SUMMARY.json` and a completion `MANIFEST.json`. The proposed bundle uses the gate's existing `fhfh.blsh.reviewed-process-evidence.v1` **schema for compatibility only**; it has no acceptance entry. The separate summary and replay make its unaccepted status explicit. Source snapshots are audit copies, not an independently portable installation.

## Remaining boundaries

Offline bundle preparation and default-closed replay are implemented. Shared source/consumer code and all prior frozen packets are unchanged. Independent review found the two corrected defects above; reviewer recheck of the successor is pending. Passing local tests does not close source, method or release acceptance.

1. Custody and historical retention are now answered: Claude owns NST and Chef confirms the requested raw bodies/clocks were not retained. Follow the [updated owner handoff](../blsh-lane-readiness-2026-11-08/NST-OWNER-HANDOFF.md) and [bounded fresh-capture proposal](../blsh-lane-readiness-2026-11-08/FRESH-CAPTURE-PROPOSAL.md). Do not repeat the historical-byte search. Owner integration of body/admission-call caps and a tested durable producer precede separate live execution approval.
2. Verify real HTML/header compatibility, transport/redaction/producer claims, official frames and model definitions, then independently accept exact bytes. The synthetic fixture cannot establish live markup semantics. Any new provider/shared-ledger operation still requires its separate bounded authorization.
3. Establish complete current latest-five membership and an admitted operational method using the **settled weight 1.0**, without consuming the reserve; connect the producer/reader and real forecast/goalie envelopes; verify actual route behavior and the exact release candidate.

No push, deployment, production repair/configuration change, provider/DB request, acceptance-policy mutation or reserved-data read occurred.
