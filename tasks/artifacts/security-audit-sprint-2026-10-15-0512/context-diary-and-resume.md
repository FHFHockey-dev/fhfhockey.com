# Security audit context diary and resume handoff

Checkpoint saved: 2026-10-15 05:56:27 UTC. Stopped on TJ's explicit “checkpoint all. 3%” instruction. No further tests, reviews, delegation, cleanup, deployment or push were started.

## Current state and ownership

- Canonical checkout: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`; last confirmed HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`.
- This audit writes only `tasks/artifacts/security-audit-sprint-2026-10-15-0512/`. Application code, migrations, task registers and shared configuration were not edited by this audit. The checkout contains substantial existing/concurrent uncommitted work; preserve all of it.
- Separate workers own the proxy and Host-header fixes. The latest status showed their changes in `web/pages/api/cors/index.ts`, `web/utils/adminOnlyMiddleware.ts`, tests and a new `web/lib/NHL/corsProxy.ts`. Those changes have NOT been reviewed or tested by this audit. Original finding line numbers and mocks describe the earlier audit snapshot, not a verdict on those fixes.
- User-authorized follow-up: retry the same npm package-name/version upload once, and prepare a database-hardening proposal without applying it. Authorization relayed with TJ's 05:48 UTC “yes” / “to both”; evidence IDs are retained in `dependency-retry-authorization.json`.

## Completed evidence

- Initial bounded static audit: `findings.md`, `coverage.md`, `handoff.md`, route/SQL/environment-name inventories, and initial report verification. Ten source findings plus a conditional deployed-database security gate; deployed exploitability remains unverified.
- Inventory snapshot: 360 API-directory source files (351 Next default-export files, five Python handler modules, four scripts; not 360 confirmed deployed endpoints), 82 supported migrations, 286 baseline public tables with RLS-enable text somewhere in the migration chain, 52 SECURITY DEFINER occurrences, and 142 unique environment variable names. These are inventory/pattern counts, not exhaustive behavioral proof.
- Eleven isolated checks passed before the concurrent fixes: nine JavaScript mocked checks and two Python AST-extracted handler checks. Evidence: `safe-local-checks.json`, `safe-python-checks.json`; harnesses: `safe-local-checks.cjs`, `safe-python-checks.py`. All transports were mocked. No app environment, credentials, secret values, held FORGE data or production services were accessed.
- Initial report verification at 05:46 UTC: 65 referenced source paths existed; route/migration hashes matched their 05:31 snapshot. Evidence: `report-verification.json`, `referenced-source-hashes.csv`. This verification has NOT been repeated after concurrent fixes.
- The single approved npm retry SUCCEEDED. `npm audit` exited 1 because advisories were found, with no response error. Evidence: `dependency-audit-approved.json`, `dependency-audit-approved-stderr.txt`, `dependency-retry-authorization.json`.
- npm reported 57 affected package entries: 3 critical, 32 high, 14 moderate, 8 low. These rollups include transitive/inherited severity and are NOT 57 unique advisories or proven exploitable application paths.
- Isolated npm execution used an empty environment apart from PATH, empty user/global npm config, copied lockfile, `--package-lock-only --ignore-scripts`, npm's public registry, no retries and a 20-second request timeout. No install/fix or application lockfile edit. The earlier denied attempt remains in `dependency-audit.json` / `dependency-audit-stderr.txt` as historical failure evidence, not the current result.

## Dependency triage already established; incomplete

- `next` 15.5.22 is a direct runtime dependency with critical advisory matches. The advisory service suggests 15.5.28 for the combined findings. The AVIF/libheif image-processing RCE advisory affects this version; source configuration enables production optimization (`web/next.config.js:33`). Exact deployed image processing/runtime and attacker control of accepted images remain unverified. Source: https://github.com/advisories/GHSA-2xp9-vwfh-vxw4 .
- Another critical Next advisory is specific to Windows filesystem hosting. Repository uses Pages Router, but deployed OS/runtime is unverified; do not label this as confirmed deployed RCE. Source: https://github.com/advisories/GHSA-p293-qw3h-jr36 .
- `vitest` 3.2.7 and transitive `tinypool` 1.1.1 account for the other critical package rollups. Tinypool advisory prerequisites include prototype pollution; test-worker exposure must be distinguished from production. Audit suggests Vitest 4.1.11 (major). Both tinypool GHSA-5gmw-xhrv-c9v3 and GHSA-85c8-ppgw-ccpr must be considered; fixing only to 2.1.1 does not cover both. Source: https://github.com/advisories/GHSA-5gmw-xhrv-c9v3 .
- Direct `axios` 1.18.1 has multiple high/moderate matches; npm suggests 1.20.0. Application reachability and input prerequisites have not yet been mapped. Example advisory: https://github.com/advisories/GHSA-c29m-xwm3-cm6r .
- Storybook, eslint-config-next and puppeteer-core also have high rollups. Some npm suggestions are major changes or downgrades (eslint-config-next 14.2.35, puppeteer-core 19.8.3); do not blindly run `npm audit fix --force` or recommend those as validated upgrades.
- Remaining dependency work: extract an exact package/advisory inventory from the saved successful JSON; deduplicate advisories; confirm dev/runtime lock flags and relevant locked image libraries; assess reachability; create a concise prioritized dependency report. No additional advisory upload is necessary or authorized by the one-retry approval. No package upgrade was made or tested.

