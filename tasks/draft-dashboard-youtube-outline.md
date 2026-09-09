# Draft Dashboard: complete YouTube tutorial outline

Prepared September 7, 2026. Target runtime: **59 minutes**. Presenter bullets and demonstration notes, not spoken dialogue.

## Recording notes — not part of the video

- Basis: the current local `web/pages/draft-dashboard.tsx`, its dashboard components, and the calculation hooks they call. The page is only the entry point; almost all behavior lives below it.
- Chef was consulted in **CHEF — Draft Pro**, task `01a07c1d-047d-7660-954c-b3ce7d8ef7d2`. His unreleased implementation is in a separate worktree. Local code does not establish what is deployed.
- Use one example league throughout: 12 teams, snake draft, ordinary positional slots, a bench, and a middle draft position. Use prepared examples for categories, trades, keepers, and reversals; restore the main example before proceeding.
- Show the league provider's actual settings beside the dashboard during setup. Prepare a small CSV with one ambiguous player name and a saved mid-draft example. Use projections you have permission to show publicly.
- Put chapter markers in the description. Keep arithmetic on screen while explaining its meaning; viewers do not need to calculate anything themselves.
- The 59-minute budget includes every core topic. If demonstrations run long, allow approximately 65 minutes rather than remove keeper/trade explanations, recovery steps, or limitations. Cut typing and loading time first.
- Donation statistics below are the creator's supplied figures, not independently audited. Update them on recording day.
- Release-sensitive material is marked **Conditional**. Verify the demonstrated build before recording those segments; do not portray planned features as available.

## Chapter plan

| Time | Chapter |
|---|---|
| 00:00–02:00 | What the dashboard does; support the creator |
| 02:00–04:00 | Workspace orientation and preparation |
| 04:00–07:00 | League format and custom draft order |
| 07:00–10:00 | Roster configuration |
| 10:00–13:30 | Points and categories scoring |
| 13:30–18:00 | Projection sources and CSV imports |
| 18:00–23:30 | Traded picks, keepers, and unusual leagues |
| 23:30–26:00 | Playoff weeks, integrations, and completing setup |
| 26:00–30:00 | Understanding VORP, VONA, and VBD |
| 30:00–35:00 | Available Players and advanced settings |
| 35:00–39:30 | Suggested Picks and every checkbox |
| 39:30–44:00 | Tracking the draft, roster, and league standings |
| 44:00–50:00 | DUST, schedule fit, and the matrix |
| 50:00–54:30 | Corrections, saving, restoring, and exports |
| 54:30–57:30 | Draft recap and troubleshooting |
| 57:30–59:00 | Final checklist and support reminder |

## 1. What this does, and supporting the work — 00:00–02:00

- **Show:** the complete dashboard, briefly followed by a populated draft.
- Explain the purpose: turn projections into league-specific player values, track everyone's selections, see roster needs, and make better-informed decisions while the actual draft takes place.
- Establish the manual workflow immediately: this is a companion to the league's draft room. Recording a player here does not submit that selection to Yahoo, ESPN, or Fantrax.
- **Show:** the **Support** button at the top of the site. Briefly open its destination without completing a payment.
- Donation appeal talking points:
  - Approximately **5,000 people used the dashboard last year**.
  - **Zero donations so far**, as of the creator's stated count; recheck before recording.
  - Reddit users have repeatedly asked how to support the work; this button is the practical answer.
  - The tool represents substantial time spent building, maintaining, troubleshooting, and improving it.
  - Invite a small thank-you if it saves preparation time, improves draft night, or simply feels like something worth supporting.
  - Keep the tone candid, lightly self-deprecating, and appreciative. Avoid treating past users as owing a debt.
  - Point to the same support link in the video description: https://www.buymeacoffee.com/tjsusername.
- Keep this appeal to about 45 seconds; then begin the promised walkthrough.

## 2. Get oriented before entering settings — 02:00–04:00

- **Show:** league label, season, Manual/Live Sync, Setup, Sources, Integrations, Summary, and the status indicator.
- Explain that Setup/Sources/Integrations are shortcuts into the relevant settings section.
- The season is a displayed context, not an arbitrary season picker. Check that projection and schedule notices match the intended draft season.
- The league selector's **Manage leagues…** entry opens integrations; do not present it as a completed multi-draft library.
- Briefly locate Available Players, Suggested Picks, Draft Graph, My Roster, and League Standings. Save their controls for their respective chapters.
- **Show on a narrow screen:** the mobile workspace tabs. They change which panel is visible without starting a different draft.
- Gather the exact team count, draft position, scoring rules, active/bench slots, keeper costs, traded picks, and playoff dates before setup.
- Open **Edit Settings** or **Open Full Setup**. Explain that the compact and full views edit the same configuration.

