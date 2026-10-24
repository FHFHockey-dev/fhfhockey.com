# CTPI correction independent review

**Qualified acceptance for local integration of the two pinned files. No blocking defect was demonstrated.** The correction removes empty/invalid teams before league normalization and validates the complete prepared destination payload before any batch upsert. It preserves the valid-cohort calculation and `legacy_unapproved` publication boundary.

## Verified behavior

**Exclude before normalization.** `web/pages/api/v1/db/update-team-ctpi-daily.ts:299` filters calculated metrics on positive `source_game_count` and valid team identity before calling `computeCtpi` at line 302. The unchanged calculator first excludes non-one-game source rows; empty histories therefore have zero eligible count. No replacement identity or fabricated no-history score is supplied.

The independent fixture imports the actual route and calculator. Adding future-only, aggregate-only and malformed-team histories leaves the valid teams' complete output unchanged. A spy that delegates to the real calculator observes only the two eligible teams on every date. It covers tab/newline/Unicode boundary whitespace, numbers, booleans, objects and arrays. An entirely ineligible source produces the existing skip response with zero upserts. The owner regressions independently pass for uneven first-game dates and a single missing history that previously contaminated normalization.

Identity validation is the stated structural contract: a nonempty string with no leading/trailing whitespace, preserving its exact value. It is not a new NHL abbreviation allowlist, case conversion or canonicalization policy.

**Validate the whole payload before writes.** Lines 217–227 inspect every prepared row, reject an invalid team and reject duplicate `(season_id, team, date)` tuples. The first 500-row write loop begins afterward, at line 229. The tuple matches the existing destination primary key and `onConflict` target. Dates and season ID are supplied by the route; the change adds team validation and tuple uniqueness, not a new general validator for every upstream season/date field.

The original cross-batch duplicate test passes. Eight further independent cases put an invalid team after 500 valid prepared rows and all return 500 with **zero upserts**. Two additional cases make an earlier date contain 500 valid rows and place the defect on the last computed date—one duplicate pair, one blank identity—and again observe zero writes. Validation therefore covers the complete multi-date request, not just each chunk or the first date. No arbitrary duplicate winner is selected.

**Valid cohorts, formula and trust are preserved.** A separate test imports both the preserved pre-fix route and fixed route with the same real calculator and synthetic sources. A valid 48-team, 12-date cohort yields **576 identical row objects/payloads**, with expected 500/76 batching and unchanged `onConflict: season_id,team,date`. Every resulting payload is `legacy_unapproved` and rejected by `isTrustedRecentTeamFormPayload`. Calculator, formula weights, version constants, V2/materialization helpers and trust tests match the packet's unchanged hashes. No formula activation or publication promotion occurred.

## Exact reviewed source

| Path | SHA-256 |
|---|---|
| `web/pages/api/v1/db/update-team-ctpi-daily.ts` | `7ba8680eb056ffe7ed220d3c0955dc61569fca17050bfd516493a21377b3e7d7` |
| `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts` | `7150b3470fdd1d44848aa859206d542879c37428fe2fbf9946ea3988dd3efb59` |

Candidate patch SHA-256: `79474e676d3267d6deaf751f690bb657766cb108149619286000feed045025b0`.

Fixture archive SHA-256: `55ad5f2061a7ec995e6d71dc1654e6c80c793193a5b1e1a76be3a3b1c3564c91`. All **21 archived file hashes** were verified before execution. Both candidate files and all six declared calculation/provenance dependency fences match canonical and the tested snapshot at start and end. Baseline hashes match the saved originals; the supplied patch passes a dry-run against a fresh non-Git scratch baseline. [Reviewed diff](reviewed-diff.patch), [start integrity](start-integrity.json), [end integrity](end-integrity.json), [exact hash receipt](REVIEWED-HASHES.json).

The actual Git diff from the stated base commit to the canonical owned bytes also matches `candidate.patch` exactly, and the baseline file hashes match that commit. During this review, canonical HEAD advanced from `716896be8325a64f5cbd3ece9a1fdab48c50733f` to `87ab20cbd6059d2e2116843f303ed00b4902c2ac` without reviewer commits or branch changes. The two candidate and six dependency hashes remained unchanged. This acceptance does not cover other concurrent changes.

## Independent execution

Fresh nested source-only extraction; Node **v22.11.0**, npm **10.9.0**; existing dependencies reused by symlink; inert synthetic settings; outbound sockets/HTTP(S)/unmocked fetch denied. Archive extraction rejected unsafe paths, links, special files and env files. Auth, audit, source-fetch and database boundaries are mocked. The route and calculator are imported and executed; no SQL/database engine or HTTP route was invoked. The separate baseline comparison uses the exact original route copied into scratch, not a reimplementation.

| Check | Result |
|---|---|
| Fixed existing route suite | **8 passed** |
| Existing calculator/trust suite | **14 passed** |
| New reviewer imported-code/adversarial suite | **13 passed** |
| Fixed route tests against the saved original route | **6 expected failures, 2 passes** |
| Scoped diff whitespace and scratch baseline patch check | Passed |
| Source/archive/dependency integrity | Passed |
| TypeScript and ESLint | Not rerun; owner records passed scoped checks |

**35 fixed-candidate tests passed.** The six baseline failures are the expected negative control, not outstanding fixed-candidate failures. [Existing test receipt](existing-suites.json), [log](existing-suites.log), [independent receipt](independent-oracles.json), [log](independent-oracles.log), [complete fixture](auditCtpiIndependent.test.ts), [baseline receipt](baseline-regressions.json), [baseline log](baseline-regressions.log). No network-denial error occurred.

## Limits and handoff

This acceptance fixes payload construction and validation only. It does not qualify the rejected legacy formula, activate trusted Recent Team Form, clean historical blank rows, establish completeness of the four NST source tables, or prove the exact production failure/candidate version. Validation failure makes no writes, but a later database failure can still leave an earlier valid batch committed; this change does not add transactionality across batches. Existing authentication/audit wrapper behavior is unchanged and was not live-tested.

No application source edits, secrets, production/NST/network requests, database execution, migrations, installs, commits, builds or deployments were performed. Only separate review artifacts, temporary test fixtures and this task's diary were written. NST R1 was not rerun; other pipeline/billing/stats owners and the active production backfill were untouched. No denied or pending action or uncertain external result remains. The review is complete; combined-candidate/release approval and any historical cleanup require their own authorization.
