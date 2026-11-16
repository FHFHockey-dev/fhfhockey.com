# BLSH bounded pilot execution plan

**Status: ready as a local plan; DO NOT EXECUTE.** Specific user approval, a current custodian response and an assigned production slot are still missing. The request already delivered once under `CODEX-BLSH-CUSTODIAN-COORDINATION-20261112` remains the only outreach. Do not send another request or treat mailbox silence as clearance.

## Current evidence and operational order

All 17 original source/test pins, both bootstrap pins and all eight bootstrap evidence hashes were rechecked at local `octoberBranch` HEAD `8b759f44aa13d5bbca29a82be132b70d149dc0f7`; all match. HEAD moved through other lanes' work, while this exact candidate is unchanged. The relevant evidence is 32 bootstrap tests, final typecheck/lint, actual offline CLI success/refusal, and independent closure of the CommonJS shadow-file defect. Earlier 204 distinct runner/adapter/sKO/UI tests remain earlier evidence at unchanged pins. No additional established offline defect or incomplete test remains; successful unchanged suites were not rerun for this plan.

The incoming [coordination mailbox](../cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md) now contains:

- `CLAUDE-FIX-SPRINT-SERIAL-ORDER-20261112`, **19:30:30Z**: the approved sequence is Claude normalization, Trends repair, Goalie Grid release, Claude summary/goalie refresh, DRM repair, then Goalie H1 capture, each with its stated approval/handoff conditions.
- `CLAUDE-FIX-SPRINT-DB-HANDOFF-2-20261112`, **19:37:08Z**: Claude reports its writes stopped after the last normalization write at 19:35:34Z, and hands the next step to Trends followed by Goalie Grid.

These are saved coordinator statements, not BLSH production observations. **Neither assigns a BLSH slot.** Do not insert this pilot between the approved steps or assume the proposed next-day time is safe. Scout must place BLSH explicitly in the current sequence with the NST custodian. No linked production data/receipt file, migration authority or live health endpoint was opened for this plan.

## Frozen candidate and proposed scope

| Binding | Exact value |
| --- | --- |
| Checkout / cwd | `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; execute only from `/Users/tim/Code/fhfhockey.com/web` |
| Bootstrap | `web/scripts/blsh/nativeProcessCaptureBootstrap.ts`, SHA-256 `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f` |
| Runner | SHA-256 `5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb` |
| Adapter | SHA-256 `0162fb52fe3df0b3c1b70f11b0739792a5b0f32b8dbd35b92255597a506c5368` |
| Other source roles / test pins | [CORRECTION-CHECKS.json](CORRECTION-CHECKS.json), [BOOTSTRAP-CHECKS.json](BOOTSTRAP-CHECKS.json) |
| Node | `/usr/local/bin/node`, v22.23.4, darwin arm64; executable SHA-256 `daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef` |
| Loader | ts-node 10.9.2 / TypeScript 5.7.3, exact dependency entries/manifests and tsconfig in [RUNTIME-IDENTIFICATION.json](RUNTIME-IDENTIFICATION.json) |
| Project / mode | `https://fyhftlxokyjtpndbkfse.supabase.co`; **existing disabled lifecycle mode only**, no flag change |
| Source | Season 20262027, regular season, **2026-11-07**, all teams, skaters, all strength, counts; individual then on-ice |
| Proposed start window | **2026-11-13T14:05:00.000Z inclusive to 14:06:00.000Z exclusive**, one start; 120-second work budget ends before 14:08 UTC subject to synchronous-I/O limitation |
| Proposed output | `/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z` — absent, parent metadata verified user-owned 0700; not created/approved |
| Proposed authorization receipt | `/Users/tim/Library/Application Support/fhfh-blsh-pilot-authorization-20261113.json` — absent, same private parent; not created/approved |

The bootstrap hard-codes this proposed slot/output and its nine expected runtime pins. A revised slot/output requires a reviewed successor bootstrap and fresh approval binding; do not edit the receipt to bypass the code. A changed source date requires a revised runner/adapter scope too. November 7 fails the date-age check from **2026-11-15T00:00:00Z**. If the slot is missed, stop; do not silently re-date or rerun.