## Database proposal pending — root causes and proposed scope only

The requested database-hardening proposal has NOT been completed, and no migration, RLS policy, grant, default privilege or deployed database setting was changed. `deployed-metadata-checks.sql` already contains prepared read-only checks; it has NOT been run.

1. Verify existing source fixes before proposing new migrations: `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql`, `20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql`, and `20260909120000_draft_pro_complimentary_access_codes.sql`. The migration register's unknown state is not proof they are absent in production. Baseline privileges/policies would be severe if still effective; later source fixes exist.
2. CSV import: `web/pages/api/v1/db/upsert-csv.ts:418` creates a public table through privileged SQL without accompanying RLS/role restrictions; validation rejects an empty import only later at line 540. Baseline defaults at `supabase/migrations/20260716112908_production_schema_baseline.sql:44823` grant broad browser-role access to new postgres-owned public tables. Proposal should validate fully before DDL and make creation/RLS/revocation/policies atomic. Preserve intended public statistics reads; do not blanket-change schema defaults without consumer review. Runtime defaults/event triggers are unverified.
3. Provider identities: baseline connected_accounts owner INSERT/UPDATE policies at lines 40176/40190 and grants at 43636 allow browser-authored provider/provider_user_id; global uniqueness at 34074 can let a user reserve another person's identity. `web/lib/integrations/patreon/sync.ts:131` rejects a link owned elsewhere. Proposal should make identity fields server-authored while preserving legitimate owner UI operations. Consumer review is incomplete: `web/components/account/AccountSettingsPage.tsx:880` and `:1025` access this table and must be inspected before choosing revoked operations/column grants.
4. Operational details: baseline `cron_job_audit` SELECT policy at 39827 and grant at 43638 permit anonymous reads; `web/lib/cron/withCronJobAudit.ts:311` / `:327` persist raw URL/response details. Proposal should restrict raw audit access, redact before persistence, and preserve any required public health summary with an explicit allowlist. No real log rows or secrets were read.
5. Acceptance design: isolated disposable DB, anonymous role plus two synthetic users and service role; assert privilege denial, owner isolation, paid entitlement integrity, intended public reads, and valid provider/import flows. Review the current migration authority before adding files. No live SQL execution or migration application is authorized here.

## Exact audit artifact inventory

Files present from the initial audit:
`README.md`, `findings.md`, `coverage.md`, `handoff.md`, `checkpoint.md`, `inventory.py`, `route-inventory.csv`, `inventory-summary.json`, `supplemental-inventory.py`, `environment-variable-names.csv`, `browser-server-import-indicators.csv`, `cron-audit-order.csv`, `supplemental-summary.json`, `dependency-structure.json`, `dependency-audit.json`, `dependency-audit-stderr.txt`, `safe-local-checks.cjs`, `safe-local-checks.json`, `safe-python-checks.py`, `safe-python-checks.json`, `sql-security-inventory.py`, `security-definer-inventory.csv`, `sql-security-summary.json`, `deployed-metadata-checks.sql`, `verify-report.py`, `referenced-source-hashes.csv`, `report-verification.json`.

Approved follow-up artifacts: `dependency-retry-authorization.json`, `dependency-audit-approved.json`, `dependency-audit-approved-stderr.txt`, and `approved-dependency-audit/` containing the isolated copied lockfile/manifest, empty npm configs and npm cache/logs. These are intentionally preserved, not cleaned up. This checkpoint adds `context-diary-and-resume.md` and updates the existing report entry points to remove the obsolete current-blocked claim.

## Tests, processes and blockers

- Passed before fixes: 11 isolated mocked checks and initial report-reference verification. No reruns after the other workers' changes.
- Not run: application suite, typecheck, lint, production build, browser tests, live DB metadata checks, security fixes' regression tests, package-upgrade compatibility checks.
- No audit-started process remains running. npm session 52137 completed; no server or scanner was launched.
- No deployments, pushes, production requests/mutations or app/database edits were performed by this audit. Advisory matching used the explicitly approved npm endpoint; public GitHub advisory pages were also read.
- Blockers/limits: deployment state and runtime applicability are unverified; CMS/functions JS dependencies lack equivalent tracked lock coverage; Python transitive dependencies are not fully locked; remaining triage/proposal work stopped on the user's checkpoint instruction, not because it was completed.

## Resume action

On explicit resume, read this diary and the saved successful npm JSON first. Finish dependency applicability/prioritization without re-uploading; finish the proposal-only database document after bounded consumer inspection. Coordinate with the existing proxy/Host owners and use their verification evidence. Preserve all concurrent work and original audit snapshots. Do not deploy, apply DB changes, install/fix packages, or expand ownership without authorization.
