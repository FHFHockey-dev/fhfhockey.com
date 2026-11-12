import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNstText } = vi.hoisted(() => ({ fetchNstText: vi.fn() }));

vi.mock("lib/nst/jobLifecycle.server", () => ({
  withNstJobLifecycle: (handler: unknown) => handler,
}));
vi.mock("lib/nst/client", () => ({
  buildNstUrlString: () => "https://example.test/playerreport.php",
  fetchNstTextWithCacheByUrl: fetchNstText,
}));

import handler from "pages/api/Teams/[teamAbbreviation]";

// NST player report: one row per season; TOI arrives as whole minutes ("1000")
// or mm:ss ("200:00").
const page = (seasons: Array<[string, string]>) => `
  <table id="indreg">
    <tr><th>Season</th><th>Shots</th><th>TOI</th></tr>
    ${seasons.map(([shots, toi], i) => `<tr><td>${2020 + i}</td><td>${shots}</td><td>${toi}</td></tr>`).join("")}
  </table>
  <table id="reg">
    <tr><th>Season</th><th>On-Ice SH%</th></tr>
    <tr><td>2020</td><td>10</td></tr>
    <tr><td>2021</td><td>10</td></tr>
  </table>`;

const sog60 = async (seasons: Array<[string, string]>) => {
  fetchNstText.mockResolvedValueOnce({ text: page(seasons) });
  const json = vi.fn();
  await (handler as any)({ query: { playerId: "8478402" } }, { json });
  const body = json.mock.calls[0][0];
  expect(body.success).toBe(true);
  return body.data["SOG/60"];
};

describe("legacy Teams route SOG/60 (W2-3 A5 caller)", () => {
  beforeEach(() => fetchNstText.mockReset());

  it("pools shots over minutes across seasons with unequal TOI", async () => {
    // 110 shots / 1,200 min × 60 = 5.5. The mean of season rates is 4.5
    // (route at ccb414c43); before that commit "1000" parsed as NaN → 1.5.
    expect(await sog60([["100", "1000"], ["10", "200:00"]])).toBeCloseTo(5.5, 10);
  });

  it("reads whole-minute TOI instead of showing 0", async () => {
    expect(await sog60([["5", "20"], ["10", "40"]])).toBeCloseTo(15, 10);
  });

  it("returns null when a season's TOI is unknown", async () => {
    expect(await sog60([["5", "20"], ["10", "-"]])).toBeNull();
    expect(await sog60([["5", "20"], ["10", ""]])).toBeNull();
  });
});

// Career rates pool their components (rule 26). Two seasons whose pooled
// values differ from the mean of NST's season percentages.
const table = (id: string, headers: string[], rows: string[][]) => `
  <table id="${id}">
    <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
  </table>`;
const IND = ["Season", "Team", "TOI", "Goals", "Total Assists", "Second Assists", "Total Points", "IPP", "Shots", "S%", "ixG", "iSCF", "iHDCF"];
const ONICE = ["Season", "Team", "GF", "SF", "On-Ice SH%", "Off. Zone Starts", "Def. Zone Starts", "Off. Zone Start %"];
const indRows = [
  ["20202021", "EDM", "1000", "10", "20", "5", "30", "60", "100", "10", "8", "40", "15"],
  ["20212022", "EDM", "200", "1", "2", "2", "3", "30", "20", "5", "4", "10", "5"],
];
const onIceRows = [
  ["20202021", "EDM", "50", "500", "10", "300", "100", "75"],
  ["20212022", "EDM", "10", "50", "20", "10", "40", "20"],
];
const careerStats = async (ind: string[][], onIce: string[][]) => {
  fetchNstText.mockResolvedValueOnce({
    text: table("indreg", IND, ind) + table("reg", ONICE, onIce),
  });
  const json = vi.fn();
  await (handler as any)({ query: { playerId: "8478402" } }, { json });
  const body = json.mock.calls[0][0];
  expect(body.success).toBe(true);
  return body.data;
};

describe("legacy Teams route career rates pool their components", () => {
  beforeEach(() => fetchNstText.mockReset());

  // [value, pooled, mean of season values that the old route returned]
  it.each([
    ["S%", 11 / 120, 0.075],
    ["xS%", 12 / 120, 0.14],
    ["IPP", 33 / 60, 0.45],
    ["oiSH%", 60 / 550, 0.15],
    ["secA%", 7 / 22, 0.625],
    ["oZS%", 310 / 450, 0.475],
  ])("pools %s from its components", async (key, pooled, seasonMean) => {
    const data = await careerStats(indRows, onIceRows);
    expect(data[key]).toBeCloseTo(pooled, 10);
    expect(data[key]).not.toBeCloseTo(seasonMean, 3);
  });

  it("returns null for a rate whose component is unknown", async () => {
    const ind = indRows.map((row) => [...row]);
    ind[1][8] = "-"; // Shots
    ind[1][5] = ""; // Second Assists
    const onIce = onIceRows.map((row) => [...row]);
    onIce[1][3] = "-"; // SF
    onIce[1][6] = "-"; // Def. Zone Starts
    const data = await careerStats(ind, onIce);
    expect(data["S%"]).toBeNull();
    expect(data["xS%"]).toBeNull();
    expect(data["secA%"]).toBeNull();
    expect(data["oiSH%"]).toBeNull();
    expect(data["oZS%"]).toBeNull();
    expect(data.IPP).not.toBeNull();
  });

  it("returns null IPP when a season has no on-ice row", async () => {
    const data = await careerStats(indRows, [onIceRows[0], ["20222023", "EDM", "10", "50", "20", "10", "40", "20"]]);
    expect(data.IPP).toBeNull();
  });

  it("returns a null per-season count mean when a season's count is unknown", async () => {
    const ind = indRows.map((row) => [...row]);
    ind[1][3] = "-"; // Goals
    const data = await careerStats(ind, onIceRows);
    expect(data.goals).toBeNull();
  });
});