## 3. League format and custom draft styles — 04:00–07:00

- **Show:** League & Draft.
- Set Teams; the current editor accepts **2–40**.
- Choose **My Team** to identify your original draft slot. This drives your next-turn information and personalized analysis.
- Choose Points or Categories; explain the distinction briefly here, then configure the scoring in chapter 5.
- Leave Keeper League off for the ordinary example. Its full workflow follows after the roster and player pool exist.
- Demonstrate each draft-order mode with four illustrative teams, A–D:
  - **Standard:** A–B–C–D every round.
  - **Snake:** A–B–C–D, then D–C–B–A, then A–B–C–D.
  - **Custom:** each selected round runs in reverse; every unselected round runs forward relative to the original order.
- **Third-round reversal example:** choose Custom and reverse rounds **2, 3, 5, 7…**, if that is the league's rule. Round 4 goes forward. The important demonstration is that a selected round is explicitly reversed, not merely a switch from the preceding round.
- For any other reversal convention, copy the commissioner’s exact round directions; do not assume every league means the same thing by third-round reversal.
- Custom supports whole-round direction changes. It is not a free-form per-round team shuffle or auction editor.
- Complete team count and order **before adding trades, keepers, or picks**. Although some UI hints mention the first ordinary pick, the parent dashboard also blocks structural changes while keepers or trades exist.
- After setup, rename team labels on the Draft Graph or League Standings to match the room. Renaming does not move a team to a different draft slot.

## 4. Match the roster exactly — 07:00–10:00

- **Show:** Roster tab and its live roster total.
- **C/LW/RW:** use separate positional requirements when the league distinguishes center and wings.
- **FWD:** use a common forward pool when forwards can occupy interchangeable forward slots.
- Explain that a player's multiple eligible positions provide flexibility; they do not create multiple players or multiple simultaneous starts.
- Set defense, goalies, utility, and bench slots. Utility is a flexible skater slot; goalies do not fill utility.
- Bench increases roster capacity but does not add active lineup positions. That distinction will matter for DUST.
- Verify the Roster Summary against the provider before continuing. The total roster size supplies the dashboard's round count; there is no separate arbitrary round-count field in this setup.
- Current editor limits, useful for unusually deep leagues: C/LW/RW up to 6 each; FWD 18; D 8; G 4; utility 2; bench 10.
- **Edge cases:** do not invent active positions to represent IR, taxi squads, minors, or salary rules. Those mechanisms are not fully modeled by these controls. Track unsupported rules externally and explain that valuations may not capture them.
- Do not pad the bench simply to force extra rounds unless that is genuinely the league's drafted roster size.

## 5. Configure scoring before trusting rankings — 10:00–13:30

- **Show:** Scoring, including both Skaters and Goalies.
- Points leagues:
  - Enter the provider's exact points for each event, including negative values where applicable.
  - **On-screen formula:** projected fantasy points = sum of each projected statistic × its point value.
  - Simple example: 30 goals × 3 points + 40 assists × 2 points = 170 points from those two categories; the remaining enabled stats add or subtract their contributions.
  - Avoid adding both a combined statistic and its components unless the league intentionally awards both.
- Categories leagues:
  - Add the actual categories used by the league; remove categories that do not count.
  - Equal weights give equal emphasis; changing a weight expresses a stronger or weaker preference in the dashboard's valuation.
  - Explain the current calculation in everyday terms: compare a player with other players of the same role in each category, express how far above or below typical they are, then combine those advantages using the chosen weights.
  - Lower GAA, goals against, and goalie losses are treated as favorable by the category scoring function; do not automatically enter negative weights just to reverse them again.
  - Goalie rate estimates are pulled toward average more strongly for small workloads, so a tiny projected sample does not look unrealistically dominant.
  - A category score is a comparison tool, not fantasy points or a predicted number of weekly categories won.
- **Show:** add-category selector, numeric weight, and Manage/remove controls; verify both goalie and skater sections.
- Finish Editing closes the category-management controls. Scoring reset controls restore their defaults; check the resulting categories again rather than assuming they match the league.
- Changing scoring recalculates values and standings; it does not erase completed selections.
- **Presenter accuracy note:** some current tooltips describe Score as a 0–100 percentile/scarcity composite. The current VORP value calculation uses a weighted standardized score instead. Do not repeat the 0–100 explanation as fact.

## 6. Choose projections and import your own — 13:30–18:00

