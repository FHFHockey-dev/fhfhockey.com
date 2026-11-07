# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roster-schedule-optimizer.spec.ts >> manual workspace retains reviewed intent, protections and locks through recalculation and reload
- Location: e2e/roster-schedule-optimizer.spec.ts:107:5

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('button', { name: 'Confirm planning inputs', exact: true })
Expected: enabled
Error: strict mode violation: getByRole('button', { name: 'Confirm planning inputs', exact: true }) resolved to 2 elements:
    1) <button>Confirm planning inputs</button> aka getByLabel('Roster and setup').getByRole('button', { name: 'Confirm planning inputs' })
    2) <button type="button">Confirm planning inputs</button> aka getByLabel('Candidates and detail').getByRole('button', { name: 'Confirm planning inputs' })

Call log:
  - Expect "toBeEnabled" with timeout 15000ms
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
          - generic [ref=e32]: Search players
        - link "Buy me a coffee" [ref=e33] [cursor=pointer]:
          - /url: https://www.buymeacoffee.com/tjsusername
          - img "Buy me a coffee" [ref=e34]
        - button "Sign In / Sign Up" [ref=e35] [cursor=pointer]
    - main [ref=e36]:
      - generic [ref=e38]:
        - group "Planning command bar" [ref=e39]:
          - heading "Roster Schedule Optimizer" [level=1] [ref=e40]
          - group "League and week" [ref=e41]:
            - button "Manual roster Choose source and dates" [ref=e42] [cursor=pointer]:
              - generic [ref=e43]: M
              - generic [ref=e44]:
                - strong [ref=e45]: Manual roster
                - generic [ref=e46]: Choose source and dates
            - generic [ref=e47]:
              - button "Planning setup · Mon, Oct 5 – Wed, Oct 7" [ref=e48] [cursor=pointer]: Mon, Oct 5 – Wed, Oct 7
              - button "Current week" [ref=e49] [cursor=pointer]
              - generic [ref=e50]: Saved range retained. Current week Mon, Sep 21 – Sun, Sep 27 · Mon–Sun fallback; league matchup dates unverified
          - generic [ref=e51]:
            - generic [ref=e52]: Player search
            - searchbox "Search candidate players" [ref=e53]
          - generic [ref=e56]: No regular-season games were found in the shared schedule for these dates.
          - group "Workspace actions" [ref=e57]:
            - button "Undo" [disabled] [ref=e58]
            - generic [ref=e59]: No edits to undo.
            - button "Matchup" [ref=e60] [cursor=pointer]
          - group [ref=e61]:
            - generic "Settings and tools" [ref=e62] [cursor=pointer]:
              - generic [ref=e63]: ☰
        - generic [ref=e64]:
          - region "Roster and setup" [ref=e65]:
            - generic [ref=e66]:
              - heading "Current Roster" [level=2] [ref=e67]:
                - generic [ref=e68]: "1"
                - text: Current Roster
              - generic [ref=e69]: 1 player
              - button "About roster metrics and protection" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: ⓘ
            - generic [ref=e72]:
              - group [ref=e73]:
                - generic "Add or import roster" [ref=e74] [cursor=pointer]
              - group "Current Roster views" [ref=e75]:
                - button "Players" [pressed] [ref=e76] [cursor=pointer]
                - button "Bench days" [ref=e77] [cursor=pointer]
              - generic [ref=e78]:
                - generic [ref=e79]: Player · range
                - generic [ref=e80]:
                  - generic [ref=e81]: GP
                  - generic [ref=e82]: AGP
                  - generic [ref=e83]: DUST
                  - generic [ref=e84]: Pts
                - generic [ref=e85]: Protect
                - generic [ref=e86]: More
              - status [ref=e87]: "No drop suggested: projected points are unknown (Projected GOALS is incomplete.)."
              - generic [ref=e88]:
                - button "Alpha Center CAR · C" [ref=e89] [cursor=pointer]:
                  - generic [ref=e90]:
                    - generic [ref=e91]: Alpha Center
                    - generic [ref=e93]: CAR · C
                - group "Alpha Center range contribution" [ref=e94]:
                  - generic "Review Alpha Center daily contribution evidence" [ref=e95] [cursor=pointer]:
                    - generic [ref=e96]:
                      - 'generic "Remaining GP: 0" [ref=e97]':
                        - generic [ref=e98]: Remaining GP
                        - strong [ref=e99]: "0"
                      - 'generic "AGP: unknown" [ref=e100]':
                        - generic [ref=e101]: AGP
                        - strong [ref=e102]: —
                      - 'generic "DUST/bench: unknown" [ref=e103]':
                        - generic "Evaluated bench games" [ref=e104]: DUST
                        - strong [ref=e105]: —
                      - 'generic "Active points: unavailable" [ref=e106]':
                        - generic [ref=e107]: Active points
                        - strong [ref=e108]: —
                - generic "Protected from drops" [ref=e109]:
                  - checkbox "Protect Alpha Center" [checked] [ref=e110]
                  - generic [ref=e111]: Protect Alpha Center
                - group [ref=e112]:
                  - generic "Manage Alpha Center" [ref=e113] [cursor=pointer]: ⋯
                  - option "Active" [selected]
                  - option "Bench"
                  - option "IR"
                  - option "IR+"
                  - option "NA"
                  - option "Unknown"
                  - option "Manager confirms yes" [selected]
                  - option "No"
              - group [ref=e114]:
                - generic "League rules and scoring" [active] [ref=e115] [cursor=pointer]
                - paragraph [ref=e116]: Check these against your league settings.
                - paragraph [ref=e117]:
                  - text: Review league rules, scoring, locked assignments and player availability. Confirm again when these inputs change.
                  - button "Confirm planning inputs" [ref=e118] [cursor=pointer]
                - group "Acquisition rules" [ref=e119]:
                  - generic [ref=e120]: Acquisition rules
                  - paragraph [ref=e121]: Fill missing settings below. Comparisons update automatically; selected moves are kept. Cost is acquisition-allowance units per add, separate from waiver bids. Confirm each period against the league’s actual reset dates in UTC.
                  - generic [ref=e122]:
                    - generic [ref=e123]:
                      - text: Acquisition timing
                      - combobox "Acquisition timing" [ref=e124]:
                        - option "Unknown"
                        - option "Same day" [selected]
                        - option "Next day"
                    - generic [ref=e125]:
                      - text: Acquisition cost
                      - spinbutton "Acquisition cost" [ref=e126]: "1"
                    - heading "Acquisition periods" [level=4] [ref=e127]
                    - generic [ref=e128]:
                      - generic [ref=e129]:
                        - text: Period
                        - textbox "Period" [ref=e130]: Week
                      - generic [ref=e131]:
                        - text: Start
                        - textbox "Start" [ref=e132]: 2026-10-05
                      - generic [ref=e133]:
                        - text: End
                        - textbox "End" [ref=e134]: 2026-10-08
                      - group [ref=e135]:
                        - generic "Exact period times" [ref=e136] [cursor=pointer]
                      - generic [ref=e137]:
                        - text: Moves left
                        - spinbutton "Moves left" [ref=e138]: "2"
                      - button "Remove period Week" [ref=e139] [cursor=pointer]: ×
                    - button "Add acquisition period" [ref=e140] [cursor=pointer]
                - generic [ref=e141]:
                  - generic [ref=e142]:
                    - text: Lineup mode
                    - combobox "Lineup mode" [ref=e143]:
                      - option "Daily" [selected]
                      - option "Weekly"
                      - option "Other / unknown"
                  - generic [ref=e144]:
                    - text: Scoring
                    - combobox "Scoring" [ref=e145]:
                      - option "Points" [selected]
                      - option "Categories"
                  - generic [ref=e146]:
                    - text: Goalie minimum
                    - spinbutton "Goalie minimum" [ref=e147]
                  - generic [ref=e148]:
                    - text: Goalie credited
                    - spinbutton "Goalie credited" [ref=e149]
                  - generic [ref=e150]:
                    - text: C
                    - spinbutton "C" [ref=e151]: "1"
              - group [ref=e152]:
                - generic "Scoring, budgets, and lock windows" [ref=e153] [cursor=pointer]
                - option "Unknown" [selected]
                - option "Priority"
                - option "Budget"
                - option "Unknown" [selected]
                - option "Starts"
                - option "Appearances"
                - option "Unknown" [selected]
                - option "Lose goalie categories"
                - option "None"
              - group [ref=e154]:
                - generic "Locked lineup assignments" [ref=e155] [cursor=pointer]
                - option "Alpha Center" [selected]
                - option "Bench"
                - option "C#1" [selected]
            - generic "Week summary" [ref=e156]:
              - region "Plan summary" [ref=e157]:
                - article [ref=e158]:
                  - generic [ref=e160]: Active games
                  - strong [ref=e161]: "0"
                  - generic "Starts across your active slots" [ref=e162]
                - article [ref=e163]:
                  - generic [ref=e165]: Bench games
                  - strong [ref=e166]: "0"
                  - generic "Scheduled games left on the bench (DUST)" [ref=e167]
                - article [ref=e168]:
                  - generic [ref=e170]: Projected points
                  - strong [ref=e171]: —
                  - generic "Shows once projections cover your lineup" [ref=e172]
              - generic "Lineup comparison" [ref=e174]:
                - generic [ref=e175]: Compare
                - paragraph [ref=e176]:
                  - text: Most starts
                  - generic [ref=e177]: 0 GP · — pts
                - paragraph [ref=e178]:
                  - text: Best projected points
                  - generic [ref=e179]: 0 GP · — pts
          - region "Itinerary" [ref=e180]:
            - generic [ref=e181]:
              - heading "Optimized Week" [level=2] [ref=e182]:
                - generic [ref=e183]: "2"
                - text: Optimized Week
              - group "Lineup goal" [ref=e184]:
                - button "Most starts" [ref=e185] [cursor=pointer]
                - button "Best projected points" [pressed] [ref=e186] [cursor=pointer]
              - button "Optimize lineup" [ref=e187] [cursor=pointer]
              - group "Schedule view" [ref=e188]:
                - button "By position" [pressed] [ref=e189] [cursor=pointer]
                - button "Show lineup by player" [ref=e190] [cursor=pointer]: By player
                - button "Streaming itinerary" [ref=e191] [cursor=pointer]: Itinerary
                - button "Plan details" [ref=e192] [cursor=pointer]
            - generic [ref=e193]:
              - region "Streaming plan" [ref=e194]:
                - heading "▾ Streaming plan" [level=3] [ref=e195]:
                  - button "▾ Streaming plan" [ref=e196] [cursor=pointer]
              - table "Lineup by position" [ref=e199]:
                - rowgroup [ref=e200]:
                  - row "Plan from Mon, Oct 5" [ref=e201]:
                    - cell "Plan from Mon, Oct 5" [ref=e202]:
                      - slider "Plan from day" [ref=e204] [cursor=pointer]: "0"
                  - row "About the lineup grid Mon Oct 5 0 NHL Tue Oct 6 0 NHL Wed Oct 7 0 NHL Thu Oct 8 0 NHL Fri Oct 9 0 NHL Sat Oct 10 0 NHL Sun Oct 11 0 NHL" [ref=e205]:
                    - columnheader "About the lineup grid" [ref=e206]:
                      - button "About the lineup grid" [ref=e207] [cursor=pointer]:
                        - generic [ref=e208]: ⓘ
                    - columnheader "Mon Oct 5 0 NHL" [ref=e209]:
                      - generic [ref=e210]: Mon
                      - generic [ref=e211]: Oct 5
                      - generic [ref=e212]: 0 NHL
                    - columnheader "Tue Oct 6 0 NHL" [ref=e213]:
                      - generic [ref=e214]: Tue
                      - generic [ref=e215]: Oct 6
                      - generic [ref=e216]: 0 NHL
                    - columnheader "Wed Oct 7 0 NHL" [ref=e217]:
                      - generic [ref=e218]: Wed
                      - generic [ref=e219]: Oct 7
                      - generic [ref=e220]: 0 NHL
                    - columnheader "Thu Oct 8 0 NHL" [ref=e221]:
                      - generic [ref=e222]: Thu
                      - generic [ref=e223]: Oct 8
                      - generic [ref=e224]: 0 NHL
                    - columnheader "Fri Oct 9 0 NHL" [ref=e225]:
                      - generic [ref=e226]: Fri
                      - generic [ref=e227]: Oct 9
                      - generic [ref=e228]: 0 NHL
                    - columnheader "Sat Oct 10 0 NHL" [ref=e229]:
                      - generic [ref=e230]: Sat
                      - generic [ref=e231]: Oct 10
                      - generic [ref=e232]: 0 NHL
                    - columnheader "Sun Oct 11 0 NHL" [ref=e233]:
                      - generic [ref=e234]: Sun
                      - generic [ref=e235]: Oct 11
                      - generic [ref=e236]: 0 NHL
                - rowgroup [ref=e237]:
                  - row "C — — — — — — —" [ref=e238]:
                    - rowheader "C" [ref=e239]:
                      - generic [ref=e240]: C
                    - cell "—" [ref=e241]:
                      - generic [ref=e242]: —
                    - cell "—" [ref=e243]:
                      - generic [ref=e244]: —
                    - cell "—" [ref=e245]:
                      - generic [ref=e246]: —
                    - cell "—" [ref=e247]:
                      - generic [ref=e248]: —
                    - cell "—" [ref=e249]:
                      - generic [ref=e250]: —
                    - cell "—" [ref=e251]:
                      - generic [ref=e252]: —
                    - cell "—" [ref=e253]:
                      - generic [ref=e254]: —
                - rowgroup [ref=e255]:
                  - row "BN Alpha Center, bench, no game, 2026-10-05 Alpha Center, bench, no game, 2026-10-06 Alpha Center, bench, no game, 2026-10-07" [ref=e256]:
                    - rowheader "BN" [ref=e257]:
                      - generic [ref=e258]: BN
                    - cell "Alpha Center, bench, no game, 2026-10-05" [ref=e259]:
                      - button "Alpha Center, bench, no game, 2026-10-05" [ref=e260] [cursor=pointer]:
                        - generic [ref=e262]: Center
                        - generic [ref=e263]: No game
                    - cell "Alpha Center, bench, no game, 2026-10-06" [ref=e264]:
                      - button "Alpha Center, bench, no game, 2026-10-06" [ref=e265] [cursor=pointer]:
                        - generic [ref=e267]: Center
                        - generic [ref=e268]: No game
                    - cell "Alpha Center, bench, no game, 2026-10-07" [ref=e269]:
                      - button "Alpha Center, bench, no game, 2026-10-07" [ref=e270] [cursor=pointer]:
                        - generic [ref=e272]: Center
                        - generic [ref=e273]: No game
                    - cell [ref=e274]
                    - cell [ref=e275]
                    - cell [ref=e276]
                    - cell [ref=e277]
                - rowgroup [ref=e278]:
                  - row "Filled" [ref=e279]:
                    - rowheader "Filled" [ref=e280]
                    - cell
                    - cell
                    - cell
                    - cell
                    - cell
                    - cell
                    - cell
          - region "Candidates and detail" [ref=e282]:
            - generic [ref=e283]:
              - heading "Best Fit Available" [level=2] [ref=e284]:
                - generic [ref=e285]: "3"
                - text: Best Fit Available
              - generic [ref=e286]:
                - text: Show
                - combobox "Show" [ref=e287]:
                  - option "5"
                  - option "10" [selected]
                  - option "20"
            - generic [ref=e288]:
              - generic [ref=e289]:
                - generic [ref=e290]: Confirm planning inputs to enable Preview swap.
                - button "Confirm planning inputs" [ref=e291] [cursor=pointer]
              - region "Candidate browser" [ref=e292]:
                - generic [ref=e293]:
                  - group "Sort recommendations" [ref=e294]:
                    - button "By projected points" [pressed] [ref=e295] [cursor=pointer]
                    - button "By more starts" [ref=e296] [cursor=pointer]
                  - group [ref=e297]:
                    - generic "Find & filter" [ref=e298] [cursor=pointer]
                    - option "All teams" [selected]
                    - option "NJD"
                    - option "All positions" [selected]
                    - option "C"
                - status [ref=e300]: Rankings appear once projections and schedules load.
                - article "Bravo Center compared acquisition" [ref=e301]:
                  - generic [ref=e302]:
                    - generic [ref=e305]:
                      - generic [ref=e306]: ADD
                      - button "Bravo Center, NJD, C" [ref=e307] [cursor=pointer]: Bravo Center
                      - generic [ref=e308]: NJD · C
                      - generic [ref=e309]: FA
                    - group "Bravo Center NHL schedule" [ref=e310]:
                      - 'generic "2026-10-05: Schedule unknown" [ref=e311]':
                        - generic [ref=e312]: Mon
                        - generic [ref=e313]: —
                      - 'generic "2026-10-06: Schedule unknown" [ref=e314]':
                        - generic [ref=e315]: Tue
                        - generic [ref=e316]: —
                      - 'generic "2026-10-07: Schedule unknown" [ref=e317]':
                        - generic [ref=e318]: Wed
                        - generic [ref=e319]: —
                    - button "Select add" [ref=e321] [cursor=pointer]
                - group [ref=e322]:
                  - generic "Why some players aren't ranked" [ref=e323] [cursor=pointer]
              - group [ref=e324]:
                - generic "Plan alternatives (1)" [ref=e325] [cursor=pointer]
        - group [ref=e327]:
          - generic "More tools" [ref=e328] [cursor=pointer]
  - alert [ref=e329]
