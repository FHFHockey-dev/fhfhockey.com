import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import {
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
} from "lib/trends/recentTeamFormV2";
import { RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS } from "lib/trends/ctpi";
import {
  RecentTeamFormBeta,
  RECENT_TEAM_FORM_INFO_TIP,
  RECENT_TEAM_FORM_PARTS_CAPTION,
} from "./RecentTeamFormBeta";
import {
  buildRecentTeamFormBetaModel,
  RECENT_TEAM_FORM_BETA_SELECT,
  type RecentTeamFormBetaRow,
} from "./useRecentTeamFormBeta";

type Rows = Record<string, unknown>[];

function query(rows: Rows) {
  const result = Promise.resolve({ data: rows, error: null });
  const q: any = {};
  for (const method of ["select", "eq", "gte", "lte", "lt", "or", "order", "limit"]) {
    q[method] = vi.fn(() => q);
  }
  q.then = (resolve: any, reject: any) => result.then(resolve, reject);
  return q;
}

function install(tables: Record<string, Rows>) {
  const queries: Record<string, any[]> = {};
  fromMock.mockImplementation((table: string) => {
    const q = query(tables[table] ?? []);
    (queries[table] ??= []).push(q);
    return q;
  });
  return queries;
}

function ctpiRow(overrides: Partial<RecentTeamFormBetaRow> = {}): RecentTeamFormBetaRow {
  return {
    date: "2026-11-13",
    team: "PHI",
    ctpi_version: 2,
    ctpi_0_to_100: 62.4,
    offense: 0.62,
    defense: -0.31,
    goaltending: 0.2,
    special_teams: 0.05,
    computed_at: "2026-11-13T10:10:04.000Z",
    publication_status: "candidate_unapproved",
    formula_version: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
    input_version: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
    status: "ready",
    source_game_count: "16",
    recent_game_count: "10",
    source_cutoff_exclusive: "2026-11-13",
    source_through_date: "2026-11-12",
    source_fingerprint: "a".repeat(64),
    warnings: [],
    missing_components: [],
    missing_metrics: [],
    unavailable_league_metrics: [],
    component_coverage: { offense: 1, defense: 1, goaltending: 1, specialTeams: 1 },
    pdo_context: { value: 101.2, z: 0.8, observationCount: 10, signal: "neutral", includedInScore: false },
    ...overrides,
  };
}

