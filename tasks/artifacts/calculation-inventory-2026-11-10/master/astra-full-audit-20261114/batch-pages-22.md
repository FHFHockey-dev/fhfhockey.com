# Rankings page audit

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; all 2,092 lines read. Exact pure-function probe `pages22-probe.cjs` passed once, using the frozen metric definitions and formatters. Later Rankings commits remain separate evidence.

## AFULL-RANKPAGE1-01 — P2: active sample label ignores selected minimums

- Location: `web/pages/rankings.tsx:544–548`; the legend promises selected minimums at 647–650, and the methodology panel displays this sample at 670.
- Claim checked: the active methodology sample describes the user's actual selected minimums, independently of a metric's default floor.
- Evidence: exact frozen `activeMethodologySummary` plus `filtersToQuery` and real pure metric definitions in `pages22-probe-output.json`.
- Scenario: Goals/60 with selected minimum 20 GP and 1,200 seconds serializes those exact filter values, but active methodology says `Min 1 GP · Min 5:00 TOI · player_last_n_games_played`. The method uses the definition's default requirements whenever a definition exists. This is a label mismatch; no new wrong rank or live incidence is asserted.
- Suggested fix: display actual applied request minimums, and distinguish metric defaults from selected/effective requirements where both matter. Test the panel against nondefault selections and any enforced producer floors.
- Readers affected: skater Rankings and Metric Explorer methodology panel; goalie/team branches have separate contracts. The existing RLIB3-04 performance-window metadata conflict also reaches this panel.

## Complete source review

- Filter serialization preserves explicit season, window scope, sample confidence, source quality, columns/groups, entity, selection, sort and paging. Changing windows follows the new default GP only if the previous default was still selected. Selecting or sorting resets page where appropriate.
- Display-only column filtering creates new metadata while preserving the original row array, metric values and ranks. Exact control removes a caveated column without mutating two ranked rows or the source metadata.
- Season requests wait for explicit/resolved season. Main-view HTTP/network/JSON errors surface stable readable text and require explicit retries; auxiliary metadata, snapshot and comparison requests retain bounded SWR retry settings. No focus revalidation or previous-key data retention is requested. Actual SWR/cache/race behavior was not exercised.
- Snapshot date formatting explicitly uses UTC for date-only labels; exact November 14 control remains November 14. Loading, missing and unsupported snapshot states are distinct. Date strings are trusted payload values; this formatter is not an independent calendar validator.
- Snapshot identity checks prevent a supplied selected row for another entity from being used. A missing selection can fall back to the first visible row and shows that row's own identity. Best metric compares available percentiles, while raw values and ranks remain independent. Null fractions display Source pending, null percentiles N/A, zero remains zero, and team one-goal percent is explicitly divided by 100 before fraction formatting.
- Team unit coverage retains complete/partial/none, resolved game count and latest date alongside its percentage. Exact null/partial control preserves N/A with the partial warning. Per-row warnings yield to nonempty dataset warnings; this inherited choice is not proof that a row-specific warning was served incorrectly.
- Comparison request uses selected ID first, then visible rows, distinct positive integer IDs capped at six. Exact control preserves cross-season scope and selected sample filters. Team and goalie requests use their respective metric, role and minimum fields. It intentionally compares visible candidates; it does not recompute a new peer cohort here.
- Unsupported goalie/team secondary tabs and planned WAR remain explicit. Main tables, snapshot panels and comparison panels receive the appropriate entity payload. Display mode and rank mode flow to their actual consumers. Drawer layout/focus, responsive sizing, network fanout and rendered values were source-reviewed only.

## Inherited findings and limits

RANK12-01 (deployment fallback rank), RANK12-02 (page-local composite absence label), RANK12-03 (goalie/team raw-mode tiles) and RLIB5-02 (cross-season secondary-tab scope) retain their earlier exact probes and reach the corresponding page callsites. No duplicate new finding is created. The page's dynamic snapshot/version/source metadata depends on previously reviewed readers; source labels are not a new proof of publication freshness or scientific qualification.

No application changes, client/env imports, HTTP/database/provider requests, browser/server/build, supplied suite or live qualification. Capture ownership is unchanged.
