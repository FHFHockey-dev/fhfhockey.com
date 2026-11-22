# FHFH Master Task List: Nov 19–20 overnight delta for Scout (FORGE/RSO entry)

Record these as new items. The sandbox capture pass and the sandbox capture → publication → RSO pass are already logged.

**Live acceptance (Nov 19 night): NOT VERIFIED.** No real game reached a qualified capture.

| Game (UTC) | Release | Claim | Result |
| --- | --- | --- | --- |
| 2026020357 SEA–VAN, capture 01:20 | `294554a48` (dpl_3hzmW6jW5na8n63nMi1xFALbTrPP) | `7d3851bf…` | source_failed: "Rolling skater history read incomplete: invalid_row" |
| 2026020358 VGK–DAL, capture 01:40 | hotfix `aa49b6c5e` (dpl_9kHEXhnEB3AExMMjySLrD1vMs8eq) | `33a516aa…` | Same failure. Stopped: same failure twice, and the last game of the night. |

- **Nothing published:** 0 publications.
- **Signed witness:** the signed Edge witness correctly recorded "rejected / artifact_missing" for claim `7d3851bf…`.
- **Evidence:** `tasks/artifacts/forge-live-release-2026-11-19/LIVE-ATTEMPTS-20261120.json`.

**Root cause, fixed.** 2023–24 rolling rows had null game_id. Inside the reader's 1,095-day long-absence window the strict reader rejects the whole read. One rostered player per game had such a row: 8483012 (SEA), 8480441 (VAN) and 8482141 (VGK).
- The 365-day hotfix (`aa49b6c5e`) fixed the other path but not this one.
- On TJ's choice, about 03:24Z: game IDs were **backfilled** in production from WGO game logs (each matched to `games` by date and season).
  - 66,797 rows across 474 players; plan md5 `90ae6392…`.
  - The backup table `forge_backfill_20261120.rolling_game_id_before` holds the before-values, and a rollback script exists.
  - Verified: 0 null-ID rows remain in scope, and the reader RPC shows 0 null-ID rows in the window for tonight's rosters.
- Receipt: `tasks/artifacts/forge-rolling-game-id-backfill-2026-11-20/APPLY-RECEIPT-20261120.md`.
- Option A, a code fail-safe that excludes unidentified long-absence history, is built at `refs/rc/forge-long-absence-20261120` and was not shipped.

**Live in production now (inert until armed):**
- **Release:** `aa49b6c5e`. It adds the game-scoped live capture and publish routes, and fences that keep pregame runs out of all public readers. The production smoke test is unchanged: `runs/latest` returns 200.
- **Signed independent witness:** the Supabase Edge Function `forge-witness-verify`.
  - Ed25519 key 469bc6093b6ffc11; the private key exists only as an Edge secret.
  - It uses Deno-native X.509 and RFC 3161 verification.
  - Its verdicts are verified in release code against the pinned key, using the official NHL start and T−60.
  - Owner credentials can't forge a verdict that passes.
- **DB:**
  - publication `4a70657a`, verifier `9673316c`, live run `b546ea3e`;
  - signed delta `da786646`;
  - signed-only gate `20261120000100`;
  - `execute_sql` hardening `7b237210`: service_role lost arbitrary SQL, and CSV admin uses `csv_create_table_v1`.

**Cleanup verified.** No temporary jobs remain, `forge_witness_api` is unexposed, job 408 is off, and BLSH is untouched.

**Open findings:**
- pgsodium `mask_role` has PUBLIC EXECUTE; the Supabase support request draft is with TJ.
- Vercel production holds `POSTGRES_*` (user postgres) and `SUPABASE_JWT_SECRET`, as do old deployments. They are not needed at runtime; rotate them or accept the risk.
- `record_signed_v1` lets the writer block a game. It fails closed.
- `octoberBranch` is behind master (`294554a48`, `5babd77c1`, `aa49b6c5e`).

**Next blocker for live acceptance.** The next NHL slate is Nov 21 18:00Z, which is after the ASAP authorization expires (Nov 20 18:55Z). Renewal is needed, then one approval to arm the same chain on a bounded game queue.
