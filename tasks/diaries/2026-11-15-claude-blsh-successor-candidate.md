# BLSH successor candidate (offline patch) — diary

## Scope
- Successor of the BLSH native-capture candidate as an OFFLINE patch for Scout (owner of `web/scripts/blsh/**`).
- Started 2026-11-14 (local). Parent: BLSH Lane / Claude Chef session local_56526db8.
- Scope change (parent, TJ direction): DATE 2026-11-11 (verified slate, games 2026020293–298), not 11-14. SLOT 2026-11-17T14:05Z, OUTPUT …20261117T140500Z unchanged. Expiry 2026-11-19T00:00Z.
- Second item: per-operation TLS observation (feasibility + patch if feasible, without editing `web/lib/nst/**`). Layered on top of constants-only.

## Where
- Base HEAD a955107671ee7c1b2521891393a6bad6d95e9f89 (octoberBranch). Source paths clean in checkout.
- Scratch exports: scratchpad `base/` (unpatched), `succ/` (successor). node_modules symlinked.
- Output folder: `tasks/artifacts/blsh-successor-candidate-2026-11-15/`.

## State / checks
- Export baseline (unpatched, env -i): Prep 27/27, Adapter 29/29, Runner 87/87, Bootstrap 16 failed / 32 (all `bootstrap_wrong_checkout`: bootstrap binds canonical web/). Total 159/175.
- Probe (loopback): bundled undici 6.29.1 publishes `undici:client:sendHeaders` {request, headers, socket}; TLSSocket facts extractable (shown with npm undici 7.29.0 + trusted CA; bundled fetch untrusted → connectError only).

- Constants-only layer: CONSTANTS-ONLY.patch sha eaf862a2…; runner e9a96c03…, adapter 4876a606…, bootstrap a99f1286…. Export 159/175 (same 16 wrong_checkout); WEB-relocated non-candidate copy 175/175. Rehearsal RESULTS-constants.jsonl: happy complete, all faults/tampers vetoed, real-clock expired ACCEPTED (date fresh until 11-19), at-expiry refused before output, 1 s before accepted.
- TLS layer feasible without lib/nst: `channel("undici:client:sendHeaders")` subscribe per action in adapter; runner whitelists into SETTLED + TRANSPORT-OBSERVATION; fail-closed `tls_observation_missing`. Mutation checks pass (M1/M2/M3 each caught).
- TLS variant (later renamed TLS-VARIANT-BLOCKED.patch) sha c8289f2d…; runner 6b3388d1…, adapter 05f32054…, bootstrap ab2c98d9…. Applies to fresh git archive of a95510767; hashes reproduce. Export 184/200 (16 wrong_checkout); relocated 200/200. Scoped tsc 0 errors (base/succ/tlsx).
- Loopback: bundled fetch + in-process CA → authorized TLSSocket facts; untrusted/path-mismatch/two-requests fail closed.

- **Decision (session end):** the TLS layer is BLOCKED. On a resumed session, Node 22.23.4 `getPeerCertificate(true)` returns `{}`. undici's WeakRef session cache means ops 4/5 may resume, which would fail closed mid-pilot. The constants-only patch became `SUCCESSOR.patch`; the TLS work is `TLS-VARIANT-BLOCKED.patch` with a proposed runner-side fix.
- Final-bytes runs, from fresh git archives:
  - successor: 159/175 in the export; 175/175 relocated;
  - TLS variant: 184/200 in the export; 200/200 relocated.
- Live HEAD moved to `ee4d5fc96` (another session); no pinned path changed. Both patches pass `git apply --check` (check only).
- The report is in the shared notes folder: `blsh-successor-candidate-report.md`.

- **Ticket 2 (from Chef via the parent):** make the TLS variant THE candidate, with the resumed-session fix and `RUNTIME.json`. Done as v3:
  - the adapter records `sessionReused`, `connectionReused` and `connectionSequence`; the runner binds `resumedFromOperation` and `connectionFromOperation` and fails closed otherwise;
  - `RUNTIME.json` is written before the first dispatch; its env entries are presence booleans only.
  - The tests stub `node:tls`: CA lists only, and connect throws.
  - The circular type was fixed with an explicit `TlsFacts` interface.
- **v3 final:** `SUCCESSOR.patch` sha256 `40dd64bc…`; runner `5dc46ec8…`, adapter `aa6237bd…`, bootstrap `fe05a832…`. Fresh export 200/216 (16 `wrong_checkout`); relocated 216/216; tsc 0 errors. Earlier patches, rehearsals and logs moved to `superseded/`.
- Live HEAD `00d465aa1` at report time; no pinned path changed; `git apply --check` passed. The rehearsal is final: 27 lines; the verifier echo-scan fix covers the RUNTIME key name.

## Next
- Scout reviews and applies `SUCCESSOR.patch`, then runs the 4 suites in the canonical tree (authoritative for the bootstrap).
- Nothing else is pending in this session. Keep this diary until Scout applies the patch.

