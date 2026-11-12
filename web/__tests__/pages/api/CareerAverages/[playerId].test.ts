import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// W1 P0 #25 (BC W1-9 D3/D12): /charts career averages pooled from matched
// components; L3 parseTime caller ticket (unknown TOI stays unknown).

const { fetchNstTextWithCacheByUrlMock } = vi.hoisted(() => ({
  fetchNstTextWithCacheByUrlMock: vi.fn()
}));

vi.mock("lib/nst/client", () => ({
  buildNstUrlString: () => "https://data.naturalstattrick.com/playerreport.php",
  fetchNstTextWithCacheByUrl: fetchNstTextWithCacheByUrlMock
}));

import handler from "../../../../pages/api/CareerAverages/[playerId]";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

const table = (id: string, headers: string[], rows: string[][]) =>
  `<table id="${id}"><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</table>`;

const IND_HEADERS = [
  "Season", "Team", "TOI", "Goals", "Shots", "S%", "ixG", "iFF", "IPP",
  "Total Points", "First Assists", "Second Assists", "Total Assists",
  "iHDCF", "iSCF"
];
const OI_HEADERS = [
  "Season", "Team", "GF", "SF", "On-Ice SH%", "Off.\u00a0Zone Starts",
  "Def. Zone Starts", "Off. Zone Start %", "CF", "CA", "CF%", "xGF", "xGA", "xG%"
];

function nstPage() {
  const individual = table("indreg", IND_HEADERS, [
    // 1-for-4 in 100 minutes, no assists at all (secA% 0/0).
    ["20232024", "TOR", "100", "1", "4", "25.0", "0.4", "6", "75.0", "6", "6", "0", "0", "2", "3"],
    // 20-for-250 in 1,000 minutes.
    ["20242025", "TOR", "1000", "20", "250", "8.0", "20", "300", "66.7", "40", "10", "10", "20", "30", "50"],
    // Unknown cells: skipped, never zero.
    ["20222023", "TOR", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
    // Season in progress: it is the judged window, not the career.
    ["20262027", "TOR", "50", "9", "10", "90.0", "5", "12", "100.0", "9", "0", "0", "0", "8", "9"]
  ]);
  const onIce = table("reg", OI_HEADERS, [
    ["20232024", "TOR", "8", "80", "10.0", "30", "10", "75.0", "100", "50", "66.7", "6", "4", "60.0"],
    ["20242025", "TOR", "60", "600", "10.0", "100", "100", "50.0", "500", "500", "50.0", "40", "40", "50.0"],
    ["20222023", "TOR", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
    ["20262027", "TOR", "9", "20", "45.0", "9", "1", "90.0", "40", "10", "80.0", "5", "1", "83.3"]
  ]);
  return `<html><body>${individual}${onIce}</body></html>`;
}

describe("/api/CareerAverages/[playerId] pooled career averages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pools matched components over completed seasons", async () => {
    fetchNstTextWithCacheByUrlMock.mockResolvedValue({ text: nstPage() });
    const res = createMockRes();
    await handler({ query: { playerId: "8478402" }, body: {} } as any, res);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    // S% = 21 / 254 = 8.27%, not the mean of 25% and 8% (16.5%).
    expect(data["S%"]).toBeCloseTo(21 / 254, 10);
    // Decision 17: xS% = ixG / iFF.
    expect(data["xS%"]).toBeCloseTo(20.4 / 306, 10);
    // IPP = points / on-ice GF = 46 / 68; an unknown season changes nothing.
    expect(data.IPP).toBeCloseTo(46 / 68, 10);
    expect(data["oiSH%"]).toBeCloseTo(68 / 680, 10);
    // A zero-assist season does not reset the secondary-assist share.
    expect(data["secA%"]).toBeCloseTo(10 / 20, 10);
    // SOG/60 pools shots over minutes: 254 / 1100 x 60, not the mean of rates.
    expect(data["SOG/60"]).toBeCloseTo((254 / 1100) * 60, 10);
    // OZS% = OZ / (OZ + DZ) (decision 9).
    expect(data["oZS%"]).toBeCloseTo(130 / 240, 10);
    expect(data.goals).toBeCloseTo(10.5, 10);
    expect(data.seasons).toBe(3);
    // Components behind the sample-aware /charts comparison (D12).
    expect(data.components).toMatchObject({
      "S%": { numerator: 21, denominator: 254 },
      IPP: { numerator: 46, denominator: 68 },
      "SOG/60": { numerator: 254, denominator: 1100 },
      "oZS%": { numerator: 130, denominator: 240 }
    });
  });

  it("returns null, not zero, when every completed season is unknown", async () => {
    const individual = table("indreg", IND_HEADERS, [
      ["20232024", "TOR", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
      ["20262027", "TOR", "50", "9", "10", "90.0", "5", "12", "100.0", "9", "0", "0", "0", "8", "9"]
    ]);
    const onIce = table("reg", OI_HEADERS, [
      ["20232024", "TOR", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
      ["20262027", "TOR", "9", "20", "45.0", "9", "1", "90.0", "40", "10", "80.0", "5", "1", "83.3"]
    ]);
    fetchNstTextWithCacheByUrlMock.mockResolvedValue({ text: `${individual}${onIce}` });
    const res = createMockRes();
    await handler({ query: { playerId: "8478402" }, body: {} } as any, res);

    expect(res.body.data).toMatchObject({
      "S%": null,
      "xS%": null,
      IPP: null,
      "secA%": null,
      "SOG/60": null,
      "oZS%": null,
      goals: null
    });
  });
});
