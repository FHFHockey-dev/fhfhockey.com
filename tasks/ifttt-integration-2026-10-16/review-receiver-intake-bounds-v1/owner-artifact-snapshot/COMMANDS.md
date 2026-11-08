# Local checks

Run from `web/`, using existing dependencies. Test harness denies network and starts fresh private PostgreSQL on a Unix socket with no TCP. It removes its cluster at exit.

```sh
TMPDIR=/tmp IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin NODE_PATH=. ./node_modules/.bin/vitest run --config ../tasks/ifttt-integration-2026-10-16/receiver-intake-bounds-v1/regression.config.mjs
./node_modules/.bin/tsc --noEmit --project ../tasks/ifttt-integration-2026-10-16/receiver-intake-bounds-v1/tsconfig.json
./node_modules/.bin/eslint --report-unused-disable-directives-severity warn lib/sources/lineSourceIftttReceiver.ts lib/sources/lineSourceIftttReceiver.test.ts lib/sources/iftttReceiptRetention.ts lib/sources/iftttIntakePolicy.ts lib/sources/iftttIntakePolicy.test.ts
```

Migration filename was generated with installed Supabase CLI migration-new command under this task workdir; SQL applied only to disposable fixture storage, not hosted Supabase. The 5s DDL transaction setting is not a runtime caller deadline. No advisors/remote validations run.