## Gotchas (more)
- The repo's `@types/node` is 18.0.2, which has no top-level `diagnostics_channel.subscribe` type. Use `channel(name).subscribe`.
- The canonical `web/node_modules/node_modules` is a pre-existing self-symlink (Oct 20), not mine.
- The rm safety check blocks `rm -rf $VAR`; use fresh directory names instead.

## Gotchas
- Bootstrap test line 96 pins old runner hash (not in parent's line list).
- Real-clock `expired` no longer refuses until 2026-11-19T00:00Z.
- Copied run-rehearsal.sh resolves WEB to canonical tree; must repoint.

## Ticket 3 (v4, from the review's interface section)
- Bootstrap: `checkExecution` now requires NST_JOB_LIFECYCLE_ENABLED to be absent. The verifier vetoes a present key.
- Runner:
  - `RUNTIME.json.launch` records entry script, cwd, bootstrap path and hash, presence booleans for `TS_NODE_*`/`OPENSSL_CONF`, and the names of any unlisted `TS_NODE_*` keys.
  - The default CA store is re-read before every dispatch and after every settlement, and recorded as `tls.defaultCACertificatesSHA256`.
- Dispatcher identity: feasible (`Symbol.for('undici.globalDispatcher.1')`) but not implemented; reported in HANDOFF.
- v4 `SUCCESSOR.patch` `66b4eb30…`: runner `6a7341dc…`, adapter `aa6237bd…` (unchanged), bootstrap `a224d62e…`.
- Fresh export 205/223 (18 `wrong_checkout`), relocated 223/223, tsc 0.
- Mutation gap found and fixed: the post-settle CA check is only observable on the last operation, so a test was added for operation 5.
- Live HEAD `8ac98cc86`; no pinned path changed.

## Ticket 4 (v5: global dispatcher identity)
- **Finding:** loading the runner's pinned cheerio pulls in npm undici 7.29.0, which registers its default Agent (writable, non-configurable). Bundled fetch honors the registry, so the live transport is npm undici 7.29.0, not bundled 6.29.1.
  - The v4 docs ("unset until first fetch") were corrected in HANDOFF.
  - The TLS observation holds on that path (`TRANSPORT-RESULT.txt`).
  - Keep-alive and resumption were not observed there in loopback.
- **First design rejected:** "refuse any dispatcher at start" would refuse every real launch. The vitest worker also pre-installs an Agent.
- **v5 design:** the runner anchors on the dispatcher at its module load, and checks it at start and before and after every dispatch. The bootstrap requires an empty registry before its imports.
- **v5 hashes:** `SUCCESSOR.patch` `e8be50de…`; runner `a74cbb0a…`, adapter `aa6237bd…` (unchanged), bootstrap `dbf69c47…`.
- **Checks:** fresh export 209/228 (19 `wrong_checkout`); relocated 228/228; tsc 0; mutations M11–M14 caught.
- **Gotcha:** the dispatcher registry entry cannot be deleted. Tests restore it by assignment; only the bootstrap suite assigns undefined.
- **Open:** `node_modules/undici` is unpinned. That belongs to the operator lane's dependency-tree check, which must also rebaseline the bootstrap hash.

## Ticket 5 (fallback v5-1118, parked)
- Scope: TJ-approved offline fallback for slot 2026-11-18 14:05Z, against 348a122d6 (v5 committed). Same source date; only slot-pinned values change. Not applied, not approved.
- Where: `tasks/artifacts/blsh-successor-candidate-2026-11-15/fallback-1118/` (FALLBACK.patch 209b34eb, bootstrap 849009ee, pins 3f61f9d4; verifier b86af692 unchanged). Live successor files untouched.
- Timing: capture 7d14h05m after the source date (8-day bound, 9h55m margin). The evaluation date rule (≤ 2026-11-18) comes from currentProcessEvidence.server.ts:210/215 with maxEventAgeDays 7. Window ≈ 9h53m (the 24 h capture-age rule does not bind). Verdict: tight but usable if post-capture steps are pre-approved.
- Checks: export 209/228 (19 wrong_checkout); relocated 228/228; tsc 0; mutations caught; rehearsal identical to v5; v5 pins veto the fallback packet. The operator's tree hash is unchanged (76c7d466); only bootstrap_differs_from_baseline.
- Gotcha: the operator's dress-rehearsal.sh was edited while I listed pins; HANDOFF cites it by content.
- Next: parked. Bridge, operator and Chef own the knock-on edits listed in HANDOFF §3.

## Ticket 6 (review L2: typecheck with exit code)
- `npm run typecheck` on scratch `git archive 348a122d6 web supabase` trees (node_modules symlinked): unpatched exit 0, patched exit 0. Log: `fallback-1118/logs/typecheck.log`.
- Gotcha: a `web/`-only export exits 2 with 46 errors, identical in both trees, from 4 files importing root `supabase/functions/**`. Include `supabase/` in the export.
