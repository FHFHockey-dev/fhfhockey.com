import React from "react";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TradePage, { getStaticProps } from "../../pages/buy-low-sell-high/trade";
import BlshTradeComparison from "../../components/blshTrade/BlshTradeComparison";
import { FIXTURE_BLSH_EVIDENCE } from "../../components/blshTrade/fixtureEvidence";
import { readCurrentBlshSnapshot } from "../../lib/buyLowSellHigh/researchSnapshot.server";
import * as archiveReader from "../../lib/buyLowSellHigh/researchSnapshot.server";
import { parseCurrentResearchSnapshot } from "../../lib/buyLowSellHigh/researchSnapshot";
import { syntheticCurrent } from "../../lib/buyLowSellHigh/__fixtures__/syntheticSnapshots";
import { BLSH_SAVED_SAMPLE_STORAGE_KEY, BLSH_STORAGE_KEY, emptyBlshState } from "../../lib/buyLowSellHigh/storage";
import { createArmCCandidateReader } from "../../lib/buyLowSellHigh/armCCandidate.server";
import { createArmCCandidateFixture } from "../../lib/buyLowSellHigh/armCCandidate.testHelper";
import { inspectArmCExport } from "../../lib/buyLowSellHigh/armCExport.server";
import { readArmCPreview } from "../../lib/buyLowSellHigh/armCPreview.server";
import { armCSnapshot } from "./armCSnapshot";

afterEach(() => { cleanup(); localStorage.clear(); });

it("opens the saved skater through the local trade page and closes both sources in production", async () => {
  const local = await getStaticProps({});
  if (!("props" in local)) throw new Error("missing local trade props");
  const props = await local.props;
  expect(props.saved).toHaveLength(2);
  const player = props.saved[0];
  expect(player.playerId).toBe(8470613);
  const original = JSON.stringify({ ...emptyBlshState(), draft: { give: ["existing-manager-draft"], receive: [] } });
  localStorage.setItem(BLSH_STORAGE_KEY, original);
  render(<TradePage {...props} />);
  const source = screen.getByLabelText("Preview data");
  expect((source as HTMLSelectElement).value).toBe("reviewed");
  const burns = within(screen.getByRole("article", { name: "Brent Burns" }));
  expect(burns.getByText("FHFH points").nextSibling?.textContent).toBe("8.85");
  expect(burns.getByText("Points per appearance").nextSibling?.textContent).toBe("1.77");
  expect(burns.getByText("Total ice time").nextSibling?.textContent).toBe("82:07");
  expect(burns.getByText("Personal baseline comparison withheld")).toBeTruthy();
  const short = within(screen.getByRole("article", { name: "David Perron" }));
  expect(short.getByText("FHFH points").nextSibling?.textContent).toBe("0.00");
  expect(short.getByText("This capture contains one appearance. Five are required.")).toBeTruthy();
  expect(screen.queryByText(/Supporting research index/)).toBeNull();
  fireEvent.change(source, { target: { value: "saved" } });
  expect(screen.queryByText("existing-manager-draft")).toBeNull();
  fireEvent.change(screen.getByLabelText("Add a player you give"), { target: { value: String(player.playerId) } });
  const card = within(screen.getByRole("article", { name: player.displayName }));
  expect(card.getByText("Recorded FHFH points per game").nextSibling?.textContent).toBe("1.82");
  expect(card.getByText(/Freshness is relative to that saved date/).textContent).toContain("2026-10-28");
  expect(card.getByText("No forecast number is shown for this player.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save draft selections" }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(BLSH_SAVED_SAMPLE_STORAGE_KEY)!).draft.give).toEqual([String(player.playerId)]));
  expect(localStorage.getItem(BLSH_STORAGE_KEY)).toBe(original);
  vi.stubEnv("NODE_ENV", "production");
  try { expect(await getStaticProps({})).toEqual({ notFound: true }); }
  finally { vi.unstubAllEnvs(); }
});

