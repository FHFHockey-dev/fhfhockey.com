# BLSH v6 re-date receipt: capture 2026-11-22 12:05–12:07Z on the 2026-11-21 slate

**Done under TJ's packet 6.1 approval (edits and tests only).** Nothing was applied, staged, pushed, armed or enabled, and there were no production reads or writes. The release candidate is `refs/rc/blsh-release-20261120`; its SHA is reported with the handoff. The release and freeze decision is in [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Date mapping (verified)

| Step | Rule in code | Nov 22 window |
| --- | --- | --- |
| Native, job 404 | `sourceDate.ts`: slate = capture UTC day − 1; window 12:00–12:30; fence from 2026-11-19 | Capture 2026-11-22 12:05 → slate **2026-11-21**. The permit (re-dated INSTALL) allows 12:05:00 to 12:07:00 (exclusive). |
| Request-context | `requestContextHandler.ts:186–188`: signed slate must equal ingress UTC day − 1, otherwise `skipped outside_approved_date` | POST 2026-11-22 12:35 → slate 2026-11-21. The D−28…D read covers 2026-10-24 to 2026-11-21. |
| Official | `officialPilotHandler.ts` `SOURCE`, `officialPilotStore.ts` `SOURCE_DATE`, `officialPilotAcquisition.ts` `OFFICIAL_SLOT`, plus the DB claim function | Slate 2026-11-21; slot 2026-11-22 12:45:00–12:45:59.999 (DB: 12:45:00 to 12:46:00 exclusive) |
| Slate | Public NHL schedule, read once 2026-11-20 about 13:35Z | 2026-11-21 has 14 regular-season games, puck 18:00Z to 03:00Z. That is under the 16-game cap. |

## What changed

**Web: official step only.**
- `officialPilotAcquisition.ts:11` (slot), `officialPilotHandler.ts:7` and `officialPilotStore.ts:7` (slate). The diff is date literals only.
- Tests:
  - `officialPilotHandler.test.ts` adds the retired 2026-11-21 slot, the retired slate 2026-11-20 and the wrong slate 2026-11-22 to the refusal cases.
  - `officialPilotStore.test.ts` adds the retired slate.
  - `officialPilotHandler.testHelper.ts` uses the new dates.
- `web/scripts/blsh/readHostedOfficialV6.mjs`: the post-capture reader's slate and slot.
- `prepareV6Observation.test.ts` shifts +1 day.
- `prepareV6ObservationCapture.testHelper.ts` gains `officialPilotDates` and an optional `at` argument. The default stays Nov 20/21, so the request-context and ledger tests that share it are unchanged.

**Database (not applied).**
- New file `supabase/migrations/20261120143000_blsh_official_pilot_redate_20261121.sql`, **SHA-256 `ce14c532f1b9169e52a310e7a3affb29c27b37a00f0bcf08e022de539e7f0f7b`**.
- What it changes:
  - It replaces the `source_date` check (`2026-11-20` → `2026-11-21`).
  - It runs `CREATE OR REPLACE` on `blsh_official_claim_v1` with only its three date literals changed. The owner and the service_role-only execute grant are kept.
- Guards:
  - It refuses if any official run exists (`official_redate_runs_exist`).
  - It refuses if the constraint text or the PostgreSQL 15 claim-function hash differs from the reviewed `20261118155445` (`official_redate_definition_mismatch`).
- Claim-function hash before: `5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1`. After: `4efee291f95cab0c761c3b88e423131a2d13d87956daf593fbcc9be05bf61f4d`.
- `supabase/tests/blsh_official_pilot.py` now applies it and uses the new dates, with the retired slot and slate added.

**Operator SQL, in [redate-20261122/](redate-20261122/).** Each is a mechanical copy. Capture 21 → 22, slate 20 → 21, object suffixes, cron `45 12 21 11 *` → `45 12 22 11 *`, and Vault `blsh_official_grant_20261121`. Nothing else changes.

| File | SHA-256 |
| --- | --- |
| `INSTALL.sql` | `e51a9a967b8b72f8cdb9178f6f933ed80bdfd1cf6d28e1255fd532654297bc87` |
| `ARM.sql` | `d28d1ef9bad47cf0eb0d66028e3150f2d91fced9d56bb4b8154ea455436f0f31` |
| `DISARM-ROLLBACK.sql` | `513b28b5a82d58389a5b3df1de42265cc63e7928b76d3eedc6d27d95478fa30e` |
| `SCHEDULE-ONCE.sql` | `600699bae9fb9a064fceea6563c662676388cdb7fbd4c9d24a41db5e93f49bf1` |
| `CANCEL-OFFICIAL-ONCE.sql` | `a9b39d83cd2ae033cd6827bffcfbe2dc9b88bc69842dcfd4c3147b98d55cc81c` |
| `PRECHECK-READONLY.sql` (new, read-only, for the DB owner) | `8a8e0732fd6f02a811065dfa69dc5fb1147c901e6cb98581c322b4aa58596932` |
| `SWITCH-OFF.sql` (unchanged, has no date) | `19abbc7f23ec69df490dd5ca4bd226353c421fe72bdf51460ad155c6f5c0ed33` in `live-readiness-2026-11-19/` |

