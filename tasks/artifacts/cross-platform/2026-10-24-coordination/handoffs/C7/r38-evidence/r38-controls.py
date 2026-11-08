import sys
src = open(sys.argv[1]).read()
extra = '''
// --- C7 R38 controls ---
describe("C7 R38", () => {
  const connected = () => {
    authState.user = { id: "manager" };
    const workspace = defaultWorkspace();
    workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team" };
    workspace.roster = [{ playerId: player.id, position: "active" }]; workspace.manualPlayers = [player];
    window.localStorage.setItem(workspaceStorageKey("manager"), JSON.stringify(workspace));
    return workspace;
  };
  const snapshotFor = (workspace: PlanningWorkspace) => ({ id: "snap", context: workspace.context, players: [player], roster: workspace.roster, rules: workspace.rules,
    lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} });
  const world = (workspace: PlanningWorkspace, provider: () => Promise<unknown>) => vi.fn((url: string) => url.endsWith("/provider") ? provider()
    : Promise.resolve({ ok: true, json: async () => url.endsWith("/access") ? { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep"] } }
      : url.includes("/data?") ? { success: true, data } : { data: null } }));
  const providerCalls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(([url]) => String(url).endsWith("/provider")).length;
  for (const strict of [false, true]) for (const onLine of [true, false]) it(`C7: first-load provider requests (StrictMode ${strict}, navigator.onLine ${onLine})`, async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(onLine);
    const workspace = connected();
    const requests = world(workspace, async () => ({ ok: true, json: async () => ({ success: true, snapshot: snapshotFor(workspace), capabilities: { roster: true, availability: true, limitations: [] } }) }));
    vi.stubGlobal("fetch", requests);
    render(strict ? <StrictMode><RosterScheduleOptimizer /></StrictMode> : <RosterScheduleOptimizer />);
    await waitFor(() => expect(providerCalls(requests)).toBeGreaterThan(0));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
    // Recorded, not asserted: the count is the observation.
    (globalThis as any).__c7r38 = { ...((globalThis as any).__c7r38 ?? {}), [`strict=${strict},onLine=${onLine}`]: providerCalls(requests) };
    console.log(`C7R38 strict=${strict} onLine=${onLine} providerCalls=${providerCalls(requests)}`);
  });
  it.each([
    ["a TypeError", () => Promise.reject(new TypeError("Failed to fetch")), true],
    ["an HTTP 503", () => Promise.resolve({ ok: false, status: 503, json: async () => ({ success: false, error: "Yahoo is unavailable." }) }), false],
    ["an HTTP 401", () => Promise.resolve({ ok: false, status: 401, json: async () => ({ success: false, code: "yahoo_reauth_required", error: "Reconnect Yahoo." }) }), false],
  ] as const)("C7: a provider refresh failing with %s shows offline: %s", async (_label, provider, offline) => {
    const workspace = connected();
    vi.stubGlobal("fetch", world(workspace, provider as () => Promise<unknown>));
    render(<RosterScheduleOptimizer />);
    await waitFor(() => expect(document.getElementById("rso-provider-refresh-status")?.textContent ?? "").not.toBe(""));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(document.body.textContent?.includes("You are offline")).toBe(offline);
    expect(screen.queryByText("Checking access for provider synchronization…")).toBeNull();
  });
  it("C7: an access check aborted by an account switch settles for the new account", async () => {
    const workspace = connected();
    let first = true;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/access") && first) { first = false; return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))); }
      return world(workspace, async () => ({ ok: false, status: 503, json: async () => ({ success: false, error: "x" }) }))(url);
    }));
    const view = render(<RosterScheduleOptimizer />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    authState.user = { id: "other" }; view.rerender(<RosterScheduleOptimizer />);
    await waitFor(() => expect(screen.queryByText("Checking access for provider synchronization…")).toBeNull());
    expect(document.body.textContent?.includes("You are offline")).toBe(false);
  });
});
'''
open(sys.argv[2], "w").write(src + extra)
