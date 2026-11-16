# BLSH pilot: blocker register and handoffs (2026-11-15 UTC)

Each item names an owner, exact paths and evidence. Claude edited none of the files that belong to other owners.

| # | Blocker | Owner | Disposition |
| --- | --- | --- | --- |
| B1 | Frozen candidate cannot run | Scout / Codex BLSH lane (`web/scripts/blsh/**`) | **Handoff below.** Blocks any pilot |
| B2 | No bridge from the runner packet to the qualification gate | Scout / BLSH, with the NST custodian for TLS provenance | **Handoff below.** Blocks *qualified* evidence, but not a diagnostic pilot |
| B3 | No operator accepted, no window cleared | TJ | **The one next decision: operator** (packet §1). The window is then cleared by the custodian and Scout |
| B4 | No configured-process / TLS / admission-control receipt | Proposed operator plus NST custodian | Pending; supplied after B3 and before approval |
| B5 | Nov 13 re-verification receipt cited in the Master Task List is not in the repo | Scout | **Hand over or confirm none.** Not assumed passed; the repo baseline (11-12 19:40Z) was re-verified instead |
| B6 | `market.ts:118-120` labels a reference "comparable" when given any non-empty `source` | Shared valuation / BLSH owner | Low. No production caller today. Before wiring, require a verified, dated market-reference provenance. Diagnostic note only |
| B7 | Production 404 gate on `pages/buy-low-sell-high/trade.tsx:12-13` has no regression test | BLSH page owner | Low. Add one test asserting `notFound` when `NODE_ENV=production`. The gate itself is verified closed by reading the code |
| C1 | Pin drift: `BlshTradeComparison.{tsx,test.tsx}` | — | **Closed.** Changed by `adc77310d`, not a runtime role. Suites pass (PIN-RECHECK.json, SUITES-CURRENT-TREE.log). Successor hashes are recorded there |
| C2 | No independent readback tool existed (the plan's reconciliation was manual) | Claude (owned) | **Closed.** `rehearsal/verify-packet.mjs` imports no repo code and vetoes 14/14 fault and tamper cases, including a packet that binds fewer source roles (REHEARSAL.md) |

---

## B1 handoff: successor candidate (for Scout)

**Why.** These four values are hard-coded:
- `nativeProcessCaptureBootstrap.ts:13-14`: `OUTPUT` and `SLOT` (2026-11-13T14:05Z);
- `nativeProcessCaptureBootstrap.ts:129`, `nativeProcessCaptureRunner.ts:14` (`DATE`) and `nativeProcessCaptureAdapter.ts:73` (schedule URL): the date 2026-11-07.

`nativeProcessCapturePreparation.ts:48` rejects any date that is ≥ 8 days old, so Nov 7 has been stale since 2026-11-15T00:00Z (reproduced: `future_incomplete_or_stale_date`). The slot itself has also passed.

**Smallest change, same safeguards:**
1. Set one new fixed date in the runner (`DATE`), the adapter schedule-URL check (`:73`) and the bootstrap plan (`:129`). Set new `SLOT` and `OUTPUT` in the bootstrap. Keep **one fixed output path** and the in-process `attempted` flag: the runner refuses only an *existing* directory, so the fixed path is what prevents a second packet.
2. Update `SOURCE_PINS` in the bootstrap for the new runner and adapter hashes. The new bootstrap hash then goes into the authorization receipt.
3. Move the test fixtures to the new date:
   - `nativeProcessCaptureRunner.test.ts:20,33,93,251,271,282,402`;
   - `nativeProcessCaptureAdapter.test.ts:28,32,63`;
   - `nativeProcessCaptureBootstrap.test.ts:23,25,31,95,108-109,115,164`.

   The preparation test uses its own relative dates and should not need changes.
4. Keep the date constraints:
   - the date is before the slot's UTC day;
   - `slot + 120 s − date` is under 8 days;
   - the date is a regular-season date whose games are all expected `OFF`/`FINAL` (pick a date at least 2 days before the slot);
   - the slot avoids saved NST windows (08:25–10:05 UTC) and other NST jobs.

   Proposal: date **2026-11-14** (Saturday; slate not verified offline), slot **2026-11-17T14:05:00Z**. No NST cron is listed for 14:xx UTC in `web/vercel.json`. The custodian must still clear it.
5. Keep:
   - disabled lifecycle mode only;
   - five ordered calls, two admission POSTs at most;
   - 0 retries or redirects;
   - 22 s NST spacing;
   - a 120 s work budget;
   - 15 s / 5 s timeouts;
   - 1 / 2 / 8 MiB caps and the 5,000-row cap;
   - 0700/0600 permissions and fsync-before-dispatch;
   - the `wx` + hard-link manifest.
6. Verify offline before any approval request:
   - the four capture suites;
   - `--check` under `env -i`;
   - Claude's rehearsal: update `rehearsal/expected-pins.json` to the nine successor runtime hashes, then run `REHEARSAL_DATE=<date> run-rehearsal.sh <scratch>` with the clock in `run-rehearsal.sh` set inside the new date's freshness span;
   - one independent review;
   - then a new readiness receipt (19 + 8 pins → successor pins).

## B2 handoff: packet-to-gate bridge (for Scout and the NST custodian)

`currentProcessEvidence.server.ts:183-187` requires a `NativeReceipt` with:
- `TLSVerified: true`;
- `representation: "parser_input_after_redaction"`;
- `producerSHA256` and `redactorSHA256`;
- `toiParsingContract: "minutes_decimal_or_mmss_to_seconds_half_up"`.

It also requires a per-player `OfficialFrame` (`:197-200`) and a non-empty acceptance policy (`CLOSED_PROCESS_EVIDENCE_POLICY` is empty, `:17`).

The runner writes `*.TRANSPORT-OBSERVATION.json` with:
- `TLSVerified: null`;
- `representation: "client_redacted_parser_input"`;
- `status: "candidate_requires_adapter_and_source_review"`;
- no producer or redactor hash and no TOI contract (`nativeProcessCaptureRunner.ts:298-303`).

`prepare_packet.py` (`blsh-native-packet-preparation-2026-11-08/`) additionally needs:
- a CURRENT-REQUEST, CONTEXTS and the native-inputs manifest;
- per-player TOI, GP, `completedByUTC`, `gamesOnNativeDate` and `dateMembershipComplete`;

and no code converts a runner packet into those inputs.

**Smallest needed handoff:**
1. Decide what evidence can set `TLSVerified: true` from the configured process. Owner: NST custodian.
2. Build a reviewed offline converter from the runner packet to `NativeReceipt` plus a native-inputs manifest, mapping the representation label explicitly rather than renaming in place. Owner: Scout.
3. Source per-player official frames for the pilot date from the official feed. This is a separate bounded read and is **not** part of the five calls.

Until all three exist, a successful pilot packet is **diagnostic only**.
