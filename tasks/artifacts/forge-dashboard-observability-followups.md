# FORGE Dashboard Observability Follow-Ups

## Goal

Promote the current observability gaps into explicit follow-on work items instead of leaving them buried as audit caveats.

## Follow-On Work Items

### Freshness Integrity

- add explicit freshness-policy coverage for:
  - `/api/v1/forge/players`
  - `/api/v1/transactions/ownership-trends`
  - `/api/v1/transactions/ownership-snapshots`
- replace request-time freshness stand-ins with true source-recency timestamps for:
  - `/api/v1/trends/team-ctpi`
  - `/api/v1/trends/skater-power`

### Route Continuity

- add route tests that verify selected `date` and `mode` survive:
  - dashboard -> team detail
  - dashboard -> player detail
  - landing preview -> Start Chart
  - player detail -> team detail / Start Chart / dashboard where context should persist

### Ownership Overlay Verification

- add checks that distinguish:
  - truly empty ownership-band results
  - null-ownership suppression
  - season-mapping mismatch
  - truncated ownership universe

### Mixed-Cadence Detection

- add page-level mixed-date health checks for:
  - landing route
  - team detail
  - dashboard bands that combine multiple feeds

### Coverage-Loss Detection

- add explicit coverage-delta checks for:
  - requested-vs-resolved goalie coverage
  - requested-vs-resolved projection coverage in Top Adds / player detail

## Why These Should Be Follow-On Work, Not Caveats

Each item above changes whether a surface can ever be promoted to `green`.

That makes them implementation backlog items, not just commentary.
