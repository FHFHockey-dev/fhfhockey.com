# FORGE Dashboard Observability Follow-Ups

## Goal

Promote the current observability gaps into explicit follow-on work items instead of leaving them buried as audit caveats.

## Follow-On Work Items

Status as of 2026-07-11: every original observability follow-up below is implemented and verified. The only newly exposed coverage gap is the separate NEW 13 weekly-projection ownership contract.

### Freshness Integrity

- [x] Add explicit freshness-policy coverage for:
  - `/api/v1/forge/players`
  - `/api/v1/transactions/ownership-trends`
  - `/api/v1/transactions/ownership-snapshots`
- [x] Replace request-time freshness stand-ins with true source-recency timestamps for:
  - `/api/v1/trends/team-ctpi`
  - `/api/v1/trends/skater-power`

### Route Continuity

- [x] Add route tests that verify selected `date` and `mode` survive:
  - dashboard -> team detail
  - dashboard -> player detail
  - landing preview -> Start Chart
  - player detail -> team detail / Start Chart / dashboard where context should persist

### Ownership Overlay Verification

- [x] Add checks that distinguish:
  - truly empty ownership-band results
  - null-ownership suppression
  - season-mapping mismatch
  - truncated ownership universe

### Mixed-Cadence Detection

- [x] Add page-level mixed-date health checks for:
  - landing route
  - team detail
  - dashboard bands that combine multiple feeds

### Coverage-Loss Detection

- [x] Add explicit coverage-delta checks for:
  - requested-vs-resolved goalie coverage
  - requested-vs-resolved projection coverage in Top Adds / player detail

## Why These Should Be Follow-On Work, Not Caveats

Each item above changed whether a surface could be promoted to `green` and is now covered by focused regressions, the full suite, or production reconciliation.

The remaining Top Adds weekly gap is tracked as source/master NEW 13 and must not be treated as an observability-only caveat.
