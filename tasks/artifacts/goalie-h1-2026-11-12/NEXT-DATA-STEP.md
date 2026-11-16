# Goalie H1 operation review

## Current disposition — November 12, 7:06 p.m. Eastern

**Game 2026020307 is skipped by TJ's latest direction. No H1 game is currently selected.** Do not resume the old game-307 execution preparation or reuse its preview as authorization. The separate `tasks/diaries/2026-11-13-codex-h1-execution.md` describes earlier preparation for that game; the latest skip and database-window direction take precedence. No matching local H1/deploy process was found in the bounded process check; no hosted deployment-state check was made in this update.

Claude is running the approved summary-only 2025–26 goalie rebuild (1,417 games, one date per call) and bounded read-only investigations, per TJ's status relay. Codex H1 work stays local until a new explicit handoff. The earlier idle-window/settings note is historical; it does not clear this active workload. Do not probe the database, invoke a preview/model/application route, or select a replacement game during this window.

### New configuration evidence and later-game plan

`CLAUDE-H1-WINDOW-AND-SETTINGS-20261112` at 23:55:10Z reports production capture=true, compute=false, canary=2026010049, bootstrap=true, scheduler=true, serving=false and challenger=false, with no FORGE_CODE_VERSION override. These are Claude's nonsecret hosted observations, not a new independent live read here. Inspection of the pinned flags/runner code confirms the consequence: current production settings cannot capture and publish the requested regular-season H1 context.

The later-game operation must therefore include a separately reviewed configuration/release step, not just a POST. Prepare a clean released-source candidate with compute enabled and a canary containing only the newly approved game. Account explicitly for scheduler=true before enabling compute: the bounded operation should prevent automatic computation/freeze fan-out, with a reviewed temporary scheduler setting and restoration of the prior deployment/settings. Serving and challenger stay false. Any deployment-scoped override must be checked against the resulting deployment; do not assume dashboard variables or a source SHA alone establish effective configuration. No configuration change or deployment is authorized or performed by this document.

After Claude's completion handoff: revalidate the then-current release and dependent lane changes, nominate one later upcoming game with adequate preparation time, repeat the bounded scope/lease/health checks, establish current freshness, and present the exact candidate/configuration, full write footprint, one-attempt limits, readback and restore/reconciliation steps for approval. Preserve source and analytics preimages before any approved replacement. Do not silently switch games or automatically retry an uncertain result. The HTTP path still has no hard write-request ceiling; do not borrow the local runner's limits or describe its runtime budget as transaction cancellation.

### Concurrent file ownership

The November 13 UTC follow-up claim returns L10, L11, L8 and L4a paths to Claude for the stated local work. In particular, L8's Lines scope intersects existing uncommitted DRM-related line-assignment changes in `web/components/LineCombinations/**`, `web/pages/lines/**` and `web/components/LinemateMatrix/**`. Preserve these changes and coordinate exact edits; no concurrent Codex edit or blanket staging of those paths. The older L8 brief's broader DateRangeMatrix listing is not a fresh transfer of the DRM data lane. The separate CSS/aesthetic shared-ownership arrangement remains in force. No H1 source edits are needed in those re-claimed paths during planning.

## Completed readiness inspection — November 12, 23:46 UTC

**Readiness inspection complete; no H1 production run authorized or executed.** This durable copy supersedes the operational status in the historical draft below. Original draft and five-file pins were preserved without loss; see `PRESERVATION.json`. This packet is not executable authorization.

TJ explicitly handed Codex the database window for three bounded read-only SQL queries and, if the fence passed, one existing-runner preview capped at 20 reads. TJ also confirmed Claude was completely idle. All authorized checks finished. No background process remains and no further database work is scheduled from this inspection.

### Verified evidence