- **Show:** Projections tab, skater sources, and goalie sources separately.
- Each source checkbox includes or excludes that source from the blend. It does not draft or remove a player from the league.
- **Weights:** specify the source's relative share. **Multipliers:** express relative influence as numbers. Both determine a normalized blend; a multiplier does not multiply a player's final fantasy score directly.
- **Edit Weights / Finish Editing:** enter and exit weight editing. **Show/Hide disabled sources:** reveals sources that are currently excluded so they can be enabled again. **Normalize Weights:** rescales the selected sources into proportional shares; it does not make every source equal.
- In percentage editing, changing one source redistributes the remaining share across the other selected sources. Inspect the entire group after a change.
- **Simple example:** two equally weighted sources projecting 30 and 40 goals produce 35. A 75%/25% blend produces 32.5.
- Available coverage matters: a player/stat can lack data in a source. Do not imply every row receives every advertised source's contribution or that missing always means zero.
- Treat skater and goalie source balances independently. Watch the weight summaries and validation messages; an enabled source with no meaningful contribution is not useful.
- Source changes can move rankings. The rank-change marker helps identify a move caused by the projection blend, rather than a new pick.
- **Show one CSV import from beginning to end:**
  - Open **Import CSV**, select/drop the file, and inspect the preview.
  - Confirm the player identifier/name column and map headers to recognizable statistics.
  - The **include-column** checkboxes keep or omit individual imported columns.
  - **Allow name fallback when player IDs are missing:** attempts matching through player names; convenient, but ambiguous names need review.
  - Resolve an ambiguous name manually using the offered player choices; inspect team/position to avoid selecting the wrong person.
  - **Minimum coverage:** the minimum acceptable share of matched rows, not a measure of projection quality.
  - **Require full mapping (100% coverage):** demand complete mapping rather than accepting partial matches.
  - **Enable anyway:** explicitly permits proceeding past an unresolved/low-coverage warning; it does not repair those rows. With fallback disabled, unresolved rows will not project.
  - Give the source a recognizable name, then Confirm Import.
  - Return to Projections and verify that the custom source is enabled and has the intended influence. Spot-check one player and one statistic.
- Show reimport/removal briefly; removing an imported source preserves draft picks but changes the data used to value them.
- Distinguish CSV projections from draft bookmarks: one supplies player forecasts; the other restores draft configuration/progress. Keep original CSV files for recovery.
- **My Rank, if present:** comes from the user's separate personal draft ranking. It is not simply the current projection rank and does not get renumbered every time another player is drafted.

## 7. Trades, keepers, and unusual league formats — 18:00–23:30

- Return to League & Draft now that team structure and player data are configured.
- Enable **Keeper League** to expose **Keepers & Traded Picks**. In the current UI, a redraft league with pick trades also needs this switch to reveal trade management; it can leave the keeper list empty.

### Traded picks — finish ownership before entering keeper costs

- Open **Manage Trades**; enter round, pick **within that round**, and new owner.
- **On-screen notation:** overall pick = (round − 1) × team count + pick in round. Example: round 3, pick 2 in a 12-team league is overall pick 26.
- This is the chronological pick position, not the original owner's team number. In a reversed round, ownership runs in the opposite direction.
- Demonstrate a two-sided exchange by entering both affected picks. A single ownership override does not automatically record the other half of a trade.
- Verify original owner and new owner in the manager and Draft Graph. The next-turn calculation should follow the adjusted ownership.
- Show editing/removing a trade; to restore original ownership, remove the override.
- Bulk input accepts JSON or CSV with **round, pickInRound, currentTeamId**. Use actual internal team IDs rather than assuming renamed display labels are interchangeable.
- Completed ordinary picks cannot be traded through this control; use the correction workflow for a mistaken completed selection.

### Keepers

- Select the player from autocomplete, choose the fantasy team, and select the cost type.
- **Costs a pick:** choose the actual round and pick-in-round being forfeited; add the keeper and show its board marker.
- **No pick cost:** assign the player without consuming a particular draft square. It still uses roster capacity and appears in the No-Pick Keepers list.
- Add keepers for **all teams**, because the available pool and upcoming turns depend on the whole league.
- Unequal keeper counts are allowed conceptually: a team with no-pick keepers reaches its roster limit sooner, and full-roster turns are skipped. Do not manually draft extra players into already full teams.
- No-pick keepers must be established before ordinary drafting locks that structure.
- Bulk input accepts **playerId, teamId, cost, round, pickInRound**. Use `pick` or `none` for cost; leave round/pick empty for no-pick keepers.
- Show feedback for duplicate players, occupied keeper picks, invalid rounds, and completed picks rather than silently proceeding.
- A keeper assigned to a traded pick can retain the keeper's displayed forfeited-pick ownership; the trade takes effect if that keeper is removed. Read the conflict warning and verify the commissioner’s intended result.
- Remove assigned keepers before switching Keeper League off. Reset Entire Draft also removes keepers and trades, so export a backup first.

