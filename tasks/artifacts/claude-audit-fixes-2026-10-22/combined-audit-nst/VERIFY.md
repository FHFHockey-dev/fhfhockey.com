# Reproduce the combined local candidate

Use this directory's `fixed-source.tar.gz` and `FIXED-SNAPSHOT.json`. Verify archive SHA-256 `1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04`, then extract into a new nested `/tmp/<task>/isolation/snapshot` directory. Reject absolute or parent paths, links, special files and env files. Verify all 3,365 file hashes before running anything. The archive is a historical dirty verification baseline plus accepted overlays, not a clean release checkout.

Use Node v22.11.0 and npm 10.9.0. Symlink only existing canonical `web/node_modules` into extracted `web/`; do not install. Keep the network-deny preload and unmocked-fetch guard enabled. Adjust only the scratch `cacheDir` in `web/audit.vitest.config.mts` if the archived scratch cache path is unavailable, and record that harness-only adjustment. Do not run from canonical, load its env files, run a server, build, or call services.

From the extracted `web/`, invoke the saved wrapper by its absolute artifact path:

```sh
sh /Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/combined-audit-nst/verify.sh affected
sh /Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/combined-audit-nst/verify.sh reproductions
sh /Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/combined-audit-nst/verify.sh application-types
sh /Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/combined-audit-nst/verify.sh lint
```

The exact file lists are embedded in the wrapper and recorded in [COMMANDS.json](COMMANDS.json). It clears the environment and supplies private HOME/TMPDIR plus synthetic `.invalid` configuration. Existing dependencies are reused with `npx --no-install` for checks. Expected results: affected 24 files/742 cases, reproductions 7 files/28 cases, application TypeScript exit 0, lint exit 0 with two existing image warnings.

To reproduce the separately recorded all-file diagnostic, run the wrapper with `all-file-types`. Expected exit 2 with two typing errors in the unchanged external reviewer fixture `__tests__/pages/api/v1/db/auditNstR1Additional.test.ts`, lines 355 and 359. The archived `audit.application-tsconfig.json` extends the original config and excludes only the four independent-review fixture copies listed in `ASSEMBLY.json`; application code and application tests retain their original include/exclude scope. The fixture was not changed to suppress the diagnostics.

Original audit reproductions retain their previously documented mock/contract adaptations from the first accepted archive: strict-cutoff mock support and an explicit independent universe for A4. Four additional independent fixtures are byte-identical to the reviewed artifacts, with provenance and hashes in [ASSEMBLY.json](ASSEMBLY.json). Do not substitute fixtures from a moving checkout.

`accepted-overlay.patch` changes 20 accepted paths relative to the original accepted audit archive. To check it, extract that original archive into another fresh private directory, verify its original manifest, and run `git apply --check` against this patch there. Do not apply it in canonical. Its original base archive SHA, patch SHA and unchanged 11 accepted paths are recorded in [OVERLAY-PROVENANCE.json](OVERLAY-PROVENANCE.json).

Evidence logs preserve the executed checks, including the failed all-file TypeScript check and initial patch-format failure. No remote, production, browser, SQL concurrency or deployment test is part of this procedure.
