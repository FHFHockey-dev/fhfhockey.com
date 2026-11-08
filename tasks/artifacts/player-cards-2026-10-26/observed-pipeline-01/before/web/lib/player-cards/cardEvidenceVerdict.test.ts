// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { GetServerSidePropsContext } from "next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlayerCardsSharePage, { getServerSideProps } from "../../pages/social-share/player-cards";
import { evidenceStatusCopy } from "./evidenceVerdictCopy";
import type { LocalCardInput } from "./adapter";
import { cardEvidenceVerdict, unclaimedBundle } from "./cardEvidenceVerdict";
import type { EvidenceBundle } from "./evidenceBundle";
import { loadAdmittedEvidence, validateAdmittedEvidence } from "./evidenceLoader";
import { buildInteractionFixture } from "./interactionFixtures";
import { flowSettings, INITIAL_FLOW } from "./interactionSnapshot";
import type { Appearance } from "./windows";

const WEB = path.resolve(__dirname, "../..");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" || name.startsWith(".") || name === "__fixtures__" ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}
const APP = ["lib", "components", "pages", "app", "hooks", "utils"].map(dir => path.join(WEB, dir)).filter(dir => { try { return statSync(dir).isDirectory(); } catch { return false; } }).flatMap(sources);
const rel = (file: string) => path.relative(WEB, file);
const importers = (pattern: RegExp) => APP.filter(file => pattern.test(readFileSync(file, "utf8"))).map(rel).sort();
/** Static `from`, dynamic `import()` and `require()` of a module whose path ends in `name`. */
const loads = (name: string) => new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*)["'\`][^"'\`]*\\b(?:${name})(?:\\.tsx?)?["'\`]`);

describe("evidence wiring boundary", () => {
  it("lets only the trusted loader call the raw validator", () => {
    expect(importers(/\bvalidateEvidenceBundle\b/)).toEqual(["lib/player-cards/evidenceBundle.ts", "lib/player-cards/evidenceLoader.ts"]);
  });
  it("keeps the loader behind the server-only verdict helper, used only by server page code", () => {
    expect(importers(loads("evidenceLoader"))).toEqual(["lib/player-cards/cardEvidenceVerdict.ts"]);
    expect(importers(loads("cardEvidenceVerdict"))).toEqual(["pages/social-share/player-cards.tsx"]);
    expect(importers(loads("evidenceLoader|cardEvidenceVerdict|evidenceAdmissions")).filter(file => file.startsWith("components/"))).toEqual([]);
  });
  it("matches dynamic import() and require() as well as static imports", () => {
    const pattern = loads("evidenceLoader");
    expect(['import("lib/player-cards/evidenceLoader")', "require('../evidenceLoader')", "import(`./evidenceLoader.ts`)", 'import { x } from "./evidenceLoader"'].every(text => pattern.test(text))).toBe(true);
    expect(pattern.test('import { x } from "./evidenceLoaderNotes"')).toBe(false);
  });
});

describe("studio preview verdict", () => {
  it("stays incomplete for the fabricated preview even though its fixture self-asserts every proof flag", async () => {
    const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
    expect(input.population.complete).toBe(true);
    const verdict = await cardEvidenceVerdict(input, unclaimedBundle(input, INITIAL_FLOW.playerId, "studio-preview"));
    expect(verdict).toMatchObject({ state: "incomplete", liveActivation: false, premiumActivation: false });
    expect(verdict.issueCodes).toEqual(expect.arrayContaining(["appearance-history-missing", "game-finality-missing", "metric-definition-missing", "population-membership-missing"]));
    expect(Object.values(verdict.metrics).every(state => state === "incomplete")).toBe(true);
  });
});

