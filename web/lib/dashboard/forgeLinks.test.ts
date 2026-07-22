import { describe, expect, it } from "vitest";

import {
  buildForgeHref,
  isRealUtcDateOnly,
  parseForgeDateParam,
  parseForgeResolvedDateParam,
} from "./forgeLinks";

const ACTIVE_FORGE_ROUTE_SURFACES = [
  "/FORGE",
  "/forge/dashboard",
  "/forge/command-center",
  "/forge/team/NJD",
  "/forge/player/88",
  "/trends/player/88",
] as const;

describe("Forge date route contract", () => {
  it.each(["2024-02-29", "2026-03-14", "2026-12-31"])(
    "accepts the real UTC calendar date %s",
    (value) => {
      expect(isRealUtcDateOnly(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-29",
    "2026-04-31",
    "2026-99-99",
    "2026-00-10",
    "2026-03-1",
    "2026-03-14T00:00:00.000Z",
  ])("rejects the non-real or non-canonical date %s", (value) => {
    expect(isRealUtcDateOnly(value)).toBe(false);
  });

  it("preserves canonical requested-date fallback and resolved-date semantics", () => {
    expect(parseForgeDateParam("2024-02-29", "2026-03-14")).toBe("2024-02-29");
    expect(parseForgeDateParam("2026-02-29", "2026-03-14")).toBe("2026-03-14");
    expect(
      parseForgeDateParam(["2026-04-31", "2024-02-29"], "2026-03-14"),
    ).toBe("2026-03-14");
    expect(parseForgeResolvedDateParam("2024-02-29")).toBe("2024-02-29");
    expect(parseForgeResolvedDateParam("2026-02-29")).toBeNull();
  });

  it.each(ACTIVE_FORGE_ROUTE_SURFACES)(
    "keeps real dates and drops impossible dates when building %s links",
    (pathname) => {
      expect(
        buildForgeHref(pathname, {
          date: "2024-02-29",
          resolvedDate: "2024-02-28",
          mode: "week",
        }),
      ).toBe(`${pathname}?date=2024-02-29&mode=week&resolvedDate=2024-02-28`);

      expect(
        buildForgeHref(pathname, {
          date: "2026-02-29",
          resolvedDate: "2026-04-31",
          mode: "week",
        }),
      ).toBe(`${pathname}?mode=week`);
    },
  );
});
