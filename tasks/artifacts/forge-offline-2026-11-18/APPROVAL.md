# Decision for TJ · One isolated FORGE rehearsal

**Approved on November 19, 2026.** TJ authorized the isolated Nov 23 run, Astra’s automated witness and conditional deletion of the new fixture database project. Managed execution is **blocked before provisioning**. Neither role has verified hosted access. The lead cannot yet verify the US$10 ceiling if setup, execution or teardown fails. The two-hour limit applies. The lead has armed zero jobs and triggered zero builds. [Game 2099020991 preflight record](MANAGED-PREFLIGHT-2099020991.json)

On Nov 19, PostgreSQL 15.20 and PostgREST 16.6 recorded qualified claim `9da9d039-cf22-42db-97ec-d29accf3e678` for synthetic game `2099020991`. The verifier login accepted the committed packet before T−60. SQL subsequently observed publication revision `cd5d574a-f989-44f5-b66b-d935af61f10b`. Both RSO readers selected that claim as their run. Daily returned **2.965 points at C#1** for player `8471001`. Detailed returned **`missing_participation`**, with null points and slot. The Linux container used loopback delivery, a fixture timestamp signer and a separate database login inside the harness process. TJ's physical Mac-offline interval remains to be recorded for Nov 23. [Linux game receipt](../sandboxforge-2026-11-19/OFF-MAC.json) · [Run conditions and retry evidence](../sandboxforge-2026-11-19/RECEIPT.md)

**Scope approved by TJ**

> Approve one scheduled, isolated Nov 23 rehearsal of synthetic game 2099020991 on candidate f886ddac731ae825a12fab915848d2b5fd7d9b8c. Authorize private delivery of that source, up to one isolated Vercel build and deployment, one fresh isolated Supabase database with the pinned SQL and seed, and the separate operator, app, witness and monitor credentials specified below.
>
> For this fixture only, authorize Astra's separately hosted automated witness to accept committed readback by T−60. Register and activate only the two isolated dispatch and watchdog jobs for 2099020991. Authorize the setup clock check, up to four signed application POSTs, one real DigiCert stamp, one fresh capture, one publication from its verified claim, both RSO reads for player 8471001, the hosted terminal check, private receipt export and deactivation.
>
> Keep my Mac offline from before dispatch at 3:40 p.m. through the 4:13 p.m. report, Eastern time. Cap incremental spend at US$10 and new isolated compute at two hours. Stop if the cost, credentials, release or window cannot be verified. Keep production job 408 off. This approval covers the isolated projects and synthetic game only.

TJ subsequently authorized the hosted operator to permanently delete only the new `fhfh-forge-offline-rehearsal` Supabase project under the teardown procedure below. The engineering lead owns setup, execution and reporting. Before creating resources, verify existing off-Mac access for both roles and the total incremental cost through failure and teardown.

| Required access | Current evidence | Evidence needed before provisioning |
| --- | --- | --- |
| Astra’s independent Linux witness | The independent owner’s handoff supplies no hosted session. The Linux sandbox exercised the verifier in the harness. | Record the existing host or vault reference and administrator. Verify Astra’s separate access, timer and durable logs with the Mac offline. |
| Operator’s terminal reporter | The monitor script uses the proposed libpq service `forge_isolated_monitor` and writes a summary to stdout. The operator handoff and available environment inventory identify no reporting host or external receipt destination. | Record the existing host or vault reference and administrator. Verify separate reporter access, a persistent timer and logs, and a private destination outside the fixture project. Use a harmless sample to prove the reporter can save and read back the sanitized record there. |

## Candidate and custody