// Ten 5-on-5 game rows before Nov 13, newest first (Nov 12 back to Nov 3):
// 20 goals on 250 shots (8.0%), 30 against on 300 (90.0%), PDO 0.980.
const gameRows = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-11-${String(12 - index).padStart(2, "0")}`,
  gp: 1,
  gf: 2,
  ga: 3,
  sf: 25,
  sa: 30,
}));

afterEach(() => {
  cleanup();
  fromMock.mockReset();
  vi.unstubAllEnvs();
});

const renderCard = () =>
  render(<RecentTeamFormBeta teamAbbrev="PHI" seasonId="20262027" />);

describe("RecentTeamFormBeta", () => {
  it("shows the badge, score, window dates, as-of date and n of 10 games", async () => {
    const queries = install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    await waitFor(() => expect(screen.getByText("62")).toBeTruthy());

    const badge = screen.getByText("Descriptive beta · not a forecast");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.closest("button")).toBeNull();
    expect(screen.getByText("on a 0–100 scale; 50 = league average on that date")).toBeTruthy();
    expect(
      screen.getByText("Last 10 games before Nov 13 (Nov 3 – Nov 12); recent games count more"),
    ).toBeTruthy();
    expect(screen.getByText("As of Nov 13 · 10 of 10 games included")).toBeTruthy();
    expect(screen.queryByText(/percentile/i)).toBeNull();
    const parts = screen.getByRole("list", { name: RECENT_TEAM_FORM_PARTS_CAPTION });
    expect(within(parts).getAllByRole("listitem")).toHaveLength(4);
    expect(RECENT_TEAM_FORM_PARTS_CAPTION).toContain("standard deviations (SD)");
    expect(screen.getByText("+0.6").textContent).toBe("+0.6 SD");
    expect(screen.getByText("−0.3").textContent).toBe("−0.3 SD");

    // Reads: selected payload paths only, v2 rows only, games before the snapshot.
    const [ctpiQuery] = queries.team_ctpi_daily;
    expect(ctpiQuery.select).toHaveBeenCalledWith(RECENT_TEAM_FORM_BETA_SELECT);
    expect(RECENT_TEAM_FORM_BETA_SELECT.split(",")).not.toContain("payload");
    expect(ctpiQuery.eq).toHaveBeenCalledWith("ctpi_version", 2);
    expect(ctpiQuery.eq).toHaveBeenCalledWith(
      "payload->>formulaVersion",
      RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
    );
    const [gameQuery] = queries.nst_team_5v5;
    expect(gameQuery.select).toHaveBeenCalledWith("date,gp,gf,ga,sf,sa");
    expect(gameQuery.lt).toHaveBeenCalledWith("date", "2026-11-13");
    expect(gameQuery.or).toHaveBeenCalledWith("gp.neq.0,gp.is.null");
    expect(gameQuery.limit).toHaveBeenCalledWith(10);
  });

  it("marks bars that run past the ±2 SD scale", async () => {
    install({
      team_ctpi_daily: [ctpiRow({ defense: 2.64, goaltending: -2.31 })],
      nst_team_5v5: gameRows,
    });
    renderCard();
    const defense = (await screen.findByText("Defense")).closest("li") as HTMLElement;
    const goaltending = screen.getByText("Goaltending").closest("li") as HTMLElement;
    const offense = screen.getByText("Offense").closest("li") as HTMLElement;
    expect(defense.querySelector('[data-clipped="true"]')).not.toBeNull();
    expect(goaltending.querySelector('[data-clipped="true"]')).not.toBeNull();
    expect(offense.querySelector("[data-clipped]")).toBeNull();
    expect(within(defense).getByText("+2.6")).toBeTruthy();
  });

  it("labels 5-on-5 puck luck over the same games as not part of the score", async () => {
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    const heading = await screen.findByText(/^Puck luck/);
    expect(heading.textContent).toBe("Puck luck (5-on-5, same 10 games; not part of the score)");
    expect(screen.getByText("0.980")).toBeTruthy();
    expect(screen.getByText("8.0%")).toBeTruthy();
    expect(screen.getByText("90.0%")).toBeTruthy();
    expect(screen.getByText("1.000 is league average; extremes usually regress")).toBeTruthy();
  });

  it("renders a null component as Unknown with its reason, never 0", async () => {
    install({
      team_ctpi_daily: [
        ctpiRow({
          status: "partial",
          special_teams: null,
          missing_components: ["specialTeams"],
          missing_metrics: ["pp_xgf_per_60", "pk_xga_per_60"],
          warnings: ["missing_source_metrics", "missing_formula_components"],
        }),
      ],
      nst_team_5v5: gameRows,
    });
    renderCard();
    const label = await screen.findByText("Special teams");
    const row = label.closest("li") as HTMLElement;
    expect(within(row).getByText("Unknown")).toBeTruthy();
    expect(
      within(row).getByText("Power-play or penalty-kill ice time missing for these games"),
    ).toBeTruthy();
    expect(within(row).queryByText(/SD/)).toBeNull();
    expect(screen.getByText("Partial: special teams unavailable")).toBeTruthy();
  });

  it("never names 5-on-5 dates as the score's window when they do not line up", async () => {
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows.slice(1) });
    renderCard();
    expect(
      await screen.findByText(
        "Last 10 games before Nov 13 (games through Nov 12); recent games count more",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Nov 3 – Nov 11/)).toBeNull();
    expect(
      screen.getByText(
        "5-on-5 stats cover 9 of these 10 games, so puck luck uses those 9",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/^Puck luck/).textContent).toContain("9 of the 10 games");
  });

  it("shows Not enough games yet with no score when the team has fewer than 5 games", async () => {
    install({ team_ctpi_daily: [], nst_team_5v5: gameRows.slice(0, 3) });
    renderCard();
    expect(await screen.findByText("Not enough games yet (3 of 5)")).toBeTruthy();
    expect(screen.queryByText(/on a 0–100 scale/)).toBeNull();
    expect(screen.getByText("Descriptive beta · not a forecast")).toBeTruthy();
  });

  it("does not show rows outside the beta contract", async () => {
    install({
      team_ctpi_daily: [ctpiRow({ publication_status: RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS })],
      nst_team_5v5: gameRows,
    });
    renderCard();
    expect(
      await screen.findByText("Recent Team Form is not available for this team and season"),
    ).toBeTruthy();
    expect(screen.queryByText("62")).toBeNull();
  });

  it("marks the card busy only while it loads", async () => {
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    const region = screen.getByRole("region", { name: "Recent Team Form" });
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(within(region).getByText("Loading Recent Team Form…")).toBeTruthy();
    await screen.findByText("62");
    expect(region.hasAttribute("aria-busy")).toBe(false);
  });

  it("opens the info tip from an expandable button", async () => {
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    const button = await screen.findByRole("button", { name: "About Recent Team Form" });
    const tip = screen.getByText(RECENT_TEAM_FORM_INFO_TIP);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(tip.hidden).toBe(true);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(tip.hidden).toBe(false);
  });

  it("shows debug detail in development only", async () => {
    vi.stubEnv("NODE_ENV", "production");
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    await screen.findByText("62");
    expect(screen.queryByTestId("recent-team-form-debug")).toBeNull();
    expect(screen.queryByText("a".repeat(64))).toBeNull();
    cleanup();

    vi.stubEnv("NODE_ENV", "development");
    install({ team_ctpi_daily: [ctpiRow()], nst_team_5v5: gameRows });
    renderCard();
    await screen.findByText("62");
    const debug = screen.getByTestId("recent-team-form-debug");
    expect(within(debug).getByText("a".repeat(64))).toBeTruthy();
    expect(within(debug).getByText("2026-11-13T10:10:04.000Z")).toBeTruthy();
  });
});

describe("buildRecentTeamFormBetaModel", () => {
  it("flags 5-on-5 rows that do not match the score's games", () => {
    const model = buildRecentTeamFormBetaModel(ctpiRow(), gameRows.slice(1));
    expect(model.kind).toBe("score");
    if (model.kind !== "score") return;
    expect(model.windowMismatch).toBe(true);
    expect(model.puckLuck.games).toBe(9);
    const aligned = buildRecentTeamFormBetaModel(ctpiRow(), gameRows);
    expect(aligned.kind === "score" && aligned.windowMismatch).toBe(false);
  });

  it("separates too early from not available when no row exists", () => {
    expect(buildRecentTeamFormBetaModel(null, [], 4)).toEqual({
      kind: "notEnoughGames",
      gamesPlayed: 4,
      minimumGames: 5,
    });
    expect(buildRecentTeamFormBetaModel(null, [], 5)).toEqual({ kind: "unavailable", debug: null });
  });
});

describe("Recent Team Form beta import boundary", () => {
  const webRoot = path.resolve(__dirname, "../..");
  const BETA_SYMBOLS = /isDescriptiveBetaCtpiPayload|CTPI_DESCRIPTIVE_BETA_LABEL|useRecentTeamFormBeta|RecentTeamFormBeta/;
  const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;

  function sourceFiles(relative: string): string[] {
    const absolute = path.join(webRoot, relative);
    let stats;
    try {
      stats = statSync(absolute);
    } catch {
      return [];
    }
    if (stats.isFile()) return SOURCE.test(absolute) ? [absolute] : [];
    return readdirSync(absolute).flatMap((entry) => sourceFiles(path.join(relative, entry)));
  }

  const forgeComponents = readdirSync(path.join(webRoot, "components"))
    .filter((entry) => entry.startsWith("forge-"))
    .map((entry) => path.join("components", entry));

  const guarded = [
    "lib/game-predictions",
    "lib/dashboard",
    "pages/api/v1/start-chart.ts",
    "pages/api/v1/trends/team-ctpi.ts",
    "pages/forge",
    "pages/FORGE.tsx",
    "pages/api/v1/forge",
    ...forgeComponents,
    // Rankings
    "components/Rankings",
    "lib/rankings",
    "pages/rankings.tsx",
    "pages/api/v1/rankings.ts",
    "pages/api/v1/contextual-rankings.ts",
    "pages/api/v1/contextual-rankings",
    // Projections
    "components/Projections",
    "lib/projections",
    "lib/fantasy-projections",
    "pages/projections",
    "pages/fantasy-projections.tsx",
    "pages/api/v1/projections.ts",
    "pages/api/v1/projections",
    "pages/api/v1/fantasy-projections",
  ];

  it("keeps the beta predicate, label and hook out of predictive, ranking and recommendation code", () => {
    expect(forgeComponents.length).toBeGreaterThan(0);
    const scanned = guarded.flatMap(sourceFiles);
    // Top Adds lives in the FORGE components; the guard must actually reach it.
    expect(scanned.some((file) => file.endsWith("TopAddsRail.tsx"))).toBe(true);
    expect(scanned.some((file) => file.endsWith("start-chart.ts"))).toBe(true);
    const offenders = scanned.filter((file) => BETA_SYMBOLS.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(webRoot, file))).toEqual([]);
  });

  it("is consumed only by the team dashboard", () => {
    const dashboard = readFileSync(
      path.join(webRoot, "components/TeamDashboard/TeamDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/from "\.\/RecentTeamFormBeta"/);
  });
});
