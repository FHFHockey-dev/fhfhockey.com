# Reproduce the held P07 draft

Use Node22.11.0/npm10.9.0 and existing `web/node_modules`; no installation. `CANDIDATE.json` pins every overlay file and the preserved combined archive. The packet is held even when the focused suites pass: the bridge-claim oracle is expected to fail until the authority gap is corrected.

1. Create an ordinary temporary directory (not a Git worktree). Verify the SHA-256 of `../claude-audit-fixes-2026-10-22/combined-audit-nst/fixed-source.tar.gz` is `1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04`, then extract it. Verify its3365source hashes against that packet's `FIXED-SNAPSHOT.json`.
2. Verify `source-overlay.tar.gz` against `CANDIDATE.json`, then extract it over that temporary tree. Verify all17overlay hashes. The pre-edit bytes and `packet.patch` also permit a focused diff against the exact start state.
3. Copy this packet's four `audit*` verification files to the extracted `web/`. Point `audit.vitest.config.mts`'s `cacheDir` at a private temporary cache. Symlink the canonical existing `web/node_modules` into extracted `web/node_modules`; create private `.audit-home`/`.audit-tmp` directories there.
4. Copy `bridge-claim-oracle.test.ts` to extracted `web/lib/player-forecasts/p07BridgeClaimOracle.test.ts`. This is an artifact-only test, not an application file.
5. Run from extracted `web/` with the environment wrapper below. The actual final commands were:

```sh
npm test -- --run --config audit.vitest.config.mts \
  lib/player-forecasts/rsoUsePolicy.test.ts \
  lib/rosterScheduleData/planning.test.ts \
  lib/player-forecasts/planningContributions.test.ts \
  lib/in-season/workspaceSchema.test.ts \
  lib/integrations/yahoo/rosterPlanning.test.ts \
  __tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts \
  lib/rosterScheduleOptimizer/planning.test.ts \
  lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts
npm test -- --run --config audit.vitest.config.mts lib/player-forecasts/p07BridgeClaimOracle.test.ts
npm exec --no -- tsc --noEmit --incremental false --project audit.application-tsconfig.json
```

Wrap each command in:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs --max-old-space-size=8192" \
  <command>
```

Lint used `npm exec --no -- eslint` with the17source/test paths listed in `CANDIDATE.json`, removing the `web/` prefix. The network block and synthetic values are mandatory; do not run against production configuration. Final successful application checks do not erase the explicit failed acceptance oracle or confer independent acceptance.