| Item | Approved isolated scope |
| --- | --- |
| Candidate | Local ref `refs/rc/forge-offline-rehearsal-20261123` at `f886ddac731ae825a12fab915848d2b5fd7d9b8c`, tree `09ef9bf0662e14cd80fa60cee25c70a988e5c748`, parent `f8081453463da1c30f60a4572f5a65da3c9d2dbf`. Deliver this object. The shared octoberBranch has concurrent work. |
| App | New Vercel project `fhfh-forge-offline-rehearsal`, proposed production alias `https://fhfh-forge-offline-rehearsal.vercel.app`, project root `web/forge-rehearsal`, Node 22. The local production build exposes the signed capture and stage handlers. Enable access to source outside the project root. This root has no application cron declarations. |
| Database | New isolated Supabase project `fhfh-forge-offline-rehearsal`. Record its provider ID and TLS hostname on the hosted operator before setup. Use an empty public schema with pg_cron, pg_net, Vault and pgcrypto. Only the fixed synthetic seed belongs here. |
| Independent witness | An independently administered Linux session, clean candidate checkout, Node 22.23.4, dedicated secret store, direct TLS connection and `forge_independent_verifier` login. The capture deployment has no witness credential. The witness has no capture, publication or operator credential. Preserve Astra's independent authority over verification. |
| Operator and reporting | FORGE's existing publication implementation owns the model and atomic write. The RSO adapters call both existing readers. Engineering lead owns arming, monitoring and the final verdict. A separate monitor login has the single fixture-check grant. Provide a hosted libpq service named `forge_isolated_monitor` and a private log sink on the monitoring host. |
| Game and reader | Synthetic `2099020991`, season `20262027`, puck drop **22:00 UTC November 23**. NHL player `8471001`. Synthetic one-center roster, one C slot, 3 points per goal, 2 per assist and 0.5 per shot. Real-league selection and historical Werenski values are outside this evidence. |

The existing human mandate applies until TJ explicitly accepts the isolated machine witness. For a live game, retain the named witness and direct readback approval unless TJ changes that mandate separately. The named-login path requires the individual to initiate its read from the independent host. No personal login may be used by the automated service.

**Witness mandate update · TJ, November 19, 2026.**
- **What counts for live acceptance.** A named human witness still counts. An automated off-Mac verifier may substitute for one only after it passes an isolation rehearsal.
- **DigiCert alone does not count.** The RFC 3161 token in custody is not an independent witness by itself.
- **What the automated verifier must do.**
  - Run separately from the FORGE writer, with its own short-lived, narrowly scoped NOLOGIN access.
  - Read the committed claim back from the database.
  - Independently verify the game ID, claim ID, packet hash, cutoff and DigiCert token.
  - Record its own timestamped verdict before T−60, in a receipt the writer cannot create or alter.
  - Be shown to reject missing, mismatched and late evidence.
- **Access limits.** No new database LOGIN role, no service-role access and no project-wide signing secret in the app.
- **Scope.** This update changes only what counts as a witness. It does not approve a push, a production access change or a live run.

## Setup after approval

1. From the hosted operator, verify the source SHA and tree. Stage the ref on a TJ-controlled isolated private Git origin, with only the rehearsal web project linked. Inventory the links and exact-SHA deployment status before triggering a build. Require one web build, zero companion projects and zero preview builds. Reuse a READY exact-SHA deployment if one already exists. Use provider Git metadata for the system release SHA and production environment. Stop on any mismatch or unexpected build.
2. On the independent infrastructure, provision separate database owner, app service, witness and reporting credentials. Use an isolated dispatch key of at least 32 printable characters in Vault as `forge_pregame_dispatch_secret` and the rehearsal Vercel secret store as `FORGE_PREGAME_DISPATCH_SECRET`. Make the signed endpoints reachable from isolated pg_net at the exact HTTPS alias. No reusable key is in the request. Require the original pinned DigiCert G4 profile for the real timestamp service. The rehearsal database supplies synthetic hockey data.
3. Set the **isolated app** Supabase URL and keys, `FORGE_PREGAME_CAPTURE_ENABLED=true`, `STARTER_BOARD_CAPTURE_ENABLED=true`, `STARTER_BOARD_COMPUTE_ENABLED=true`, `STARTER_BOARD_SERVING_ENABLED=true`, `STARTER_BOARD_CANARY_GAME_IDS=2099020991`, `FORGE_SKATER_MODEL_MODE=baseline`, `FORGE_RESERVE_PASS_ENABLED=false`, `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED=false`, `RSO_FORGE_DAILY_BRIDGE=on` and `RSO_LATER_IMPACT_SCENARIO=off`. Use legacy daily serving for the fixture, with the native catalog head unset. Keep the isolated deployment free of production account credentials. Verify the two function manifests give 240 seconds and the deployment metadata pins the approved release.
4. Generate SQL from the exact candidate with the fixed clock below. Its expected SHA-256 is `c02c458fe6d2675d45995264036fbeab07f094cd2cc3a73d5d6376602f52171b`. Apply it once on the fresh isolate. It includes the existing custody, dispatch and publication schema plus migrations 20261118210001–003. The original publication migration remains `4a70657ae3e0841f6fac1e66ee608ed866c5152b83a23dd10a83f5b435373f97`. The bootstrap creates no active job.

