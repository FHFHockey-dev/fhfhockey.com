# Reviewer brief: BLSH evidence bridge (independent review)

> **RECHECK-4 (narrow, 2026-11-15): the v5 interface and the new tool hash.**
> - **Interface:** `convert.mjs` `APPROVED` is v5 (pins `a2a1e694…`, verifier `b86af692…`, bootstrap `dbf69c47…`). `checkRuntime` requires `RUNTIME.globalDispatcher`, and `verifyTlsChain` requires the per-op `tls.globalDispatcher` (15-key packet `tls`).
> - **Tool:** `aa8a9cb7…`; its diff from `4f8a0888…` is the `APPROVED` constants only.
> - **Tests:** v5 is vendored in `approved/v5/`. New negatives are in tests 3 and 5. Suite: 21/21 in the canonical checkout.

> **Vendoring (2026-11-15):** tests and the operator commands use `approved/v4/*` and `approved/chef/*`, never the live successor or Chef folders. `approved/UPSTREAM-PINS.json` pins 6 vendored and 14 in-place files, checked at test import. Suite: 21/21 at v4.

> **RECHECK-2 re-review (2026-11-15):** the new tool hash is `acquire-boxscores.mjs` `4f8a0888…`. It replaces `e075b90a…`, which is not approvable.
> - **Changed:** the tool (self-contained); `frames.mjs` (runtime v2 / receipt v3 checks, `execArgv` `[]`, dispatcher, fixed path); `tests/acquire-harness.mjs`; the new `tests/observation-equivalence.mjs`; tests 15 and 18–20; `ACQUISITION-SPEC.md`.
> - **Unchanged:** `convert.mjs`, `assemble.mjs` and `propose-policy.mjs`.
>
> Suite: 21/21 in the canonical checkout.

> **Second recheck (RECHECK.md §4 / §1 / §2 / §6, 2026-11-15):** check only the new and changed parts. They are listed in README §"Changes after the recheck":
> - **New:** `acquire-boxscores.mjs` and `tests/acquire-harness.mjs`.
> - **Rewritten:** `frames.mjs`, on the production directory path.
> - **Changed:** `assemble.mjs` (approval re-check, frames manifest), `ACQUISITION-SPEC.md`, and tests 3, 15–19.
> - **Unchanged since the first recheck:** `convert.mjs` and `propose-policy.mjs`.
>
> Run the suite in the canonical checkout (20/20).

> **Recheck after review fixes (2026-11-15):** recheck only the changed parts. They are listed in README §"Changes after the independent review": `convert.mjs` `APPROVED` / `checkRuntime` / `checkLaunch` / `verifyTlsChain` (exact keys, CA store), `frames.mjs` (production vs test mode), `assemble.mjs` and `propose-policy.mjs` (bindings, frame modes), `ACQUISITION-SPEC.md`, tests 3, 5, 11, 12 and 15–17. The suite is now safe to run in place: test 17 asserts the folder is untouched.

**You are the separate reviewer.** The author's 14 passing tests are **not** acceptance. Review the code and the bytes, not the author's conclusions. Re-derive every claim, and report findings to the parent Chef (`local_56526db8`).

**Your limits:**
- Read-only on everything outside your own notes.
- No network, provider, NST, DB, ledger, credential or `.env` access.
- No git mutation, push, deploy or flags.
- Run tests with `TMPDIR` set to a scratch directory and `GIT_DIR` unset.

## Scope

**Under review:** `tasks/artifacts/blsh-evidence-bridge-2026-11-15/`, at the hashes in its README:
- `lib.mjs`, `convert.mjs`, `frames.mjs`, `assemble.mjs`, `propose-policy.mjs`;
- `real_fixture_lineage.py`, `window_feasibility.py`;
- `tests/`.

**Context it depends on (unchanged, read-only):**
- gate: `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts` (sha `e69db2c0…`) and `currentInput.ts`;
- runner and adapter: `web/scripts/blsh/nativeProcessCapture{Runner,Adapter,Preparation}.ts`, and `web/lib/nst/client.ts` (`redactNstMessage`, `fetchNstTextByUrl`);
- prior art: `tasks/artifacts/blsh-native-packet-preparation-2026-11-08/` (`prepare_packet.py`, `closed_gate.cjs`, SOURCE-PINS → pinned `nst_lineage.py` and `intake.py`);
- the successor's handoff, which defines the TLS fields (§2) and `RUNTIME.json` (§3): `tasks/artifacts/blsh-successor-candidate-2026-11-15/HANDOFF.md`, `SUCCESSOR.patch` **v4** (`66b4eb30…`; v3 `40dd64bc…` is superseded);
- the verifier used: `tasks/artifacts/blsh-successor-candidate-2026-11-15/rehearsal/verify-packet.mjs` **v4** (`04a632ba…`; v3 `fc4e3d04…` is superseded). It is now vendored as `approved/v4/verify-packet.mjs`; the live successor folder holds v5 work in progress. Chef's older verifier (`blsh-pilot-readiness-2026-11-14/rehearsal/verify-packet.mjs`) vetoes successor packets.

