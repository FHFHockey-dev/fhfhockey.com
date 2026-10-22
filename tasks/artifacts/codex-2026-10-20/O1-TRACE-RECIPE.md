# O1 — Bounded, deployment-bound Vercel trace recipe

## Scope and current evidence

This is a read-only recipe for a separately authorized diagnostic session. **No project inspection, deployment lookup, trace search, or hosted log query was run.** Chef located the handoff's recorded executable at `/Users/tim/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel` and ran only offline `traces --help`, `traces search --help` and `traces inspect --help` with outbound networking blocked and telemetry disabled for those commands. CLI64.5.0 confirms the options below, UTC/relative time inputs, JSON Lines output and lookup limits. The installed-help check supersedes the worker's PATH-only absence observation; it does not establish account access.

The handoff’s O1 note cites Vercel’s September 29, 2026 trace-search announcement and correctly warns that default searches (last hour, newest first, 100 spans) are not complete historical coverage. Current docs now expose the required bounded filters. They also say `search` without `--project` spans all projects for the selected team, so explicitly bind both team and project.

## Operator procedure (do not run without the separate access/session authorization)

1. Record the incident’s exact UTC interval (`FROM_UTC`, `UNTIL_UTC`), approved team and project, exact deployment ID, and request ID from an already authorized incident receipt. Check that the interval is short enough for this case and is within the team’s effective retention. Do not discover these values by broadening the search.
2. Search once, bound to all five dimensions, with a 100-span ceiling:

```bash
vercel traces search \
  --scope "$TEAM_ID" \
  --project "$PROJECT_ID" \
  --environment production \
  --deployment-id "$DEPLOYMENT_ID" \
  --request-id "$REQUEST_ID" \
  --since "$FROM_UTC" \
  --until "$UNTIL_UTC" \
  --limit 100 \
  --json
```

Set the time variables to explicit ISO-8601 UTC timestamps, for example `2026-10-20T14:02:00Z` and `2026-10-20T14:07:00Z`; do not leave relative defaults. The command combines filters with AND. The 100 result cap is a deliberate first-pass bound, not a claim of full coverage. If the summary indicates more matches, stop and request an explicitly bounded follow-up; do not automatically page.

3. Read the JSON Lines summary (`recordsReturned`, `timeRange`, `pagination`, `excludedIntervals`) before interpreting spans. Confirm every returned span’s project/deployment/environment/request identity and UTC timestamp against the approved receipt. If a matching request ID has a captured root trace, inspect that trace with the same approved project/team binding:

```bash
vercel traces inspect "$REQUEST_ID" \
  --scope "$TEAM_ID" \
  --project "$PROJECT_ID" \
  --json
```

The `inspect` operation is request-ID based, not time/deployment filtered. Only use the request ID established by the bounded search/receipt. Current docs state that retrieval requires a matching root span in the same project within 30 minutes after the request timestamp; a 404 is therefore not evidence the request never happened.

## Read and report safely

- Preserve the query interval, `timeRange`, count, pagination state, `excludedIntervals`, and any permission/retention error in the evidence note. Redact request/trace/span IDs and any user, session, league, token, URL query, header, or custom-attribute value before sharing output. Keep only fields needed to prove project, deployment, environment, request/time alignment, span name/kind/status/duration and parent-child order. Do not paste raw JSON or secrets into a ticket.
- `recordsReturned: 0` means no matching indexed spans were returned for that exact filtered window. It does **not** prove there was no request: check the returned time range and `excludedIntervals`, selected deployment/project/environment, whether tracing was collecting, sampling, retention, and access. Current Vercel docs describe always-on traces as sampled and plan retention as Hobby 1 hour, Pro 1 day, Enterprise 3 days (beta documentation, last updated August 24, 2026); the project’s effective plan, beta availability, configuration, and retained interval are **UNKNOWN** here.
- A page cap (`pagination.hasMore`, or `recordsReturned` reaching the chosen cap) means matching evidence may be incomplete. The CLI supports cursors, but do not follow `pagination.next` without a separately agreed time/record budget.
- Missing framework or custom spans is not proof of missing function execution. Vercel’s tracing docs distinguish infrastructure/outbound-fetch spans from framework/custom spans and note that framework/custom span availability depends on instrumentation. Do not add instrumentation under O1.

## Synthetic redacted alignment fixture

Use this only as a review fixture, never as a real trace receipt:

```json
{
  "query": {
    "project": "<project-redacted>",
    "deployment": "<deployment-redacted>",
    "environment": "production",
    "request": "<request-redacted>",
    "since": "2026-10-20T14:02:00Z",
    "until": "2026-10-20T14:07:00Z",
    "limit": 100
  },
  "summary": {
    "recordsReturned": 2,
    "timeRange": {"since": "2026-10-20T14:02:00Z", "until": "2026-10-20T14:07:00Z"},
    "pagination": {"hasMore": false, "next": null},
    "excludedIntervals": []
  },
  "spans": [
    {"project": "<project-redacted>", "deployment": "<deployment-redacted>", "environment": "production", "request": "<request-redacted>", "trace": "<trace-redacted>", "span": "<root-redacted>", "parent": null, "time": "2026-10-20T14:03:10Z", "status": "Error"},
    {"project": "<project-redacted>", "deployment": "<deployment-redacted>", "environment": "production", "request": "<request-redacted>", "trace": "<trace-redacted>", "span": "<child-redacted>", "parent": "<root-redacted>", "time": "2026-10-20T14:03:10Z", "status": "Error"}
  ]
}
```

Acceptance for this synthetic fixture is only identity/time consistency, parent linkage, and explicit pagination/exclusion reporting. It says nothing about real project tracing coverage.

## Official references checked

- [Vercel CLI `traces` documentation](https://vercel.com/docs/cli/traces): current search and inspect flags; 100 default / 1,000 maximum; JSON Lines summary and excluded intervals; root-span lookup limit.
- [Vercel Always-on Tracing](https://vercel.com/docs/tracing/always-on-tracing): sampling prerequisites, automatic-span coverage, beta-plan retention windows, last updated August 24, 2026.
- [Vercel September 29, 2026 trace-search announcement](https://vercel.com/changelog/search-trace-spans-from-the-vercel-cli): explains the search feature and historical default cap.

The official docs establish CLI capability only. They do not establish this project’s plan, enabled sampling, trace retention, request-span coverage, current deployment ID, or user’s authorization for a hosted query.