```sh
python3 -I tasks/artifacts/forge-offline-2026-11-18/rehearsal/bootstrap.py \
  --start 2026-11-23T22:00:00Z --out /tmp/forge-isolated-2099020991.sql
psql -X 'service=forge_isolated_owner' -v ON_ERROR_STOP=1 -f /tmp/forge-isolated-2099020991.sql
psql -X 'service=forge_isolated_owner' -v candidate=f886ddac731ae825a12fab915848d2b5fd7d9b8c \
  -f tasks/artifacts/forge-offline-2026-11-18/operator/register-isolated.sql
```

5. Verify both jobs are dormant, the source schedule agrees on both teams, the operator has load visibility, and the installed pg_net accepts 240,000 ms. Perform one setup Data API read of `forge_rehearsal_api_clock` with the rehearsal app role. Require `service_role` and an effective 15-second statement timeout. Check the witness's effective grants including PUBLIC, the named role boundaries, DB CA, pinned code and keys from the two separate secret stores. The reporter gets only its check RPC via membership in `forge_rehearsal_monitor`. Stop before arming on any discrepancy.
6. On the witness host, use the automated command in [the independent operator guide](../forge-pregame-capture-2026-11-14/operator/independent-witness.md). Schedule it for **20:40:00 UTC**, with `GAME_ID=2099020991`, the candidate SHA and `--poll-until 2026-11-23T21:00:00Z`. It reads the raw packet at most once and contacts no timestamp service. On the reporting host, pre-schedule [report-isolated.sh](operator/report-isolated.sh) for **21:13 UTC** with TLS-verified libpq access and jq. Connect its failure exit to the existing hosted operator alert channel. It exports only game ID, phase and reason. Confirm both timers and their durable logs before arming.
7. With advance approval in hand, arm on the hosted operator **before 20:40 UTC** using `psql -X 'service=forge_isolated_owner' -f tasks/artifacts/forge-offline-2026-11-18/operator/activate-isolated.sql`. Registration and activation are separate transactions. TJ's Mac can power down before the run and stay offline through terminal reporting. Record its offline interval with the eventual receipt. No game-time intervention is expected.

## Execution and limits

| Eastern time on Nov 23 (UTC) | Hosted operation |
| --- | --- |
| 3:40–3:53 p.m. (20:40–20:53) | Supabase can enqueue one signed preflight and one signed capture. Failure of effective compute or exact game scope skips before a capture slot. Changed schedule, closed window or unavailable capacity stops the attempt. |
| By 4:00 p.m. (21:00) | A separate login verifies the committed packet, canonical digest, claim binding, cutoff, release, RFC 3161 signature and clock bounds. Its provisional result must be observed in a later transaction by T−60. An absent or rejected verdict withholds publication. |
| Following acceptance | One signed publication delivery calls Astra's owner code. A separate SQL transaction looks up the committed receipt even after a lost response. One signed reader delivery records daily and detailed results against the same run. |
| Terminal, or 4:12 p.m. (21:12) | Stop both isolated jobs. The independent 4:13 p.m. (21:13 UTC) observer can durably close and report a missed run even if the cron dispatcher never fired. On an outage it exits unsuccessfully and leaves an external monitoring record. |

**Cost authority is a ceiling.** One isolated build and deployment, one fixture DB, one hosted verification process and one reporting check. At most four application POSTs and one TSA stamp. Four 240-second invocation ceilings give 16 aggregate function-minutes. The real-PostgREST local fixture made 166 app-to-DB HTTP requests (2 preflight, 135 capture, 6 publication, 23 readers). A slow request can end the game early. Witness polls every 30 seconds for this 20-minute interval, at most 40 polls plus a boundary check. Each SQL job has at most 73 scheduled minutes from 20:00 through 21:12 on that date, typically fewer through self-deactivation. Allow one setup clock RPC, one full metadata-only terminal receipt export, and the scheduled monitor check. Existing plan credits, actual provider billing and available independent Linux capacity are unverified. Use existing paid capacity only if the provider-side incremental ceiling can be met, with new isolated compute limited to two hours. Stop before provisioning if a new subscription, additional build or unbounded charge would be necessary.

