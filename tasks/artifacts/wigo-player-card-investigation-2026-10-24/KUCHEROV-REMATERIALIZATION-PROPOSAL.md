# Kucherov-only re-materialization proposal

**Planning only; not executable approval yet.** Parent accepted the four-file correction locally after independent verification (parent-reported 75/75 offline cases, scoped lint, 46 matching pins and exact patch). Production remains unchanged. No external action, new test, Git operation or application edit was made for this proposal.

## Existing endpoint is not safe for this operation

`/api/v1/db/calculate-wigo-stats` unconditionally enumerates every non-goalie player, with no `playerId`/recent-only query control: [route:163](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:163), [:234](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:234). Adding `?playerId=8476453` would not bound it. It writes **both** career and recent tables, in independent batches; write errors are logged rather than guaranteed to fail the entire operation: [route:1258](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:1258), [:1301](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:1301). No other application writer of these aggregates was found in the inspected API/scripts/lib paths.

**Local prerequisite:** prepare and independently review a single-player, recent-only dry-run/apply path that **reuses the accepted corrected recent calculation**, accepts an immutable input snapshot/cutoff, emits one candidate payload, and enforces the limits below. It must not call the existing broad handler or duplicate its metric formulas. No such reviewed bounded path exists today; do not run the endpoint as a shortcut. This prerequisite is not implemented by this proposal.

## Exact target and code identity

- Production project: `fhfhockey.com`, ref **fyhftlxokyjtpndbkfse**, verified during the earlier authorized diagnosis. Reconfirm the target at any future approved execution without exposing credentials.
- Player **8476453, Nikita Kucherov**. Forward mutation: **one existing row in `public.wigo_recent WHERE player_id=8476453`**, updating only L5/L10/L20 aggregate columns and `last_updated`. No insert if absent; no career, rates, NST, NHL, season, cron or job-state mutation.
- Accepted corrected source pins are in [local-fix/SOURCE-PINS.json](local-fix/SOURCE-PINS.json): builder SHA-256 `f438eb129e1f70dd0691151916e78a8ea2225412ec63847ce93e334bc9ee9fa6`; reader `7a253deedaa1c30593e944afbd84679087df235dd7fa16204810f2379b60414f`. Pin the reviewed bounded runner and calculation to these accepted bytes (or a subsequently approved exact candidate).
- A local runner can calculate from corrected code without a hosted build; it does **not deploy** that code. Stable production repair also requires the corrected hosted builder to be released through separate explicit deployment approval; otherwise an old scheduled builder may overwrite the repair. Verify the deployed candidate before a stable repair. No deployment is authorized or proposed to run now.

## Preparation and currentness gate

Proposed fixed diagnostic cutoff: **completed regular-season appearances through 2026-10-23**, retaining WiGO's existing cross-season last-N policy. Later appearances must not silently roll this operation's window. If a later window is desired, replace the cutoff and regenerate/review its candidate before write approval.

Under separately approved bounded reads, capture one immutable fresh snapshot:

| Input | Fields / filter | Maximum rows |
| --- | --- | ---: |
| `players` | identity/position, `id=8476453` | 1 |
| `seasons` | latest two started season IDs/dates; must agree with declared cutoff/current season | 2 |
| `wigo_recent` | complete **fresh prior row**, `player_id=8476453`, including timestamp | 1 |
| `wgo_skater_stats` | player's latest 20 unique regular-season appearances through cutoff, `games_played=1`; game/date/season, all NHL numerator and PP-exposure fields used by corrected calculation | 20 |
| `nst_gamelog_as_counts` | same player and exact NHL-frame seasons/dates; TOI, ixG, iCF, iSCF/HDCF | 20 |
| `nst_gamelog_as_counts_oi` | same player/frame; GF/SF and zone-start numerator fields | 20 |

Total **64 snapshot rows**, in at most two sequential read-only SELECTs (metadata/prior row <=4; game-frame/source rows <=60), five-second statement timeout, one-second lock timeout, rollback. Explicitly mark absent source games; reject duplicate/conflicting identities, read errors and over-limit results. No provider calls or seasonal/career history reads are needed for a recent-only candidate.

