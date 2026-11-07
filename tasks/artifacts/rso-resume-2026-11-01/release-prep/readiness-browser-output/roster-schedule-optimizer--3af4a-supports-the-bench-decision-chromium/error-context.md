# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roster-schedule-optimizer.spec.ts >> mixed Kaprizov coverage stays unresolved until complete evidence supports the bench decision
- Location: e2e/roster-schedule-optimizer.spec.ts:761:5

# Error details

```
Error: locator.focus: Error: strict mode violation: getByRole('button', { name: 'Confirm planning inputs', exact: true }) resolved to 2 elements:
    1) <button>Confirm planning inputs</button> aka getByLabel('Roster and setup').getByRole('button', { name: 'Confirm planning inputs' })
    2) <button type="button">Confirm planning inputs</button> aka getByLabel('Candidates and detail').getByRole('button', { name: 'Confirm planning inputs' })

Call log:
  - waiting for getByRole('button', { name: 'Confirm planning inputs', exact: true })

```

# Page snapshot

```yaml
- generic:
  - generic [ref=e1]:
    - banner [ref=e2]:
      - link "FHFH home" [ref=e3] [cursor=pointer]:
        - /url: /
        - img "FHFH" [ref=e4]
        - generic [ref=e5]: Hockey Analytics
      - navigation "Primary navigation" [ref=e6]:
        - list [ref=e7]:
          - listitem [ref=e8]:
            - link "Home" [ref=e9] [cursor=pointer]:
              - /url: /
          - listitem [ref=e10]:
            - link "Game Grid" [ref=e11] [cursor=pointer]:
              - /url: /game-grid
          - listitem [ref=e12]:
            - link "Underlying Stats" [ref=e13] [cursor=pointer]:
              - /url: /underlying-stats
          - listitem [ref=e14]:
            - button "Analytics" [ref=e15] [cursor=pointer]:
              - text: Analytics
              - img [ref=e16]
          - listitem [ref=e18]:
            - button "Tools" [ref=e19] [cursor=pointer]:
              - text: Tools
              - img [ref=e20]
          - listitem [ref=e22]:
            - link "Blog" [ref=e23] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e24]:
            - button "Community" [ref=e25] [cursor=pointer]:
              - text: Community
              - img [ref=e26]
      - generic [ref=e28]:
        - button "Search players" [ref=e29] [cursor=pointer]:
          - img [ref=e30]
        - link "Buy me a coffee" [ref=e32] [cursor=pointer]:
          - /url: https://www.buymeacoffee.com/tjsusername
          - img "Buy me a coffee" [ref=e33]
        - button "Sign In / Sign Up" [ref=e34] [cursor=pointer]
    - main [ref=e35]:
      - generic [ref=e37]:
        - group "Planning command bar" [ref=e38]:
          - heading "Roster Schedule Optimizer" [level=1] [ref=e39]
          - group "League and week" [ref=e40]:
            - button "Manual roster Choose source and dates" [ref=e41] [cursor=pointer]:
              - generic [ref=e42]: M
              - generic [ref=e43]:
                - strong [ref=e44]: Manual roster
                - generic [ref=e45]: Choose source and dates
            - generic [ref=e46]:
              - button "Planning setup · Mon, Oct 5 – Wed, Oct 7" [ref=e47] [cursor=pointer]: Mon, Oct 5 – Wed, Oct 7
              - button "Current week" [ref=e48] [cursor=pointer]
              - generic [ref=e49]: Saved range retained. Current week Mon, Sep 21 – Sun, Sep 27 · Mon–Sun fallback; league matchup dates unverified
          - generic [ref=e50]:
            - generic [ref=e51]: Player search
            - searchbox "Search candidate players" [ref=e52]
          - group "Workspace actions" [ref=e55]:
            - button "Undo" [disabled] [ref=e56]
            - generic [ref=e57]: No edits to undo.
            - button "Matchup" [ref=e58] [cursor=pointer]
          - group [ref=e59]:
            - generic "Settings and tools" [ref=e60] [cursor=pointer]:
              - generic [ref=e61]: ☰
        - generic [ref=e62]:
          - region "Roster and setup" [ref=e63]:
            - generic [ref=e64]:
              - heading "Current Roster" [level=2] [ref=e65]:
                - generic [ref=e66]: "1"
                - text: Current Roster
              - generic [ref=e67]: 3 players
              - button "About roster metrics and protection" [ref=e68] [cursor=pointer]:
                - generic [ref=e69]: ⓘ
            - generic [ref=e70]:
              - group [ref=e71]:
                - generic "Add or import roster" [ref=e72] [cursor=pointer]
              - group "Current Roster views" [ref=e73]:
                - button "Players" [pressed] [ref=e74] [cursor=pointer]
                - button "Bench days" [ref=e75] [cursor=pointer]
              - generic [ref=e76]:
                - generic [ref=e77]: Player · range
                - generic [ref=e78]:
                  - generic [ref=e79]: GP
                  - generic [ref=e80]: AGP
                  - generic [ref=e81]: DUST
                  - generic [ref=e82]: Pts
                - generic [ref=e83]: Protect
                - generic [ref=e84]: More
              - generic [ref=e85]:
                - button "Kirill Kaprizov MIN · LW" [ref=e86] [cursor=pointer]:
                  - generic:
                    - generic: Kirill Kaprizov
                    - generic:
                      - generic: MIN · LW
                - group "Kirill Kaprizov range contribution" [ref=e87]:
                  - generic "Review Kirill Kaprizov daily contribution evidence" [ref=e88] [cursor=pointer]:
                    - generic [ref=e89]:
                      - 'generic "Remaining GP: 1" [ref=e90]':
                        - generic [ref=e91]: Remaining GP
                        - strong [ref=e92]: "1"
                      - 'generic "AGP: 1" [ref=e93]':
                        - generic [ref=e94]: AGP
                        - strong [ref=e95]: "1"
                      - 'generic "DUST/bench: 0" [ref=e96]':
                        - generic "Evaluated bench games" [ref=e97]: DUST
                        - strong [ref=e98]: "0"
                      - 'generic "Active points: 9" [ref=e99]':
                        - generic [ref=e100]: Active points
                        - strong [ref=e101]: "9"
                - generic "Protect from drops" [ref=e102]:
                  - checkbox "Protect Kirill Kaprizov" [ref=e103]
                  - generic [ref=e104]: Protect Kirill Kaprizov
                - group [ref=e105]:
                  - generic "Manage Kirill Kaprizov" [ref=e106] [cursor=pointer]: ⋯
                  - option "Active"
                  - option "Bench" [selected]
                  - option "IR"
                  - option "IR+"
                  - option "NA"
                  - option "Unknown"
                  - option "Manager confirms yes" [selected]
                  - option "No"
              - generic [ref=e107]:
                - button "Matthew Knies TOR · LW DROP Ownership unknown. Demand from other managers isn't checked." [ref=e108] [cursor=pointer]:
                  - generic:
                    - generic: Matthew Knies
                    - generic:
                      - generic: TOR · LW
                      - generic [ref=e109]:
                        - emphasis [ref=e110]: DROP
                        - generic "Ownership unknown. Demand from other managers isn't checked." [ref=e111]:
                          - generic [ref=e112]: "?"
                          - generic [ref=e113]: Ownership unknown. Demand from other managers isn't checked.
                - group "Matthew Knies range contribution" [ref=e114]:
                  - generic "Review Matthew Knies daily contribution evidence" [ref=e115] [cursor=pointer]:
                    - generic [ref=e116]:
                      - 'generic "Remaining GP: 1" [ref=e117]':
                        - generic [ref=e118]: Remaining GP
                        - strong [ref=e119]: "1"
                      - 'generic "AGP: 0" [ref=e120]':
                        - generic [ref=e121]: AGP
                        - strong [ref=e122]: "0"
                      - 'generic "DUST/bench: 1" [ref=e123]':
                        - generic "Evaluated bench games" [ref=e124]: DUST
                        - strong [ref=e125]: "1"
                      - 'generic "Active points: 0" [ref=e126]':
                        - generic [ref=e127]: Active points
                        - strong [ref=e128]: "0"
                - generic "Protect from drops" [ref=e129]:
                  - checkbox "Protect Matthew Knies" [ref=e130]
                  - generic [ref=e131]: Protect Matthew Knies
                - group [ref=e132]:
                  - generic "Manage Matthew Knies" [ref=e133] [cursor=pointer]: ⋯
                  - option "Active"
                  - option "Bench" [selected]
                  - option "IR"
                  - option "IR+"
                  - option "NA"
                  - option "Unknown"
                  - option "Manager confirms yes" [selected]
                  - option "No"
              - generic [ref=e134]:
                - button "Drake Batherson OTT · RW" [ref=e135] [cursor=pointer]:
                  - generic:
                    - generic: Drake Batherson
                    - generic:
                      - generic: OTT · RW
                - group "Drake Batherson range contribution" [ref=e136]:
                  - generic "Review Drake Batherson daily contribution evidence" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]:
                      - 'generic "Remaining GP: 1" [ref=e139]':
                        - generic [ref=e140]: Remaining GP
                        - strong [ref=e141]: "1"
                      - 'generic "AGP: 1" [ref=e142]':
                        - generic [ref=e143]: AGP
                        - strong [ref=e144]: "1"
                      - 'generic "DUST/bench: 0" [ref=e145]':
                        - generic "Evaluated bench games" [ref=e146]: DUST
                        - strong [ref=e147]: "0"
                      - 'generic "Active points: 5" [ref=e148]':
                        - generic [ref=e149]: Active points
                        - strong [ref=e150]: "5"
                - generic "Protect from drops" [ref=e151]:
                  - checkbox "Protect Drake Batherson" [ref=e152]
                  - generic [ref=e153]: Protect Drake Batherson
                - group [ref=e154]:
                  - generic "Manage Drake Batherson" [ref=e155] [cursor=pointer]: ⋯
                  - option "Active"
                  - option "Bench" [selected]
                  - option "IR"
                  - option "IR+"
                  - option "NA"
                  - option "Unknown"
                  - option "Manager confirms yes" [selected]
                  - option "No"
              - group [ref=e156]:
                - generic "League rules and scoring" [active] [ref=e157] [cursor=pointer]
                - paragraph [ref=e158]: Check these against your league settings.
                - paragraph [ref=e159]:
                  - text: Review league rules, scoring, locked assignments and player availability. Confirm again when these inputs change.
                  - button "Confirm planning inputs" [ref=e160] [cursor=pointer]
                - group "Acquisition rules" [ref=e161]:
                  - generic [ref=e162]: Acquisition rules
                  - paragraph [ref=e163]: Fill missing settings below. Comparisons update automatically; selected moves are kept. Cost is acquisition-allowance units per add, separate from waiver bids. Confirm each period against the league’s actual reset dates in UTC.
                  - generic [ref=e164]:
                    - generic [ref=e165]:
                      - text: Acquisition timing
                      - combobox "Acquisition timing" [ref=e166]:
                        - option "Unknown"
                        - option "Same day" [selected]
                        - option "Next day"
                    - generic [ref=e167]:
                      - text: Acquisition cost
                      - spinbutton "Acquisition cost" [ref=e168]: "1"
                    - heading "Acquisition periods" [level=4] [ref=e169]
                    - generic [ref=e170]:
                      - generic [ref=e171]:
                        - text: Period
                        - textbox "Period" [ref=e172]: Week
                      - generic [ref=e173]:
                        - text: Start
                        - textbox "Start" [ref=e174]: 2026-10-05
                      - generic [ref=e175]:
                        - text: End
                        - textbox "End" [ref=e176]: 2026-10-08
                      - group [ref=e177]:
                        - generic "Exact period times" [ref=e178] [cursor=pointer]
                      - generic [ref=e179]:
                        - text: Moves left
                        - spinbutton "Moves left" [ref=e180]: "2"
                      - button "Remove period Week" [ref=e181] [cursor=pointer]: ×
                    - button "Add acquisition period" [ref=e182] [cursor=pointer]
                - generic [ref=e183]:
                  - generic [ref=e184]:
                    - text: Lineup mode
                    - combobox "Lineup mode" [ref=e185]:
                      - option "Daily" [selected]
                      - option "Weekly"
                      - option "Other / unknown"
                  - generic [ref=e186]:
                    - text: Scoring
                    - combobox "Scoring" [ref=e187]:
                      - option "Points" [selected]
                      - option "Categories"
                  - generic [ref=e188]:
                    - text: Goalie minimum
                    - spinbutton "Goalie minimum" [ref=e189]
                  - generic [ref=e190]:
                    - text: Goalie credited
                    - spinbutton "Goalie credited" [ref=e191]
                  - generic [ref=e192]:
                    - text: LW
                    - spinbutton "LW" [ref=e193]: "1"
                  - generic [ref=e194]:
                    - text: RW
                    - spinbutton "RW" [ref=e195]: "1"
                  - generic [ref=e196]:
                    - text: BN
                    - spinbutton "BN" [ref=e197]: "1"
              - group [ref=e198]:
                - generic "Scoring, budgets, and lock windows" [ref=e199] [cursor=pointer]
                - option "Unknown" [selected]
                - option "Priority"
                - option "Budget"
                - option "Unknown" [selected]
                - option "Starts"
                - option "Appearances"
                - option "Unknown" [selected]
                - option "Lose goalie categories"
                - option "None"
              - group [ref=e200]:
                - generic "Locked lineup assignments" [ref=e201] [cursor=pointer]
            - generic "Week summary" [ref=e202]:
              - region "Plan summary" [ref=e203]:
                - article [ref=e204]:
                  - generic [ref=e206]: Active games
                  - strong [ref=e207]: 2 / 2
                  - generic "100% of starting slots used" [ref=e208]
                - article [ref=e209]:
                  - generic [ref=e211]: Bench games
                  - strong [ref=e212]: "1"
                  - generic "33% of scheduled games sit (DUST)" [ref=e213]
                - article [ref=e214]:
                  - generic [ref=e216]: Projected points
                  - strong [ref=e217]: "14"
                  - generic "League scoring, active games only" [ref=e218]
              - generic "Lineup comparison" [ref=e220]:
                - generic [ref=e221]: Compare
                - paragraph [ref=e222]:
                  - text: Most starts
                  - generic [ref=e223]: 2 GP · 14 pts
                - paragraph [ref=e224]:
                  - text: Best projected points
                  - generic [ref=e225]: 2 GP · 14 pts
          - region "Itinerary" [ref=e226]:
            - generic [ref=e227]:
              - heading "Optimized Week" [level=2] [ref=e228]:
                - generic [ref=e229]: "2"
                - text: Optimized Week
              - group "Lineup goal" [ref=e230]:
                - button "Most starts" [ref=e231] [cursor=pointer]
                - button "Best projected points" [pressed] [ref=e232] [cursor=pointer]
              - button "Optimize lineup" [ref=e233] [cursor=pointer]
              - group "Schedule view" [ref=e234]:
                - button "By position" [ref=e235] [cursor=pointer]
                - button "Show lineup by player" [ref=e236] [cursor=pointer]: By player
                - button "Streaming itinerary" [ref=e237] [cursor=pointer]: Itinerary
                - button "Plan details" [pressed] [ref=e238] [cursor=pointer]
            - region "Plan details" [ref=e240]:
              - group [ref=e241]:
                - generic "Selected lineup · estimate sources" [ref=e242] [cursor=pointer]
              - group [ref=e243]:
                - generic "Selected plan · projected points comparison" [ref=e244] [cursor=pointer]
              - generic [ref=e245]:
                - heading "Selected steps" [level=3] [ref=e246]
                - paragraph [ref=e247]: "Planned adds: 0 · Week: 2 remaining (manager)"
                - paragraph [ref=e248]: No acquisition selected. The no-move lineup is the comparison.
              - group [ref=e249]:
                - generic "Why players are outside this assignment" [ref=e250] [cursor=pointer]
          - region "Candidates and detail" [ref=e251]:
            - generic [ref=e252]:
              - heading "Best Fit Available" [level=2] [ref=e253]:
                - generic [ref=e254]: "3"
                - text: Best Fit Available
              - generic [ref=e255]:
                - text: Show
                - combobox "Show" [ref=e256]:
                  - option "5"
                  - option "10" [selected]
                  - option "20"
            - generic [ref=e257]:
              - generic [ref=e258]:
                - generic [ref=e259]: Confirm planning inputs to enable Preview swap.
                - button "Confirm planning inputs" [ref=e260] [cursor=pointer]
              - region "Candidate browser" [ref=e261]:
                - generic [ref=e262]:
                  - group "Sort recommendations" [ref=e263]:
                    - button "By projected points" [pressed] [ref=e264] [cursor=pointer]
                    - button "By more starts" [ref=e265] [cursor=pointer]
                  - group [ref=e266]:
                    - generic "Find & filter" [ref=e267] [cursor=pointer]
                    - option "All teams" [selected]
                    - option "All positions" [selected]
                - status [ref=e269]: Rankings appear once projections and schedules load.
                - paragraph [ref=e270]: No candidates match these filters.
                - group [ref=e271]:
                  - generic "Why some players aren't ranked" [ref=e272] [cursor=pointer]
              - group [ref=e273]:
                - generic "Plan alternatives (1)" [ref=e274] [cursor=pointer]
        - group [ref=e276]:
          - generic "More tools" [ref=e277] [cursor=pointer]
          - generic [ref=e278]:
            - group [ref=e279]:
              - 'generic "Shared schedule: complete · Forecasts unknown" [ref=e280] [cursor=pointer]':
                - strong [ref=e281]: "Shared schedule: complete"
                - generic [ref=e282]: · Forecasts unknown
            - group [ref=e283]:
              - generic "Planning readiness · Review inputs" [ref=e284] [cursor=pointer]:
                - strong [ref=e285]: Planning readiness
                - text: · Review inputs
              - list [ref=e286]:
                - listitem [ref=e287]:
                  - text: "Roster: 3 players; review unresolved names and eligibility."
                  - button "Review roster" [ref=e288] [cursor=pointer]
                - listitem [ref=e289]:
                  - text: "Rules: Acquisition legality, budget or scoring is unresolved. Review timing, allowances, slots and locks."
                  - button "Review rules" [ref=e290] [cursor=pointer]
                - listitem [ref=e291]:
                  - text: "Coverage: Player-quality assignment evidence available; projected totals have separate coverage requirements."
                  - button "Review coverage" [ref=e292] [cursor=pointer]
                - listitem [ref=e293]:
                  - text: "Plan: Schedule analysis available. Selected moves remain manager intent; execute changes with your provider."
                  - button "View plan" [ref=e294] [cursor=pointer]
          - group [ref=e295]:
            - generic "Why add/drop plans may be unavailable" [ref=e296] [cursor=pointer]
          - group [ref=e297]:
            - generic "Download planning evidence" [ref=e298] [cursor=pointer]
  - alert [ref=e299]
```

