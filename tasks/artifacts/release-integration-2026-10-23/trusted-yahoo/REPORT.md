# Trusted Yahoo current planning candidate

Local implementation is complete and frozen for independent review. It is **not** a release acceptance or a live-provider validation. Base HEAD: `2a5092d37cb863ec92a2a4e609999cf226bfa4a5` on `octoberBranch`. No commit, push, deployment, real provider/DB call, credential/settings change or migration application occurred here.

## Behavior and authority

- `planningConfirmations.ts` reads an owned team and league for the authenticated principal, checks matching connected account and configured Yahoo season, then requests **one current-day roster resource**. It does not call the full snapshot loader, settings, scoreboard, availability discovery, or per-candidate provider reads. No timeout retry is added; the existing provider client may retry once on 401 after token refresh.
- The roster must match its team, coverage date and owned-login marker. Its provider response date cannot be future or over two minutes old; cache age must be at most 60 seconds and is conservatively deducted from the remaining two-minute lifetime. Incomplete lists and failed reads reject the private read. Two bounded mapping queries check both identity directions; ambiguous, wrong-team/date/game, unknown and absent marks do not alter a prior.
- The existing bridge-only `applyProviderGoalieStarts` supplies confirmed-start 1 / confirmed-nonstart 0 and team participation accounting. Conditional saves/GA abilities and unknown values are preserved. Native rows remain outside that override; target approvals remain empty. Conflicting confirmations retain the existing conservative helper behavior. Existing server-news likely 0.8 / projected 0.65 floors are unchanged, including higher-prior preservation.
- New private POST `/api/v1/roster-schedule-optimizer/yahoo-current-data` uses `requireApiUser` and `requireProviderSyncAccess`. Body `userId` is ignored. It invokes the existing source-selection/admission path via `loadPlanningData(... consumer: "rso", forgeDailyBridge: true)`, applies verified marks on the server, and returns a noncacheable receipt bound to principal/team/league/season/range/time zone and a request nonce. The public data route is unchanged.
- `yahooPlanningReadBroker.ts` performs the actual authenticated fetch on the main thread. A separately transferred runtime `MessagePort` permits exactly one fixed-scope read; request JSON cannot choose an endpoint, headers, account scope or response body. Bearer tokens never enter snapshots, execution options or worker messages. Scope is copied before asynchronous work; identity is checked before/after fetch, and auth-change cancellation remains active through computation.
- Worker and no-worker execution share that channel and the existing current-read adapter. The reader checks nonce, server clock, policy revision and private scope, replaces the entire forecast graph, and includes provider expiry in authority/publication deadlines. Failed, stale, mismatched or revoked reads preserve schedule/manager inputs with no old numerical fallback. Saved Yahoo labels cannot mint authority. This protects serialized input boundaries; it does not claim to defend against arbitrary same-origin JavaScript execution.

## Inspectable scope

`CANDIDATE.json` pins 15 leased paths, of which 14 changed. The existing hook test is pinned unchanged. The application changes are one server loader, one private route, a runtime port reader/broker, current reader/adapter/worker/hook wiring, and one `yahooPrincipalId` line in `RosterScheduleOptimizer.tsx`. No billing, Game Grid, model producer, native policy/catalog, Start Chart, migration, storage or schema file changed in this packet.

Patch SHA-256: `7013599e82c6c2b8bc2512e3d95abd2b73db6d58c69c8e8c3456847c3030f001`.
Fixed source archive SHA-256: `78e986e8b065e2c07cb971b6ae654f474b52545e5caf1856a33fe4bf5785214a`.

## Verification actually run

Node 22.11.0 / npm, isolated copies with environment loading disabled, synthetic keys and network-denial guards. Shared heavy checks used the atomic-directory lock and released only their own token/inode.

104 distinct passing cases across six files, assembled without adding overlapping runs:

| Test file | Cases | Receipt |
|---|---:|---|
| `lib/integrations/yahoo/planningConfirmations.test.ts` | 29 | `attempt-01/tests.json` |
| `lib/integrations/yahoo/planningConfirmationRoute.test.ts` | 8 | same |
| `lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts` | 4 | same |
| `lib/rosterScheduleOptimizer/executionAdapter.test.ts` | 51 | `tests.json` |
| `hooks/yahooPlanningReadBroker.test.ts` | 8 | same |
| `hooks/useRosterPlanning.test.tsx` | 4 | same |

Server/helper source and dependencies are unchanged from the first receipt; the final 63-case client run covers subsequent broker/harness changes. Tests exercise actual worker entry and actual shared no-worker execution, positive 1/0/unknown controls, spoofed saved marks, missing runtime channel, wrong principal/team/league/range/nonce, revocation, expiry during compute, coalescing, logout and read-deadline cancellation, and token absence from outputs. Server route tests use the real `requireApiUser` with mocked auth transport, and loader tests mock all DB/provider access.

Scoped TypeScript: PASS. Scoped ESLint: PASS, zero errors, six existing RSO hook-dependency warnings. `baseline-lint.log` reproduces the same six rule/messages against the preserved pre-edit component; no warning was suppressed and no unrelated dependency-array edit was made. `STATIC.json` records exact commands. Full current-tree release type/lint and browser acceptance are still separate gates.

Historical failures are retained: first run 100 pass / 3 harness URL failures; corrected Vite origin-relative worker URL setup passes all three parity cases. One fixture cast caused the first scoped TypeScript failure; a real `MessageEvent` fixes it. The original zero-warning lint invocation failed on those six baseline warnings; this is disclosed, not relabeled as zero-warning success. The first baseline-lint probe used an absolute symlinked path and was ignored; `baseline-lint.log` is the corrected relative-path execution.

## Reproduction and remaining gates

`fixed-source.tar.gz`, `SNAPSHOT.json`, `COMMAND.json`, `STATIC.json`, and the attempt receipts preserve exact tested inputs. Extract the archive into a disposable directory; attach the already installed `web/node_modules`, retain the offline setup and synthetic environment from `COMMAND.json`, and run its listed npm commands from `web/`. `verify.py` constructs a new canonical overlay for future revisions; it is not the immutable replay command.

Independent review is pending. In particular inspect runtime-port provenance, lifetime/abort handling, ownership and identity filters, provider budget, and expiry publication. No live Yahoo test is authorized. Browser acceptance should mock the new private POST and its scope/nonce receipt plus browser auth; it must not call Yahoo. The candidate has no final release commit SHA yet and must not be supplied as one to Claude. Model reverts, billing shutdown/switch, the active Game Grid follow-up, final composition, exact-SHA browser validation and parent vetting remain outside this packet.