Two billed hours of Supabase Micro compute at the published rate would cost US$0.02688 before credits. A bound for the whole run still needs the effective Vercel build tier, ingress, function runtime, storage and egress, plus the stamp, witness, reporter and cleanup through failure. Vercel checks spend periodically. A budget notification alone cannot establish the ceiling. [Supabase compute rates](https://supabase.com/docs/guides/platform/manage-your-usage/compute) · [Vercel spend checks](https://vercel.com/docs/spend-management)

## Lookup, stop and acceptance

```sql
select forge_pregame_capture.hosted_receipt_v2(2099020991);
```

Retain the sanitized JSON in the private hosted operator store under the game ID, together with exact deployment ID, cron execution and pg_net request IDs, witness host identity, report exit status, billing metadata and TJ's offline interval. The query omits the packet and token bytes. A passing rehearsal requires the joined game/claim/release, independently accepted hashes by T−60, one observed publication, both selected reader runs and a terminal success report. The expected daily result is 2.965 points at C#1. The expected detailed skater result is `missing_participation` with null points and slot.

At the first unexpected link, run [stop-isolated.sql](operator/stop-isolated.sql) on the isolated owner connection, disable the isolated operator timers and inspect the game receipt. An unresolved delivery fences the slot. The guarded postgame `hosted_release_fence_v2` preserves its original outcome after custody reconciliation. Never dispatch a second capture or publication to find out what happened. Disable the isolated web entry points and revoke the ephemeral credentials.

**Fixture teardown on success or failure**

1. At creation, record the new Supabase provider project ID, organization, project name, creation time and two-hour deadline in the private external operator store.
2. Before deletion, save the sanitized game receipt or an actionable failure record outside the fixture project with its game ID and recorded project ID. Read the saved record back and verify the IDs, result and digest against the export. Retain the terminal reporter’s summary and exit status when available.
3. Verify the exact recorded ID against Supabase immediately before deletion. Permanently delete only that new project within two hours of its creation. Confirm deletion with Supabase and append its acknowledgement and confirmation time to the external record. An ID mismatch stops deletion. Production job 408 and all existing projects are outside this authority.

The deployed Git SHA is expected in the provider system environment. Supabase documents role timeouts and its Cron-to-HTTP transport. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables) · [Supabase timeouts](https://supabase.com/docs/guides/database/postgres/timeouts) · [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)

## Local verification and prior hosted evidence

The [candidate receipt for synthetic game 2099020991](LOCAL-2099020991.json) contains claim `543fc867-3940-452c-b2eb-69c40f3beea0`, the two packet hashes, token hash, independent verdict, revision, selected runs, points, slot and exclusion. The local HTTP run used real PostgREST 16.6, PostgreSQL 15, signed requests to both Next handlers and the dedicated verifier LOGIN. The queue transport, signing authority and hockey records were fixtures. The separate lost-response test committed the packet without acknowledging the finish and committed the publication without returning its write response. Both recovered from database evidence.

The control harness emitted 97 passing assertions with its connected route case. The focused Vitest run passed 60 cases across seven files and conditionally skipped the PostgreSQL route case, which passed in the control harness. Full web TypeScript and scoped ESLint passed. The isolated project built locally under the final production SHA with exactly two dynamic endpoints. The 241-module producer closure retained its admitted hash; the 257-module scan including hosted capture and publication had zero findings. The final SQL change was also exercised against the witness and joined-stage suites. Registration, activation, monitor lookup and deactivation scripts ran against disposable SQL scheduler interfaces. Actual managed scheduler installation and delivery remain rehearsal evidence to collect.

The original route retains its 420-second cap. The v2 route and its pg_net delivery each allow 240 seconds. The capture work cutoff is 218 seconds from the conservative queue/entry clock, finish is due by 230 seconds, and the DB fences at 240. The budget reserves 160 seconds after claim, with 12 seconds for pinning, 75 seconds for collection, 12 seconds for save, 8 seconds for TSA and bounded RPCs. The claim is refused if the full remaining budget cannot fit. Publication waits on the independent verdict at the existing committed packet boundary, uses that immutable input cutoff, and bounds application I/O at 216 seconds. A subsequent DB tick observes the committed publication. A slow or killed process leaves a durable reason or unresolved fence.

The [Nov 17 hosted canary](../forge-pipeline-reliability-2026-11-17/HOSTED-CANARY-2026020336.md) remains the off-Mac capture evidence for 2026020336. Job 408 was closed after that canary. Its packet does not establish a historical Werenski publication or either RSO selection.
