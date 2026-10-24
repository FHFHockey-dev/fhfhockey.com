# Slice05 ownership — 2026-10-24

Parent explicitly granted all ten paths from slice-05-proposal/TRANSFER-REQUEST.md for local owner-gated integration and accepted a generic locked SSR frame. Coordinator CODEX-LEASES.json records that grant. Each path was rechecked absent before this receipt.

- `web/lib/forge-testing-grounds/serverOwnerBoundary.ts` — absent
- `web/lib/forge-testing-grounds/serverOwnerBoundary.test.ts` — absent
- `web/lib/forge-testing-grounds/ownerRoutes.ts` — absent
- `web/lib/forge-testing-grounds/ownerRoutes.test.ts` — absent
- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.tsx` — absent
- `web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx` — absent
- `web/pages/forge/testing-grounds.tsx` — absent
- `web/pages/api/v1/forge/testing-grounds/access.ts` — absent
- `web/pages/api/v1/forge/testing-grounds/runs/index.ts` — absent
- `web/pages/api/v1/forge/testing-grounds/runs/[runId]/[operation].ts` — absent

New artifacts in this slice: OWNERSHIP.md, HANDOFF.md, EVIDENCE.json, BASELINE.json, checks.log, slice05.vitest.config.mts, tsconfig.json, LOCAL-VIEW.md, and artifact-local test cache. Existing task diary continues. No source edits outside these ten paths. Prior packets and slice04-R1 source frozen for review.

No shared source/config edits, owner identity activation, hosted auth/data/provider calls, execution, migrations, server replacement, Git or broad build. Port3000 inspection found no listener (lsof exit1); no server has been started. Browser/app resource allocation must be coordinated before starting one.

## Local viewer resource extension

Parent explicitly authorizes a dedicated isolated local development cache and localhost:3000 startup after rechecking leases/port. Additional exact artifact files: dev-view.mjs, offline-network.mjs, dev-view.log, runtime.json, local-http.json. Runtime staging is a new /tmp/forge-testing-grounds-s05-* directory with read-only source/dependency symlinks and copies of existing configuration, not another Git/editing checkout. Next writes its generated next-env.d.ts and tsconfig there; it must not change the canonical generated file or Claude cache. Cache is .next-forge-testing-grounds-s05 under this temporary root.

Only page, dedicated access check, and local static assets are served. Browser CSP and a server outbound socket/fetch guard prevent remote auth/profile/settings/analytics activity. Ordinary shared AuthProvider calls ensureUserRecords after sign-in and can insert/update records, so ordinary hydration without containment is not authorized. This viewer preserves owner gating and cannot provide authenticated access while outbound verification is blocked. Heavy lock acquired only if absent for prepare/initial page compile, never stolen. Process/port/lock ownership recorded in runtime.json; no auto-restarts.

## Interim viewer approved by parent

Parent explicitly permits a loopback-only server serving the frozen self-contained synthetic HTML at /forge/testing-grounds as an interim viewing artifact, separately from the integrated owner-gated app. Additional exact artifact: preview-server.mjs. This is the selected viewing mode. No Next build/cache is required. dev-view.mjs startup was refused by the existing shared heavy lock (EEXIST) before staging, app imports or listening; original error remains in dev-view.log. Do not retry it. offline-network.mjs controls passed but that proposed Next harness is not running or accepted.

Final exact patch artifact: slice05.patch, containing only the ten granted new application files. Later local-http.json records the parent-authorized read-only locked-page diagnosis; no source expansion or config mutation.
