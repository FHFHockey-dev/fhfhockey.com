# Draft entry for `tasks/TASKS/cron-operations/cron-schedule.md`

**Status:** a draft. It goes into the inventory only after TJ approves `SCHEDULE.sql`. Until then, `cron-schedule.md` is unchanged.

**Landing order (review L7):** this entry and REGISTRATION.md (`nstCoordination.ts` / `nstClassification.ts`) must land in the **same change**. `nstCoordination.test.ts` ("burst-clearance schedule synchronized with the canonical inventory") compares the inventory with `NST_ACTIVE_DIRECT_CRON_STARTS`. An inventory with the job but no registration fails it, and so does the reverse.

**Prose time list, inserted in order:**

```
-- - 12:05 UTC / 07:05 EST: blsh-native-capture (direct NST, 2 URLs; one-shot per source date)
-- - 12:20 UTC / 07:20 EST: blsh-native-capture-backup (same route; refuses with a 200 skip once 12:05 claimed)
-- - 12:50 UTC / 07:50 EST: blsh-native-capture-watchdog (SQL; claimed > 10 min -> abandoned_uncertain)
-- - 12:52 UTC / 07:52 EST: blsh-native-capture-watchdog-assert (SQL; fails the job run on a missing or failed date)
```

**JSON inventory rows** (`jobid` comes from the read-back after scheduling):

```json
{ "jobname": "blsh-native-capture", "schedule": "5 12 * * *", "active": true, "route": "/api/v1/db/blsh-native-capture", "method": "POST", "auth": "Supabase Vault cron_secret" },
{ "jobname": "blsh-native-capture-backup", "schedule": "20 12 * * *", "active": true, "route": "/api/v1/db/blsh-native-capture", "method": "POST", "auth": "Supabase Vault cron_secret" },
{ "jobname": "blsh-native-capture-watchdog", "schedule": "50 12 * * *", "active": true, "route": null },
{ "jobname": "blsh-native-capture-watchdog-assert", "schedule": "52 12 * * *", "active": true, "route": null }
```

**NST note for the "Schedule floor" section:**

> Direct NST cron starts: the last band start is 09:55. The next is 12:05 (BLSH, 2 URLs), and its backup is at 12:20. Both gaps are at least 10 minutes. The backup reaches NST only if the 12:05 run never claimed the date.
