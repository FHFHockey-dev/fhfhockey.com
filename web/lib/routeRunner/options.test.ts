import { describe, expect, it } from "vitest";

import { parseRunnerInput } from "./core";
import {
  ROUTE_RUNNER_OPTIONS,
  splitRunnerUrl,
  switchRunnerRoute,
  withRunnerParam
} from "./options";
import { ROUTE_RUNNER_PATHS, ROUTE_RUNNER_ROUTES } from "./registry";

describe("ROUTE_RUNNER_OPTIONS", () => {
  it("covers every allowlisted route and never offers a runner-owned param", () => {
    expect(Object.keys(ROUTE_RUNNER_OPTIONS).sort()).toEqual([...ROUTE_RUNNER_PATHS].sort());
    for (const path of ROUTE_RUNNER_PATHS) {
      const options = ROUTE_RUNNER_OPTIONS[path];
      const keys = options.map((option) => option.key);
      expect(new Set(keys).size).toBe(keys.length);
      const runnerParams: readonly string[] =
        (ROUTE_RUNNER_ROUTES[path] as { runnerParams?: readonly string[] }).runnerParams ?? [];
      expect(keys.filter((key) => runnerParams.includes(key))).toEqual([]);
      for (const option of options) {
        const shaped = option as { kind: string; values?: readonly string[]; flagValue?: string };
        if (["choice", "select", "multi"].includes(shaped.kind)) {
          expect(shaped.values?.length).toBeGreaterThan(0);
        }
        if (shaped.kind === "flag") expect(shaped.flagValue).toBeTruthy();
      }
    }
  });

  it("leaves table-clearing and auto-resume params out of the rolling builder", () => {
    const keys = ROUTE_RUNNER_OPTIONS["/api/v1/db/update-rolling-player-averages"].map(
      (option) => option.key
    );
    expect(keys).not.toContain("fullRefresh");
    expect(keys).not.toContain("fullRefreshMode");
    expect(keys).not.toContain("autoResume");
  });
});

describe("URL builder helpers", () => {
  it("sets, replaces and removes one param and keeps commas readable", () => {
    let url = "/api/v1/db/update-nst-gamelog";
    url = withRunnerParam(url, "runMode", "incremental");
    url = withRunnerParam(url, "dates", "2026-01-12,2026-04-12");
    url = withRunnerParam(url, "runMode", "reverse");
    expect(url).toBe("/api/v1/db/update-nst-gamelog?runMode=reverse&dates=2026-01-12,2026-04-12");
    expect(withRunnerParam(url, "dates", "  ")).toBe("/api/v1/db/update-nst-gamelog?runMode=reverse");
    expect(withRunnerParam("/api/v1/db/update-nst-gamelog?overwrite=yes", "overwrite", null)).toBe(
      "/api/v1/db/update-nst-gamelog"
    );
  });

  it("reads pasted absolute URLs and drops a trailing slash", () => {
    const parts = splitRunnerUrl("https://fhfhockey.com/api/v1/db/update-wgo-totals/?season=20252026");
    expect(parts?.path).toBe("/api/v1/db/update-wgo-totals");
    expect(parts?.params.get("season")).toBe("20252026");
    expect(splitRunnerUrl("   ")).toBeNull();
  });

  it("keeps only the params the next route offers when switching", () => {
    expect(
      switchRunnerRoute(
        "/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18&datasetGroup=fiveOnFive",
        "/api/v1/db/update-nst-team-daily"
      )
    ).toBe("/api/v1/db/update-nst-team-daily?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18");
    expect(switchRunnerRoute("", "/api/v1/db/update-nst-current-season")).toBe(
      "/api/v1/db/update-nst-current-season"
    );
  });

  it("builds URLs the runner accepts", () => {
    let url = "/api/v1/db/update-rolling-player-averages";
    url = withRunnerParam(url, "startDate", "2026-10-07");
    url = withRunnerParam(url, "endDate", "2026-10-18");
    url = withRunnerParam(url, "strength", "ev,pp");
    url = withRunnerParam(url, "fastMode", "true");
    expect(parseRunnerInput(url)).toMatchObject({
      ok: true,
      routePath: "/api/v1/db/update-rolling-player-averages",
      query: { startDate: "2026-10-07", endDate: "2026-10-18", strength: "ev,pp", fastMode: "true" }
    });
  });
});
