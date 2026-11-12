// @vitest-environment node
// W3-3 D3 / A2 (L19): the legacy /api/Averages and /api/ThreeYearAverages
// routes, driven end to end from fixture NST report HTML (no provider call).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNst } = vi.hoisted(() => ({ fetchNst: vi.fn() }));

vi.mock("lib/nst/client", () => ({
  buildNstUrlString: (path: string, query: Record<string, string | number>) =>
    `https://nst.fixture/${path}?${new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)])
    )}`,
  fetchNstTextWithCacheByUrl: fetchNst
}));

import averagesRoute from "../../../pages/api/Averages/[playerId]";
import threeYearRoute from "../../../pages/api/ThreeYearAverages/[playerId]";

type Cells = Record<string, string | number>;

const table = (id: string, rows: Cells[]) => {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cells = (row: Cells) =>
    headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("");
  return `<table id="${id}"><tr>${headers
    .map((h) => `<th>${h}</th>`)
    .join("")}</tr>${rows.map((row) => `<tr>${cells(row)}</tr>`).join("")}</table>`;
};

/** One NST player report per `rate` value; each stint lists both tables' cells. */
function serveReports(
  reports: {
    counts: Array<{ ind: Cells; oi: Cells }>;
    rates: Array<{ ind: Cells; oi: Cells }>;
  },
  { inProgressSeason = true } = {}
) {
  // By default the player also has a 2026-27 (in progress) row, which no
  // average may include; the old code dropped "the newest season" instead.
  const current = {
    counts: [stint(20262027, "TOR", { TOI: 100, Shots: 50, Goals: 9 }, { CF: 9, CA: 1, GF: 9 })],
    rates: [stint(20262027, "TOR", { TOI: 100, "Shots/60": 30 }, { TOI: 100, "CF/60": 90, "CA/60": 10 })]
  };
  fetchNst.mockImplementation(async (url: string) => {
    const kind = url.includes("rate=y") ? "rates" : "counts";
    const stints = [
      ...(inProgressSeason ? current[kind] : []),
      ...reports[kind]
    ];
    return {
      text: `<html><body>${table(
        "indreg",
        stints.map((s) => s.ind)
      )}${table("reg", stints.map((s) => s.oi))}</body></html>`
    };
  });
}

async function call(route: typeof averagesRoute) {
  let body: any;
  const res: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    }
  };
  await route({ query: { playerId: "8470000" } } as any, res);
  return body;
}

const stint = (season: number, team: string, ind: Cells, oi: Cells = {}) => ({
  ind: { Season: season, Team: team, ...ind },
  oi: { Season: season, Team: team, ...oi }
});

