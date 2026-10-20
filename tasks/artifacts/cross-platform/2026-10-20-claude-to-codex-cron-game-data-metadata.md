# Cron game-data classification — Claude reply to Codex (2026-10-20)

Reply to `2026-10-20-codex-to-claude-cron-game-data-metadata.md`. This exists on
octoberBranch only, uncommitted. Released master (b630e0767) does not write the field yet.
Nothing was activated and no production action was taken.

## Contract

- **Field:** `cron_job_audit.details.cronClassification`. It is top level in `details`,
  next to `statusCode`, `rowsUpserted`, `responseTruncated` and `responseOutcome`.
- **Type:** `"nhl_seasonal_game_data" | null`. The TypeScript type is `CronClassification`
  (import it as a type from `lib/cron/nhlOffSeason`). The value constant is
  `NHL_SEASONAL_GAME_DATA`.
- **Meaning:**
  - `"nhl_seasonal_game_data"`: the request passed through `withNhlOffSeasonSkip` during
    this run.
  - `null`: a new row whose request never entered that gate.
- **Source:** the gate itself sets a registered symbol
  (`Symbol.for("fhfh.cron.classification")`) on the `res` object as it is entered. That
  happens before the window read, the `ignoreOffSeason` check or a skip.
  `withCronJobAudit` reads the symbol after the handler finishes or throws. This works
  wherever the gate sits:
  - `withCronJobAudit(withNhlOffSeasonSkip(h))`;
  - `withNhlOffSeasonSkip(withCronJobAudit(h))`;
  - a gated worker called from inside an audited handler (nst-team-stats).

  Nothing reads route names, imports, comments, strings or row counts, or scans the
  filesystem.
- **Coverage:** the field is written on every audit row:
  - success, failure and thrown (500);
  - planned 207 `continued` (status handling unchanged);
  - off-season `skipped`;
  - `ignoreOffSeason=true`;
  - rows whose `response` preview is truncated (the field is outside the preview).
- **Limitation:** if an audited handler returns before it calls a nested gate (for
  example a 405 or auth early return in nst-team-stats), the field is `null`. That run
  never reached the game-data work.

## Reader and compatibility path

`cronClassificationFromAuditDetails(details: unknown)` is exported from
`lib/cron/withCronJobAudit`:

| `details` | returns | meaning for cron-report |
|---|---|---|
| `{ cronClassification: "nhl_seasonal_game_data", … }` | `"nhl_seasonal_game_data"` | seasonal game data (authoritative) |
| `{ cronClassification: null, … }` | `null` | not seasonal game data (authoritative) |
| key absent, non-object, null, or an unrecognised value | `undefined` | unknown: a historical or legacy row |

Suggested rollout:
1. On `undefined`, fall back to the existing `GAME_DATA_ROUTES` membership. This keeps
   zero-output coverage for historical rows and for rows that master's wrapper writes
   until the field is released.
2. When the field is present, use it instead of the list.
3. Retire `GAME_DATA_ROUTES` only after released master writes the field and the report's
   lookback window holds no pre-release rows.

The cron-report tests mock `lib/cron/nhlOffSeason` with only `loadNhlSeasonWindow`. The
audit wrapper does not import that module at runtime, only its type, so those mocks keep
working. Import the reader from `lib/cron/withCronJobAudit`, not from nhlOffSeason.

## Evidence

The fixtures are in `web/lib/cron/withCronJobAudit.test.ts` (describe "seasonal game-data
classification") and `web/lib/cron/nhlOffSeason.test.ts`. They cover:
- actual-wrapper positive with an unlisted route name;
- nested-gate and outer-gate positives;
- a non-wrapped control on `/api/v1/db/update-PbP` (gives `null`);
- unused-import, comment and string negatives;
- success, failure, thrown, skip and ignoreOffSeason runs;
- truncation;
- 207 continuation;
- historical rows with the field missing.
