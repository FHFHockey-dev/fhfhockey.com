# Rolling Player Refresh Actions Report

Date: March 11, 2026

Related freshness input:
- [rolling-player-validation-freshness-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md)

## Purpose

This report records the stale-layer refresh actions executed for task `7.3`, along with their observed outcomes.

## Refresh Actions Executed

### 1. Brent Burns PP builder refresh

Action run:

```text
GET /api/v1/db/update-power-play-combinations/2025021023
Authorization: Bearer <CRON_SECRET>
```

Observed endpoint result:

```json
{"message":"Successfully updated the power play combinations for game 2025021023","success":true}
```

Outcome:

- succeeded
- Brent Burns PP builder freshness blocker cleared
- post-refresh freshness state moved from `BLOCKED` to `READY`

### 2. Corey Perry PK NST counts refresh

Action run:

```text
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCounts
Authorization: Bearer <CRON_SECRET>
```

Observed endpoint result:

```json
{"message":"Done","runMode":"incremental","startDate":"2026-03-10","overwrite":true,"datasetType":"penaltyKillCounts"}
```

Outcome:

- request completed successfully
- post-refresh freshness check still showed:
  - latest PK counts date: `2026-03-08`
  - WGO latest date: `2026-03-10`
- blocker not cleared

### 3. Corey Perry PK NST rates refresh

Action run:

```text
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillRates
Authorization: Bearer <CRON_SECRET>
```

Observed endpoint result:

```json
{"message":"Done","runMode":"incremental","startDate":"2026-03-10","overwrite":true,"datasetType":"penaltyKillRates"}
```

Outcome:

- request completed successfully
- post-refresh freshness check still showed:
  - latest PK rates date: `2026-03-08`
  - WGO latest date: `2026-03-10`
- blocker not cleared

### 4. Corey Perry PK NST on-ice counts refresh

Action run:

```text
GET /api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCountsOi
Authorization: Bearer <CRON_SECRET>
```

Observed endpoint result:

```json
{"message":"Done","runMode":"incremental","startDate":"2026-03-10","overwrite":true,"datasetType":"penaltyKillCountsOi"}
```

Outcome:

- request completed successfully
- post-refresh freshness check still showed:
  - latest PK on-ice counts date: `2026-03-08`
  - WGO latest date: `2026-03-10`
- blocker not cleared

## Rolling Recompute Actions Triggered

Targeted rolling recomputes were triggered for:

- Brent Burns (`8470613`, season `20252026`)
- Corey Perry (`8470621`, season `20252026`)

Purpose:

- ensure refreshed source rows are eligible to flow into `rolling_player_game_metrics`

Operational note:

- the freshness recheck that followed already showed target freshness remained current for both players
- source freshness, not target freshness, remained the gating issue for Corey Perry

## Post-Refresh Freshness Outcome

After the refresh actions, the validation-player statuses were:

- Brent Burns: `READY`
- Corey Perry: `BLOCKED`
- Jesper Bratt: `READY`
- Seth Jones: `BLOCKED`

### Brent Burns

Resolved:

- PP builder tail blocker cleared
- expected PP game ID now matches latest PP builder game ID: `2025021023`

### Corey Perry

Still blocked:

- PK counts tail lag: `1`
- PK rates tail lag: `1`
- PK counts-on-ice tail lag: `1`

Post-refresh evidence:

- latest PK counts date remained `2026-03-08`
- latest PK rates date remained `2026-03-08`
- latest PK counts-on-ice date remained `2026-03-08`
- WGO latest date remained `2026-03-10`

Interpretation:

- the narrow NST refresh requests completed successfully but did not advance Perry’s PK source tail
- this now looks like a source-availability or upstream-import limitation, not a missed local refresh action

### Seth Jones

No refresh action was run in this sub-task for the Jones PK tail.

Reason:

- Seth Jones remains the PRD’s retained incomplete-source-tail proxy
- his blocker is still useful as the designated freshness-blocker case for later mismatch classification and signoff evidence
- a narrow one-day refresh is not available through the current NST endpoint surface for his January 2, 2026 PK lag; the documented endpoint would require a much broader forward crawl from `2026-01-02`

Current state:

- Jones remains `BLOCKED`
- PK tail blocker remains intentionally preserved for validation workflow coverage

## Line Builder Refresh

No line-combination refresh action was required in this sub-task.

Reason:

- no freshness blocker in the March 11, 2026 validation-player report involved `lineCombinations`

## Conclusion

`7.3` refresh-action result:

- one blocked freshness case was fully resolved:
  - Brent Burns PP builder freshness
- one blocked freshness case remained blocked after the required narrow refresh actions:
  - Corey Perry PK NST source tail
- one retained proxy case remains intentionally blocked:
  - Seth Jones incomplete-source-tail PK case

This leaves the validation set in the following state for later verification work:

- Brent Burns: ready
- Jesper Bratt: ready
- Corey Perry: ready for all-strength, EV, PP, and GP/availability validation; PK still blocked
- Seth Jones: retained blocker/proxy case for freshness-aware validation and mismatch classification