beforeEach(() => {
  // The 2026-27 season is in progress; 2024-25 and earlier are complete.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  fetchNst.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const plainRates = [
  stint(20242025, "TOR", { TOI: 1000, "Shots/60": 6 }, { TOI: 1000 }),
  stint(20232024, "TOR", { TOI: 1000, "Shots/60": 6 }, { TOI: 1000 }),
  stint(20222023, "TOR", { TOI: 1000, "Shots/60": 6 }, { TOI: 1000 })
];

describe("legacy averages: units (W3-3 D3a)", () => {
  it("SOG/60 is shots × 3600 ÷ TOI seconds from NST decimal minutes", async () => {
    serveReports({
      counts: [
        stint(20242025, "TOR", { TOI: 1400.5, Shots: 200 }),
        stint(20232024, "TOR", { TOI: 1000, Shots: 150 }),
        stint(20222023, "TOR", { TOI: 1000, Shots: 150 })
      ],
      rates: plainRates
    });
    const body = await call(averagesRoute);
    expect(body.success).toBe(true);
    const row = body.yearlyCounts.counts.find(
      (c: any) => c.season === 20242025
    );
    expect(row.TOI).toBeCloseTo(84030, 6);
    expect(row["SOG/60"]).toBeCloseTo((200 * 3600) / 84030, 6); // 8.568
    // Three seasons pooled: 500 shots / 3400.5 minutes.
    expect(body.threeYearCountsAverages["SOG/60"]).toBeCloseTo(
      (500 / 3400.5) * 60,
      6
    );
  });
});

describe("legacy averages: traded-season TOT row (W3-3 D3b, A2)", () => {
  const tradedRates = [
    stint(
      20242025,
      "TOR",
      { TOI: 600, "Shots/60": 9 },
      { TOI: 600, "CF/60": 60, "CA/60": 20 }
    ),
    stint(
      20242025,
      "MTL",
      { TOI: 300, "Shots/60": 6 },
      { TOI: 300, "CF/60": 20, "CA/60": 60 }
    ),
    stint(
      20232024,
      "TOR",
      { TOI: 900, "Shots/60": 8 },
      { TOI: 900, "CF/60": 40, "CA/60": 40 }
    ),
    stint(
      20222023,
      "TOR",
      { TOI: 900, "Shots/60": 8 },
      { TOI: 900, "CF/60": 40, "CA/60": 40 }
    )
  ];
  const tradedCounts = [
    stint(20242025, "TOR", { TOI: 600, Shots: 90 }, { CF: 600, CA: 200 }),
    stint(20242025, "MTL", { TOI: 300, Shots: 30 }, { CF: 100, CA: 300 }),
    stint(20232024, "TOR", { TOI: 900, Shots: 120 }, { CF: 400, CA: 400 }),
    stint(20222023, "TOR", { TOI: 900, Shots: 120 }, { CF: 400, CA: 400 })
  ];

  it("pools TOT rates by TOI: 9.0 over 600 min and 6.0 over 300 min → 8.0", async () => {
    serveReports({ counts: tradedCounts, rates: tradedRates });
    const body = await call(averagesRoute);
    const tot = body.yearlyRates.rates.find(
      (r: any) => r.season === 20242025
    );
    expect(tot.team).toBe("TOT");
    expect(tot["SOG/60"]).toBeCloseTo(8, 9);
    expect(tot["CF/60"]).toBeCloseTo((60 * 600 + 20 * 300) / 900, 9);
  });

  it("pools TOT shares by their denominators: CF% 700 ÷ 1200 = 58.33 on both paths", async () => {
    serveReports({ counts: tradedCounts, rates: tradedRates });
    const body = await call(averagesRoute);
    const rateTot = body.yearlyRates.rates.find(
      (r: any) => r.season === 20242025
    );
    const countTot = body.yearlyCounts.counts.find(
      (c: any) => c.season === 20242025
    );
    expect(rateTot["CF%"]).toBeCloseTo((700 / 1200) * 100, 9);
    expect(countTot["CF%"]).toBeCloseTo((700 / 1200) * 100, 9);
  });
});

describe("legacy averages: seasons (W3-3 D3c)", () => {
  it("weights season rates by TOI (10 at 1000 min, 4 and 4 at 500 → 7.0, not 6.0)", async () => {
    serveReports({
      counts: [
        stint(20242025, "TOR", { TOI: 1000, Shots: 100 }),
        stint(20232024, "TOR", { TOI: 500, Shots: 50 }),
        stint(20222023, "TOR", { TOI: 500, Shots: 50 })
      ],
      rates: [
        stint(20242025, "TOR", { TOI: 1000, "Shots/60": 10 }, { TOI: 1000 }),
        stint(20232024, "TOR", { TOI: 500, "Shots/60": 4 }, { TOI: 500 }),
        stint(20222023, "TOR", { TOI: 500, "Shots/60": 4 }, { TOI: 500 })
      ]
    });
    const body = await call(averagesRoute);
    expect(body.threeYearRatesAverages["SOG/60"]).toBeCloseTo(7, 9);
    // The in-progress 2026-27 season is not part of the averages.
    expect(body.careerAverageRates["SOG/60"]).toBeCloseTo(7, 9);
  });

  it("keeps the newest completed season when the player has no current-season row", async () => {
    serveReports({
      counts: [
        stint(20242025, "TOR", { TOI: 1000, Shots: 100 }),
        stint(20232024, "TOR", { TOI: 1000, Shots: 50 }),
        stint(20222023, "TOR", { TOI: 1000, Shots: 50 })
      ],
      rates: plainRates
    }, { inProgressSeason: false });
    const body = await call(averagesRoute);
    expect(body.success).toBe(true);
    expect(body.threeYearCountsAverages.SOG).toBeCloseTo(200 / 3, 9);
  });
});

describe("legacy averages: unknowns and zero denominators (W3-3 D3, rule 5)", () => {
  it("a zero or unknown denominator is null, never 0", async () => {
    serveReports({
      counts: [
        stint(
          20242025,
          "TOR",
          { TOI: 0, Shots: 0, Goals: 0 },
          { CF: 0, CA: 0 }
        ),
        stint(20232024, "TOR", { TOI: "-", Shots: 50, Goals: 5 }),
        stint(20222023, "TOR", { TOI: 1000, Shots: 50, Goals: 5 })
      ],
      rates: plainRates
    });
    const body = await call(averagesRoute);
    const zero = body.yearlyCounts.counts.find(
      (c: any) => c.season === 20242025
    );
    expect(zero["S%"]).toBeNull();
    expect(zero["SOG/60"]).toBeNull();
    expect(zero["CF%"]).toBeNull();
    const unknownToi = body.yearlyCounts.counts.find(
      (c: any) => c.season === 20232024
    );
    expect(unknownToi["SOG/60"]).toBeNull();
    // One unknown season TOI leaves the pooled three-year rate unknown.
    expect(body.threeYearCountsAverages["SOG/60"]).toBeNull();
    expect(body.threeYearCountsAverages["S%"]).toBeCloseTo((10 / 100) * 100, 9);
  });
});

describe("legacy averages: one versioned scale contract (W3-3 A2, decision 17)", () => {
  it("serves every share on 0-100 points and xS% = ixG ÷ iFF", async () => {
    serveReports({
      counts: [
        stint(
          20242025,
          "TOR",
          { TOI: 1000, Shots: 200, Goals: 25, ixG: 20, iFF: 250 },
          { CF: 600, CA: 200, GF: 30, GA: 20 }
        ),
        stint(
          20232024,
          "TOR",
          { TOI: 1000, Shots: 200, Goals: 25, ixG: 20, iFF: 250 },
          { CF: 600, CA: 200, GF: 30, GA: 20 }
        ),
        stint(
          20222023,
          "TOR",
          { TOI: 1000, Shots: 200, Goals: 25, ixG: 20, iFF: 250 },
          { CF: 600, CA: 200, GF: 30, GA: 20 }
        )
      ],
      rates: plainRates
    });
    const body = await call(averagesRoute);
    const row = body.yearlyCounts.counts[0];
    expect(row["S%"]).toBeCloseTo(12.5, 9);
    expect(row["CF%"]).toBeCloseTo(75, 9);
    expect(row["GF%"]).toBeCloseTo(60, 9);
    expect(body.threeYearCountsAverages["xS%"]).toBeCloseTo(8, 9);
    expect(body.threeYearCountsAverages["S%"]).toBeCloseTo(12.5, 9);
    expect(body.scaleContract.version).toBe("legacy-averages-v2");
    expect(body.scaleContract.shares).toMatch(/0-100/);
  });
});

describe("/api/ThreeYearAverages serves the same contract as /api/Averages", () => {
  it("returns identical averages and season rows for the same reports", async () => {
    const reports = {
      counts: [
        stint(20242025, "TOR", { TOI: 600, Shots: 90, Goals: 9, "Total Assists": 10, "Second Assists": 4 }, { GF: 40, CF: 600, CA: 200 }),
        stint(20242025, "MTL", { TOI: 300, Shots: 30, Goals: 3, "Total Assists": 2, "Second Assists": 1 }, { GF: 10, CF: 100, CA: 300 }),
        stint(20232024, "TOR", { TOI: 900, Shots: 120, Goals: 12, "Total Assists": 8, "Second Assists": 3 }, { GF: 30, CF: 400, CA: 400 }),
        stint(20222023, "TOR", { TOI: 900, Shots: 120, Goals: 10, "Total Assists": 9, "Second Assists": 5 }, { GF: 35, CF: 400, CA: 400 })
      ],
      rates: plainRates
    };
    serveReports(reports);
    const fromAverages = await call(averagesRoute);
    serveReports(reports);
    const fromThreeYear = await call(threeYearRoute);
    expect(fromThreeYear.success).toBe(true);
    const { message: _a, ...averagesBody } = fromAverages;
    const { message: _b, ...threeYearBody } = fromThreeYear;
    expect(threeYearBody).toEqual(averagesBody);
    // IPP = (goals + assists) ÷ on-ice GF, pooled: 63 / 115.
    expect(threeYearBody.threeYearCountsAverages.IPP).toBeCloseTo(
      (63 / 115) * 100,
      9
    );
  });
});
