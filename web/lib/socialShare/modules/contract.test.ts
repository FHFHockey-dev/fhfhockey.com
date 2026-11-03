import { describe, expect, it } from "vitest";
import { UNKNOWN_EVIDENCE, defineShareModule, parseShareSettings, shareSettingLines, sharePostExportBlock, sharePostExportToken, sharePostShowsCard, shareHeadlineSize, SharePostRequestError, type SharePostSnapshot } from "./contract";
import { buildRegistry, LANE_MODULES, SHARE_MODULES } from "./registry";

const entry = defineShareModule<{ x: number; pos: string; search: string; since: string | null }, { rows: number[] }>({
  id: "sample", title: "Sample", summary: "s", group: "skaters", basis: "observed",
  fields: [
    { id: "x", label: "X", kind: "number", default: 3, min: 0, max: 10 },
    { id: "pos", label: "Position", kind: "select", default: "all", options: [{ value: "all", label: "All skaters" }, { value: "D", label: "Defense" }] },
    { id: "search", label: "Search", kind: "text", default: "", clientOnly: true },
    { id: "since", label: "Since", kind: "date", default: null },
  ],
  validate: settings => settings.pos === "D" && settings.x === 9 ? "Refused pair." : null,
  load: async () => async () => ({ state: "ready", evidence: UNKNOWN_EVIDENCE, data: { rows: [] } }),
  card: async () => () => null,
  hasRows: data => data.rows.length > 0,
  altText: () => "alt",
});
const snapshot = (over: Partial<SharePostSnapshot> = {}): SharePostSnapshot => ({ schemaVersion: 1, id: "e1", post: "sample", state: "ready", reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: "2026-10-31T12:15:00Z", timeZone: "America/New_York", settings: {}, evidence: { ...UNKNOWN_EVIDENCE, sources: [{ name: "S", tables: ["t"], state: "ready", asOf: null, updatedAt: null }] }, data: { rows: [1] }, teams: [], fixture: false, ...over });
const now = Date.parse("2026-10-31T12:05:00Z");

describe("post settings", () => {
  it("takes visible defaults, types values and refuses unknown or invalid input", () => {
    expect(parseShareSettings(entry, {})).toEqual({ x: 3, pos: "all", search: "", since: null });
    expect(parseShareSettings(entry, { x: "0", pos: "D", since: "2026-10-01" })).toMatchObject({ x: 0, pos: "D", since: "2026-10-01" });
    for (const bad of [{ x: "11" }, { x: "" }, { x: "abc" }, { pos: "G" }, { since: "2026-02-31" }, { other: "1" }] as Record<string, string>[]) expect(() => parseShareSettings(entry, bad)).toThrow(SharePostRequestError);
    expect(() => parseShareSettings(entry, { pos: "D", x: "9" })).toThrow("Refused pair.");
  });
  it("keeps browser-only settings out of the server query", () => {
    expect(() => parseShareSettings(entry, { search: "abc" }, "server")).toThrow("Invalid query");
    expect(parseShareSettings(entry, {}, "server").search).toBe("");
  });
  it("prints the select's label and marks unset values", () => {
    expect(shareSettingLines(entry.fields, { x: 3, pos: "D", search: "", since: null }).map(line => line.value)).toEqual(["3", "Defense", "any", "any"]);
  });
});

describe("post export", () => {
  it("allows only a ready, unexpired, labeled, non-empty, real edition", () => {
    expect(sharePostExportBlock(entry, snapshot(), {}, now)).toBeNull();
    expect(sharePostExportBlock(entry, snapshot({ fixture: true }), {}, now)).toMatch(/fixture/);
    expect(sharePostExportBlock(entry, snapshot({ state: "partial", reasons: ["Gap."] }), {}, now)).toBe("Gap.");
    expect(sharePostExportBlock(entry, snapshot({ state: "stale", reasons: [] }), {}, now)).toMatch(/not ready/);
    expect(sharePostExportBlock(entry, snapshot({ expiresAt: "2026-10-31T12:04:00Z" }), {}, now)).toMatch(/expired/);
    expect(sharePostExportBlock(entry, snapshot({ expiresAt: null }), {}, now)).toMatch(/expired/);
    expect(sharePostExportBlock(entry, snapshot({ evidence: UNKNOWN_EVIDENCE }), {}, now)).toMatch(/source labels/);
    expect(sharePostExportBlock(entry, snapshot({ data: { rows: [] } }), {}, now)).toMatch(/Nothing qualifies/);
  });
  it("refuses export while server settings differ from the ones the data was built with; browser-only settings may differ", () => {
    const built = snapshot({ settings: { x: 3, pos: "all", search: "", since: null } });
    expect(sharePostExportBlock(entry, built, { x: 3, pos: "all", search: "", since: null }, now)).toBeNull();
    expect(sharePostExportBlock(entry, built, { x: 3, pos: "all", search: "connor", since: null }, now)).toBeNull();
    for (const changed of [{ x: 4 }, { pos: "D" }, { since: "2026-10-01" }]) expect(sharePostExportBlock(entry, built, { x: 3, pos: "all", search: "", since: null, ...changed }, now)).toMatch(/Wait for the post to update/);
  });
  it("ties the token to the edition, post and every setting, including browser-only ones", () => {
    const a = sharePostExportToken(entry.fields, snapshot(), { x: 3, pos: "all", search: "", since: null });
    expect(sharePostExportToken(entry.fields, snapshot(), { x: 3, pos: "all", search: "a", since: null })).not.toBe(a);
    expect(sharePostExportToken(entry.fields, snapshot({ id: "e2" }), { x: 3, pos: "all", search: "", since: null })).not.toBe(a);
  });
  it("never renders a card for stale, missing or blocked data", () => {
    expect(sharePostShowsCard(snapshot())).toBe(true);
    expect(sharePostShowsCard(snapshot({ state: "partial" }))).toBe(true);
    for (const state of ["stale", "missing", "blocked"] as const) expect(sharePostShowsCard(snapshot({ state }))).toBe(false);
    expect(sharePostShowsCard(snapshot({ data: null }))).toBe(false);
  });
});

describe("registry", () => {
  it("refuses duplicate and malformed ids and holds the example post", () => {
    expect(() => buildRegistry([[entry], [entry]])).toThrow("Duplicate");
    expect(() => buildRegistry([[{ ...entry, id: "Bad Id" }]])).toThrow("Invalid");
    expect(SHARE_MODULES.has("team-games")).toBe(true);
    expect(LANE_MODULES).toHaveLength(8);
  });
});

describe("shareHeadlineSize", () => {
  it("leaves a headline that fits at the header size and shrinks a longer one to a floor", () => {
    expect(shareHeadlineSize("GOALIE CATEGORY RESCUE")).toBeUndefined();
    expect(shareHeadlineSize("POINTS-FIRST MULTI CAT MONSTERS")).toBe(36);
    expect(shareHeadlineSize("X".repeat(80))).toBe(32);
  });
});