## Gates before the user sees the execution request

1. **Custodian and coordinator:** identify the actual operator (proposed NST custodian `local_3bb2755d` or confirmed successor), acknowledge the existing request, and explicitly clear this window within the current production sequence. Any active/restarted production contention or conflicting NST work makes it a no-go. Existing shared admission remains mandatory; no pause/disable of other jobs is included.
2. **Actual configured process:** supply a non-secret receipt establishing the pinned project, existing disabled mode, Node/loader/dependency resolution and TLS configuration. The inspected shell and empty-environment CLI checks are unconfigured; they cannot satisfy this gate. Operator privately confirms credentials exist without disclosing values or loading them for this preparation task. No preloads, TLS bypass, alternate proxy or custom trust settings outside the reviewed profile.
3. **Admission/control evidence:** custodian confirms the current deployed contract/control state from already-retained evidence. The best saved report is post-burst budget body MD5 prefix `5e854308` (local full body `5e8543085513e308b92ce55b0090557b`), plus older controls/ACL readback. This is not a current full-hash/enforcement-state readback. If new remote evidence is necessary, propose and obtain its own bounded authority; it is outside the five-call pilot.
4. **Private storage:** operator accepts the exact output/authorization paths and has host permission to write them. Keep output absent; the runner creates it exclusively at 0700 and files at 0600, fsyncing before dispatch. No separate output folder should be pre-created. A failed durability check stops locally.
5. **Specific user approval:** present [PILOT-AUTHORIZATION.md](PILOT-AUTHORIZATION.md), this exact candidate/window and the five operations/writes below. Only after approval may the operator create the private authorization JSON in the [documented shape](BOOTSTRAP-HANDOFF.md), with genuine human/coordination/runtime/admission references and the exact bootstrap hash. No approval receipt exists now; the documented `PENDING` example is deliberately invalid.

These gates remain pending. Neither the implementation request nor the instruction to keep independent lanes moving authorizes capture or the two admission writes.

## One authorized invocation, only after all gates close

The previously verified `--check` command remains available for local, credential-free validation; see [BOOTSTRAP-HANDOFF.md](BOOTSTRAP-HANDOFF.md). A current non-secret profile from the actual configured process must still be separately established. Do not use a real adapter factory as a configuration probe.

After specific approval, in the already configured operator process, with the reviewed loader environment `NODE_PATH=.`, `DISABLE_V8_COMPILE_CACHE=1`, `TS_NODE_COMPILER_OPTIONS={"module":"commonjs","moduleResolution":"node"}` and no forbidden overrides, the **single** planned command from the exact web cwd is:

```sh
/usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only scripts/blsh/nativeProcessCaptureBootstrap.ts --run '/Users/tim/Library/Application Support/fhfh-blsh-pilot-authorization-20261113.json'
```

**This command was not run.** No shell wrapper, `.env` loader, secret export, scheduler, retry loop, second terminal or alternate output path is part of this plan. The bootstrap rechecks source resolution/hashes, private paths, receipt scope, start window and project/mode; then it rebuilds one fresh plan and awaits one runner invocation.

## External budget and stopping behavior

| Order | Exact operation | Maximum attempts |
| --- | --- | ---: |
| 1 | GET `https://api-web.nhle.com/v1/schedule/2026-11-07` | 1 |
| 2 | POST `https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1`, `p_burst=false`, `p_planned_requests=null` | 1 |
| 3 | GET the fixed **individual** NST URL from the authorization packet, after a valid current permit | 1 |
| 4 | Same admission RPC for the on-ice page | 1 |
| 5 | GET the fixed **on-ice** NST URL from the authorization packet, after a valid current permit | 1 |

The full NST URLs are frozen in [PILOT-AUTHORIZATION.md](PILOT-AUTHORIZATION.md); the plan may not add/alter a query parameter. Every failed/uncertain attempt counts toward the ceiling. Concurrency one; no retry, redirect, query-key fallback, browser service, lifecycle begin/finish/hold, status poll, database readback or application request. A denied admission ends the invocation; do not wait and poll again.

