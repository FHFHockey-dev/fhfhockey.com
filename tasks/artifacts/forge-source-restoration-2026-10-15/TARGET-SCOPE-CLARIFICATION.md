# Target scope correction and read-set options

This supersedes the SOG-only recommendation in REVISED-SCOPE-PROPOSAL.md. That restriction was a convenience recommendation for a small first step, **not a proven missing-field or label limitation**. It unnecessarily coupled validation breadth to the later one-head model-comparison budget. Recommend retaining G/A/SOG/HIT/BLK/PIM plus conditional TOI in a revised validation proposal; fitting/scoring remains separately gated. PIM retains the explicitly approved positive-TOI population and exclusions.

Metadata presence is identical for each retained core target:

| Target (skaters only) | Original spans with key | Retained spans with key | Retained identities | Retained unique identity/game contexts |
|---|---:|---:|---:|---:|
| G | 780 | 717 | 825 | 15,984 |
| A | 780 | 717 | 825 | 15,984 |
| SOG | 780 | 717 | 825 | 15,984 |
| HIT | 780 | 717 | 825 | 15,984 |
| BLK | 780 | 717 | 825 | 15,984 |
| PIM | 780 | 717 | 825 | 15,984 |
| Conditional TOI | 780 | 717 | 825 | 15,984 |

Every row covers 444 retained games on 92 dates. The original corresponding core population was 830 skaters / 17,424 unique identity/game contexts / 484 games / 93 dates. These are field-presence counts, not nonmissing, numeric, coherent, positive-TOI or evaluable sample counts. No source values were accessed. All seven keys coexist in the retained skater metadata, so keeping these targets does not increase the source-span byte budget; it does require explicit target validation/output contracts and revised review.

## Exact read-set options

1. **All retained receipt locations:** 717 spans / 26,127,016 bytes, exactly listed in revised-scope-metadata.json. Every span contains metadata for SOG and conditional TOI. There is no target-presence filter that makes SOG/TOI smaller than the other core heads. This option validates each retained source location and preserves all revision/conflict evidence. It is not a claim that 717 reads are scientifically minimal.
2. **Metadata-deduplicated payload option:** 464 distinct retained span-digest classes / 16,485,400 representative bytes. There are 253 alias spans in 172 repeated-digest classes. Class members agree on byte length, game/day and recorded fetchedAt metadata. `deduplicated-read-option.json` fixes one representative by lexicographic (source,start,end), retains every alias and every distinct digest revision, and requires fresh verification of each read representative against its pinned digest. SHA256 `84416c9fed6561be112ba207210b25adb63bd95619b5cb0acc715316f507ba65`.

Option 2 is a proposed new input contract, not authority to skip reads under old A. It does not verify unread alias bytes and must preserve original wrapper/provenance bindings, source-reader semantics and contradiction handling. Independent review must decide whether inherited alias bindings suffice for the intended claim; no silent fallback to aliases on mismatch. It is not a 444-game single-revision selection: all distinct payload digest classes remain. Selecting only one revision per game could conceal conflicting values and is not proposed. Both options cover the same metadata population and neither establishes evaluable counts before validation. No subset is currently admitted.

## Changes from the original 829-span proposal

| Structural measure | Original | Retained | Loss |
|---|---:|---:|---:|
| Spans | 829 | 717 | 112 |
| Allocated bytes | 28,509,016 | 26,127,016 | 2,382,000 |
| Distinct games | 484 | 444 | 40 |
| Dates | 93 | 92 | 1 (Dec 19) |
| NHL identities | 927 | 920 | 7 |
| Skater identities | 830 | 825 | 5 |
| Goalie identities | 97 | 95 | 2 |
| Unique identity/game metadata contexts | 19,360 | 17,760 | 1,600 |
| Skater identity/game metadata contexts | 17,424 | 15,984 | 1,440 |

The remaining 1,776 goalie identity/game contexts are also structural, not valid appearances. Removed sources comprise 63 boxscore spans and all 49 landing spans. PPP loses its paired landing verification inputs; total PPP cannot be inferred from power-play-goal keys. Goalie component keys remain for 95 identities and decision keys for 82; deferring goalie validation is a scope recommendation, not proof those labels are absent. Native provenance/coherence and support remain unresolved. Unsupported probability/role/SO/unconditional claims stay excluded. Dates remain Oct 7, 2025–Jan 13, 2026; Jan 14 onward stays closed; all historical exposure/as-of caveats persist.

## Existing engineering review

Owner reports completed independent ACCEPTED_NEW_A_ENGINEERING_ONLY review, overall BLOCKED_MISSING_ORIGINAL_SOURCES, at `/Users/tim/Documents/FHFH-private/forge-broader-development-20261015-v1/protocol/reviews/a-execution-gate-v1.json`, SHA256 `dba836f4299bc899f140d9d23cbd3cbe8cc887f28c84e8d180781a313aeeb410`. The review includes corrected cross-revision core/PPP conflict quarantine, 16 owner synthetic checks and four independently rerun changed regressions. This does not admit either revised option. Preserve that immutable receipt and original unstarted evidence. No source-body access, execution, fitting or new approval occurred for this clarification.
