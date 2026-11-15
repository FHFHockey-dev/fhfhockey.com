# Candidate `29451c57304866d54abd2a3302625f0696472ab0`: clean-export verification

- **Export:** `git archive 29451c573` of the whole tree, 13,437 files and no untracked files, with `web/node_modules` linked from the checkout. It ran 2026-11-15 ~19:33Z under `/tmp/fhfh-heavy.lock`.
- **Typecheck:** `npm run typecheck` gave **exit 0, 0 errors**.
- **Tests:** `vitest run lib/projections/pregameCapture lib/projections/queries scripts/forge-pregame-capture.test.ts lib/supabase/supportedBaselineMigration.test.ts lib/projections/run-forge-projections.external-inputs.test.ts` gave **16 files, 326 tests, exit 0**. The run covers:
  - the capture modules;
  - parity and compute-off oracles;
  - the strict transport, including the new RPC's GET and the 404 refusal;
  - the trend-band reader and its benchmark comparison;
  - the offline rehearsal;
  - the baseline migration pins (117 applied / 6 pending);
  - the input-source audit.
- **Code drift:** `git diff --stat 29451c573 HEAD -- web supabase` is empty at packet time. The working tree's uncommitted BLSH edits belong to another lane; they are not in the candidate, and the run uses this export.
