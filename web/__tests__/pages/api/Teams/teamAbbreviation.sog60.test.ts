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