**Retired, do not run.**
- `tasks/artifacts/blsh-shipping-2026-11-18/pilot-control/{INSTALL,ARM,DISARM-ROLLBACK}.sql`
- `tasks/artifacts/blsh-shipping-2026-11-18/official-dispatch/SCHEDULE-ONCE.sql`
- `live-readiness-2026-11-19/CANCEL-OFFICIAL-ONCE.sql`

The old INSTALL would still be accepted until 2026-11-21 12:05Z and would open a permit for the empty Nov 20 slate. [CUSTODY.md](../live-readiness-2026-11-19/CUSTODY.md) now names the new window and the Vault name `blsh_official_grant_20261121`.

## Test receipts

These were run in the scratch clone on candidate commit `3a0073cfe`, merged with origin/master `aa49b6c5e`. The release branch reruns the affected suites after merging `0b1a9c958` (see the handoff).

- **PostgreSQL 15 harness** [redate-20261122/pg15-validate.py](redate-20261122/pg15-validate.py) → [pg15-validate.out](redate-20261122/pg15-validate.out): **64/64 PASS, exit 0.** That is the original 41 checks, re-dated, plus 23 new. The new checks prove:
  - Pins and static checks for the new files.
  - **Forward migration:**
    - the check now reads 2026-11-21;
    - the claim function is replaced, with its hash recorded;
    - the grant is kept;
    - a rerun fails closed;
    - it refuses when an official run exists.
  - **Read-only precheck:** returns `ready_to_apply` on the reviewed schema, `already_redated` afterwards, and stops once a run exists.
  - **Official DB claim:** the retired slate 2026-11-20 and the wrong slate 2026-11-22 are refused.
  - **Native permit:**
    - accepts slate 2026-11-21 at exactly 2026-11-22 12:05:00.000;
    - refuses the retired window (2026-11-21 12:05:30, slate 20);
    - refuses the retired slate and the wrong slate inside the new window;
    - refuses at 12:04:59.999 and at 12:07:00.
  - **INSTALL** refuses at or after 2026-11-22 12:05.
  - **SCHEDULE-ONCE** refuses in the retired 2026-11-21 window.
- **`supabase/tests/blsh_official_pilot.py`** (disposable PostgreSQL 15, all real BLSH migrations plus the forward one): **3/3 PASS groups.**
  - It covers official **acceptance** at 2026-11-22 12:45:05 for slate 2026-11-21.
  - It covers four concurrent claims, slot edges, the retired slot (2026-11-21 12:45:05), the retired and wrong slates, the journal, 4 MiB readback and terminal controls.
- **Request-context date gate on the real handler:** [redate-20261122/request-context-date-gate.txt](redate-20261122/request-context-date-gate.txt), **4/4.**
  - Slate 2026-11-21 at 2026-11-22 12:40Z passes the gate and reads the native source.
  - The retired slate, the wrong slate and the retired window are each skipped before store I/O.
  - This was a scratch test that was then deleted; the replay lane owns that test file.
- **Vitest:** `lib/blsh`, `scripts/blsh`, `lib/buyLowSellHigh`, `lib/cron`, plus the cron-audit-wrappers, cron-report and cron-auth-boundaries suites.
  - 76/80 files, **1,492 tests passed**, 113 skipped.
  - **19 failed, all in `scripts/blsh/nativeProcessCaptureBootstrap.test.ts`.** They fail identically at the unmodified base in this clone, because that test only accepts the canonical checkout path (`bootstrap_wrong_checkout`).
- **`npm run typecheck`:** exit 0. **ESLint** on the 9 changed web files: exit 0.
- **Known pre-existing:** `lib/supabase/supportedBaselineMigration.test.ts` already fails on master; the migration list exceeds `migration-authority.json`. This migration adds one more file. The migration owner reconciles the registry; this lane did not edit it.

## File ownership

The handler lane (`blsh-sandbox-run`, `local_f11fca0c`) owns everything under `web/lib/blsh` except the `official*` files. This lane proposed taking the official files, their tests, the four extra files above and the migration. **That split was proposed twice and is not yet acknowledged.** The lane's ref `refs/rc/blsh-v6-replay-20261120` (`6a7cd0498`) touches only `tasks/`, so there is no overlap so far. Any replay fix rides in the same keyed build.
