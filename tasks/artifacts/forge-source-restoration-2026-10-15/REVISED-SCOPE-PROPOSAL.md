# Revised source scope — proposal only

No revised allocation or execution is authorized by this document. Original A remains unstarted and operationally blocked; preserve its approval, missing-source preflight, restoration inventory and engineering review as separate historical evidence. Do not run 717 spans under the old 829-span approval.

Current engineering status, reported by the sole executor: the existing evaluator found a PPP conflict-handling defect; a private correction now passes 16 synthetic checks and is under final focused re-review. Receipt: `/Users/tim/Documents/FHFH-private/forge-broader-development-20261015-v1/protocol/synthetic-receipt-v4.json`, SHA256 `87d8efb03ca3eb263ece33cc979de3344ead718d7e52a3f21ec54e990c50e4e7`. Independent final engineering acceptance is pending and cannot remove the missing-originals blocker. No A attempt, read ledger, terminal receipt or support-counts report exists according to the owner.

## Exact retained scope

Derived exclusively from retained metadata-contexts and span metadata, without source-body reads or hashes. `revised-scope-metadata.json` lists all proposed source/offset/span-digest bindings; SHA256 `d96a1d996d4801a1611e7ad3af88d4b965e914d951382dee93a2db6a7fc23e3f`.

| Existing source under private v1 sources/original | Spans | Allocated bytes |
|---|---:|---:|
| native-private-capture/observations.json | 49 | 639,193 |
| remaining-skater-materialization/native-skater-observations-v1.json | 592 | 22,588,548 |
| team-conflict-investigation/native-two-player-observations-v1.json | 76 | 2,899,275 |
| Total | 717 | 26,127,016 |

These paths passed the owner's lstat-only size preflight; their source bytes have not been freshly verified by this proposal. The allocated bytes are exact ranges, not permission to read entire enclosing files.

Remaining metadata covers 444 distinct games on 92 dates, October 7, 2025–January 13, 2026; 920 NHL identities (825 skaters, 95 goalies); 17,760 unique identity/game entries. There are 28,680 repeated roster entries across spans; these must not be presented as independent observations. Compared with the original proposal, seven identities (five skaters, two goalies), 40 games and December 19 disappear entirely. Exact lost IDs/games are in the metadata inventory. Loss is source-driven and potentially selective, not random missingness or evidence of complete league coverage.

| Existing period | Remaining spans | Bytes | Distinct games |
|---|---:|---:|---:|
| Seed Oct 7–Nov 16 | 292 | 10,538,087 | 180 |
| Nov 17–30 | 101 | 3,681,016 | 65 |
| Dec 1–14 | 104 | 3,815,830 | 62 |
| Dec 15–Jan 2 | 128 | 4,707,590 | 80 |
| Jan 3–7 | 37 | 1,359,565 | 22 |
| Already-exposed Jan 8–13 | 55 | 2,024,928 | 35 |

## Category implications

- G/A/SOG/HIT/BLK/PIM and conditional minutes have schema presence for 825 skaters. Positive TOI, coherent numeric values, duplicates, target-specific support and chronology remain unvalidated. Preserve the approved positive-TOI PIM exclusions if PIM is later allocated; do not broaden its population.
- All 49 allocated landing spans are absent. Their formerly proposed 49 paired structures cannot support fresh PPP credit validation. Remaining power-play-goal keys are not total PPP. Defer PPP from revised raw-source validation.
- Remaining boxscores contain goalie component keys for 95 goalies and decision keys for 82, but absence of the 63 dedicated goalie spans changes support. Keys do not establish valid appearances, native outcome provenance, W credit, or coherent component totals. Do not infer that the missing goalie archive can be replaced with these contexts. Defer goalie targets from the first revised wave.
- SO, participation/start probabilities, PP role, strength-specific and unconditional forecasts remain unsupported. Historical original-as-of availability and untouched evaluation remain unproved.

## Smallest useful next step

Recommend a new, independently reviewed **skater SOG plus positive-TOI support validation only** allocation over the exact 717 retained spans, capped at 26,127,016 bytes. SOG is provisional based on product relevance and retained schema coverage, not observed performance. Decode only the fields needed for identity, game/date, TOI, SOG and validation; no opportunistic extraction of other heads. Freeze canonical joins, duplicate/conflict rules, exclusions, date isolation, byte accounting and output contract before source access. Stop after one validation/support receipt, including exact failures and missingness. No fitting, scoring, candidate selection or B execution.

This changes both allocation and target scope and needs direct approval plus a revised executable/runtime/synthetic gate. Reuse the existing evaluator and useful engineering findings, but rebind acceptance to exact new code and allocation hashes. Any missing path or source/span mismatch stops the pass; no retries, substitution, refetch or partial-success promotion. The existing one-head, anchor-plus-at-most-two-challengers budget does not authorize a benchmark. B still needs its separate frozen recipes, practical gates and direct approval.

## Already-exposed derived-data alternative

Prior accepted v3 and Jan 8–13 development reports remain present at:

- `/Users/tim/Documents/FHFH-private/forge-full-development-20261014-v3/reports/DEVELOPMENT-REPORT.md`
- `/Users/tim/Documents/FHFH-private/forge-adaptive-development-20260108-13-v1/REPORT.md`

Previously reported accepted support was 662 skater and 39 usable goalie records plus 46 PPP observations for v3; the Jan 8–13 continuation reported 55 skater appearances, three PPP observations and two positive-TOI goalie appearances. These are historical owner/evaluator-reported support summaries, not fresh verification of derived datasets in this proposal. Report-file existence was checked without opening numeric bodies. Prior reports/results may remain cited as exposed development evidence.

A separately approved derived-only experiment could potentially reuse the exact previously exposed datasets if their retained bytes, transformation lineage, date/identity/target allocation and acceptance bindings can be admitted. It cannot recover missing original receipts, validate the original 829-span A pass, establish untouched/as-of status or expand to new identities/targets. First require a bounded metadata inventory of exact derived artifacts; do not open them merely to determine usability. No rerun, blend or further adaptive fit is authorized here. This is a fallback, not the recommended first step because original-source revalidation would remain incomplete.

## Future genuine capture and preservation

Leave the existing v1 live operation unchanged. A separately authorized future pilot can freeze one supported head, explicit identities/games, schedule and roster inputs, scoring contract, request/concurrency/byte budgets, actual acquisition clocks, pregame feature/selection cutoff and immutable issuance deadline. Future observations acquired after an event are post-event evidence; they cannot replace original historical availability or backdate a forecast. Preserve misses and errors without silent shifting or retry. Settle only under a separate bounded outcome allocation and evaluator/readout policy.

Before any future acquisition or experiment, require a durable non-`/tmp` experiment source directory, immutable exact original bytes, acquisition receipt and actual clock, whole-file plus allocated-span digests, source/identity lineage and an independently verifiable manifest. Before deleting temporary copies, verify an authorized second durable copy and bind its location/hash in the manifest. Recovery verification must respect protected-period read boundaries; no whole-file hashing or decoding of mixed protected sources without explicit scope. Temporary staging alone is insufficient. Pin all runtime and source dependencies and record availability checks before execution.

January 14, 2026 onward remains closed. No new source acquisition, numeric access, scoring/fitting, model changes, production writes or deployment occurred in preparing this proposal.
