# Authorized metadata discovery results — 2026-11-01

Both approved SELECTs completed against Supabase project `fyhftlxokyjtpndbkfse`, verified by the connector as active `fhfhockey.com`. Each ran in a read-only transaction with a 5-second statement timeout, 1-second lock timeout and 17-row result cap. The two SELECTs were sent separately to preserve distinct returned results. No retry or action-time approval prompt occurred.

| Read | Observed result |
|---|---|
| Latest-per-game revision/run/model metadata, November 1 | 0 returned rows; no model tuple can be pinned |
| Game IDs and start timestamps, November 2 | 4 rows; no overflow |

The first call's empty result was checked against the public connector implementation before proceeding. Supabase's [postgres-meta query handler](https://raw.githubusercontent.com/supabase/postgres-meta/master/src/lib/db.ts) selects the last nonempty statement result, so a trailing rollback does not inherently discard a nonempty SELECT result. This supports interpreting the observed empty result as zero returned metadata; the exact hosted implementation version was not independently inspected. No database diagnostic query was added. Raw tool outputs, exact executed SQL and hashes are retained in this directory.

The empty result was passed through the offline identity inspector: expected exit 1, `metadata_population_out_of_bounds`, `identity: null`, `qualificationReady: false`. This is an evidence gap, not a test regression or proof of a specific operational cause. It does not establish whether capture/compute flags are disabled, a run failed, no scoped revision was issued, or another producer condition applies.

The separately authorized schedule-only read continued as independent preparation; no qualification/canary capture followed the missing identity. Returned public game metadata:

| Game ID | Start UTC |
|---|---|
| 2026020232 | November 3, 00:00 |
| 2026020233 | November 3, 00:00 |
| 2026020234 | November 3, 01:00 |
| 2026020235 | November 3, 02:00 |

For the complete four-game slate, provisional T−60 is **November 2 at 23:00 UTC / 18:00 America/New_York**. Proposed D+1 noon New York settlement is **November 3 at 17:00 UTC**. The actual canary may be a subset with another first game; these are schedule calculations, not an approved capture window. No time or game subset has been written into the frozen scope.

## Exact next prerequisite

The retained legacy producer owner/coordinator must provide an already-authorized original `captured_live`, h1 revision/snapshot identity and the actual canary/capture/compute/serving configuration receipt, or identify the precise producer operation/decision needed to create one. Supply the actual codeVersion, configurationHash and artifactHash; do not substitute the merged release or candidate closure. The November 1 read cannot supply that evidence. Do not widen dates, read outcomes, turn on flags or trigger issuance automatically.

Admission remains independently pending on Claude's full candidate SHA/tree or limited Git/admission custody handback. If an earlier eligible slate was missed, the scope-owner restart decision in PROTOCOL.md still applies. Full consumer capture also retains the documented fan-out, comparator and normalization prerequisites.

Production actions were exactly **two metadata SELECTs**, plus one project-details lookup. There were zero RSO/Start Chart application requests, Yahoo/NST/provider requests, canary/producer jobs, persistent database writes, builds, pushes, deployments or activations. Returned data contained only the authorized public schedule fields; no credentials, player/account data or forecast values were returned.
