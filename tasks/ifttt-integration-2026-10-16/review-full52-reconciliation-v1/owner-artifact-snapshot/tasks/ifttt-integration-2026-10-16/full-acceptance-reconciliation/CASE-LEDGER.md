# Original52 assertion ledger

This is a heterogeneous bounded local evidence ledger. It is not one integrated full52 run and does not approve production. Every original case and all227 assertions remain present.

Original projections: **50/52 case rows,225/227 assertions match**. CR011/CR051 keep their original failing positive assertions; their separately approved explicit-clause v2 positives pass12 assertions, retaining all7 original game-separation assertions. Both ambiguous originals hold for review in pure and actual durable checks.

| Original | Case | Matching / original assertions | Evidence boundary |
| --- | --- | --- | --- |
| CR001 | Frozen G005040 widens display evidence without changing semantic claim | 9/9 | pure projection |
| CR002 | Display-only expansion retains one bound scenario and one effect identity | 9/9 | pure projection |
| CR003 | Known delivered legacy effect is reused across new evidence version | 6/6 | pure projection |
| CR004 | Legacy effect outcome unknown blocks a fresh effect | 4/4 | pure projection |
| CR005 | New-first then old replay converges after persisted mapping | 6/6 | pure projection |
| CR006 | Exact retry allocates no new occurrence or evidence version | 6/6 | pure projection |
| CR007 | Rule-version-only replay keeps semantic revision and action identity | 5/5 | pure projection |
| CR008 | Different named players in one source never share an occurrence | 4/4 | pure projection |
| CR009 | Repeated independent same-player clauses keep occurrence multiplicity | 5/5 | pure projection |
| CR010 | Opposing repeated same-player clauses remain unresolved | 5/5 | pure projection |
| CR011 | Same player in separate games has separate scenarios | 3/4 | separate approved fixture correction |
| CR012 | Repeated text requires unique occurrence alignment before aliasing | 3/3 | pure projection |
| CR013 | Explicit correction is retained as a new occurrence and held transition | 6/6 | pure projection |
| CR014 | Retraction has no synthesized replacement or inverse action | 6/6 | pure projection |
| CR015 | Missing or cross-game relation target never alters unrelated acceptance | 3/3 | pure projection |
| CR016 | Retraction delivered before target still prevents a batch initial action | 5/5 | pure projection |
| CR017 | Unknown-to-known identity binds a new interpretation to the same occurrence | 6/6 | pure projection |
| CR018 | Unknown-to-known game binding keeps source occurrence stable | 5/5 | pure projection |
| CR019 | Verified provenance enrichment keeps claim token and preserves held legacy row | 4/4 | pure projection |
| CR020 | Post-action player rebinding is held rather than treated as fresh acceptance | 6/6 | pure projection |
| CR021 | Post-action game rebinding cannot escape dedupe through a new scope | 4/4 | pure projection |
| CR022 | Independent agreeing originals corroborate one revision | 6/6 | pure projection |
| CR023 | Two verified relays of one original add no independent claim or vote | 5/5 | pure projection |
| CR024 | Explicit independent contradiction remains unresolved regardless of certainty | 6/6 | pure projection |
| CR025 | Two agreeing originals cannot outvote one contrary explicit original | 3/3 | pure projection |
| CR026 | Corroboration cannot refresh expired first-acceptance validity | 5/5 | pure projection |
| CR027 | Identical text with unknown originals never proves cross-wrapper equivalence | 3/3 | pure projection |
| CR028 | Original URL or author contradiction fails before downstream planning | 3/3 | pure projection |
| CR029 | Two retained source lineage matches are ambiguous even with identical bytes | 3/3 | pure projection |
| CR030 | One-to-many split cannot silently reuse a legacy occurrence token | 3/3 | pure projection |
| CR031 | Many-to-one merge cannot erase a distinct source occurrence | 3/3 | pure projection |
| CR032 | Older agreeing original arriving later preserves clocks and effect identity | 3/3 | pure projection |
| CR033 | Contradiction delivery permutation yields unresolved batch in either order | 4/4 | pure projection |
| CR034 | Late older contrary evidence cannot roll back an already delivered effect | 4/4 | pure projection |
| CR035 | Late receipt or interpretation cannot be retrofitted to an earlier cutoff | 2/2 | pure projection |
| CR036 | Same evidence-version key with different immutable payload fails closed | 4/4 | actual local persistence projection |
| CR037 | Legacy same-key conflicts retain parent and suppress every new child | 4/4 | actual local persistence projection |
| CR038 | A source occurrence token reused for an unrelated original is a collision | 4/4 | pure projection |
| CR039 | Interrupted before registry commit retries with one durable occurrence | 3/3 | actual local persistence projection |
| CR040 | Registry commit acknowledgement lost requires readback before reuse | 3/3 | actual local persistence projection |
| CR041 | Evidence-parent write acknowledgement lost verifies exact immutable readback | 4/4 | actual local persistence projection |
| CR042 | Action reservation before dispatch reuses its persisted transition/effect identity | 3/3 | actual local persistence projection |
| CR043 | Dispatch acknowledgement lost is unknown outcome and blocks blind resend | 3/3 | actual local persistence projection |
| CR044 | Durable delivery acknowledgement suppresses replay even after queue failure | 3/3 | actual local persistence projection |
| CR045 | A rule bump cannot promote unchanged tentative language to actionable fact | 3/3 | pure projection |
| CR046 | Unicode prefix shifts UTF-16 offsets without changing aligned occurrence | 6/6 | pure projection |
| CR047 | A-to-B-to-A material transitions cannot collapse by value-only hash | 5/5 | pure projection |
| CR048 | A status URL and author-looking text cannot invent verified reporting identity | 3/3 | pure projection |
| CR049 | Two players sharing one predicate retain distinct subject occurrences | 5/5 | pure projection |
| CR050 | Independent repetition never upgrades tentative assertion strength | 3/3 | pure projection |
| CR051 | Two distinct games on the same team date never share a scenario | 2/3 | separate approved fixture correction |
| CR052 | Concurrent first claims require one committed transition and one effect identity | 4/4 | actual local persistence projection |

All original assertion objects, actual values, case-level evidence paths/hashes, scope qualifications, approved replacements and dependency drift are in `outputs/full52-reconciliation.json`. No pure deferred row was relabeled as a persistence pass; separate reviewed actual-storage results supply those31 assertions.

The immutable-row rewrite negative control still makes unchanged CR019 assertion2 fail (count1 versus normal0). The normal raw runner exits1 for the original CR011/CR051 fixtures; the mutation runner exits1 with CR019 additionally failed. Those exit codes are expected preserved original-oracle failures, not a passing full52 score.