| Check | Observed result |
| --- | --- |
| Database health, 23:42:01Z | 554 ms tool round trip; not in recovery; zero other active client queries; zero lock waiters. This is a point-in-time check, not a sustained capacity guarantee. |
| Hosted local-execution fence, 23:42:09Z | All six function body hashes match the owning migration; security-invoker/search-path settings and service-role execution grants match; both guard triggers enabled; both indexes valid and ready. Follow-up confirms schema usage and no anonymous/authenticated execution grants. No migration is needed for this fence. |
| Fresh proposed scope, 23:43:33Z | **2026020307, St. Louis (19) at Utah (68), slate date 2026-11-12, scheduled start 2026-11-13T02:00:00Z / November 12 at 9 p.m. Eastern.** Explicit replacement proposal for game 299; not permission to run or silently replace it again. |
| Existing state | No revision or local attempt for game 307. One November 9 full-slate run is succeeded, with its resumable lease released. The game queue is pending with no owner, active run or lease. No queue entry was claimed or changed. |
| Existing local-runner preview, 23:43:49Z | Passed; two reads, zero writes, expected prior revision null. Model was not run. Node v22.23.4. Preview cap: 20 requests, 60 s overall I/O deadline, 10 s per request; read-only mode rejects all writes despite the CLI's minimum numeric write-limit argument of 1. |
| Total live work | **Three SQL requests plus two REST reads; zero mutations, providers, application-route calls, migrations, deployments or hosted flag changes.** |

Evidence: `READINESS-RECEIPT.json` (health/catalog), `SCOPE-RECEIPT.json`, `PREVIEW-RECEIPT.json`, and `READINESS-SUMMARY.json`. Query text is retained in `readiness-catalog.sql` and `readiness-scope.sql`.

### Execution-path correction

The local runner is suitable for private captured evidence, but **cannot satisfy live Game Grid candidate-name acceptance**. It stamps `FORGE_CODE_VERSION=local:<hash>`. The public Game Grid reader calls `excludeOffReleaseRuns`, which rejects `local:` runs before selection. Do not relabel a local run as a release, relax the serving fence, or interpret a private capture as live UI success. Sources: `web/scripts/run-forge-local.ts:408`, `web/lib/projections/goalie/gameGridReader.ts:71`, `web/lib/projections/releasedRunFence.ts:10`.

The preview also exposed two loaded source files that differ from released 4243: `web/lib/projections/queries/goalie-queries.ts` and untracked `web/lib/projections/goalie/historyLedger.ts`. They are source-consolidation work, explicitly excluded from the names-first release packet; see its README and `tasks/diaries/2026-11-12-codex-goalie-consolidation.md`. They were preserved, not edited or admitted for production. A third dirty loaded source, `starterBoardScoring.ts`, is byte-identical to 4243. The five original source pins alone do not prove the full runtime closure matches that release.

Private preview identity: `local:64050d303124f3bd17dfdf66eea8bcf898f89679dd51beccfe1373e097e0e8f1`; exact artifact SHA-256 `2a604e00552fb1375d319248fbb3db6cf00696e31fc53d7e54aeafe97b153c37`. The artifact and receipt are retained outside temporary storage at `/Users/tim/.fhfh/goalie-h1-20261112/preview-2026020307/`. This identity is not approved for writing. Its process-only flags are capture/compute true, serving/scheduler/challenger false, canary game 307. Other model environment entries are recorded as unset, not inferred hosted values.

### Remaining work before an executable live-grid H1 proposal

