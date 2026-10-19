import { describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase", () => ({ default: { auth: {} } }));

import { validateAdminRoutePath } from "./CronRouteRunner";

describe("validateAdminRoutePath", () => {
  it("accepts a same-origin /api/ path with a query string", () => {
    const path =
      "/api/v1/db/update-nst-team-daily?runMode=reverse&startDate=2026-09-29&endDate=2026-09-25&overwrite=false";
    expect(validateAdminRoutePath(path)).toEqual({ ok: true, path });
  });

  it("trims surrounding whitespace and drops a fragment", () => {
    expect(validateAdminRoutePath("  /api/v1/db/x?a=1#frag \n")).toEqual({
      ok: true,
      path: "/api/v1/db/x?a=1"
    });
  });

  it.each([
    "",
    "   ",
    "https://evil.example/api/x",
    "http://localhost:3000/api/x",
    "javascript:alert(1)",
    "//evil.example/api/x",
    "/\\evil.example/api/x",
    "/api\\..\\x",
    "/api/x\\y",
    "/api/x y",
    "/api/x\ty",
    "/api/x\ny",
    "/api/x\u0000",
    "/api/x\u007f",
    "/api/x y",
    "api/x",
    "/apix",
    "/db/x",
    "/api/../secret",
    "/api/%2e%2e/secret"
  ])("rejects %j", (input) => {
    expect(validateAdminRoutePath(input).ok).toBe(false);
  });
});