describe("page props carry no free text, receipt ids or bundle internals", () => {
  const FILE = "player-cards-2026-10-25/completion-read-01/RESULT.json";
  const GAMES = [[2026020095, "2026-10-13"], [2026020111, "2026-10-15"], [2026020123, "2026-10-17"], [2026020151, "2026-10-20"], [2026020167, "2026-10-23"]] as const;
  // Observed bundle against the reviewed five-row admission, plus an unadmitted internal reference and a population claim.
  const observed = (): { input: LocalCardInput; bundle: EvidenceBundle } => {
    const settings = { ...flowSettings(INITIAL_FLOW), cutoff: "2026-10-25T00:00:00Z", period: { mode: "appearances" as const, count: 5 as const } };
    const appearances: Appearance[] = GAMES.map(([gameId, date]) => ({ playerId: 1, gameId, season: 20262027, gameType: "regular", date, played: true, completion: { status: "unverified" } }));
    const { season, gameType, strength, period, cutoff } = settings;
    return {
      input: { id: "props-leak-check", origin: "local-observed", capturedAt: "2026-10-25T06:10:23Z", settings,
        source: { definition: "local-observed-check", version: "v0", definitionReference: "", verifiedMetrics: [] },
        population: { scope: "all-nhl", complete: false, reference: "", expectedPlayerIds: [1] },
        players: [{ frame: { playerId: 1, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: false, historyThrough: "", historyReference: "", appearances }, records: [] }] },
      bundle: { id: "internal-bundle-7f3a", origin: "local-observed", selection: { playerId: 1, season, gameType, strength, period, cutoff },
        history: [{ playerId: 1, receipt: { receiptId: "internal/history-path.json#player-1", sha256: "0".repeat(64) } }], definitions: [],
        populations: [{ metricId: "atoi", receipt: { receiptId: "internal/population.json#members-8475000", sha256: "1".repeat(64) } }],
        finality: GAMES.map(([gameId]) => ({ gameId, receipt: { receiptId: `${FILE}#game-${gameId}`, sha256: "6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2" } })) },
    };
  };

  it("serializes only states and codes, never the validator's reasons or any receipt id", async () => {
    const { input, bundle } = observed();
    const full = validateAdmittedEvidence(input, bundle, await loadAdmittedEvidence({ root: path.join(__dirname, "__fixtures__", "retained"), origin: "local-observed" }));
    const reasons = Array.from(new Set([...full.issues.map(issue => issue.reason), ...Object.values(full.metrics).flatMap(metric => metric.reasons)]));
    expect(reasons.some(reason => reason.includes("internal/history-path.json#player-1"))).toBe(true);
    const json = JSON.stringify(await cardEvidenceVerdict(input, bundle));
    expect(JSON.parse(json)).toMatchObject({ state: "incomplete", issueCodes: expect.arrayContaining(["finality-not-actual-end", "receipt-not-retained"]) });
    for (const secret of [...reasons, bundle.id, FILE, "internal/", "#player-1", "8475000", "6ee7b37d"]) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/"(reasons?|receiptId|bundleId|card|readings|rank|value|sha256|retainedPath)"/);
  });
  it("ships exactly { evidence: { state } } from the page's getServerSideProps", async () => {
    const setHeader = vi.fn();
    const result = await getServerSideProps({ res: { setHeader } } as unknown as GetServerSidePropsContext);
    expect(setHeader).toHaveBeenCalledWith("X-Robots-Tag", "noindex, nofollow");
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({ props: { evidence: { state: "incomplete" } } });
  });
});

vi.mock("components/SocialShare/SocialShareAccessGate", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("components/player-cards/PlayerCardShareStudio", () => ({ default: () => null }));

describe("studio evidence status line", () => {
  it("renders fixed copy selected by state only, never codes", async () => {
    const result = await getServerSideProps({ res: { setHeader: vi.fn() } } as unknown as GetServerSidePropsContext);
    const { evidence } = (result as { props: { evidence: Parameters<typeof PlayerCardsSharePage>[0]["evidence"] } }).props;
    const html = renderToStaticMarkup(createElement(PlayerCardsSharePage, { evidence }));
    expect(html).toContain('role="status" data-evidence-state="incomplete"');
    expect(html).toContain("Evidence check: incomplete");
    expect(html).toContain("Fabricated preview, no admitted evidence. Ranks are illustrative.");
    const input = buildInteractionFixture(flowSettings(INITIAL_FLOW), INITIAL_FLOW.scenario, INITIAL_FLOW.playerId);
    const { issueCodes } = await cardEvidenceVerdict(input, unclaimedBundle(input, INITIAL_FLOW.playerId, "studio-preview"));
    expect(issueCodes.length).toBeGreaterThan(0);
    for (const code of issueCodes) expect(html).not.toContain(code);
  });
  it("has copy for every verdict state and context, and falls back to rejected", () => {
    const states = ["eligible", "incomplete", "rejected"] as const;
    for (const context of ["fabricated-preview", "evidence-bundle"] as const) {
      expect(states.map(state => evidenceStatusCopy({ state }, context).title)).toEqual(["Evidence check: admitted evidence matches", "Evidence check: incomplete", "Evidence check: rejected"]);
      expect(evidenceStatusCopy({ state: "unknown" as "eligible" }, context).title).toBe("Evidence check: rejected");
    }
  });
  it("never calls a real evidence bundle a fabricated preview", () => {
    const states = ["eligible", "incomplete", "rejected", "unknown"] as const;
    for (const context of ["evidence-bundle", "unknown-context"] as const) {
      for (const state of states) expect(evidenceStatusCopy({ state: state as "eligible" }, context as "evidence-bundle").detail).not.toMatch(/fabricated|illustrative/i);
    }
    expect(evidenceStatusCopy({ state: "incomplete" }, "evidence-bundle").detail).toBe("Not all evidence is admitted. Ranks without admitted evidence are withheld.");
    expect(evidenceStatusCopy({ state: "incomplete" }, "fabricated-preview").detail).toBe("Fabricated preview, no admitted evidence. Ranks are illustrative.");
  });
});