Compute offline without network or write capability. Retain canonical input JSON, its hash, exact game list, coverage by metric, code/runner hashes, the complete candidate, and field-level old/new diff. A fresh snapshot is required; the earlier 16:25/16:26 diagnostic rows are historical evidence, not an apply-time currentness guarantee. The original 08:52 row alone is not a current rollback backup.

Immediately before applying, compare the complete selected input frame/source values and prior target row against this snapshot **within the write statement/transaction's consistent snapshot**. Abort on any change; do not overwrite with a stale calculation. Re-reading the same exact bounded selections in SQL can enforce this comparison without returning extra source rows. Lock only the target aggregate row, with one-second lock timeout. No cron suspension is implied; a concurrent writer/change causes an abort/review, not a bypass.

## Write, idempotency and rollback budget

- One conditional `UPDATE` transaction, `WHERE player_id=8476453` **and exact prior-row equality and exact input-snapshot equality**; return the one changed row. Require affected count **exactly one** before commit; zero/multiple/error means rollback. Statement timeout **5s**, lock timeout **1s**, no automatic retry. Use a fixed operation timestamp in the candidate rather than refreshing `last_updated` on retries.
- Operation ID = hash of player, cutoff/frame, input contents, calculation/runner version and candidate. Same operation + exact already-applied postimage => no-op. On uncertain response, inspect the target once and compare with retained prior/postimage before any retry; do not submit another update blindly. No new idempotency table or migration.
- Retain the complete apply-time prior row and postimage in the diagnostic artifact. If verification fails after commit, the proposed approval may include **at most one compensating restore of that same row**, conditional on it still matching this operation's exact postimage. If another writer changed it, stop rather than clobber newer work. Database transaction failures roll back normally.
- Maximum mutation: **one target row**, **one forward UPDATE**, plus **at most one conditional restore UPDATE** of that same row if explicitly included in execution approval. No deletes, inserts or other table writes.
- Maximum returned records including preparation: **68** (64 snapshot + one forward returned row + one post-read + one uncertainty read if needed + one restore returned row). Stop when conclusive; do not consume optional recovery reads routinely. Source comparisons inside apply scan only the same bounded frame (<=64 selected records), with statement timeout.
- Maximum operation wall time: **60 seconds**, each database statement <=5 seconds and lock wait <=1 second, concurrency one. Abort/rollback at a limit; no repeated polling, refresh loops or provider fan-out. If the chosen executor cannot enforce conditional commit/rollback and these limits, execution remains blocked until the local prerequisite is corrected.

## Expected result, without inventing October 5

Assuming inputs are unchanged from the approved diagnosis:

- **L5:** five matching NHL/NST games permit ATOI, individual NST metrics and supported rates to become non-null. Captured-input arithmetic was ATOI **1262.6 seconds**, ixG **1.82**, iCF **35**, SOG/60 **11.9753**, PTS/60 **2.8513**. These are acceptance references for the frozen diagnosed inputs, not unconditional values for a newly changed snapshot.
- **L10:** **9/10** NST coverage remains because October 5 is absent. Dependent ATOI/per-60/NST totals/IPP/oiSH% remain null; valid NHL counts and independently supported PP fields remain populated. A refresh must not manufacture October 5 data.
- **L20:** corrected matching no longer loses older regular-season inputs to unrelated postseason top-20 rows. If those older rows exist, coverage becomes **19/20** with October 5 still missing; dependent whole-window metrics therefore remain null. The earlier diagnosis did not read those six older rows below the old NST limit, so 19/20 is conditional, not a verified current count. Report the actual captured coverage and keep any additional genuine gaps null.
- Database post-read must equal the candidate (including preserved valid zeros/nulls), change no other player/table, and retain the operation watermark. This alone does not verify hosted page behavior or deploy the accepted reader.

**October 5 ingestion repair is a separate task and approval**, with its own player/date/dataset/provider request, pacing and write bounds. It is not part of this re-materialization plan. No production execution approval is requested until the bounded local path and dry-run candidate are concrete and independently reviewed.