Honor at least 22 monotonic seconds between NST dispatches and all existing local/global limits: stricter 39/minute, 80/5 minutes, 100/15 minutes, 180/hour, plus the deployed post-burst cooldown. No burst is requested and no ledger is cleared or substituted. Existing local reservations may remain charged if shared admission refuses. Up to two legacy admission transactions may update `last_untracked_at` even on a budget denial; allowed permits additionally update shared attempt/spacing state. No statistics, forecasts, cohorts, evidence admission, scores or lifecycle job rows are written.

The work deadline is 120 seconds from runner entry, measured with wall and monotonic clocks. Provider response/body timeout is at most 15 seconds; admission at most 5 seconds, each clamped to remaining time. Disabled mode adds no cleanup request/time. Synchronous filesystem calls cannot be preempted; an overrun prevents later provider work/success when control returns. A timeout does not prove server cancellation and never permits a retry.

Stop before transport on any source/runtime/project/mode/approval/path/slot mismatch. Official schedule must have one unambiguous nonempty exact-date list, coherent unique game/team identities, correct season/type, schedule state `OK`, and every game `OFF`/`FINAL`; otherwise stop before NST admission. Stop on the first permit denial/invalidity/expiry, HTTP/TLS/redirect/shape error, timeout, byte/row cap, filesystem failure or uncertain transport. No normal retry or changed-date continuation exists.

Accepted decoded limits remain 1 MiB schedule, 2 MiB each NST page, 5,000 rows/page, 8 MiB total packet. Admission JSON uses the existing uncapped parse path; these are not wire-byte or guaranteed monetary-cost ceilings. No deployment/build is part of the plan.

## Local reconciliation after the one approved attempt

Do not make follow-up remote calls. Preserve the directory even if the process exits nonzero, is interrupted or produces no final manifest. Inspect it as data; never execute retained source snapshots.

1. Record the process exit status, invocation/approval references and whether the output exists. `STARTED.json` and `PLAN.json` bind project, mode, fresh plan and the nine source snapshots. Compare their bytes/hashes with the frozen candidate; no file is rewritten to make it match.
2. Account for `operation-N-STARTED.json` and matching `operation-N-SETTLED.json`. A STARTED record without settlement is **possibly dispatched/uncertain**, not proof of no request or a refund. Successful disabled mode must show the five ordered operations above with usable permits, matching final URL/status and no redirect. Report counts of started, settled and uncertain operations separately; do not invent wire-level timing or exact bytes from application receipts.
3. Verify retained `schedule.raw.json`, `individual.parser-input.html`, `onIce.parser-input.html`, their `*.TRANSPORT-OBSERVATION.json` and source snapshots against `MANIFEST.json` entries. Check private modes, original completion clocks, file hashes, byte/row limits and scope. Preserve unknown original-publication/model facts and `TLSVerified: null`; a successful HTTPS request alone is not the missing transport-evidence receipt.
4. Completion requires both successful process return and a coherent final `MANIFEST.json` with `state=packet_complete_pending_review`, five operations and both retained pages. **Any failure, FAILED.json, missing/mismatched file, unresolved STARTED operation or completion-marker uncertainty vetoes acceptance**, even if a final marker remains. Never use a partial marker to resume or issue a sixth call.
5. Keep all artifacts private until credential-echo/privacy review and explicit disposition. No automatic deletion, overwrite, upload or Git inclusion. Share only reviewed sanitized metadata. Any unresolved server effect requires a separately bounded reconciliation proposal; do not query or clear the production/local ledger from this plan.

A complete packet is still **pending independent source review**: `advancedAdmission=false`, `independentlyAccepted=false`, `score=null`, baseline weight unchanged. It does not supply complete official per-player/goalie membership, an admitted forecast envelope, source/method qualification or permission to publish scores. Those remain separate work.

## Handoff state

The offline implementation/test/review work is complete at the pinned candidate. This plan adds no runtime change. Continue from the existing mailbox response when available, settle only the dependent owner facts, and then request the specific bounded approval. Do not repeat successful suites, duplicate outreach or use production to fill the waiting period.