1. Use the released producer path for the live-grid outcome. Revalidate its actual deployment/producer identity and effective capture/compute/canary/bootstrap settings; the local preview says nothing about hosted flags. Preserve serving/scheduler/challenger settings.
2. Establish current freshness evidence without treating this preview as preflight. The HTTP route's existing preflight checks the full date and prior 14-day inputs, even for one requested game. Do not invoke the route merely as a diagnostic or bypass these gates. Reuse the completed DRM/goalie source receipts where they apply; line combinations, goalie priors, identity mappings and other model inputs still need current evidence.
3. Bound and review the full HTTP footprint: run metadata, player/team/goalie/reserve projections; deletion/replacement of this game/date/model's three analytics output sets; route audit records; and input snapshot/game revisions when capture/compute is enabled. The three analytics replacements are not a collectively atomic operation. This is not a goalie-only repair, and the local-runner request/write ceilings do not apply to HTTP execution.
4. Pin one still-upcoming game, expected prior state, exact one-attempt runtime/readback/failure limits and a fresh exclusive execution handoff. If game 307 reaches its start before readiness/approval, stop and present a new scope. A timeout or lost response requires reconciliation, never automatic retry.
5. Obtain approval for that concrete operation after these gaps are resolved. The completed read-only approval grants no H1 write, flag change, deployment, migration or analytics replacement. A displayed surname must be verified against the exact issued team/game candidate. The current reader itself says a frozen puck-drop receipt is unavailable; do not claim that later freeze acceptance is implemented by this plan.

Probability qualification and authoritative historical membership remain separate, unfinished gates. No new production permission is requested by this review document.

## Historical draft preserved below

Updated November12 after production release4243bcd4 and current coordination refresh. This is a source-based operation review, not an executable authorization or a production-read receipt.

## Completed prerequisites
- Names-first candidate4243bcd4e29889c035e832562e25850d14af0ee1 is released and READY/aliased. Four approved raw HTTP checks passed; the November12 goalie API returned0 candidate boards. Receipt: /tmp/fhfh-goalie-release-preflight-20261112/RELEASE-RECEIPT.json.
- Scout handed over the two private-export files. The separate canonical export is implemented locally and passes133pipeline tests, scoped lint and full shared typecheck. Packet: /tmp/fhfh-goalie-canonical-export-20261112/README.md. It was not included in4243 and remains for review.
- The prior synthetic diagnostic is retained: canonical conditional credited-Win0.54 versus legacy serving export0.60, with canonical-only goalies omitted by the legacy exporter. This motivated the new export; it is not evidence of actual production disagreement or calibration.

## Historical coordination (superseded above)
Claude's STEP4-START at20:03:03Z says the summary sweep and goalie partition refresh have started with distinct TJ approval. Scout then coordinates the DRM repair before H1 identity/capture. Wait for those actual completion handoffs. No database/provider/application request, pipeline, model fit or setting change was made by this review. Native Scout/source-consolidation snapshots are terminal/idle; they are not jobs to poll for completion here.

## Newly verified operation differences
The five inspected files exactly match deployed4243; hashes are in H1-SOURCE-PINS.json.

### Existing HTTP route
`web/pages/api/v1/db/run-projection-v2.ts::handler` accepts the single-date gameIds/horizonGames/maxDurationMs parameters. A candidate scope from the earlier authorized diagnostic is date2026-11-12/game2026020299 (Boston6 vs Montreal8; recorded start2026-11-13T00:00:00Z). That saved13:38Z observation must be revalidated, and the scope expires at game start. Do not backdate it or silently substitute the next game if the serial queue finishes later.

The hypothetical POST path is `/api/v1/db/run-projection-v2?date=2026-11-12&gameIds=2026020299&horizonGames=1&maxDurationMs=120000&bypassPreflight=false`. This is NOT ready to invoke. Authentication stays in the existing secret-safe operator mechanism; no token belongs in this packet.

This is the full player/team/goalie producer for one game, not a goalie-only writer. Besides run metadata, it upserts forge_player_projections, forge_team_projections, forge_goalie_projections and reserve rows. Crucially, `runProjectionCalculations` calls `persistPerGameAnalyticsOutputs` without localAttempt: that deletes and replaces this date/game/model's player_prediction_outputs, game_prediction_outputs and model_market_flags_daily records. These replacements are not transactional as a group. No odds ingestion is triggered by that helper, and its game win fields remain null; the extra writes still need explicit inclusion in the operation scope.

