# Retained FORGE metadata feasibility: October 7, 2025–January 13, 2026

**The retained indexed context supports a broad metadata cohort proposal: 927 NHL identities across 484 games and 93 dates.** All 927 meet the declared core-key presence rule. Only 19 have accepted canonical mappings; 908 remain mapping-pending. No outcome labels or valid modeling samples are admitted by this audit.

One independently gated pass read 829 exact indexed spans (28,509,016 bytes) across five retained source paths. It used seek-only reads, date/game/season checks before roster traversal, metadata scalar allowlists and statistic-key presence. No whole mixed archive was read/parsed/hashed; discovery-facts was never opened. No outcome values, scoring events, goalie decisions, TOI values or team scores were decoded. No new acquisition, fitting, scoring, allocation, promotion or deployment.

## Verified coverage

| Coverage | Verified metadata count |
|---|---:|
| NHL identities | 927 |
| Canonical mapped / mapping pending | 19 / 908 |
| Distinct represented games / dates / teams | 484 / 93 / 32 |
| Distinct identity/game roster entries | 19360 |
| Forward / defense / goalie entries | 11583 / 5841 / 1936 |
| Canonical-mapped / mapping-pending entries | 780 / 18,580 |
| Metadata identity conflicts quarantined | 0 |
| Additional reference copies consolidated | 11,840 |
| Landing games with scoring-array structure | 49 |

| Roster role | Distinct identities | Metadata games per identity: min / median / max |
|---|---:|---|
| Forward | 548 | 1 / 18 / 48 |
| Defense | 282 | 1 / 18 / 48 |
| Goalie | 97 | 1 / 19 / 48 |

48 identities have only one represented game. Metadata prior-history bands using the two-calendar-day lag contain 1,008 entries with 0 prior indexed games, 3,396 with 1–4 and 14,956 with 5+. These are indexed roster histories, not validated positive-TOI histories. 22 identities have more than one historical team ID; that is a metadata flag, not a verified trade/return diagnosis. Rookie and return status remain unknown.

The interval has 99 calendar dates; six have no represented boxscore: October 10, November 27, December 12 and December 24–26. This audit cannot distinguish league off-days from archive gaps. The archive was selected around the original 19-player pilot; 32 represented teams and 484 games do not establish league completeness or representativeness.

## Per-target schema support

| Target group | Identities with required keys | Roster entries with keys | What remains unverified |
|---|---:|---:|---|
| G,A,SOG,HIT,BLK,PIM and conditional skater TOI | 830 for each target | 17,424 for each target | Numeric validity, nonmissing values, positive TOI, native reconciliation |
| SV,GA,SA and conditional goalie minutes | 97 for each primitive | 1,936 for each primitive | Positive minutes, coherent components, exposure and credit validity |
| Direct PPP field | 0 | 0 | PPP must be derived from complete paired original evidence |
| Potential PPP paired-game context | 553 skaters | 1,764 skater/game entries | Individual credited PPP derivation and complete source reconciliation |
| Goalie starter / decision field existence | Not a class count | 1,936 / 968 entries | Official starts, binary win classes and valid credit |

SO credit, participation/start probabilities, PP-role, strength-specific and unconditional ice time remain unqualified. Field names do not establish target values or complete negative/peer populations. Ratios require later linked numeric component checks: SV + GA = SA, SV% = SV/SA and GAA = 60 × GA/minutes. Counts, penalty minutes, ice minutes and rates retain distinct units.

## Exact cohort proposal

Propose all 927 structurally supported identities, chosen without performance information. [cohort-proposal.json](cohort-proposal.json) enumerates every identity and every player/game/date/team/role/key-presence row, with per-target candidate sets and source-context lineage. It is explicitly a proposal, not outcome allocation or model admission.

- Canonical-mapped stratum: the original 17 skaters and 2 goalies (19 IDs; 780 roster entries).
- Mapping-pending stratum: 908 exact NHL IDs (18,580 roster entries). Canonical IDs stay null; NHL IDs were not substituted for canonical IDs.
- Target-schema cohorts: 830 skaters and 97 goalies. Separate per-target lists preserve potential support when another field is missing.
- Minimum objective rule: an identity must have at least one non-conflicted indexed roster game with all required core keys. This establishes structural feasibility only; it is not a sufficient-history, predictive-quality or release threshold. No performance filtering or new target allocation occurred.

The broad development proposal remains blocked on canonical mapping for 908 identities and separately authorized native label/coherence checks. There is no metadata-based justification to certify all 927 as usable training or held-out samples. The 19 mapped identities are the only currently canonical-resolved proposal stratum; broader coverage is preserved rather than discarded.

## Evidence limits and next decision

All original source hashes are inherited from accepted metadata indexes. This pass checked source sizes and recorded fresh hashes only of exact read spans. It did not freshly verify entire source files or prove value-equivalent revisions. Header/identity agreement and deterministic latest-fetched metadata choice cannot establish numeric reconciliation. Source acquisition clocks are later than historical games; zero rows are certified original-as-of. Earlier auxiliary decoding/incident provenance still prevents an untouched historical claim.

Next bounded work would need direct authorization to resolve the exact 908 NHL/canonical mappings from an admitted retained identity index, or obtain one under a separately approved acquisition scope. Then review the exact dataset/target manifest and frozen development/selection/future-test protocol before any numeric extraction, scoring or fitting. No January 14+ outcomes are opened or allocated by this proposal.

## Separate live-operation exception

The execution clock had advanced beyond October 14 while no capture or forecast existed. Original capture and training owners recorded the October 14 windows missed with zero source requests and zero issued forecasts; there was no retry or backdating. Under the existing approved operations rules, the same heartbeat was advanced to the October 15 10:00 Eastern settlement event. Tool confirmation and configuration readback matched. The next approved pregame event remains October 15 17:20 capture / 17:45 cutoff / 18:00 issuance. Future execution is not guaranteed. No broader capture budget or model was substituted; the blend scoring hold remains.

## Reproducibility

- [Protocol](PROTOCOL.md), [exact span manifest](span-manifest.json) and [independent execution gate v2](protocol/reviews/execution-gate-v2.json).
- [Coverage and identity histories](coverage.json), [metadata-only contexts](metadata-contexts.json), [exact cohort proposal](cohort-proposal.json) and [completion hashes](completion.json).
- Independent recomputation: [recomputed-metadata-coverage-v1.json](protocol/reviews/recomputed-metadata-coverage-v1.json), 359,101 checks. Final acceptance is separate; this report alone confers no label or model authority.