### Supported combinations and honest boundaries

- Redraft: ordinary roster and scoring, no keepers.
- Keeper/dynasty redraft portion: assign retained players first, then track the remaining selections. Contract values, prospect eligibility, salaries, and future-year assets require outside tracking.
- Traded picks plus snake/custom reversals: enter final order first, then overrides, then keeper costs; verify the resulting graph.
- FWD, multi-position, utility, and goalie-heavy formats: supported only within the editor's real slots and limits.
- Auctions, arbitrary changing team permutations, unlimited/deep rosters beyond the limits, and special league rules do not become fully supported merely by choosing Manual. Present manual tracking only to the extent its pick/roster model fits.

## 8. Playoff weeks, integrations, and finishing setup — 23:30–26:00

- **Show:** Playoff Weeks in League & Draft.
- Select the actual matchup weeks using the displayed date ranges. Hold Command/Ctrl for separate selections; choose the full playoff period, not just the championship week.
- These are Yahoo matchup-week/date definitions. For other providers, check date alignment rather than matching week numbers blindly.
- Above Available Players, switch **Schedule period** between Season and Playoffs. Playoffs is unavailable until valid weeks are selected; clearing playoff weeks returns the scope to Season.
- Explain now that this changes schedule counts/analysis for the chosen period. It does not turn season projections into a complete playoff-only fantasy forecast.
- **Show:** Integrations & Live Sync.
  - Connected league settings can reduce manual entry; always review imported teams, roster, scoring, and warnings before drafting.
  - Fantrax's settings application is distinct from automatic pick tracking.
  - ESPN has settings/live-sync code for supported straight or snake formats with complete pick order. Demonstrate only with a functioning connection; auction/offline/incomplete formats cannot be advertised as live-sync supported.
  - Yahoo league/live sync is **parked pending actual API access**, per Chef. September 11 is a readiness check, not a release promise. Use the manual workflow for the main tutorial.
  - **Conditional future live demonstration:** choose a supported league, start sync, inspect last update/pick count, use Sync now, and stop/continue manually if needed. Active sync owns the draft state and can disable manual editing. It reads picks; it is not automatic drafting into the provider.
- Select **Done**. Show green/valid summaries and fix any highlighted section before moving on. Save errors must be addressed, not dismissed as a successful save.

## 9. Read player value: VORP, VONA, VBD — 26:00–30:00

- Introduce all three before using them as sort options or explaining recommendations.
- **VORP — Value Over Replacement Player:** how much more value a player offers than the position's estimated replacement option.
  - Example: 250 projected points versus a 180-point replacement = **70 VORP**.
  - Replacement depth comes from league size, starting slots, and a utility adjustment. Deeper leagues change the comparison.
  - In categories, the same subtraction uses category-value scores, not fantasy points.
  - Negative VORP means below the chosen comparison level; it does not mean the player scores negative fantasy points.
- **VONA — Value Over Next Available:** estimated cost of waiting until your next turn.
  - Example: a 250-point player compared with a projected 230-point alternative after intervening picks = **20 VONA**.
  - The dashboard uses available players' ADP and the number of intervening picks to estimate how far each position may be depleted. Multi-position players split their expected positional contribution.
  - It is a draft-room estimate, not knowledge of opponents' intentions. Missing ADP and unusually aggressive position runs can weaken it.
- **VOLS — Value Over Last Starter:** comparison with the last estimated starting-caliber player. Briefly define it because it contributes to VBD and appears in baseline details.
- **VBD — Value Based Drafting:** this dashboard's combined value measure.
  - **On-screen formula:** VBD = 60% VORP + 30% VONA + 10% VOLS.
  - Example: VORP 70, VONA 20, VOLS 50 produces **53 VBD**.
  - A balance of positional advantage and the possible cost of waiting; not a guaranteed draft grade.
- A multi-position player is evaluated across eligible positions; the calculation chooses its best positional comparison. It does not add every positional VORP together.

## 10. Available Players and Advanced Settings — 30:00–35:00

