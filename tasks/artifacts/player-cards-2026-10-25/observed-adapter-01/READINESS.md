# Observed-card source readiness

This checkpoint maps supplied NST rows into the accepted local card adapter. It performs no fetch, database read, source repair or activation. The currently served artwork remains unchanged and synthetic. Parent owns independent acceptance.

## Confirmed mapping versus missing evidence

The inspected ingestion mapping and schema establish these stored fields. All per-game TOI inputs below are seconds. A stored field and a single-player capture do not establish league coverage, provider-model equivalence or source freshness.

| Metric | Individual (`I`) / on-ice (`O`) components | Mapping and local capture |
| --- | --- | --- |
| ATOI | `I.toi / official appearance GP`, then seconds→minutes | Fields available; denominator remains official appearance frame, including zero selected-strength exposure |
| SOG/60 | `3600 × I.shots / I.toi` | Exact fields captured |
| iCF/60 | `3600 × I.icf / I.toi` | Exact fields captured; distinct from on-ice attempts |
| iSCF/60 | `3600 × I.iscfs / I.toi` | Exact fields captured; distinct from on-ice chances |
| ixG/60 | `3600 × I.ixg / I.toi` | Exact field captured; provider model/event universe remains unverified |
| On-ice CF/60 | `3600 × O.cf / O.toi` | Exact fields captured |
| On-ice SCF/60 | `3600 × O.scf / O.toi` | Exact fields captured |
| On-ice xGF/60 | `3600 × O.xgf / O.toi` | Exact fields captured; provider model/event universe remains unverified |
| On-ice xG% | `100 × O.xgf / (O.xgf + O.xga)` | Exact components captured; no substitution of supplied rounded shares |
| IPP | `100 × I.total_points / O.gf` | Requires both source groups on the same games/strength |
| SH% | `100 × I.goals / I.shots` | Zero shots remains undefined; inconsistent positive goals/zero shots remains missing |
| On-ice SH% | `100 × O.gf / O.sf` | Zero on-ice shots remains undefined |

All calculations remain in the previously accepted aggregation module. This mapper adds no rate or rank formula. Invalid/missing component values remain null; it does not coerce numeric strings or source failures to zero. An unavailable on-ice group does not erase otherwise valid individual inputs, while IPP correctly depends on both.

Tables are explicitly selected by the requested strength: `nst_gamelog_as_counts`, `nst_gamelog_5v5_counts` or `nst_gamelog_pp_counts`, with corresponding `_oi` tables. ES is not treated as 5v5. Wrong tables, minutes, read failures, missing provenance or capture timestamps later than the declared snapshot make the affected group unavailable. This is table-contract support, not verified current strength coverage.

## Historical capture reconciliation

The unchanged approved `production-diagnostic/query-2-rows.json` contains 60 rows from one player: 20 NHL, 20 NST individual and 20 NST on-ice. Query1 supplied the other eight rows in the original 68-row diagnostic. No new production request was made.

The original SQL has exact `WHERE player_id = 8476453` predicates, but omits player IDs in the returned JSON. The new adapter requires an explicit single-player query receipt for that case; it never guesses identity from name, row order or a selected UI player. A conflicting returned player ID invalidates that source batch.

Under the explicitly proposed current-season frame, the mapper retains ten current-season NHL records and joins nine individual/nine on-ice records. October 5 has no captured matching NST row. Prior-season source rows do not fill that date, and independently selected source windows are not treated as the official appearance frame. This reproduces source alignment through the new boundary rather than re-running the accepted WiGO repair.

`capture-reconciliation.json` deliberately keeps:

- `completeHistory: false` and unverified game completion;
- empty verified-metric/model-definition evidence;
- unknown all-NHL population and no league ranks;
- live and premium activation false.

All twelve observed-card values remain unavailable in the final adapter result. Raw components are mapped for diagnosis, not promoted to qualified statistics. The capture timestamp used by this harness is the recorded query invocation time; it is an envelope timestamp, not a per-row update time or a proven database transaction timestamp. The regular-season/UTC frame is declared for mapping, not independently proven by the old capture.

## Evidence still needed

1. **Completed appearances and actual date convention.** `games` supplies season/type/date/scheduled start, but no actual game-end field. The existing update-stats handler checks NHL `OFF`/`FINAL` before transactional persistence. `statsUpdateStatus.completed_at` dates ingestion, not the actual end of play. A contract-v1 complete manifest may support a conservative “known final by” bound only after source/receipt validation; it must not silently become an exact game-end timestamp. Historical cutoffs earlier than that bound remain unresolved.
2. **Complete per-player history through the cutoff.** Latest20 rows, surviving counts or a current roster entry are not complete-history evidence. The mapper does not infer completeness or honestly-short status from row count. A qualified frame must cover every completed appearance in the selected season/date policy, including traded and non-current roster players.
3. **Provider definitions and null/zero semantics.** The ingestion source maps dash placeholders to zero before storing counts. Stored rows cannot recover the original distinction. Provider field/placeholder semantics therefore need verification before declaring those zeros measured. xG model/event-universe evidence remains distinct from the app's own xG model. No provider/model substitution is made.
4. **Source versions/freshness.** The inspected NST count tables do not carry row source-update/model-version timestamps. Capture hashes preserve the bytes read, not their original creation time or what was known historically. The new adapter preserves explicit capture references and does not invent a source watermark.
5. **Metric-specific all-NHL population.** The one-player capture proves none of this. NST skater ingestion's `pos=S` is insufficient for the requested all-position valid-value population; compatible goalie values or justified undefined/incompatible cases require evidence. No GP/TOI, position, active-roster or recency threshold is introduced. A future population inventory must report expected identities, valid values, known undefined values and missing/incomplete values separately for every metric.
6. **Publication and product decisions.** Provider/asset rights, proposed short-N/season/rank policies and exact premium allocation remain separate gates. This pure mapper does not enable a route or approve them.

The smallest next read proposal is the five-game completion/identity check in [READ-REQUEST.md](READ-REQUEST.md). It narrows the first gap only. Full-history and population acquisition need a separate bounded plan after that result, not an implied league-wide query or provider scrape.

## Source references

- `web/pages/api/v1/db/update-nst-gamelog.ts`: header-to-column map around 505–660; TOI/placeholder parsing around 1390–1440.
- `supabase/migrations/20260716112908_production_schema_baseline.sql`: NST individual table5724, on-ice16641, games9059, statsUpdateStatus25546; player/date indexes35068/35075/36146.
- `web/pages/api/v1/db/update-stats/[gameId].ts`: final-state check278–315 and transactional persistence438–449.
- `web/lib/cron/transactionalGameStatsPersistence.ts`: contract-v1 manifest shape.
- Existing accepted WiGO local-fix and dry-run receipts remain read-only; no duplicate repair or operational execution.

`INPUT-PINS.json` records inspected input hashes. These repository contracts are not assertions about deployed data coverage.