it("builds and rereads an immutable arm-C export through the trade adapter under isolated reviews", async () => {
  const f = createArmCCandidateFixture(), target = f.input.target;
  const root = mkdtempSync(join(tmpdir(), "blsh-reviewed-export-"));
  const dir = join(root, target.eventThroughDate, String(target.playerId));
  const args = [dir, String(target.playerId), target.eventThroughDate];
  const saved = join(dir, "snapshot.json"), archive = join(dir, "artifacts");
  const verify = createArmCCandidateReader(f.windowPolicy, f.referencePolicy);
  const inspect: typeof inspectArmCExport = (path, selected, at, action) => inspectArmCExport(path, selected, at, action, verify);
  try {
    mkdirSync(archive, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), f.input.manifestBytes);
    for (const [sha, bytes] of f.input.artifacts) writeFileSync(join(archive, sha), bytes);
    expect(await armCSnapshot(["build", ...args], f.evaluatedAtUTC)).toMatchObject({ status: "withheld", score: null });
    expect(existsSync(saved)).toBe(false);
    const cli = spawnSync(process.execPath, ["./node_modules/ts-node/dist/bin.js", "--transpile-only", "--compiler-options",
      '{"module":"commonjs","moduleResolution":"node"}', "scripts/blsh/armCSnapshot.ts", "build", ...args],
    { env: { ...process.env, NODE_PATH: "." }, encoding: "utf8" });
    expect(cli.status, cli.stderr).toBe(2);
    expect(JSON.parse(cli.stdout)).toMatchObject({ ...target, status: "withheld", score: null });
    expect(existsSync(saved)).toBe(false);
    const built = await armCSnapshot(["build", ...args], f.evaluatedAtUTC, inspect);
    expect(built.status).toBe("available");
    expect(await armCSnapshot(["read", ...args], f.evaluatedAtUTC, inspect)).toEqual(built);
    await expect(armCSnapshot(["build", ...args], f.evaluatedAtUTC, inspect)).rejects.toMatchObject({ code: "EEXIST" });
    const selected = [{ playerId: target.playerId, name: "Synthetic Window Skater" }];
    const preview = () => readArmCPreview(f.evaluatedAtUTC, root, target.eventThroughDate, inspect, selected);
    const reviewed = await preview();
    expect(reviewed.rows[0].profile?.evidence.reference.sourceIds).toHaveLength(50);
    render(<TradePage reviewed={reviewed} eventThroughDate="2026-10-28" saved={[]} />);
    const card = within(screen.getByRole("article", { name: selected[0].name }));
    expect(card.getByText("Recorded FHFH points per game").nextSibling?.textContent).toBe("0.40");
    expect(card.getByText(reviewed.rows[0].profile!.evidence.window.dates.join(" · "))).toBeTruthy();
    expect(card.queryByText(/#1 (among|overall)/)).toBeNull();
    expect((await readArmCPreview("2026-11-09T12:00:00Z", root, target.eventThroughDate, inspect, selected)).rows[0].profile).toBeNull();
    expect(await armCSnapshot(["read", ...args], f.evaluatedAtUTC)).toMatchObject({ status: "withheld", score: null });
    const packageCopy = JSON.parse(readFileSync(saved, "utf8"));
    packageCopy.profile.playerId++;
    writeFileSync(saved, JSON.stringify(packageCopy));
    expect((await preview()).rows[0]).toMatchObject({ profile: null, reasons: ["saved_package_differs_from_verified_rebuild"] });
    const hash = [...f.input.artifacts.keys()][0];
    writeFileSync(join(archive, hash), "changed source");
    expect((await preview()).rows[0]).toMatchObject({ profile: null, reasons: ["reviewed_export_unreadable"] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it("continues the personal-baseline review when the separate historical arm-A package fails verification", async () => {
  const read = vi.spyOn(archiveReader, "readCurrentBlshSnapshot").mockImplementation(() => { throw Error("digest mismatch"); });
  try {
    const local = await getStaticProps({});
    if (!("props" in local)) throw Error("missing local trade props");
    const props = await local.props;
    expect(props.saved).toEqual([]);
    render(<TradePage {...props} />);
    expect(screen.getByRole("article", { name: "Brent Burns" })).toBeTruthy();
    expect((screen.getByRole("option", { name: "Saved arm-A sample unavailable" }) as HTMLOptionElement).disabled).toBe(true);
  } finally { read.mockRestore(); }
});

it("selects dated saved v1 evidence with no forecasts and compares recorded FHFH points per appearance", () => {
  const snapshot = readCurrentBlshSnapshot();
  const give = snapshot.profiles.find(p => p.tracks.some(t => t.track === "fantasy_points"))!;
  const receive = snapshot.profiles.find(p => p.playerId !== give.playerId && p.score.list !== null)!;
  expect(snapshot.mapperVersion).toBe("blsh-display-profile-v1");
  expect(Object.hasOwn(give.score, "headline")).toBe(false);
  const evidence = { [give.playerId]: give, [receive.playerId]: receive, "777777777": give };
  render(<BlshTradeComparison recordsByHorizon={{ 5: [], 10: [], 20: [] }} evidence={evidence} />);
  const selector = screen.getByLabelText("Add a player you give");
  expect([...selector.querySelectorAll("option")].map(o => o.value)).not.toContain("777777777");
  fireEvent.change(selector, { target: { value: String(give.playerId) } });
  fireEvent.change(screen.getByLabelText("Add a player you receive"), { target: { value: String(receive.playerId) } });
  const card = within(screen.getByRole("article", { name: give.displayName }));
  expect(card.getByText("No forecast number is shown for this player.")).toBeTruthy();
  expect(card.getByText(/Freshness is relative to that saved date/).textContent).toContain(snapshot.eventThroughDate);
  const listed = within(screen.getByRole("article", { name: receive.displayName }));
  expect(listed.getByText(new RegExp(`#${receive.score.rank} overall`))).toBeTruthy();
  expect(listed.queryByText(/among forwards|among defence/)).toBeNull();
  const expected = (p: typeof give) => p.tracks.find(t => t.track === "fantasy_points")!.observed / p.evidence.window.games;
  expect(card.getByText("Recorded FHFH points per game").nextSibling?.textContent).toBe(expected(give).toFixed(2));
  fireEvent.click(screen.getByRole("button", { name: /Show a retrospective comparison instead/ }));
  const panel = within(screen.getByRole("region", { name: "Recorded FHFH Standard points per game" }));
  expect(panel.getByText("You give, recorded per game").nextSibling?.textContent).toBe(expected(give).toFixed(2));
  expect(panel.getByText("You receive, recorded per game").nextSibling?.textContent).toBe(expected(receive).toFixed(2));
  const net = expected(receive) - expected(give);
  expect(panel.getByText("Receive − give, recorded per game").nextSibling?.textContent).toBe((net > 0 ? "+" : "") + net.toFixed(2));
});

it("keeps an arm-C research method and a later window outside the fixed display parser", () => {
  const fixture = syntheticCurrent();
  expect(parseCurrentResearchSnapshot(fixture).referencePolicy.arm).toBe("A_development_reference");
  expect(() => parseCurrentResearchSnapshot({ ...fixture, referencePolicy: { ...fixture.referencePolicy, arm: "C_weighted_personal_baseline" } }))
    .toThrow(/selected provisional reference/);
  expect(() => parseCurrentResearchSnapshot({ ...fixture, eventThroughDate: "2026-10-31" })).toThrow(/frozen current scope/);
});

it.each([null, "Fixture scope"])("withholds a mismatched numeric selection through the whole card (%s)", fixtureBanner => {
  const p = FIXTURE_BLSH_EVIDENCE["fx-f5"], wrong = String(p.playerId + 1);
  render(<BlshTradeComparison recordsByHorizon={{ 5: [], 10: [], 20: [] }} fixtureBanner={fixtureBanner}
    evidence={{ [wrong]: p }} initialGive={[wrong]} />);
  expect(screen.queryByText(p.displayName)).toBeNull();
  expect(screen.queryByText(/Supporting research index/)).toBeNull();
  const card = within(screen.getByRole("article", { name: wrong }));
  expect(card.getByText("No Buy Low / Sell High evidence for this player.")).toBeTruthy();
});
