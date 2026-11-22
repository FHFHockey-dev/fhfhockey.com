# E2 inventory: who holds the database password or a postgres URL

Read Sun 2026-11-22 ~02:0xZ (Sat ~20:0x CST) by the managed-signer lane, at BLSH Chef's request. Read-only.

**Names only. No value was printed, stored or sent.**
- Vercel names come from `vercel env ls` (CLI 48.1.6, account `fhfhockey-dev`, scope `fhfhockeydevs-projects`). The CLI reports values as encrypted, and the parser kept only the name and environment columns.
- GitHub names come from `gh secret list`.
- Local names come from `grep` for `NAME=` keys, with values never read into the output.

## Vercel: all 6 projects in the team (`vercel-env-names.tsv`, 124 rows)

| Project | Variables | DB-owner credentials | Other relevant names |
|---|---|---|---|
| **fhfhockey** (web, production) | 110 | **`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`** (Production only) | `SUPABASE_JWT_SECRET` (Production); `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview, Development); `SUPABASE_SECRET_KEY`; anon/publishable keys |
| functions-fhfhockey | 6 | none | `SUPABASE_SERVICE_ROLE_KEY` (Production) |
| cms-fhfhockey | 3 | none | none |
| fhfhockey.com | 0 | none | none |
| web | 5 | none | `SUPABASE_SERVICE_ROLE_KEY` (Production) |
| functions | 0 | none | none |

- **`SUPABASE_DB_URL` is in no Vercel project.** So the direct-Postgres paths in `lib/underlying-stats/*` and `functions/lib/postgres.py` already use their fallbacks in production.
- The `POSTGRES_*` + `SUPABASE_JWT_SECRET` set is exactly what Supabase's Vercel integration syncs. Whether that integration is installed and syncing is **not checked** (it needs a read-only integration listing; see PROPOSAL-SUPABASE §5, R1b).
- **No repository code reads any `POSTGRES_*` variable or `SUPABASE_JWT_SECRET`.** This lane's grep agrees with `forge-writer-hardening-2026-11-19/WRITER-HARDENING.md` §3. The only matches are three local `web/scripts/draft-pro/*.sh` verifiers, which run against a local container.

## GitHub Actions (`github-actions-secret-names.txt`)

- **Repository secrets:** `X_BURNER_COOKIES`, `X_INGEST_SECRET`. There are no repository variables and no `production` environment (HTTP 404).
- **Workflows** reference only `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` and the two X secrets.
- **No DB password or postgres URL appears in GitHub Actions.** Org-level secrets were not listed.

## Local files on this Mac (`local-env-file-names.txt`, plus the wider search below)

| File | Relevant names | Notes |
|---|---|---|
| `web/.env.local` | **`SUPABASE_DB_URL`**, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_SUPABASE_SERVICE_ROLE_KEY`, `DEFAULT_SECRET_KEY` | The operator path: every `pgpool.sh` (×4 under `tasks/artifacts/`), the BLSH readers, the FORGE/DRM operator scripts, `web/scripts/*` (forge-live-acceptance-audit, sync-player-forecast…, run-nhl-xg-release-validation, dev-player-forecasts, `blsh/export_db_history.py`) |
| `web/scripts/.env` | **`SUPABASE_DB`** | Read by `web/scripts/audit-nhl-game-prediction-sources.ts` |
| `functions/.env.local` | `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_SUPABASE_SERVICE_ROLE_KEY` | No DB URL |
| `../fhfhockey-workspace-recovery-2026-10-24/workspace-reconciliation-2026-10-25-1415/working-files/web/.env.local` | **`SUPABASE_DB_URL`** | A stale recovery copy. It becomes a dead credential on rotation; TJ may delete it. |
| `~/.zshrc`, `~/.zprofile`, `~/.zshenv`, `~/.bash_profile`, `~/.bashrc` | none | — |
| `~/.pgpass` | absent | — |

**Not inventoried:**
- password managers;
- other people's machines (TJ has none);
- Codex or other agent sessions (they share these same files);
- Supabase-side tooling such as the dashboard, the CLI login token and the MCP connector (these are admin paths, not password holders);
- old Vercel deployments, which keep the values baked in at their build time.