- **Show:** search, position filters, sortable headings, and page controls. Search may appear empty because other filters remain active.
- Explain identity/eligibility, ADP, projected points or category Score, VORP/VONA/VBD, and **AVL%**.
- ADP is average draft position; lower means typically selected earlier. AVL% estimates whether the player lasts to your next pick. A 90% display is not a guarantee.
- **Favorites:** star a player, then toggle Favorites only to create a shortlist. A star does not protect the player from another team drafting them.
- **Stat columns:** switch between the compact value view and individual projected statistics; useful for diagnosing what drives a ranking.
- **Hide drafted:** removes selected players from view; turning it off is for inspection, not permission to draft someone twice.
- **Comparison checkboxes:** select players, open Compare, inspect the two-player comparison, close, and clear selections. Do not promise an unlimited multi-player comparison even if a label suggests 2+ selections.
- In Compare, use the radar shapes for a quick strengths/weaknesses overview, then read individual stat advantages and the per-game table for detail. Any overall winner label reflects the comparison's average-percentile method, not guaranteed suitability for your roster; volume and per-game production answer different questions.
- **My Rank, if available:** sort your saved personal order independently of the model's ranking.
- Briefly identify OFF and B2B as schedule counts; their exact meaning follows in chapter 13.
- Open the table's **⋯** tools:
  - **84G Prorate** in the current build: displays skater counting statistics/fantasy production at a full-season pace; asterisks mark prorated values. Concept: projected statistic ÷ projected games × displayed season length.
  - Useful for comparing production rates; it can hide differences in expected availability. It does not promise that an injury-prone player will play a full season or prorate goalie starts the same way.
  - **Info/legend:** inspect data freshness and coverage warnings, not just colors.
- Open **Advanced Settings** and cover every control:
  - **Value Band Scope — Per Position / Overall:** changes the comparison group for color bands. Green is the top 30%, yellow the middle 40%, red the bottom 30%; these are relative tiers.
  - **VORP Baseline — Remaining / Full Pool:** remaining uses undrafted players for replacement comparisons; full pool includes the original full player pool. The same player can change VORP as the remaining pool changes.
  - **Need Weighting — Enabled:** changes recommendation scoring to favor useful roster/category fits.
  - **Strength α, 0–1:** controls that extra influence. Formula for presenter reference: base recommendation value × (1 + α × normalized fit). At α = 0.5 and maximum fit, positive base value receives a 50% increase before the separate availability adjustment.
  - **Risk Model SD, 2–40 picks:** controls how loosely the availability estimate spreads around ADP. Lower values assume picks cluster tightly near ADP; higher values express more uncertainty. Leave the default for a first draft.
  - **Diagnostics — Show Excluded:** exposes exclusion information to investigate missing players; it does not automatically include them.
  - **Cross-check Sources:** checks source coverage to help identify players present in source data but missing from the table.
  - **Replacement Baselines:** read-only positional comparison values used by VORP/VOLS; useful for explaining why a position looks scarce.
- **Presenter caveat:** the table's risk slider and Suggested Picks do not have a clear same-tab update connection in the inspected code; Suggested Picks listens for a browser storage event. Do not promise both panels immediately change together when moving that slider.

## 11. Suggested Picks: what every checkbox really does — 35:00–39:30

- **Show:** recommendations for the configured league before and after a roster becomes partly filled. Prepared examples avoid spending minutes entering picks.
- **Rank:** the recommendation score, not a raw ADP rank or necessarily the table's current order.
- Presenter formula note: the starting recommendation combines **70% VBD + 30% VONA**. Advanced need weighting can modify it, and ADP-based risk of losing a player can add urgency. No need to narrate all coefficients after explaining the concept.
- Walk through position filter, sort field, ascending/descending button, and Top 5/10/12/16/20. For lower-is-better fields such as ADP/My Rank, use ascending order.
- Sort choices: Rank, My Rank when available, VORP, VBD, Proj FP, Avail %, and Cat Fit. In points mode the fit calculation is positional even though the menu still says Cat Fit.

### Need weight checkbox on the cards

- **Unchecked:** show the ordinary calculated VORP.
- **Checked:** scale the card's VORP by how much room remains at the player's eligible positions.
- **On-screen formula:** adjusted VORP = VORP × [0.25 + 0.75 × average positional need]. Need is open slots ÷ total slots.
- Example with 100 VORP: no slots filled → 100; half the slots open → 62.5; all relevant slots filled → 25.
- Explain the purpose: make the VORP display less enthusiastic about a position already stocked.
- This affects displayed card VORP and **VORP sorting**. It does **not** itself change the base recommendation Rank score, VBD, or the underlying table VORP values.
- Distinguish it explicitly from **Advanced Settings → Need Weighting**, which changes recommendation scores. Similar labels currently describe different controls.
- For negative VORP, the multiplier pulls the number closer to zero; it is not a universal ranking penalty. Use it alongside the underlying value.

### Personalized checkbox

