# Explicit compatibility run-ID admission increment

No overlap existed in the three routes or their direct tests before editing. Only `web/pages/api/v1/projections/{players,goalies,teams}.ts` and the new direct `explicitRunAdmission.test.ts` were changed.

An explicit `runId` now reads that exact run's metrics before projection access and requires the accepted external-fantasy exclusion marker. Missing run: 404. Missing/unsupported marker: 422. Neither path falls back or reads projections. Eligible runs retain response shape, deprecation metadata and existing date/horizon/entity filters, including successful empty projection responses. Existing metadata/projection database errors retain their status/redaction behavior. Default lookup still uses the previously guarded helper.

Verification: 38/38 focused tests passed (36 new parametrized admission tests across all three routes, two existing direct tests); scoped ESLint and diff whitespace checks passed. No broad tests or full TypeScript in this increment.

[additional.diff](additional.diff) contains the exact four-file increment; [receipt.json](receipt.json) contains before/after SHA256, patch hash, base HEAD and hash-identical preservation of the prior patches, including apiHelpers. No consumer, weight, schema, SQL, Git, deployment or production action.

This closes these three compatibility-reader bypasses only. Other canonical-reader/fallback paths and historical calibration/source-lineage concerns require their separate ownership checks.