```

# Test source

```ts
  27  | const fixtureRules: LeagueRules = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [{ id: "Week", start: "2026-10-05T00:00:00Z", end: "2026-10-09T00:00:00Z", remaining: 2, source: "manager" }], lineupPeriods: [], scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
  28  | function fixtureWorkspace(players: PlanningPlayer[], rules: LeagueRules = fixtureRules): PlanningWorkspace {
  29  |   return { version: 1, context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: date(5), endDate: date(7), timeZone: "UTC", asOf: "2026-09-26T00:00:00Z" }, rules, managerRuleOverrides: {}, roster: [{ playerId: players[0].id, position: "active" }], lockedAssignments: [], intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: players, unresolvedNames: [], realized: {}, opponent: null };
  30  | }
  31  | /** Seeds the local slot of `principal` (default: the anonymous manual slot). */
  32  | async function seedWorkspace(page: import("@playwright/test").Page, workspace: PlanningWorkspace, principal: string | null = null) {
  33  |   await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: workspaceStorageKey(principal), value: workspace });
  34  | }
  35  | async function openPlanDetails(page: import("@playwright/test").Page) {
  36  |   await showScheduleView(page, "details");
  37  | }
  38  | async function openPlanningSetup(page: import("@playwright/test").Page) {
  39  |   const toggle = page.getByRole("button", { name: /Planning setup ·/ });
  40  |   if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  41  | }
  42  | async function expectDesktopFrameVisible(page: import("@playwright/test").Page) {
  43  |   const frame = await page.evaluate(() => {
  44  |     const banner = document.querySelector("header")?.getBoundingClientRect();
  45  |     const title = document.querySelector("h1")?.getBoundingClientRect();
  46  |     const setupElement = document.querySelector('[aria-label="Planning setup"]');
  47  |     const setup = (setupElement?.getBoundingClientRect().height ? setupElement : document.querySelector('[aria-controls="rso-planning-setup"]'))?.getBoundingClientRect();
  48  |     const summary = document.querySelector('[aria-label="Plan summary"]')?.getBoundingClientRect();
  49  |     return { scrollY: window.scrollY, htmlScroll: document.documentElement.scrollHeight, bodyScroll: document.body.scrollHeight, height: window.innerHeight, bannerBottom: banner?.bottom ?? 0, titleTop: title?.top ?? -1, setupTop: setup?.top ?? -1, summaryTop: summary?.top ?? -1 };
  50  |   });
  51  |   expect(frame.scrollY).toBe(0);
  52  |   expect(frame.htmlScroll).toBeLessThanOrEqual(frame.height + 1);
  53  |   expect(frame.bodyScroll).toBeLessThanOrEqual(frame.height + 1);
  54  |   expect(frame.titleTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
  55  |   expect(frame.setupTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
  56  |   expect(frame.summaryTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
  57  | }
  58  | 
  59  | test("connected refresh fixtures preserve nonzero intent through offline, cooldown, Undo and reopen", async ({ page }, testInfo) => {
  60  |   await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  61  |   await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  62  |   const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  63  |   await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  64  |   const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")]; players[1].availability = "free_agent";
  65  |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 2 }, periods: [{ id: "fixture-week", start: "2026-10-11T00:00:00Z", end: "2026-10-19T00:00:00Z", remaining: 2, source: "manager" }] });
  66  |   workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "fixture-league", teamId: "fixture-team", startDate: "2026-10-12", endDate: "2026-10-18", asOf: "2026-10-11T12:00:00Z" };
  67  |   workspace.intent.steps = [{ id: "fixture-add", type: "add", playerId: players[1].id, at: "2026-10-12T12:00:00Z", effectiveAt: "2026-10-12T12:00:00Z", conditional: false, dependsOn: [] }]; workspace.intent.protectedPlayerIds = [players[0].id];
  68  |   await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  69  |   await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep"] } } }));
  70  |   await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  71  |   let reads = 0;
  72  |   await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
  73  |     const read = ++reads;
  74  |     const snapshot: PlanningSnapshot = { id: `fixture-refresh-${read}`, context: { ...workspace.context, asOf: read === 1 ? "2026-10-11T12:00:00Z" : "2026-10-11T12:01:00Z" }, players, roster: workspace.roster, rules: workspace.rules, lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
  75  |     return route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: read !== 2, limitations: [] }, ...(read === 2 ? { code: "yahoo_rate_limited", retryAfterSeconds: 1200 } : {}) } });
  76  |   });
  77  |   const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!) as PlanningWorkspace);
  78  |   const visibility = (value: "visible" | "hidden") => page.evaluate(value => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value }); document.dispatchEvent(new Event("visibilitychange")); }, value);
  79  |   const network = (value: boolean) => page.evaluate(value => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value }); window.dispatchEvent(new Event(value ? "online" : "offline")); }, value);
  80  |   await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/roster-schedule-optimizer");
  81  |   await expect.poll(() => reads).toBe(1); await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();
  82  |   await openPlanningSetup(page); await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover"); const p2 = (await saved()).intent;
  83  |   await visibility("hidden"); await visibility("visible"); expect(reads).toBe(1);
  84  |   await page.getByRole("button", { name: "Refresh provider" }).click(); await expect(page.getByText(/Provider inputs partly refreshed/)).toBeVisible(); expect(reads).toBe(2); expect((await saved()).intent).toEqual(p2);
  85  |   // A false navigator.onLine pauses timed polling but never blocks an explicit refresh (the flag can be wrong).
  86  |   await network(false); await page.clock.fastForward(5 * 60_000); await expect(page.getByRole("button", { name: "Refresh provider" })).toBeEnabled(); expect(reads).toBe(2);
  87  |   await network(true); await visibility("hidden"); await visibility("visible"); await page.getByRole("button", { name: "Refresh provider" }).click(); await expect(page.getByText(/Provider refresh is paused until/)).toBeVisible(); expect(reads).toBe(2);
  88  |   await page.clock.fastForward(15 * 60_000 + 1000); await expect.poll(() => reads).toBe(3);
  89  |   await page.getByRole("button", { name: "Undo" }).click(); await expect.poll(async () => (await saved()).intent.goalieCoverage).toBe(workspace.intent.goalieCoverage); expect((await saved()).intent).toMatchObject({ steps: workspace.intent.steps, protectedPlayerIds: workspace.intent.protectedPlayerIds, goalieCoverage: workspace.intent.goalieCoverage });
  90  |   await page.reload(); await expect.poll(() => reads).toBe(4); expect((await saved()).intent.steps).toEqual(workspace.intent.steps); expect((await saved()).context.asOf).toBe("2026-10-11T12:01:00Z");
  91  |   await page.screenshot({ path: testInfo.outputPath("rso-refresh-fixture.png") });
  92  |   await writeFile(testInfo.outputPath("refresh-fixture-receipt.json"), JSON.stringify({ reads, scope: "Fictional intercepted session/provider and local storage; controlled online/visibility/time. Authentic isolation and account saves not accepted.", nonzeroP2: p2 }, null, 2));
  93  | });
  94  | 
  95  | test.beforeEach(async ({ page }) => {
  96  |   await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: unmocked API" } }));
  97  |   await page.route("**/*", route => {
  98  |     const host = new URL(route.request().url()).hostname;
  99  |     return ["127.0.0.1", "localhost"].includes(host) ? route.fallback() : route.abort();
  100 |   });
  101 |   await setPlanningTime(page, new Date("2026-09-26T00:00:00Z"));
  102 |   await routeCurrentPlanning(page, (route) => route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } }));
  103 |   await page.route("**/api/v1/roster-schedule-optimizer/access", (route) => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
  104 |   await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
  105 | });
  106 | 
  107 | test("manual workspace retains reviewed intent, protections and locks through recalculation and reload", async ({ page }) => {
  108 |   const members = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  109 |   const saved = fixtureWorkspace(members);
  110 |   saved.lockedAssignments = [{ date: date(6), playerId: members[0].id, slotId: "C#1" }];
  111 |   saved.intent = { ...saved.intent, protectedPlayerIds: [members[0].id], steps: [{
  112 |     id: "selected-add", type: "add", playerId: members[1].id, at: `${date(6)}T00:00:00Z`,
  113 |     effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [],
  114 |   }] };
  115 |   await seedWorkspace(page, saved);
  116 |   for (const [width, height] of [[1440, 900], [1920, 1080]]) {
  117 |     await page.setViewportSize({ width, height });
  118 |     await page.goto("/roster-schedule-optimizer");
  119 |     await expect(page.getByRole("heading", { name: "Roster Schedule Optimizer" })).toBeVisible();
  120 |     await expect(page.getByRole("region", { name: "Roster and setup" }).getByRole("button", { name: "Alpha Center CAR · C", exact: true })).toBeVisible();
  121 |     const manage = page.getByLabel("Manage Alpha Center", { exact: true });
  122 |     await manage.click();
  123 |     await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
  124 |     await manage.click();
  125 |     await page.getByText("League rules and scoring", { exact: true }).click();
  126 |     const confirm = page.getByRole("button", { name: "Confirm planning inputs", exact: true });
> 127 |     await expect(confirm).toBeEnabled();
      |                           ^ Error: expect(locator).toBeEnabled() failed
  128 |     await confirm.focus();
  129 |     await page.keyboard.press("Enter");
  130 |     await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toBeVisible();
  131 |     await page.getByRole("combobox", { name: "Lineup mode", exact: true }).selectOption("weekly");
  132 |     await expect(page.getByRole("combobox", { name: "Lineup mode", exact: true })).toHaveValue("weekly");
  133 |     if (width === 1440) await expect(confirm).toBeEnabled();
  134 |     await page.getByText("League rules and scoring", { exact: true }).click();
  135 |     const weight = width === 1440 ? 2 : 3;
  136 |     await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
  137 |     await page.getByRole("spinbutton", { name: "Weight", exact: true }).fill(String(weight));
  138 |     await expect(page.getByRole("spinbutton", { name: "Weight", exact: true })).toHaveValue(String(weight));
  139 |     await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
  140 |     await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:anonymous")!))).toMatchObject({
  141 |       intent: saved.intent, lockedAssignments: saved.lockedAssignments, roster: saved.roster,
  142 |       rules: { scoring: { weights: { GOALS: weight } } },
  143 |     });
  144 |     await expectDesktopFrameVisible(page);
  145 |     await page.reload();
  146 |     await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  147 |     await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
  148 |     await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  149 |     await page.getByText("League rules and scoring", { exact: true }).click();
  150 |     await expect(confirm).toBeEnabled();
  151 |     await page.getByText("League rules and scoring", { exact: true }).click();
  152 |     await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:anonymous")!))).toMatchObject({
  153 |       intent: saved.intent, lockedAssignments: saved.lockedAssignments, roster: saved.roster,
  154 |       rules: { lineupMode: "weekly", scoring: { weights: { GOALS: weight } } },
  155 |     });
  156 |     await expectDesktopFrameVisible(page);
  157 |   }
  158 | });
  159 | 
  160 | test("mobile tabs keep selection and expose the matchup and player details", async ({ page }, testInfo) => {
  161 |   await page.setViewportSize({ width: 390, height: 844 });
  162 |   await page.goto("/roster-schedule-optimizer");
  163 |   await expect(page.getByRole("region", { name: "Itinerary" })).toBeVisible();
  164 |   await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  165 |   await openDisclosure(page, "Add or import roster");
  166 |   await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center");
  167 |   await page.getByRole("button", { name: "Review pasted names" }).click();
  168 |   await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Matchup" }).click();
  169 |   await expect(page.getByText(/Opponent inputs are missing/)).toBeVisible();
  170 |   await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  171 |   await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  172 |   await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
  173 |   await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  174 |   await openDisclosure(page, "Add or import roster");
  175 |   await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center");
  176 |   await page.getByRole("button", { name: "Review pasted names" }).click();
  177 |   await expect(page.locator("#rso-action-status")).toHaveText("Roster review complete: 0 added, 1 already rostered, 0 unresolved. No new roster players were added.");
  178 |   const retained = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1:anonymous"));
  179 |   const detail = page.getByRole("region", { name: "Player details for Alpha Center", exact: true });
  180 |   await page.getByRole("region", { name: "Roster and setup" }).getByRole("button", { name: /^Alpha Center/ }).click();
  181 |   await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeVisible();
  182 |   await expect(detail).toBeVisible();
  183 |   await expect(detail).toBeFocused();
  184 |   expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1:anonymous"))).toBe(retained);
  185 |   await page.screenshot({ path: testInfo.outputPath("player-detail-mobile.png") });
  186 |   await page.setViewportSize({ width: 1440, height: 900 });
  187 |   await page.getByRole("button", { name: "Matchup", exact: true }).click();
  188 |   await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeHidden();
  189 |   await showScheduleView(page, "player");
  190 |   await expect(page.getByRole("table", { name: "Individual player weekly schedule" })).toBeVisible();
  191 |   const schedulePlayer = page.getByRole("button", { name: /^Schedule details for Alpha Center,/ });
  192 |   if (!(await schedulePlayer.isVisible())) await page.getByRole("button", { name: /^Bench \d+, expand/ }).click();
  193 |   await schedulePlayer.click();
  194 |   await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeVisible();
  195 |   await expect(detail).toBeVisible();
  196 |   await expect(detail).toBeFocused();
  197 |   expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1:anonymous"))).toBe(retained);
  198 |   await expectDesktopFrameVisible(page);
  199 |   await page.screenshot({ path: testInfo.outputPath("player-detail-desktop.png") });
  200 | });
  201 | 
  202 | test("readiness controls reach existing inputs across the required viewports", async ({ page }, testInfo) => {
  203 |   const errors: string[] = [];
  204 |   page.on("pageerror", error => errors.push(error.message));
  205 |   await routeCurrentPlanning(page, route => {
  206 |     const day = route.request().method() === "POST" ? route.request().postDataJSON().endDate : new URL(route.request().url()).searchParams.get("endDate")!;
  207 |     return route.fulfill({ json: { success: true, data: { players: [player],
  208 |       games: [{ ...fixtureGame("empty-roster-game", 2, "CAR"), date: day, startsAt: `${day}T23:00:00Z` }], forecasts: [], evidence: {} } } });
  209 |   });
  210 |   for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [720, 450], [390, 844], [320, 844]]) {
  211 |     await page.setViewportSize({ width, height });
  212 |     await page.goto("/roster-schedule-optimizer");
  213 |     await openDisclosure(page, /^More tools$/);
  214 |     const readiness = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Planning readiness", { exact: true }) });
  215 |     await readiness.locator(":scope > summary").focus();
  216 |     await page.keyboard.press("Enter");
  217 |     await expect(readiness).toHaveAttribute("open", "");
  218 |     await expect(readiness).toContainText("Add your players to begin schedule analysis.");
  219 |     await expect(readiness).toContainText("Acquisition legality, budget or scoring is unresolved.");
  220 |     await expect(readiness).toContainText("Awaiting roster and schedule inputs.");
  221 |     await expect(readiness).toContainText("Add roster players to assess player-quality coverage.");
  222 |     await expect(readiness).not.toContainText("Player-quality assignment evidence available");
  223 |     await page.keyboard.press("Tab");
  224 |     const rosterAction = page.getByRole("button", { name: "Review roster", exact: true });
  225 |     await expect(rosterAction).toBeFocused();
  226 |     await page.keyboard.press("Enter");
  227 |     await expect(page.getByRole("searchbox", { name: "Find a player" })).toBeFocused();
```