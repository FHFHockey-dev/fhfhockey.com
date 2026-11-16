# DRM and FORGE reader tests — source batch 7

Four full files read in path order: DRM37lines, goalie snapshot191, goalie tests777, player tests1244 (2249total). All bytes match89da739cb; exact hashes and per-function inventory are in the companion manifest/TSV. No test/browser/API execution and no snapshot regeneration. No new confirmed finding in this batch. Previously closed native-input proof/fallback/PK-head corrections remain represented by meaningful assertions, with actual implementation review still pending.

## DRM

Three tests pin scalar string-to-number scope (team22, season20262027),60second public cache, POST405/repeated parameter400 before matrix read, scope error400 and private backend error503/no-store. The matrix reader itself is mocked, so neither deployment math nor coverage qualification follows from these assertions. Response-helper status/header assignments are inventoried as internal functions.

## Goalies and retained snapshot

The Game Grid tests use real candidate contract/board/cell helpers with synthetic projections and a filter-aware Supabase stand-in. Candidate selection20 is retained even when candidate10 has greatest modeled start mass; unqualified start/win percentages and unqualified residual mass are withheld. Duplicates, mismatched opponent, legacy slots and post-cutoff issuance reject. Tests distinguish timestamps one microsecond apart, including expiry at scheduled puck-drop.

Run coverage is game-specific: newer H1 coverage for game103 does not erase older game104. Within a newer admitted run, malformed candidate rows do not silently restore that game's stale prior rows. Wrong-date/local/unproven runs are excluded before payload reads. Coverage query projects only run/game IDs with count and sentinel; truncated or excessive coverage yields500 before candidate payload reads. Candidate payload cap321, run cap30 and H1 filter are asserted. No DB planner/pagination/concurrent-write proof is implied.

Stored workload tests require exactly one game-end event, preserve incomplete schedule gaps, and use official credited starts. Three scheduled identities with0/1/2 end markers admit only the single-marker game; missing schedule is unknown, not a known empty workload. This proves the test's historical marker contract, not current games.game_state consumer completeness or real event integrity.

The ordinary goalie API suite distinguishes candidate lines from legacy team-slot mixtures. Candidate backup .38 start×24.6 saves yields9.348 unconditional saves, while conditional credited win.33, supplied unconditional credited win.13 and team win.45 remain separate. Opposing team wins .45+.55=1; own wins are not rescaled into team wins. Critically, the unconditional credited win is supplied by the builder input, not independently derived by this test. Relief counts are explicitly a zero-relief assumption; no calibration evidence is generated.

Legacy slot wins become null, with team-win evidence retained only where supplied. Missing starter/shot/save/GA/win/shutout fields stay null. Requested/fallback/explicit runs require succeeded release and captured native-input exclusion evidence; unknown/local/null-SHA and failed/running sources are refused. When6games exist on the requested day and only prior-day data is available, serving is blocked/degraded with gapDays1; no falsely current date is asserted.

The191-line snapshot pins supplied shape, not scientific accuracy: MAE3.88/1.22, Brier.19/.21/.07 and coverage.79/.75 are fixture metadata. Snapshot start probability.61 and modeled save%.892 are delivered inputs; the snapshot does not independently check24.1/27.2 or qualification. It preserves diagnostics/compatibility/provenance, but does not exercise NODE_ENV=production or prove UI debug suppression. Latest-run lookup is usually mocked; explicit/fallback proof logic and selected real helper paths are stronger than that stub alone.

## Skaters

Canonical fixture expects G=.4+.2+0=.6, A=.5+.1+0=.6, PTS1.2, PPP.2+.1=.3, SOG2.7+.8+0=3.5, hits.6, blocks.4. The test independently checks these sums, but confidence/range/scenario/PP-share/rest metadata are supplied. The fixture interval0/1/3 is a display mapping, not an uncertainty-calibration test.

AF-05 regression is explicit for a versioned all-situations strength contract: ES.2+PP.1+unknownPK cannot produce goals or points; known assists .3+.15+.01=.46 and shots2+.5+.2=2.7 still serve, PPP.25 independent. An earlier legacy row with null PK allows the legacy non-PP totals; its scope differs from the versioned all-situations case. Preserve this distinction when auditing implementation, rather than declaring those two fixture expectations contradictory without provenance review. Physical nulls remain null and unknown PK status remains labelled.

Availability/time-away objects pass through as if-plays, uncertain participation and unvalidated/unapplied decay; this does not qualify a returning-player decay model. ARI53/UTA59/UTA68 retain season-specific source identity while displaying canonicalUTA68; wrong joined ID/abbreviation/season fails closed. A synthetic fallback changes requested/resolved season separately; its mocked season transition is a propagation fixture, not a real calendar assertion.

H5 requests find genuine same-date H5 output when newest run only hasH1. If onlyH1 exists, the response retainsH5 but returns empty/blocked with explicit missing horizon; it neither scales nor relabelsH1. Fallback excludes20-day-old runs, local/null-SHA and single-game scope when a full-slate source is required. Prior-day response is warning/ready when requested schedule has0games and blocked/partial when6games were scheduled.

Native-input-proof tests check captured snapshot evidence rather than trusting run-start metrics. A real lookup is installed for selected mixed-window cases; broad fixture builders otherwise ignore some filters, and explicit source snapshots are generated by a production fixture helper. Actual provider exclusion, closure hash and release provenance still require their own source/receipt review.

## Verification and limits

Static TypeScript inventory and target-byte comparison passed. Source assertions and mocks were read fully; no Vitest call, database read, route invocation or browser load belongs to this batch. Full producing APIs/shared definitions remain pending and are not marked audited merely because their tests were reviewed. No test was added or changed.
