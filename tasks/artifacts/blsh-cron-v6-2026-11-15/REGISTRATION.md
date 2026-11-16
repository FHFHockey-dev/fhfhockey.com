# Shared NST registration for `blsh-native-capture` (for Chef to route; not applied by this lane)

These are two shared NST files that this lane must not edit. The route works without the change. Without it:
- the burst-clearance helper does not know the slot;
- cron-report and audit tooling classify `blsh-native-capture` as an unknown NST touch.

## 1. `web/lib/cron/nstCoordination.ts`: `NST_ACTIVE_DIRECT_CRON_STARTS`

Add as the last entry, after `update-nst-team-daily-incremental` at 9:55:

```ts
  { jobName: "blsh-native-capture", minuteOfDayUtc: 12 * 60 + 5 }
```

**Effect on `getNstCronBurstClearance`:**
- The previous gap is 09:55 → 12:05 = 130 min.
- The next gap wraps around the day to 08:30 = 1,225 min.
- Both are at least `NST_MIN_CRON_BURST_GAP_MS` (10 min), so `allowed: true`.
- The existing entries are unchanged: `update-nst-team-daily-incremental`'s next gap becomes 130 min (≥ 10).

The 12:20 backup is not listed. It is the same job, and it makes NST requests only when the 12:05 run never claimed the date.

## 2. `web/lib/cron/nstClassification.ts`: `DIRECT_REMOTE_NST_JOBS`

Add one line inside the set:

```ts
  "blsh-native-capture",
```

## Landing order

Land this in the same change as `schedule/CRON-SCHEDULE-ENTRY.md`. `nstCoordination.test.ts` keeps the inventory and `NST_ACTIVE_DIRECT_CRON_STARTS` in sync, so either one alone fails it (review L7).

## Tests the owning lane should run

- `npm test -- lib/cron/nstCoordination.test.ts`. If it pins the list's length or contents, update it to the 5-entry list.
- The test that covers `nstClassification`, if one exists (`rg -l nstClassification web/lib web/__tests__`).