- **Unchecked:** replacement depth uses the configured starters per team without subtracting your filled slots.
- **Checked:** subtract your filled positional slots when choosing replacement depth, making the baseline more demanding at positions you have filled.
- Simple internal example: 12 teams × 2 centers suggests a replacement around center 25 before utility adjustments. With one of your center slots filled, personalized depth becomes roughly center 13.
- This recalculates the underlying replacement comparisons, so VORP, VOLS, VBD, and related recommendations can move. It is more than a cosmetic card toggle.
- It uses **your** filled slots as the personalization input; it does not reconstruct each opponent's exact willingness to draft another center.
- Both checkboxes can be enabled, but teach them one at a time so viewers see their different effects.

### Roster checkbox and card actions

- Under expanded controls, **Roster** shows/hides the positional progress bar; it does not change roster rules or recommendations.
- Click roster progress segments to filter positions; clear them to return to a broad view. Multiple selected positions can continue filtering even after changing the dropdown.
- **Show/Hide cards** and the advanced-controls expander only change presentation.
- Select a card to inspect it, use Compare to add it to comparison, and use Draft only for the team currently on the clock.
- Category fit currently considers deficits against league-average totals in six skater categories: goals, assists, power-play points, shots, hits, and blocks. Do not present it as complete optimization of every custom or goalie category, weekly matchup odds, or punting strategy.

## 12. Run the live manual draft — 39:30–44:00

- Return to the main example and demonstrate **three consecutive picks**, including an opponent's pick and your own.
- For each pick: check the provider's actual selection → check the dashboard's team on the clock → find the player → record the selection → verify the graph and roster update.
- Use either the Suggested Picks Draft button or **My Roster → Add a player to the team on the clock**.
- Stress that viewing another roster does not redirect the next pick to that roster. The add-player button names the actual receiving team.
- **Draft Graph:** current round/pick, next pick, picks until your turn, selected players, keeper badges, traded ownership, and full-roster skips. Hover/focus the relevant square for details.
- **My Roster:** choose a team to inspect; use My Team to return. Review open slots, bench, roster needs, and totals.
- Use eligible slot assignment controls to adjust a multi-position player's placement where available. This organizes the dashboard roster; it does not submit a provider lineup.
- **League Standings:** switch between projected points/category totals and Team VORP, sort headings, and compare category strengths/weaknesses. Read goalie ratios as ratios, not counting stats to add together.
- These are projected draft comparisons, influenced by team size and current baseline settings. A leading incomplete roster is not a forecast of a league championship.
- Optional shortcut overlay after the mouse workflow is clear: C show/hide suggestion cards; P roster bar; F cycle suggestion sort; T suggestion count; O sort direction; R card VORP need adjustment; D draft the selected suggestion. Shortcuts are suppressed in text-entry contexts.

## 13. DUST, schedule fit, and the matrix — 44:00–50:00

- **DUST = Daily Unstartable Schedule Tax.** In fantasy hockey, a scheduled NHL game provides no usable lineup opportunity if every eligible active slot is already occupied.
- Example: five rostered forwards play tonight but the league has only three compatible available forward slots. Some games must sit on the bench; tomorrow's empty NHL schedule cannot recover them.
- The model checks the actual daily schedule and eligible lineup slots to find startable combinations. It handles multi-position flexibility; it does not simply assume all busy-night games are wasted.
- **On-screen notation:** Bench Games = Scheduled Games − Active Games under the model's lineup assignment.
- **Roster DUST rate:** Bench Games ÷ Scheduled Games. Lower means a larger share of the scheduled opportunities can fit into the lineup.
- **Candidate DUST +X:** the additional bench-game burden when a candidate is added to the existing roster. Some displaced games can belong to existing players; X is not necessarily the candidate's personal bench count.
- **Active Games Added:** the increase in startable games after adding that candidate. Example: 10 extra scheduled opportunities and 3 additional bench games produce 7 active games added.
- **Strong drafting guidance:** draft for player quality, scoring fit, role, and value first. Use DUST as a **tiebreaker between otherwise comparable players**, especially as the bench fills. Do not pass on a substantially better player just to chase a prettier schedule.
- Explain why fewer bench games can help: more opportunities to collect points/categories from the roster already drafted. More opportunities are not automatically more production than an elite player's fewer starts.
- **OFF:** scheduled NHL player opportunities on dates with **at most eight NHL games** in the current implementation. This is a schedule definition, not merely Monday/Wednesday/Friday.
- **B2B:** consecutive-day NHL game pairs, counted on the second day. Useful schedule context, especially around goalie workload questions; not a guarantee a goalie starts either game.
- Season/Playoffs changes the period under consideration. Tie the selected dates back to chapter 8 rather than reopening the entire setup explanation.

