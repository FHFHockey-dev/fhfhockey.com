# Lines parser IGA support (Lane D) — 2026-11-06

## Scope
Lane D of `tasks/artifacts/lines-iga-plan-2026-11-06.md`: in-game/practice/warmup/projected context with spans,
PP as sub-unit (keep goalies), partial/change-only units, audit High #1/#3/#4/#5, FxTwitter provenance on source
metadata. Chef: local_3f3bae11-08af-4e4b-8198-488d12a385ea.

## Where
octoberBranch, canonical checkout. Owned: web/lib/sources/{tweetInterpretation,linesCccIngestion,
lineupSourceIngestion,lineSourceLineCombinations}.ts + tests.

## State
- Implemented: `interpretation.lineContext` (detectTweetLineContext), `interpretation.changes`
  (extractTweetUnitChanges), 🥅/G: goalie rows + ✅/🅿️ `unit.sourceMarker`, trailing media links stripped;
  classifier PP-only-without-full-block, transactions not injuries; buildRowGoalies + metadata.goalieStates;
  metadata.sourceProvenance (buildTweetSourceProvenance); fx capture key on original id; first complete lineup wins.
- Checks: lib/sources 1283 pass (pre-change 1267 + 1 trainer-lane failure that later cleared); eslint clean;
  regression 0/5 → 0/5, 0 newly broken (baseline in session scratchpad).

## Outcome (closed)
- Commit 505ed430a (octoberBranch, 8 owned files, not pushed). Typecheck exit 0, eslint clean, lib/sources
  1283 passed / 39 skipped, trainer regression 0/5 → 0/5 with 0 newly broken.
- Chef verified the commit and test run and relayed the field names to Lane A. Field spec:
  side-session-notes/<chef>/lane-d-parser-fields.md.
- Out of scope, logged by Chef: audit H2 (F→D section role carry).

- Follow-up (Chef): goalie slots, tweet 2118850118849864168 (UPL/Ellis). Commit 1877dea90: lone one-name lines
  after the D pairs are goalie slots; an unmatched slot-1 name stays unresolved (stored as goalie_1_name, id null);
  goalie-scoped alias resolves it; line-combination writes skip goalies when goalie_1 has no id; goalieStates
  carries slot and playerId null for unresolved. lib/sources 1288 passed / 39 skipped; regression 2/11 → 2/11,
  0 newly broken (baseline regression-baseline-2.json, flag on); typecheck exit 0; eslint clean.

## Next
None. Lane D is closed.

## Gotchas
- Lane A ClaimContext warmup|game|practice|projected, phase pregame|in_game|unknown. Legacy `context`
  (camp|practice|game|unknown) untouched because `context !== "game"` nulls gameId.
- goalie_1 feeds game-predictions topGoalie, so projected goalies stay stored; only ruled-out are dropped.
- No new classification value: a forecast table has a CHECK on classification.
