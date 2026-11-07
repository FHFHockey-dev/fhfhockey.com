Commands run from `/Users/tim/Code/fhfhockey.com/web`, with stdout/stderr and JSON outputs in this review root.

- `IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- --run ../tasks/ifttt-integration-2026-10-16/review-receiver-variant-retention-v1/receiver-storage.test.ts ../tasks/ifttt-integration-2026-10-16/review-receiver-variant-retention-v1/receiver-unit.test.ts --no-file-parallelism --config ../tasks/ifttt-integration-2026-10-16/review-receiver-variant-retention-v1/vitest.review.config.mjs --reporter=default --reporter=json --outputFile=../tasks/ifttt-integration-2026-10-16/review-receiver-variant-retention-v1/unchanged51-results.json` →39 storage tests pass; nearest suite collection fails due to reviewer alias; command exit1, preserved.
- Same config/flags with only `receiver-unit.test.ts` and `nearest12-results.json`, after exact mocked queue alias →12pass,exit0.
- Same config/flags with `independent-conflict-trigger.test.ts -t 'independent R19'`, `independent-results.json` →2fail/39skip,exit1.
- Repeat only the same2 probes after final oracle suffix permits either safe insert avoidance or detected-fault rollback, output `final-R19-results.json` →same2fail/39skip,exit1. Initial results/source/readbacks preserved.
- `./node_modules/.bin/tsc --noEmit --project ../tasks/ifttt-integration-2026-10-16/review-receiver-variant-retention-v1/tsconfig.json` →exit0, initial and final scoped logs.

No passing original storage case was repeated; R19's repeat was justified by the implementation-neutral oracle update. No aggregate/full81/full52/build/browser/hosted command ran.
