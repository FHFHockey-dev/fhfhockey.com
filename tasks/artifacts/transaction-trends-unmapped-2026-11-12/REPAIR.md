# Verified local repair candidate: three legacy Yahoo keys

**Production follow-through completed:** see [PRODUCTION-RECEIPT.md](PRODUCTION-RECEIPT.md) for the later authorized commit and successful exact-key readback. The investigation and local-candidate status below are preserved as history.

The deeper investigation found a concrete metadata defect and produced a tested repair. **Production is unchanged.** This is a three-player pilot, not a completed classification or repair of the previous 2,065-row aggregate.

Follow-up: [AUTHORIZATION.md](AUTHORIZATION.md) records the independent review, tightened **23-scenario** proof, current hashes, exact readback and refreshed Phase C gates. The original 18-scenario record below is retained as history.

## Confirmed current cause

At `2026-11-12T17:55:21.674214Z`, the current production identity reader returned no mapping for these exact keys:

| Yahoo key | Player | Existing FHFH identity | Existing NHL ID |
| --- | --- | ---: | ---: |
| 453.p.30000 | Nikita Nesterenko | 8946 | 8481754 |
| 453.p.30024 | Frank Nazar | 10423 | 8483493 |
| 453.p.30111 | Devon Levi | 10251 | 8482221 |

All three already have **verified** external and canonical identities, approved by the existing DR-011 review on July 15. Their `yahoo_players.season` is null; their external identity has `season_id = null` and context `yahoo:game:453:season:unknown`. The deployed `verified_yahoo_player_identities_read()` explicitly excludes null season IDs.

The stored `yahoo_game_keys` catalogue binds game/key 453 to NHL season **2024**, and canonical season **20242025** exists. Each player's newer `477.p.*` key maps to the same canonical player, which corroborates identity continuity but is **not** the authority used to infer the old season. No target source-season collision was found. No new player, name match, verification promotion or weaker reader rule is needed.

`REPAIR-EVIDENCE.json` retains the current three-key evidence, six old/new corroborating rows, catalogue rows, activity guard and exact deployed reader definition. The first 40 lexicographic Yahoo records all had null source seasons, but the initial derived-context join could not establish their external-identity status. Only the three independently checked old keys are classified here. The pre-fix top-20 capture and old 2,065 count were not treated as a current census.

## Exact repair

`repair-season-metadata.sql` changes only:

- Three existing `yahoo_players` rows: `season: null → 2024`.
- Three existing `fhfh_player_external_identities` rows: `season_id: null → 20242025`, context `unknown → 2024`, and an appended metadata-repair provenance object. The existing updated-at trigger runs normally.

It preserves NHL/FHFH IDs, verification status, match method, original review actor/time/provenance, ownership values/history, Yahoo source freshness timestamps and current-season rows. It does not create identities or modify a permanent schema/view/function.

The SQL pins the three external UUIDs, canonical/NHL IDs, source timestamps, original verification time and review-manifest hash. It locks the exact rows, verifies the game catalogue and canonical season, rejects conflicting identities/source uniqueness, and uses one serializable transaction with a 3-second statement timeout and 1-second lock timeout. A mixed/partial cohort aborts; an entirely completed cohort is an idempotent no-op. A final call to the existing identity reader must admit all three or both updates roll back.

The script defaults to `ROLLBACK`; `psql -v commit_repair=1` explicitly opts into commit. **Even rollback mode executes writes and triggers before rollback. Neither mode is authorized for production in this task.**

## Verification actually run

`python3 tasks/artifacts/transaction-trends-unmapped-2026-11-12/verify-season-repair.py`

Passed **18 scenarios** in disposable PostgreSQL **15.19**, using only a temporary Unix socket, with TCP disabled and inherited libpq configuration removed. The cluster was stopped and deleted. The fixture uses relevant production uniqueness constraints, the updated-at trigger, the exact captured reader function and retained three-target records; it is not a complete production schema/RLS replica.