The route runs broader slate/date freshness checks before projection. gameIds does not bound their scans or all reads. A120s model budget answers by135s, but an in-flight step can continue; this is not a hard database-stop guarantee.207/timeout/lost response means reconcile the existing run/lease, never automatic retry or takeover. Existing resume state can select a prior run and skip the outer preflight, so its identity/age must be inspected before invoking rather than assumed fresh.

### Existing local runner
`web/scripts/run-forge-local.ts` is an existing alternative, not a new pipeline. It pins code/dependencies/model configuration, limits total REST attempts and writes, journals uncertain writes, confines network to the selected Supabase REST origin, blocks DELETE/provider HTTP, and uses localAttempt so the three analytics replacements are omitted. It enables capture/compute and disables serving/scheduler/challenger only in its own process; it does not change hosted settings.

However, it directly calls runProjectionV2ForDate and does not call the HTTP route's runProjectionPreflightChecks. Do not use it to evade freshness gates. It also requires begin_forge_local_run and its database fence. The current README describes that migration as unapplied; that is local documentation, not a fresh hosted-ledger check. Confirm the actual migration/RPC state through the owner before selecting this path. No migration is proposed or authorized by this review.

Runner defaults are1000requests/100attempted writes/150s runtime/10s perrequest. Those are software ceilings, not measured resource headroom or a recommended budget. I/O limits cannot prove cancellation of a server transaction or preempt synchronous work. The read-only preview itself makes live scope/revision reads. Do not run even its preview during the held window.

## Concrete inputs Scout must supply or review before H1
1. The actual completed step4/DRM handoffs, exclusive operation window and current source-head/freshness receipts. A slot is not inferred from an idle chat.
2. One still-upcoming game/date, scheduled start, team identities and existing revision/run/lease state. The saved Boston candidate is a proposal with an expiry, not current evidence.
3. Chosen execution path and exact supported write footprint. If HTTP, include analytics delete/replacement and cron-audit effects. If local, confirm deployed fence, reviewed artifact/operation UUID/expected prior revision, shared ownership directory and equivalent freshness evidence. Do not introduce a second model.
4. A nonsecret receipt of effective capture/compute/canary/bootstrap flags and actual producer code/model identity. Capture requires capture&&compute; H1 publication needs supported scope. Capture alone does not store the snapshot. Existing serving/scheduler/challenger settings must not be enabled as a side effect.
5. Accepted maximum attempts, writes, readback records, concurrency1, runtime and per-request limits, plus failure/reconciliation handling. Returned-row caps are not scan/I/O caps. The present evidence is insufficient to certify a hard physical DB budget.

Once these are concrete and the coordinated scope is approved, perform one attempt, retain its run/candidate/revision/snapshot identities, and verify the displayed surname against that exact team/game candidate. No regeneration just because the UI is unavailable. Preserve one captured issuance before game start and the final frozen selection after the game-start boundary through existing supported machinery; do not reconstruct an as-issued record from overwritten projections.

## Qualification and workload gates remain separate
The new private export preserves every canonical candidate and unknown mass, using canonical Start and credited-Win conditional on starting. Official-start and credited-win labels must be independent. Missing labels are unknown; nonstarters are excluded from the conditional-Win population. Keep the existing200game/30slate minimum, predeclared populations/baselines and component review gates. A successful H1 run does not qualify either percentage.

Historical tenure/trade completion remains a separate source-evidence task. The consolidation owner has80passing pure tests and a pinned-export admission gate, but has not recovered an authoritative UUID/hash/membership-coverage receipt. Do not wire an empty or fabricated tenure source into the live panel to call it complete.

TJ's broad ordered-completion authorization is recorded. The immediate blockers are exact operation scope/readiness and the serial handoff, not another general permission request. Scout owns local branch synchronization and later integration of the separate exporter patch; leave current shared source edits intact.
