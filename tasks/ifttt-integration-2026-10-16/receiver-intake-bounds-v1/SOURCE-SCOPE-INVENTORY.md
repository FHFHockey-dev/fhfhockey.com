# Existing receiver scopes (local code only)

These routes already exist; no endpoint, secret, IFTTT applet or delivery setting was created or activated. The table names below are exact scope values, not a rollout selection.

| Route suffix under /api/v1/sources/ifttt/ | table | sourceGroup | sourceKey | normalized sourceAccount |
|---|---|---|---|---|
| DFOFantasy-tweet | line_source_ifttt_events | dfo | dfofantasy | dfofantasy |
| NHL-Rosters-tweet | line_source_ifttt_events | nhl_rosters | nhl_rosters | nhl_rosters |
| gamedaylines-tweet | line_source_ifttt_events | gdl_suite | gamedaylines | gamedaylines |
| gamedaygoalies-tweet | line_source_ifttt_events | gdl_suite | gamedaygoalies | gamedaygoalies |
| gamedaynewsnhl-tweet | line_source_ifttt_events | gdl_suite | gamedaynewsnhl | gamedaynewsnhl |
| ccc-tweet | lines_ccc_ifttt_events | ccc | ccc | cccmiddleton |

CCC's receiver config key is `ccc`; the retry scheduler elsewhere uses `cccmiddleton` for processor routing. Policy scope must match receiver configuration, not infer the key from the scheduler. DFOFantasy and NHL_Rosters retain their existing source-account checks. Those checks do not authenticate original-post/quote lineage or establish independent corroboration.

After separate authorization and deployed-prerequisite proof, bound natural-receipt evidence checks to exactly the approved tuples/window/attempt/receipt budgets: compare admitted raw/variant original text and source/publication/receipt clocks, lineage, qualification holds and quota counters; stop at expiry/exhaustion or explicit stop. Do not bulk ingest/replay, widen source coverage, turn on processing, read future outcomes or interpret a local config entry as authentic production coverage. Missing source observations remain missing evidence, not negative injury evidence.

The six config hashes captured while the139-pin candidate is held are in `source-scope-config-pins.json`. These additional read-only observations do not expand the139-file review freeze or its current runtime acceptance.
