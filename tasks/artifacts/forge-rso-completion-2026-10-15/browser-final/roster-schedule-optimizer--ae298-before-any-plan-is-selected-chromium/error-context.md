# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: roster-schedule-optimizer.spec.ts >> Audit1 native candidate Worker finds complete swaps before any plan is selected
- Location: e2e/roster-schedule-optimizer.spec.ts:1565:5

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  locator('[data-rso-candidate-id="fhfh:140"]').getByRole('button', { name: 'Select compared plan' })
Expected: enabled
Received: disabled
Timeout:  15000ms

Call log:
  - Expect "toBeEnabled" with timeout 15000ms
  - waiting for locator('[data-rso-candidate-id="fhfh:140"]').getByRole('button', { name: 'Select compared plan' })
    34 × locator resolved to <button disabled class="CandidateCard_action__DpVqb">Select compared plan</button>
       - unexpected value "disabled"

```

```yaml
- button "Select compared plan" [disabled]
```

# Test source

```ts
  1505 |   const finished = receipt.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.revision === 2);
  1506 |   const canceled = receipt.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.revision === 3);
  1507 |   expect(first.finishedAt).toBeUndefined();
  1508 |   expect(canceled.finishedAt).toBeUndefined();
  1509 |   expect(first.terminatedAt).toBeGreaterThanOrEqual(receipt.edits[0].at);
  1510 |   expect(canceled.terminatedAt).toBeGreaterThanOrEqual(receipt.edits[2].at);
  1511 |   await writeFile(testInfo.outputPath("planning-performance.json"), JSON.stringify({ profile: { roster: 25, candidates: 300, days: 7, games: 70, forecasts: forecasts.length, positions: "C only", input: "fictional complete forecasts, default worker search quotas" },
  1512 |     fullPlanMs: finished.finishedAt - finished.postedAt, cancellationMs: [first.terminatedAt - receipt.edits[0].at, canceled.terminatedAt - receipt.edits[2].at],
  1513 |     editToStaleResultClearMs: receipt.clearAt - receipt.edits[1].at, dates: finished.dates, activeGames: finished.activeGames, search: finished.search,
  1514 |     mainThread: { ticks: receipt.ticks, maxGapMs: receipt.maxGapMs }, scope: "Native headless planner workers; event-to-termination and DOM invalidation; development observation, no latency guarantee" }, null, 2));
  1515 | });
  1516 | 
  1517 | test("candidate worker ranks the complete population without blocking filters and retains zero AGP", async ({ page }, testInfo) => {
  1518 |   await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
  1519 |     ? route.fallback() : route.abort());
  1520 |   await page.addInitScript(() => {
  1521 |     const NativeWorker = window.Worker;
  1522 |     (window as any).__candidatePerformance = [];
  1523 |     window.Worker = class extends NativeWorker {
  1524 |       postMessage(message: any, options?: any) {
  1525 |         const started = performance.now();
  1526 |         let ticks = 0, previous = started, maxGapMs = 0;
  1527 |         const timer = window.setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; ticks++; }, 20);
  1528 |         this.addEventListener("message", event => {
  1529 |           window.clearInterval(timer);
  1530 |           if (event.data.metrics) (window as any).__candidatePerformance.push({ elapsedMs: performance.now() - started, ticks, maxGapMs,
  1531 |             evaluated: event.data.metrics.activePoints.filter((row: any[]) => row[1] !== null).length });
  1532 |         }, { once: true });
  1533 |         super.postMessage(message, options);
  1534 |       }
  1535 |     };
  1536 |   });
  1537 |   const owned = fixturePlayer(1, "Owned Center", "NJD");
  1538 |   const candidates = Array.from({ length: 999 }, (_, index) => fixturePlayer(index + 2, index === 998 ? "Last Candidate Best Quality" : `Candidate ${index}`, "CAR"));
  1539 |   const members = [owned, ...candidates];
  1540 |   const games = [5, 6].flatMap(day => [fixtureGame(`NJD${day}`, day, "NJD"), fixtureGame(`CAR${day}`, day, "CAR")]);
  1541 |   const forecasts = games.flatMap(game => members.filter(member => member.teamAbbreviation === game.teamAbbreviation)
  1542 |     .map(member => fixtureForecast(member, game, member.id === candidates[998].id ? 10 : 2)));
  1543 |   const workspace = fixtureWorkspace(members);
  1544 |   workspace.context.endDate = date(6);
  1545 |   await seedWorkspace(page, workspace);
  1546 |   await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  1547 |   await page.goto("/roster-schedule-optimizer");
  1548 |   const browser = page.getByRole("region", { name: "Candidate browser" });
  1549 |   await browser.getByRole("button", { name: "All players", exact: true }).click();
  1550 |   const best = browser.getByRole("button", { name: /Last Candidate Best Quality/ });
  1551 |   await expect(best).toBeVisible();
  1552 |   await expect(best.locator("..")).toContainText("+AGP 0");
  1553 |   await expect(best.locator("..")).toContainText("Potential active points gain 16");
  1554 |   await expect(browser.getByRole("heading", { name: "Projected fit · active points gain", exact: true }).locator("+ div")).toContainText("Last Candidate Best Quality");
  1555 |   await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Candidate 42");
  1556 |   await expect(best).toHaveCount(0);
  1557 |   await expect(browser.getByRole("button", { name: /Candidate 42/ }).first()).toBeVisible();
  1558 |   const metrics = await page.evaluate(() => (window as any).__candidatePerformance);
  1559 |   expect(metrics.some((row: any) => row.evaluated === 999 && row.ticks > 0 && row.maxGapMs < 500)).toBe(true);
  1560 |   await writeFile(testInfo.outputPath("candidate-performance.json"), JSON.stringify(metrics, null, 2));
  1561 |   await browser.getByRole("searchbox", { name: "Find candidate" }).fill("");
  1562 |   await page.screenshot({ path: testInfo.outputPath("rso-worker-zero-agp.png"), fullPage: true });
  1563 | });
  1564 | 
  1565 | test("Audit1 native candidate Worker finds complete swaps before any plan is selected", async ({ page }, testInfo) => {
  1566 |   await page.route("**/api/**", route => route.request().url().includes("/roster-schedule-optimizer/")
  1567 |     ? route.fallback() : route.fulfill({ json: {} }));
  1568 |   await page.addInitScript(() => {
  1569 |     const NativeWorker = window.Worker;
  1570 |     (window as any).__auditCandidateResults = [];
  1571 |     window.Worker = class extends NativeWorker {
  1572 |       constructor(url: string | URL, options?: WorkerOptions) {
  1573 |         super(url, options);
  1574 |         this.addEventListener("message", event => {
  1575 |           if (event.data.metrics) (window as any).__auditCandidateResults.push(event.data.metrics);
  1576 |         });
  1577 |       }
  1578 |     };
  1579 |   });
  1580 |   const owned = [fixturePlayer(1, "Owned Strong", "NJD"), fixturePlayer(2, "Owned Second", "NJD"), fixturePlayer(3, "Owned Weak", "NJD")];
  1581 |   const candidates = Array.from({ length: 41 }, (_, index) => fixturePlayer(100 + index,
  1582 |     index === 40 ? "Strongest Last Candidate" : `Audit Candidate ${index}`, "NJD"));
  1583 |   const players = [...owned, ...candidates], game = fixtureGame("audit-native-game", 5, "NJD");
  1584 |   const forecasts = players.map((member, index) => fixtureForecast(member, game,
  1585 |     [100, 90, 1][index] ?? (index === 43 ? 1000 : 10)));
  1586 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 3, BN: 0 } });
  1587 |   workspace.roster = owned.map(member => ({ playerId: member.id, position: "active" }));
  1588 |   workspace.context.endDate = date(5);
  1589 |   workspace.intent.steps = [];
  1590 |   await seedWorkspace(page, workspace);
  1591 |   await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
  1592 |     data: { players, games: [game], forecasts, evidence: { schedule: { source: "complete synthetic Audit1 universe",
  1593 |       asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete", limitations: [] } } } } }));
  1594 |   await page.goto("/roster-schedule-optimizer");
  1595 |   await expect.poll(() => page.evaluate(() => (window as any).__auditCandidateResults.length)).toBeGreaterThan(0);
  1596 |   const metrics = await page.evaluate(() => (window as any).__auditCandidateResults.at(-1));
  1597 |   expect(metrics.baseline.projectedPoints).toBe(191);
  1598 |   expect(metrics.search).toMatchObject({ candidates: 40, eligibleCandidates: 41, complete: false });
  1599 |   expect(metrics.search.evaluated).toBeLessThanOrEqual(160);
  1600 |   const strongest = metrics.candidates.find((candidate: any) => candidate.playerId === "fhfh:140");
  1601 |   expect(strongest.plans.some((plan: any) => plan.netPoints === 999 && plan.steps[0].dropPlayerId === "fhfh:3")).toBe(true);
  1602 |   const card = page.locator('[data-rso-candidate-id="fhfh:140"]');
  1603 |   await expect(card).toContainText("Net points +999");
  1604 |   await expect(card).toContainText("Owned Weak");
> 1605 |   await expect(card.getByRole("button", { name: "Select compared plan" })).toBeEnabled();
       |                                                                            ^ Error: expect(locator).toBeEnabled() failed
  1606 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).intent.steps)).toEqual([]);
  1607 |   await writeFile(testInfo.outputPath("audit1-native-worker.json"), JSON.stringify({
  1608 |     scope: "Native browser Worker and served local UI; intercepted synthetic inputs, not genuine feed acceptance", metrics,
  1609 |   }, null, 2));
  1610 | });
  1611 | 
  1612 | function compactWorkspace(count: number) {
  1613 |   const positions = ["C", "C", "LW", "LW", "RW", "RW", "D", "D", "D", "D", "C", "LW", "G", "G"];
  1614 |   const players = Array.from({ length: count === 19 ? 20 : count }, (_, index) => ({ ...fixturePlayer(index + 1, `Compact Surname${index + 1}`, "CAR"),
  1615 |     eligiblePositions: index === 0 ? ["C", "LW"] : [positions[index] ?? "C"], playerClass: positions[index] === "G" ? "goalie" as const : "skater" as const,
  1616 |     reserveEligibility: ["IR", "IR+"] as Array<"IR" | "IR+"> }));
  1617 |   const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 2, LW: 2, RW: 2, D: count === 19 ? 3 : 4, UTIL: 2, G: 2, BN: count >= 25 ? count - 16 : 6, IR: 1, "IR+": 1 } });
  1618 |   workspace.context.endDate = "2026-10-11";
  1619 |   workspace.roster = players.filter((_, index) => count !== 19 || index !== 9).map(player => { const index = players.indexOf(player); return { playerId: player.id,
  1620 |     position: count >= 25 && index >= count - 2 ? index === count - 2 ? "IR" : "IR+" : index < 14 ? "active" : "bench" }; });
  1621 |   workspace.intent.protectedPlayerIds = [players[0].id];
  1622 |   workspace.lockedAssignments = [{ date: "2026-10-07", playerId: players[0].id, slotId: "C#1" }, ...workspace.roster.filter(row => row.position === "bench").map(row => ({ date: "2026-10-07", playerId: row.playerId, slotId: null }))];
  1623 |   const games = Array.from({ length: 7 }, (_, index) => ({ ...fixtureGame(`compact-${index}`, 5, "CAR"), date: `2026-10-${String(index + 5).padStart(2, "0")}`, startsAt: `2026-10-${String(index + 5).padStart(2, "0")}T23:00:00Z` }));
  1624 |   return { workspace, players, games };
  1625 | }
  1626 | async function installCompactFixture(page: import("@playwright/test").Page, count: number, customize?: (fixture: ReturnType<typeof compactWorkspace>) => void) {
  1627 |   const fixture = compactWorkspace(count);
  1628 |   customize?.(fixture);
  1629 |   await page.clock.setFixedTime(new Date("2026-10-07T12:00:00Z"));
  1630 |   await seedWorkspace(page, fixture.workspace);
  1631 |   await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: fixture.players, games: fixture.games, forecasts: [], evidence: {
  1632 |     schedule: { source: "fictional compact fixture", asOf: "2026-10-07T12:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] },
  1633 |   } } } }));
  1634 |   await page.goto("/roster-schedule-optimizer");
  1635 |   await expect(page.getByRole("slider", { name: "Selected planning day" })).toHaveAttribute("aria-valuetext", "Wed, Oct 7");
  1636 |   await expect(page.getByText(/Local planning lineup · GP/)).toBeVisible();
  1637 |   return fixture;
  1638 | }
  1639 | async function expectDaySliderAligned(page: import("@playwright/test").Page) {
  1640 |   const slider = page.getByRole("slider", { name: "Selected planning day" });
  1641 |   const thumbCenter = await slider.evaluate(node => {
  1642 |     const input = node as HTMLInputElement, box = input.getBoundingClientRect();
  1643 |     const min = Number(input.min), max = Number(input.max);
  1644 |     return box.left + 8 + (box.width - 16) * (max === min ? 0 : (Number(input.value) - min) / (max - min));
  1645 |   });
  1646 |   const date = await slider.getAttribute("aria-valuetext");
  1647 |   const headerCenter = await page.getByRole("button", { name: `Select ${date}`, exact: true }).evaluate(node => {
  1648 |     const box = node.closest("th")!.getBoundingClientRect(); return box.left + box.width / 2;
  1649 |   });
  1650 |   expect(Math.abs(thumbCenter - headerCenter)).toBeLessThanOrEqual(1);
  1651 | }
  1652 | 
  1653 | for (const count of [19, 20, 29]) test(`compact layout accounts for ${count} slots with a maximum of 20 slot rows and internal labels`, async ({ page }, testInfo) => {
  1654 |   await page.setViewportSize({ width: 1440, height: 900 });
  1655 |   await installCompactFixture(page, count);
  1656 |   await expectDaySliderAligned(page);
  1657 |   const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  1658 |   await expect(table.locator('tr[data-player-id]')).toHaveCount(count);
  1659 |   await expect(table.locator('tr[data-compact-row]')).toHaveCount(count);
  1660 |   await expect(page.getByRole("heading", { name: "Current Roster" })).toBeVisible();
  1661 |   await expect(page.getByRole("heading", { name: "Available Players" })).toBeVisible();
  1662 |   const metrics = await table.evaluate(node => {
  1663 |     const viewport = node.parentElement!.getBoundingClientRect();
  1664 |     const bodyTop = Math.max(viewport.top, node.querySelector("thead")!.getBoundingClientRect().bottom);
  1665 |     const rows = [...node.querySelectorAll('tr[data-compact-row]:not([hidden])')];
  1666 |     return { visibleRows: rows.filter(row => { const box = row.getBoundingClientRect(); return box.top >= bodyTop && box.bottom <= viewport.bottom; }).length,
  1667 |       visiblePlayers: rows.filter(row => { const box = row.getBoundingClientRect(); return row.hasAttribute("data-player-id") && box.top >= bodyTop && box.bottom <= viewport.bottom && box.left >= viewport.left && box.right <= viewport.right; }).length,
  1668 |       rowHeights: rows.map(row => row.getBoundingClientRect().height),
  1669 |       scrollHeight: node.parentElement!.scrollHeight, clientHeight: node.parentElement!.clientHeight,
  1670 |       firstRowTop: rows[0]?.getBoundingClientRect().top, lastRowBottom: rows.at(-1)?.getBoundingClientRect().bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom,
  1671 |       playerIds: rows.map(row => row.getAttribute("data-player-id")).filter(Boolean),
  1672 |       groups: [...node.querySelectorAll("tbody")].map(group => ({ position: group.getAttribute("data-position"), band: getComputedStyle(group).borderLeftColor,
  1673 |         width: getComputedStyle(group).borderLeftWidth, style: getComputedStyle(group).borderLeftStyle,
  1674 |         topLeftRadius: getComputedStyle(group).borderTopLeftRadius, bottomLeftRadius: getComputedStyle(group).borderBottomLeftRadius, rightRadius: getComputedStyle(group).borderTopRightRadius,
  1675 |         outlineColors: [getComputedStyle(group).borderTopColor, getComputedStyle(group).borderRightColor, getComputedStyle(group).borderBottomColor],
  1676 |         outlineWidths: [getComputedStyle(group).borderTopWidth, getComputedStyle(group).borderRightWidth, getComputedStyle(group).borderBottomWidth],
  1677 |         label: group.getAttribute("data-label"), renderedLabel: (() => {
  1678 |           const label = group.querySelector('[data-position-label] > span');
  1679 |           const cell = group.querySelector('tr[data-compact-row] th[scope="row"]');
  1680 |           if (!label || !cell) return null;
  1681 |           const box = label.getBoundingClientRect(), container = cell.getBoundingClientRect();
  1682 |           const band = group.getBoundingClientRect();
  1683 |           const control = group.querySelector('tr[data-bench-heading] button')?.getBoundingClientRect();
  1684 |           const player = cell.querySelector('button')?.getBoundingClientRect();
  1685 |           return { text: label.textContent?.trim(), width: box.width, height: box.height, fontSize: getComputedStyle(label).fontSize,
  1686 |             left: box.left, right: box.right, top: box.top, bottom: box.bottom,
  1687 |             bandLeft: band.left, bandRight: band.left + parseFloat(getComputedStyle(group).borderLeftWidth), bandTop: band.top, bandBottom: band.bottom,
  1688 |             color: getComputedStyle(label).color, panelColor: getComputedStyle(node.closest("section")!).backgroundColor,
  1689 |             cellLeft: container.left, cellRight: container.right, transform: getComputedStyle(label).transform,
  1690 |             controlRight: control?.right, playerLeft: player?.left };
  1691 |         })(),
  1692 |         before: getComputedStyle(group, "::before").content, after: getComputedStyle(group, "::after").content,
  1693 |         contentInset: Math.min(...[...group.querySelectorAll('th[scope="row"]')].map(cell => cell.getBoundingClientRect().left - group.getBoundingClientRect().left)) })) };
  1694 |   });
  1695 |   expect(new Set(metrics.playerIds).size).toBe(count);
  1696 |   expect(metrics.groups.map(group => group.position)).toEqual(count >= 25 ? ["C", "LW", "RW", "D", "UTIL", "G", "BENCH", "IR", "IR+"] : ["C", "LW", "RW", "D", "UTIL", "G", "BENCH"]);
  1697 |   expect(metrics.groups.find(group => group.position === "RW")?.band).toBe("rgb(167, 139, 250)");
  1698 |   for (const group of metrics.groups) {
  1699 |     expect(group.width).toBe("28px"); expect(group.style).toBe("solid");
  1700 |     expect(group.topLeftRadius).toBe("10px"); expect(group.bottomLeftRadius).toBe("10px"); expect(group.rightRadius).toBe("10px");
  1701 |     expect(group.outlineColors).toEqual([group.band, group.band, group.band]); expect(group.outlineWidths).toEqual(["1px", "1px", "1px"]);
  1702 |     expect(group.label).toBe(group.position);
  1703 |     expect(group.before).toBe("none"); expect(group.after).toBe("none");
  1704 |     expect(group.renderedLabel?.text).toContain(group.label);
  1705 |     expect(group.renderedLabel?.width).toBeGreaterThan(0); expect(group.renderedLabel?.height).toBeGreaterThanOrEqual(11);
```