## Questions to answer, each with evidence

1. **Can `TLSVerified: true` be reached without real, authorized, correctly bound TLS observations and a default-CA runtime?**
   - Read `verifyTlsChain` and `checkRuntime` in `convert.mjs`.
   - Try to construct a packet that passes the successor's verifier and yet makes the bridge emit `TLSVerified: true` from weaker facts. Probe resumed sessions without a prior full handshake, keep-alive bound to the wrong opener, a repeated `connectionSequence`, and an admission operation without TLS.
   - Is "every override absent, plus `defaultCACertificatesSHA256 == rootCertificatesSHA256`, plus pinned `execPathSHA256`" sufficient evidence of the default CA with no overrides?
   - The successor states that `sessionReused` and `connectionSequence` are adapter-asserted: only their consistency is checked, not their truth. Does that matter?
   - The bridge does not check that the global dispatcher or agent was left unreplaced; is the adapter source review enough for that?
2. **Is the representation map honest?** Is `client_redacted_parser_input` really the gate's `parser_input_after_redaction`? Check the adapter at `:124-137`, `client.ts` at `:421-430` and runner retention at `:270-305`. Does anything else map, or get renamed?
3. **Are producer and redactor taken from the pins, never from the packet?** In the `--synthetic-adapter-ok` path, is the result unmistakably diagnostic, and does `propose-policy.mjs` refuse it?
4. **Is the freshness rule intact?** `nativeProcessCapturePreparation.ts:48` must be applied, not relaxed, at retrieval time. Check the boundaries: same-day capture, exactly 8 days, and clocks with offsets.
5. **OfficialFrame:**
   - Is `completedByUTC` truly the earliest official observation showing the game final?
   - Can a frame be produced for a non-final game, a game off the packet's schedule, a duplicated player, or a 0-TOI skater?
   - Is "one boxscore call per game" correct, and are the call counts right (6 for 2026-11-11; 5 per player-window; about 59 for an 8-date refresh)?
6. **Proposed acceptance:**
   - Does `requiredArtifactSHA256` bind every witness artifact plus the readback, runtime receipt, STARTED, schedule and boxscores?
   - Is the entry non-installable as written? `reviewSHA256: null` should be rejected by the gate constructor.
   - Did the author install a policy anywhere? Search for it.
7. **Tests:** does each negative fail for the stated reason, not by accident? Mutate the bridge (for example, delete the TLS call or the 8-day check) and confirm the matching test fails. Is the "intended rows" rule (288 − 54 dotted-team rows) derived independently of the code under test?
8. **Findings to confirm or refute:**
   - **(a)** The final `SUCCESSOR.patch` packet format, as described in its HANDOFF, converts. Chef's older verifier vetoes it because of the `SUPABASE_SERVICE_ROLE_KEY` key name in `RUNTIME.json`.
   - **(b)** In `WINDOW-FEASIBILITY.json`:
     - all five members can be source-observation-qualified at one evaluation only if span ≤ 7 days (68/644 windows);
     - current use of all five needs span ≤ 6 days (0/644);
     - re-derive both from `currentProcessEvidence.server.ts:201-215` and `nativeProcessCapturePreparation.ts:48`.
   - **(c)** NST's dotted team codes hold 54/288 real rows in the pinned lineage validator.
   - **(d)** `capturedWindows` never admits a window.
9. **Leakage:** do any committed artifacts (README, JSON results, test log) contain player names or IDs from the private retained request, or any secret?
10. **Durability:** are outputs exclusive (0700/0600), with no overwrite and the completion manifest written last? Does a refusal leave no output directory?

## How to reproduce

```bash
cd /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15
env -u GIT_DIR TMPDIR=<your scratch> node --test tests/bridge.test.mjs      # ~3 min; 14 tests; see README 'Tree precondition'
PYTHONDONTWRITEBYTECODE=1 python3 real_fixture_lineage.py >/dev/null
PYTHONDONTWRITEBYTECODE=1 python3 window_feasibility.py
```

The two Python scripts rewrite `REAL-FIXTURE-LINEAGE.json` and `WINDOW-FEASIBILITY.json` in place. Diff them against the committed copies.

## External read-only fixtures (sha256)

- NST 2026-10-01 counts: `8182551d…db8a`
- rates: `f79995aa…ae08`
- 09-30 PK on-ice: `80f79183…0c15`
- retained CURRENT-REQUEST: `c6d1d13d…12ba2`
- boxscore 2026020187: body `18709a26…ffafb`, receipt `5c94d24f…35d4`

## Verdict format

For each question: **pass**, **fail** (with a reproducer) or **unverified** (with the reason). End with an overall recommendation on whether the bridge can be used for a live pilot packet, and the exact preconditions.