### Read the matrix

- **Current workspace:** expand DUST dashboard under your roster. Player rows intersect Yahoo matchup-week columns; Previous/Next weeks pages through four weeks at a time.
- An empty diamond represents zero bench games; larger/brighter filled diamonds mean more unstartable games. Lower is better here, even when a brighter mark attracts attention.
- Select, hover, or keyboard-focus a diamond to see the player, week dates, scheduled games, startable games, and benched games. The weekly footer totals the bench games.
- Read across a player to locate crowded weeks; read down a week to locate the roster's trouble spots.
- A blank/unavailable state is not zero DUST. Missing schedules, unknown teams, unresolved eligibility, or stale data must be acknowledged.
- **Conditional Chef version:** Chef's newer local matrix uses all 27 Yahoo weeks, a diagonal overview plus exact details, playoff highlights, and explicit unavailable teams. Film that layout only when it is integrated into the demonstrated build; do not combine navigation instructions from the two versions.

### Model limits

- DUST currently models **daily** lineup assignment; weekly-lock leagues are not supported by that calculation.
- NHL team games are opportunities, not individual appearances. Injuries, scratches, goalie starts, postponements, and league-specific transaction rules can change actual results.
- The model aims to fit scheduled games into slots; do not describe every suggested bench assignment as the best fantasy-points lineup or a command to bench that named player.
- Missing/stale/mismatched season data can make insights unavailable or unreliable. Show the warning instead of substituting zero.
- A suggested lower-DUST alternative still needs a player-value comparison. The schedule explanation is complete only after showing both the improvement and the talent/value tradeoff.

## 14. Corrections, saving, restoring, and exports — 50:00–54:30

- **Undo Last Pick:** rewind the latest recorded manual pick; demonstrate immediately after a deliberate recent mistake.
- **Pick Correction:** replace a completed ordinary manual pick without rewinding subsequent picks. Select the erroneous pick and correct player; verify that later selections stay in place. This is not the keeper editor.
- **Reset Entire Draft:** clears selections, keepers, traded picks, positional overrides, and draft history. Use only for a true restart; show the confirmation but do not destroy the main example.
- **Reset Settings:** returns league/roster/scoring/source configuration toward defaults while preserving completed picks and blocking incompatible structural changes. It is a different action from resetting the draft.
- **Local autosave/resume:** show a reload and resume in the same browser/tab context. Some preferences/progress use local storage, while the richer snapshot and custom-source session use tab-scoped storage.
- Do not promise that browser autosave is account backup, survives every storage-clearing action, or transfers imported CSV data to another device.
- **Settings Export / Import bookmark:** save the bookmark key/exported configuration, then show where to paste the key/JSON or select a JSON/text file to restore it. Resolve compatibility or missing-source warnings before accepting the result.
- Keep original custom CSV files. Existing bookmark restoration can require matching locally available custom sources; a bookmark is not a promise that private source rows travel with it.
- **Export CSV:** downloads blended player projections; it is a different artifact from a draft bookmark or summary image. Chef intends this to be Pro in the upcoming release; reflect the demonstrated build's access rules.
- Retain a pre-draft backup and another at a useful checkpoint. Returning to a previously exported state is different from undoing a single pick.
- **Conditional Saved Drafts:** do not demonstrate cloud saving until the feature is released and verified. Chef's current work targets named account saves, imported-source restoration, favorites, notes/tiers, autosave, and conflict handling; panel integration and cross-device verification were still pending at handoff.
- If that feature ships before filming, insert its complete save → named entry → reopen on another device → verify imported rows → handle a version conflict flow here. Do not substitute a local refresh for proof of cross-device recovery.

## 15. Finish the draft and troubleshoot — 54:30–57:30

- Open **Summary** after reviewing the final roster.
- Show **Recap** versus **Roster** views, configuration summary, keepers/trades, highlights, leaderboard, and **Download PNG**.
- Present any winner/highlight labels as model-based commentary. They are not a guarantee, especially if scoring, sources, or replacements change.
- Troubleshooting, in this order:
  - Missing player: clear position/favorites/drafted filters, search again, check the selected source and CSV identity mapping, then use diagnostics/source cross-check.
  - Strange rankings: check Points/Categories, point values/category weights, roster requirements, source shares, prorating, replacement mode, and need controls.
  - Wrong team receiving picks: verify My Team versus team on the clock, custom order, traded ownership, and keeper costs.
  - Disabled editing: inspect live-sync authority and structural locks before assuming the UI is broken.
  - No playoff option: select valid matchup weeks and wait for the correct season's week data.
  - No DUST/matrix: ensure there are rostered players and complete matching schedule/eligibility data; unknown is not zero.
  - Stale projections: use **Refresh Data**. This does not guarantee that an upstream publisher has released new projections or that the separate schedule cache was refreshed.
  - Resume/import problem: preserve original files and backup, read the exact error, and report the affected action rather than repeatedly resetting.