# Test source

```ts
  700 |     await expect(itinerary.getByRole("columnheader", { name: "Slot / player", exact: true })).toBeVisible();
  701 |     const nestedVerticalScrolls = await itinerary.evaluate((panel) => Array.from(panel.querySelectorAll("div")).filter((node) => node.scrollHeight > node.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(node).overflowY)).length);
  702 |     expect(nestedVerticalScrolls).toBeLessThanOrEqual(1);
  703 |     await expect(page.getByRole("region", { name: "Player weekly schedule scroll area" })).toHaveCSS("overflow-y", "auto");
  704 |     await expectDesktopFrameVisible(page);
  705 |     await page.screenshot({ path: testInfo.outputPath(`rso-lineup-${width}.png`), fullPage: true });
  706 |   }
  707 |   await page.setViewportSize({ width: 390, height: 844 });
  708 |   await expect(page.getByRole("group", { name: "Schedule view", exact: true }).getByRole("button", { name: /^Show (lineup by player|category lineup comparison)$/ })).toHaveAttribute("aria-pressed", "true");
  709 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  710 |   await page.screenshot({ path: testInfo.outputPath("rso-mobile.png"), fullPage: true });
  711 | });
  712 | 
  713 | test("Yahoo timeout retains schedule analysis and matchup-week navigation without actionable acquisitions", async ({ page }, testInfo) => {
  714 |   await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  715 |   const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  716 |   await page.addInitScript((key) => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  717 |   await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  718 |   const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  719 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 2 }, acquisitionTiming: "unknown", acquisitionCost: null, periods: [] });
  720 |   workspace.context = { ...workspace.context, provider: "yahoo", teamId: "team", leagueId: "league", startDate: "2026-10-05", endDate: "2026-10-11" };
  721 |   await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  722 |   await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"] } } }));
  723 |   await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ status: 502, json: { success: false, error: "Yahoo roster/settings reads timed out after retrying." } }));
  724 |   await routeCurrentPlanning(page, route => {
  725 |     const start = route.request().method() === "POST" ? route.request().postDataJSON().startDate : new URL(route.request().url()).searchParams.get("startDate")!;
  726 |     const games = players.map(player => ({ ...fixtureGame(player.id, 5, player.teamAbbreviation!), date: start, startsAt: `${start}T23:00:00Z` }));
  727 |     return route.fulfill({ json: { success: true, data: { players: players.map(player => ({ ...player, availability: "unknown" })), games, forecasts: [], evidence: {}, matchupWeeks: [{ gameKey: "477", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }, { gameKey: "477", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }] } } });
  728 |   });
  729 |   await page.setViewportSize({ width: 1440, height: 900 });
  730 |   await page.goto("/roster-schedule-optimizer");
  731 |   await openPlanDetails(page);
  732 |   await expect(page.getByText("Yahoo roster/settings reads timed out after retrying.")).toBeVisible();
  733 |   await expect(page.getByText("Retained roster · roster, locks & availability unverified.", { exact: true })).toBeVisible();
  734 |   await showScheduleView(page, "itinerary");
  735 |   await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  736 |   await openDisclosure(page, "Find & filter");
  737 |   await page.getByRole("button", { name: "All players", exact: true }).click();
  738 |   const candidateBrowser = page.getByRole("region", { name: "Candidate browser" });
  739 |   await expect(candidateBrowser.getByRole("button", { name: /^Preview swap/ })).toHaveCount(0);
  740 |   await expect(candidateBrowser.getByText("Net AGP", { exact: true })).toHaveCount(0);
  741 |   await openDisclosure(page, /^More tools$/);
  742 |   await openDisclosure(page, /^Why add\/drop plans may be unavailable$/);
  743 |   await expect(page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Why add/drop plans may be unavailable", { exact: true }) })).toContainText("Add/drop plans need acquisition-effective timing");
  744 |   await openPlanningSetup(page);
  745 |   await page.getByRole("button", { name: "Previous matchup week" }).click();
  746 |   await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-09-29");
  747 |   await expect(page.getByLabel("Through", { exact: true })).toHaveValue("2026-10-04");
  748 |   await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  749 |   await page.getByRole("button", { name: "Next matchup week" }).click();
  750 |   await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-10-05");
  751 |   await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  752 |   await openDisclosure(page, "Find & filter");
  753 |   await page.getByRole("button", { name: "All players", exact: true }).click();
  754 |   await expect(candidateBrowser.getByRole("button", { name: /^Preview swap/ })).toHaveCount(0);
  755 |   await expect(candidateBrowser.getByText("Net AGP", { exact: true })).toHaveCount(0);
  756 |   await expectDesktopFrameVisible(page);
  757 |   await page.screenshot({ path: testInfo.outputPath("rso-timeout-schedule.png"), fullPage: true });
  758 | });
  759 | 
  760 | 
  761 | test("mixed Kaprizov coverage stays unresolved until complete evidence supports the bench decision", async ({ page }) => {
  762 |   await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
  763 |     ? route.fallback() : route.abort());
  764 |   const players = [
  765 |     { ...fixturePlayer(1, "Kirill Kaprizov", "MIN"), eligiblePositions: ["LW"] },
  766 |     { ...fixturePlayer(2, "Matthew Knies", "TOR"), eligiblePositions: ["LW"] },
  767 |     { ...fixturePlayer(3, "Drake Batherson", "OTT"), eligiblePositions: ["RW"] },
  768 |   ];
  769 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { LW: 1, RW: 1, BN: 1 } });
  770 |   workspace.roster = players.map(player => ({ playerId: player.id, position: "bench" }));
  771 |   const games = players.map((player, index) => fixtureGame(`game-${index}`, 5, player.teamAbbreviation!));
  772 |   let fullCoverage = false;
  773 |   await seedWorkspace(page, workspace);
  774 |   await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
  775 |     data: { players, games, forecasts: fullCoverage ? players.map((player, index) => fixtureForecast(player, games[index], [9, 4, 5][index]))
  776 |       : [fixtureForecast(players[1], games[1], 2), fixtureForecast(players[2], games[2], 3)], evidence: {} } } }));
  777 |   await page.goto("/roster-schedule-optimizer");
  778 |   await openPlanDetails(page);
  779 |   await expectQualityReadiness(page, false);
  780 |   await showScheduleView(page, "player");
  781 |   await openPlanDetails(page);
  782 |   await expectQualityReadiness(page, false);
  783 |   await expectQualityReadiness(page, false);
  784 |   fullCoverage = true;
  785 |   for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
  786 |     await page.setViewportSize({ width, height });
  787 |     await page.reload();
  788 |     await openPlanDetails(page);
  789 |     await showScheduleView(page, "player");
  790 |     await openPlanDetails(page);
  791 |     await expectQualityReadiness(page, true);
  792 |     await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toHaveCount(0);
  793 |     await expect(page.getByText(/Suggested assignment uses reviewed inputs/)).toHaveCount(0);
  794 |     await openDisclosure(page, /^More tools$/);
  795 |     const readiness = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Planning readiness", { exact: true }) });
  796 |     if (await readiness.evaluate(node => (node as HTMLDetailsElement).open)) await readiness.locator(":scope > summary").click();
  797 |     await readiness.locator(":scope > summary").focus();
  798 |     await page.keyboard.press("Enter");
  799 |     await page.getByRole("button", { name: "Review rules", exact: true }).click();
> 800 |     await page.getByRole("button", { name: "Confirm planning inputs", exact: true }).focus();
      |                                                                                      ^ Error: locator.focus: Error: strict mode violation: getByRole('button', { name: 'Confirm planning inputs', exact: true }) resolved to 2 elements:
  801 |     await page.keyboard.press("Space");
  802 |     await openDisclosure(page, /^League rules and scoring$/);
  803 |     await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toBeVisible();
  804 |     await page.locator("#rso-rule-settings > summary").click();
  805 |     await page.getByRole("button", { name: "View plan", exact: true }).click();
  806 |     await openPlanDetails(page);
  807 |     await page.getByText("Why players are outside this assignment", { exact: true }).click();
  808 |     const bench = page.getByRole("article", { name: "Matthew Knies bench decision" });
  809 |     await expect(bench).toContainText("Complete-plan start/sit score: selected 14; with Matthew Knies 9");
  810 |     await expect(bench).toContainText("LW#1: Kirill Kaprizov → Matthew Knies");
  811 |     await expect(bench).toContainText("detailed game estimate");
  812 |     await expect(bench).toContainText("not an approved projected total or acquisition comparison");
  813 |     await expect(page.getByRole("article", { name: "Kirill Kaprizov bench decision" })).toHaveCount(0);
  814 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  815 |   }
  816 | });
  817 | 
  818 | test("weekly LW/RW and UTIL bench explanations preserve midpoint locks through worker reload", async ({ page }) => {
  819 |   await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
  820 |     ? route.fallback() : route.abort());
  821 |   const players = [
  822 |     { ...fixturePlayer(1, "Kirill Kaprizov", "MIN"), eligiblePositions: ["LW"] },
  823 |     { ...fixturePlayer(2, "Matthew Knies", "TOR"), eligiblePositions: ["LW", "RW"] },
  824 |     { ...fixturePlayer(3, "Drake Batherson", "OTT"), eligiblePositions: ["RW"] },
  825 |     fixturePlayer(4, "Locked Center", "CAR"),
  826 |   ];
  827 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, lineupMode: "weekly",
  828 |     rosterSlots: { LW: 1, RW: 1, UTIL: 1, BN: 1 }, lineupPeriods: [{ id: "week",
  829 |       start: "2026-10-05T00:00:00Z", end: "2026-10-07T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }] });
  830 |   workspace.context.endDate = "2026-10-06";
  831 |   workspace.roster = players.map(player => ({ playerId: player.id, position: "bench" }));
  832 |   workspace.lockedAssignments = [{ date: "2026-10-06", playerId: players[3].id, slotId: "UTIL#1" }];
  833 |   const games = [5, 6].flatMap(day => players.map((player, index) => fixtureGame(`game-${day}-${index}`, day, player.teamAbbreviation!)));
  834 |   const forecasts = games.map(game => {
  835 |     const index = players.findIndex(player => player.teamAbbreviation === game.teamAbbreviation);
  836 |     return fixtureForecast(players[index], game, [9, 10, 7, 8][index]);
  837 |   });
  838 |   await seedWorkspace(page, workspace);
  839 |   await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
  840 |     data: { players, games, forecasts, evidence: {} } } }));
  841 |   const errors: string[] = [];
  842 |   page.on("pageerror", error => errors.push(error.message));
  843 |   await page.goto("/roster-schedule-optimizer");
  844 |   await openPlanDetails(page);
  845 |   for (let pass = 0; pass < 2; pass++) {
  846 |     await showScheduleView(page, "player");
  847 |     await openPlanDetails(page);
  848 |     await page.getByText("Why players are outside this assignment", { exact: true }).click();
  849 |     const bench = page.getByRole("article", { name: "Drake Batherson bench decision" });
  850 |     await expect(bench).toContainText("Weekly placement window: Oct 5–Oct 6");
  851 |     await expect(bench).toContainText("Complete-plan start/sit score: selected 54; with Drake Batherson 50");
  852 |     await expect(bench).toContainText("LW#1: Kirill Kaprizov → Matthew Knies");
  853 |     await expect(bench).toContainText("RW#1: Matthew Knies → Drake Batherson");
  854 |     await expect(bench.getByRole("list", { name: "Changed assignments" })).not.toContainText("UTIL#1");
  855 |     await showScheduleView(page, "player");
  856 |     const center = page.getByRole("region", { name: "Itinerary" }).getByRole("row").filter({ hasText: "Locked Center" });
  857 |     await expect(center.getByRole("button", { name: "Schedule details for Locked Center, UTIL#1, league positions C, Fantasy assigned", exact: true })).toBeVisible();
  858 |     if (pass === 0) await page.reload();
  859 |     await openPlanDetails(page);
  860 |   }
  861 |   expect(errors).toEqual([]);
  862 | });
  863 | test("manual league eligibility must be confirmed and survives a reload", async ({ page }) => {
  864 |   const errors: string[] = [];
  865 |   page.on("pageerror", error => errors.push(error.message));
  866 |   const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")]
  867 |     .map(player => ({ ...player, eligibilityVerified: undefined }));
  868 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  869 |   workspace.roster.push({ playerId: players[1].id, position: "bench" });
  870 |   const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
  871 |   await seedWorkspace(page, workspace);
  872 |   await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
  873 |     data: { players, games, forecasts: games.map((game, index) => fixtureForecast(players[index], game, index ? 1 : 9)), evidence: {} } } }));
  874 |   await page.goto("/roster-schedule-optimizer");
  875 |   await expectQualityReadiness(page, false);
  876 |   await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  877 |   const reviews = page.getByText("Review evidence", { exact: true });
  878 |   for (let index = 0; index < 2; index++) {
  879 |     await page.getByLabel(`Manage ${players[index].name}`, { exact: true }).click();
  880 |     await reviews.nth(index).click();
  881 |     await page.getByRole("checkbox", { name: "Manager confirms league positions" }).nth(index).check();
  882 |     if (!index) await expectQualityReadiness(page, false);
  883 |   }
  884 |   await expectQualityReadiness(page, true);
  885 |   await showScheduleView(page, "itinerary");
  886 |   await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  887 |   await page.reload();
  888 |   await expectQualityReadiness(page, true);
  889 |   const retained = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:anonymous")!).manualPlayers);
  890 |   expect(retained.every((player: PlanningPlayer) => player.eligibilityVerified === true)).toBe(true);
  891 |   expect(errors).toEqual([]);
  892 | });
  893 | 
  894 | test("goalie competition stays unresolved across the worker and evidence view", async ({ page }, testInfo) => {
  895 |   const players: PlanningPlayer[] = [7, 8].map(id => ({ ...fixturePlayer(id, `Goalie ${id}`, "CAR"),
  896 |     playerClass: "goalie", eligiblePositions: ["G"], availability: id === 7 ? "manager_available" : "unknown" }));
  897 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { G: 1 },
  898 |     scoring: { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] },
  899 |     goalieMinimum: { required: 1, credited: 0, counts: "starts", penalty: "none" } });
  900 |   workspace.context.endDate = date(9);
```