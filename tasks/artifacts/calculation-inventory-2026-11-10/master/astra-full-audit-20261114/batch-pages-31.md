# Underlying Stats landing — frozen source audit

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`; full1,780-line read of `web/pages/underlying-stats/index.tsx`,240unique AST rows. Exact `pages31-probe.cjs` and output passed once. No app edits or production activity.

## AFULL-ULSPAGE1-01 — P1: equal Power Scores receive order-dependent different ranks

- **Location/claim:** page:475–492,rank table cell. Numeric ranks must handle ties and remain independent of input order (§4).
- **Evidence/scenario:** exact powerRankedRatings/powerRankByTeam memos and actual shared power helper. AAA andBBB both have offense104,defense100,Power102. CCC hasPower100. Map assignsAAA1,BBB2,CCC3; swapping the two tied input rows assignsBBB1,AAA2. No secondary evidence distinguishes the tied teams. This is numeric rank, not merely presentation order.
- **Fix/readers:** use the approved shared tied-rank convention (competition or documented dense rank), and deterministic team ordering only for display within ties. Extend an existing ranking test with equal values and input permutation. Affects landing rank cells, rank sort and top-team ordering; no hosted tie occurrence asserted.

## Additional evidence for existing findings

- **AFULL-TEAMN1-02 P2:** page:841–865 power popover and table tooltip still describe offense/defense/pace plus PP/PK bonus. Actual shared power is(off+def)/2. Exact page residual expression with off=def100,pace130,tier2 gives an alleged special-teams bonus−10 despite tiers contributing nothing. This is another reader of the already recorded narrative/formula mismatch, not a duplicate finding. Update both the prose and residual calculation; preserve the shared definition.
- **AFULL-TEAMR1-01 P1:** landing/date resolver can select a future snapshot for absent historical data, inherited from fully reviewed service/landing functions. This page adopts returned resolvedDate and updates URL. Its new local guard correctly suppresses stale ratings until selectedDate matches resolvedDate; that does not repair an upstream false date attribution.
- **AFULL-TEAMR1-02 P1:** PDO sparkline uses `team.luckSeries` supplied by landing; upstream absent PDO→100 survives this renderer. No duplicate production probe or source-occurrence claim.

## Full-source checks

All sorts, formatters, component statistics/popovers, schedule chips, handlers/effects, desktop/simple table branches and initial loader were read. SOS uses fraction×100 once, declares2:1direct/indirect points% and source-as-of context. PP/PK percentages are displayed as stored percentages and missing tiers remain unknown, notTier3. Exact controls keepnull andknown0 distinct and null last in both sort directions. Numeric nonfinite admission remains a producer contract; no arbitrary malformed value was promoted to a reachable finding.

Goaltending column and per-row tags use the shared basis contract: only a wholly verifiedv4 slate says5v5 globally; mixed dates retain per-row legacy/basis tags. Popover describes empty-net exclusion only for verified5v5. The closed scope-label correction holds in source. PDO is a separate percent-sum index around100; explanatory cohort z uses sample SD. Exact[1,2,3] control producesmean2,SD1. Popover z values are display reconstructions over the displayed cohort, not independent evidence of the producer's historical sample. Mean-centred power inputs and the approved writer remain separately qualified in earlier batches.

Initial landing fetch occurs only once after router readiness; date changes use team-ratings. Abort guards suppress late results and stale/error ratings become an empty set rather than remaining under a new date. Retry is an explicit button, never invoked here. The local guard probe confirms a Nov14 selection cannot display a Nov13 snapshot. Fallback response adopts the resolver date; source resolver finding above still applies. Route-status metadata is initial-load context, not revalidated by the date-change endpoint. Empty tables show unavailable rather than numeric rows. Mobile initially selectsSimple mode; layout/rendering not observed.

Schedule chips count seven/fourteen-day texture as supplied, include rest differential and at most three priorities; they do not recompute scheduling. Shared narrative still includes its existing formula finding. No live requests, source data, database, provider, actual UI/popover, environment imports, server/build or supplied suite ran. Local exact-source controls and hash/ledger checks only.
