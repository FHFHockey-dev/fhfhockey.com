# Retained evidence reconciliation and offline readback adapter

## Findings

The bounded retained-record search did not locate the released captured-game model tuple needed by the adopted SOG scope. This is a statement about the inspected records, not proof that no such record exists elsewhere, and not an inference from November 1's zero-row result.

| Retained evidence | Actual observation | Why it does not pin the current scope |
|---|---|---|
| Claude mailbox `CLAUDE-20261026-098` | Explicit production flag read: serving=false, legacy combined flag unset, canary `2026010049`; release #385 smoke reported legacy/native_not_activated | Historical October 26 state. That canary is not among the four observed November 2 game IDs. No current configuration or activation is inferred |
| `astra-rso-handoff-2026-10-26/BOUNDED-READ-RECEIPT-2026-10-26.md` | Two historical run metadata rows had no input snapshot; the bounded snapshot query returned zero | Retained metadata receipt, not immutable issued forecasts. Its explanation that capture was off is historical owner interpretation |
| Private `native-publication-execution-v1/receipt.json` | 86 persisted rows, `persisted_not_activated`, activation not performed | Native baseline/participation publication, not a captured FORGE game-revision model tuple |
| Private `candidate-conditional-publication-v2/receipt.json` | 95 persisted rows, activation not performed | Same contract distinction; proposed process pins are not production configuration |
| Private `candidate-participation-publication-v2/receipt.json` | 3 persisted rows, activation not performed | Participation publication does not supply a released SOG game-revision identity |
| Private `native-cadence-readonly-reconciliation-execution-v1/receipt.json` | Closed input reconciliation; headCAS=false, sourceAcquisition=false, currentOvernightReadiness=false | Input closure is not current issuance or consumer qualification |
| Private `consumer-live-readback-v1/execution-receipt.json` | October 16, `hosted_store_readback_completed`; original package hash and identity checks retained | Real older native-store evidence. Recovered companion receipt explicitly distinguishes this from hosted HTTP/browser acceptance and current captured-game qualification |
| Recovered `forge-task2-2026-10-22/HANDOFF.md` | Explicitly synthetic fixture and mechanical reproducibility tests | No authentic prospective qualification claim |
| Existing exact-release verifier receipts | Commit/producer closure proof | Do not contain the actual run's configuration/artifact identity or canary configuration |

Private receipt paths and SHA-256 pins are listed in `retained-evidence.json`; private response bodies, names, league/account details and release IDs were not copied into this packet. The private root is `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1`. Recovered documentation was read from `/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505/files/`. This closes stale “missing canonical path” pointers without editing historical checkouts. No sealed October 23–30 forecast, readback or outcome payload was opened; the October 26 material above is configuration/run-metadata documentation only.

## Completed unblocked work

`normalize-readbacks.ts` now converts saved public RSO and Start Chart responses to the integrity checker's E2 rows. It uses the application's actual `decodePlanningDataTransport`, retains NHL identity, the exposed model hashes/revision/cutoff, observed capture time and denied uses. Null SOG remains null. It refuses bridge substitution, mismatched identity, date fallback, conditional-only values, empty readbacks, duplicate player/game rows and missing/ambiguous Start Chart revision joins. It does not construct participation lineage that the consumer did not expose.

**11 tests passed with TypeScript checking enabled**, including the real transport encoder/decoder and a saved-JSON CLI round trip. The initial harness failed TS5095 because the repository's bundler module resolution conflicts with CommonJS; the task command explicitly sets moduleResolution=node. No dependency or application configuration changed. These are synthetic adapter checks, not live qualification. The shared heavy lock was released after the checks.

Run from `web/`:

```sh
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' TS_NODE_TRANSPILE_ONLY=0 node -r ts-node/register -r tsconfig-paths/register --test ../tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/normalize-readbacks.test.ts
```

Normalize an already-authorized saved public response, using its **original** capture timestamp:

```sh
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' TS_NODE_TRANSPILE_ONLY=0 node -r ts-node/register -r tsconfig-paths/register ../tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/normalize-readbacks.ts rso capture.json raw-rso.json > rso.normalized.json
```

Use `start-chart` for the other consumer. `capture.json` contains exactly the intended `date`, original `observedAt` and approved `gameIds`. No fixture-generated current timestamp, default canary or authorization is supplied. Retain original raw response bytes/hash alongside normalized output, then use the corrected checker; normalization does not prove issuance or qualification.

## Canary and custody handoff

The only current schedule evidence remains the four November 2 games from the authorized metadata read. Their complete-slate T−60 is November 2 23:00 UTC / 18:00 New York. Actual canary IDs and a valid issued tuple remain unknown. The historical canary must not be silently replaced with those four games, and serving must not be enabled merely to collect evidence.

Before a concrete canary request, the legacy producer coordinator must supply an original released captured_live h1 identity plus current non-secret canary/capture/compute/serving receipts, or name the exact operation and current runtime owner needed to produce them. If a new producer operation is necessary, its game/date/source/batch/runtime/write/fan-out bounds must be prepared before TJ authorizes it. Full application readback also retains the internal fan-out, issue-version E1 extractor, season-rate comparator and first-slate/reset prerequisites in PROTOCOL.md. No canary execution is ready or authorized by the records found here.

Claude's incoming mailbox still has no candidate SHA or custody transfer. PROV-GUARD remains idle/unreleased; local Git custody remains retained. No repeated custody message was sent during this search. The four-file app candidate and held qualification tooling are unchanged; this adapter lives only in the lane's artifact directory. No new live traffic, production mutation, build, push, deployment or activation occurred.