- Default rollback leaves every fixture table unchanged.
- Explicit **local fixture** commit restores reader admission from **0 to 3** and changes only the specified six metadata rows. Identity and approval data, ownership values and current-season sentinels are preserved.
- Repeating the repair makes no further changes.
- Fourteen precondition variants reject atomically: catalogue drift/ambiguity, absent season/source, source drift, partial/mixed repairs, changed/unverified/merged canonical identity, unverified/changed-provenance external identity, target-context conflict and source-season uniqueness collision.
- A forced failure in the final reader check rolls back both table updates, proving protection after writes begin.

The sandbox initially blocked PostgreSQL shared memory. The isolated test was allowed through auto-review outside that restriction. The first executable SQL test found a PL/pgSQL alias ambiguity, which was corrected before the passing run. No auto-review rejection, pending operation or uncertain mutation remains.

Earlier unchanged API regressions remain **44/44 passed**, with scoped ESLint and diff checks passed. No need to rerun those tests for artifact-only SQL changes. New artifact whitespace checks passed. No application build, deployment, forecast or provider request occurred.

Pins (SHA-256):
- SQL: `99a528b95429e64123e276351240db8ca730da7abcb2440883911c1e15a8f10f`
- Harness: `08915c3576cb3f6384623581e987cbfc1aee05c6e4fab49115d0c4a6af4ff3bb`
- Evidence: `1519a4123fed3cda925c8a0f71b115c4b6ec475ec4838e6ddd9748403aca56d6`

## Production read accounting and remaining gates

This follow-up made **8 read-only SQL tool calls**, with 3-second statement timeouts: activity guard; index catalogue; first-40 keyset sample; non-executing exact-key EXPLAIN; six exact old/new keys; three game-catalogue rows; three exact repair targets/conflict checks; and the deployed reader definition/exact three-key admission check. One metadata call included both an estimated-row catalogue SELECT and EXPLAIN; only the final EXPLAIN was returned. SQL tool wall time is not a server execution-time measurement.

The initial activity result was 0 active clients/long queries/lock waits/normalization queries. Later exact-key reads included guards for long/IO/lock-waiting clients. Phase C remained ongoing according to the latest coordination notes; a quiet database instant was not interpreted as completion. Reads avoided normalized ownership-history aggregation and the NHL/provider/game-normalization tables. No application HTTP requests, production writes, migrations or deployments were made.

The next production action, if separately authorized by TJ and coordinated by the parent, is:

1. Obtain Phase C and overlapping recovery completion/handoff. Check current activity again; do not overlap the repair with that work.
2. Review this exact SQL hash and authorize **one atomic metadata transaction on the six listed rows** in `fhfhockey.com` / Supabase project `fyhftlxokyjtpndbkfse`. The SQL revalidates the captured state itself and stops on drift. No release or provider call is required.
3. Execute the pinned file once with explicit commit enabled, then use one bounded exact-three-key read of `yahoo_nhl_player_map_read` and the six target metadata rows to confirm the IDs/seasons and retained approvals. Suggested bound: one activity call, one transaction and one readback, sequentially; no broad count or timeline scan.
4. On an error or uncertain result, reconcile these exact rows first. Do not retry blind. SQL errors roll back the entire transaction; any reversal after a successful commit needs a separately reviewed compensating transaction using the saved before-state.

**Pending, not attempted:** production application and its readback. The parent's continuation explicitly forbids production writes/migrations/deployments, so the local proof is not authority to apply them.

**Still unresolved:** current total unmapped population and the causes of the other rows. Do not claim that fixing this pilot would change today's total from 2,065 to 2,062. A separately bounded, consistent census or successive reviewed exact-key cohorts is needed before expanding the manifest. Keep this pilot limited even if the same defect appears elsewhere.

## Ownership handoff

No existing runtime, writer, migration, shared UI or coordination file was edited. This lane's existing API-test patch remains uncommitted; the four new exact artifacts and diary are local. Parent review owns the next action. Preserve all other shared changes and keep the diary out of release candidates.