- Be explicit that Yahoo sync remains unavailable until access and release verification are complete. Do not tell viewers to keep clicking Connect in anticipation of a calendar date.

## 16. Close with a useful checklist and support reminder — 57:30–59:00

- **Show the finished example while checking:** correct league/scoring/roster; correct draft direction; all keeper costs and traded picks; matching season and playoff dates; understandable projection sources; saved backup.
- Reinforce the practical decision order: player quality and league value → roster/category needs and cost of waiting → DUST as a close-call tiebreaker.
- Encourage a short practice run before draft night, including one correction and one restore.
- Return to the **Support** button and description link. Invite viewers who found the tool helpful, interesting, or worth maintaining to leave a small thank-you.
- Reference the 5,000-users/zero-donations context only if still accurate; keep this reminder shorter than the opening appeal.
- Invite specific feedback and bug reports with league format, action taken, and visible error, without exposing private league credentials.

## Release appendix — presenter reference, not an extra chapter

- Chef confirmed the manual draft, keepers, trades, scoring/source controls, local CSV import, local autosave/bookmarks, favorites, existing comparison, basic suggestions, undo, and basic summary are intended to remain available in the free workflow.
- Chef's initial **local/unreleased** Pro work includes roster-needs recommendations/advanced replacement analysis, DUST candidate insights and schedule-fit sorting, and aggregate CSV export. Do not claim those paywalls already exist in the original workspace.
- Proposed purchase implementation: one-time **$5.99 for 2026–27**, access through **June 30, 2027 Eastern**, no renewal; independently active paid Patreon is another entitlement path. Payment/provider activation is still gated. Verify launch terms before mentioning a price in a published video.
- Keep optional donations, Patreon membership, and a Pro purchase clearly distinguished. Do not imply the Buy Me a Coffee donation automatically unlocks Pro.
- Saved Drafts under review: planned limits of 10 drafts, 10 MiB per draft/100 MiB per account, approximately two-second cloud autosave, and conflict recovery. These are implementation targets at handoff, not current tutorial promises.
- Scenarios and analytical reports are queued, not implemented. Keep them out of the present walkthrough; if released, insert them after drafting/DUST and before final recap, with a new time allowance.
- Chef states expiry should preserve saved data/names while locking premium payload access; the free local workflow continues. Verify released behavior before demonstrating it.

## Evidence map and verification scope

- Entry/composition/state: `web/pages/draft-dashboard.tsx`; `web/components/DraftDashboard/DraftDashboard.tsx`.
- Setup and scoring: `DraftSettings.tsx`, `DraftSettingsShell.tsx`, `DraftScoringSettings.tsx`, `ProjectionSourceSettings.tsx`, `ImportCsvModal.tsx` in `web/components/DraftDashboard/`.
- Pick structure: `web/lib/draftDashboard/draftOrder.ts`, `pickTrades.ts`, `keepers.ts`; `ManageTradesModal.tsx` and `QuickFixModal.tsx`.
- Value calculations: `web/hooks/useVORPCalculations.ts`, `web/hooks/usePlayerRecommendations.ts`, `web/lib/scoring/categoryScores.ts`.
- Player/recommendation controls: `ProjectionsTable.tsx`, `SuggestedPicks.tsx`, `ComparePlayersModal.tsx`.
- Draft/roster/recap: `DraftBoard.tsx`, `DraftStatus.tsx`, `MyRoster.tsx`, `LeagueStandings.tsx`, `DraftSummaryModal.tsx`, `MobileDraftTabs.tsx`.
- Schedule: `DustMatrix.tsx`, `web/hooks/useRosterScheduleOptimizer.ts`, `web/hooks/useDraftSchedule.ts`, `web/lib/draftDashboard/scheduleMetrics.ts`.
- Integrations: `YahooLiveDraftPanel.tsx`, `EspnLiveDraftPanel.tsx`, `FantraxLeagueSettingsPanel.tsx`, and the parent dashboard wiring.
- Donation destination: `web/components/Layout/Header/Header.tsx`.
- Verified by targeted source inspection and direct Chef consultation. No application code was changed, no runtime/browser walkthrough was executed, and no live provider/payment flow was tested for this outline.
