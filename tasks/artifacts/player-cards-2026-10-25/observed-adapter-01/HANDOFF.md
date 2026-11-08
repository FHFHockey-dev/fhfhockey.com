# Supplied NST capture adapter — frozen local checkpoint

Parent-requested offline source work is ready for independent review under lease `CODEX-PLAYER-CARDS-NST-CAPTURE-20261025`. Only two new application files changed:

- `web/lib/player-cards/nstCapture.ts`
- `web/lib/player-cards/nstCapture.test.ts`

The adapter accepts supplied count rows and explicit evidence. It contains no transport, database client, auth, environment lookup, route, source repair or activation. Existing arithmetic, window, registry, ranking and UI modules remain read-only. The current hero/share preview remains intact.

## Result

`mapNstCapture` constructs the accepted `LocalCardInput` shape with `origin: local-observed`. It validates NST table/strength and seconds contracts; captured-time/read references; row identity or an explicit single-player query receipt; exact season/date alignment; duplicate date rows and ambiguous same-date official games. It preserves missing fields and source-group independence. A missing on-ice record blocks its dependent metrics and IPP without discarding valid individual components. Frame/history/completion and metric-definition/population evidence pass through explicitly; none is inferred from row count, schema or a successful read. Live and premium flags remain false.

The old single-player capture was consumed through this new mapper, not through a repair handler. Ten current-season NHL rows map to nine matching individual/nine matching on-ice rows; October5 remains missing. The capture still lacks final-game, complete-history, UTC date, model-definition and all-NHL population proof. Therefore the final card adapter returns all twelve values unavailable and zero ranks. See [capture-reconciliation.json](capture-reconciliation.json) and [READINESS.md](READINESS.md). Raw diagnostic components are not displayed as qualified live statistics.

## Checks

From `web/`, using existing packages, Node22.11.0, offline fetch rejection and the owned shared-lock wrapper:

| Check | Command | Result |
| --- | --- | --- |
| Mapping regression tests | `npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-25/observed-adapter-01/vitest.config.mts` | 10/10 passed |
| Scoped types | `npx --no-install tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-25/observed-adapter-01/tsconfig.json` | Passed |
| Scoped lint | `npx --no-install eslint lib/player-cards/nstCapture.ts lib/player-cards/nstCapture.test.ts` | Passed |
| Historical capture bridge | `node <artifact-root>/reconcile-capture.mjs` | Passed;9/10 joins, all observed outputs remain blocked, zero network requests |

Tests cover identity receipts/conflicts, wrong strength/units, failed reads/future capture stamps, exact seasonal joins, missing/duplicate sources, multiple same-day games, unverified evidence, explicit zero PP exposure, missing/nonnumeric components, and per-source pre-completion capture times. Positive impossible ratios continue into the existing accepted validity gates. No old accepted suite was rerun to reconstruct missing logs, and no browser/server changes were needed for this pure module.

The original query's recorded start time is used as the historical capture envelope; it is not mislabeled a per-row source-update watermark or an actual database transaction timestamp. The old capture has no finality proof. New qualified data must supply the actual reviewed references, not reuse the fixture proof strings in tests.

## Concrete next read, not executed

[READ-REQUEST.md](READ-REQUEST.md) and [PROPOSED-READ-ONLY-COMPLETION.sql](PROPOSED-READ-ONLY-COMPLETION.sql) specify one read-only transaction for the five already captured L5 game IDs, at most five rows, a five-second statement timeout and no retry. It reads game identity plus completion-manifest metadata only. The proposal narrows finality evidence without repeating metric totals, fetching providers or invoking ingestion. It does not resolve full history, provider meaning or population coverage, and it cannot authorize live activation.

`statsUpdateStatus.completed_at` is ingestion completion, not actual game-end time. Any conservative “known final by” interpretation needs explicit contract review. Current NST count tables lack a row-update/model-version watermark, and ingestion canonicalizes dash placeholders to zero; provider semantics must establish which stored zeros are measured. The requested all-position population cannot be replaced by NST `pos=S`, a current roster, or a minimum-exposure subset.

## Visual steering and preservation

After this safe checkpoint, the requested posterized/pixelated/team-color variants became the priority. Both new Library image references failed the supported input materialization, including one pinned executor-local retry each. Zero readable bytes/pixel inspections means image-dependent work is blocked before implementation. Exact evidence and next required input are in [portrait treatment handoff](../portrait-treatments-01/HANDOFF.md). Existing accepted cutouts and card exports remain unchanged; no roster805 inference was run.

Coordinator independently reports all48 previously absent historical logs match files in `/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/archived-output-files/`; see canonical coordination `CODEX-TO-CLAUDE.md` at its2026-10-25 card checkpoint entry. The earlier hero packet is preserved as a record of what was absent locally at that readback. No logs were reconstructed or old tests rerun.

Parent owns independent source/visual acceptance. Next: obtain the two accessible style references, inspect their pixels and request exact custody for an isolated treatment candidate. In parallel the parent may review the five-row read proposal. The observed source/public search/live ranking/premium and publication gates remain open; this is not full product completion.
