import { describe, expect, it } from "vitest";

import {
  buildCommandCenterRedirect,
  getServerSideProps,
} from "../../../pages/forge/dashboard";

describe("FORGE dashboard compatibility redirect", () => {
  it("redirects the legacy route to the canonical Command Center", async () => {
    await expect(
      getServerSideProps({ query: {} } as Parameters<
        typeof getServerSideProps
      >[0]),
    ).resolves.toEqual({
      redirect: {
        destination: "/forge/command-center",
        permanent: false,
      },
    });
  });

  it("preserves only query parameters supported by the Command Center", () => {
    expect(
      buildCommandCenterRedirect({
        date: "2026-03-14",
        resolvedDate: "2026-03-13",
        team: "CAR",
        position: "f",
        slate: "main",
        mode: "week",
      }),
    ).toBe(
      "/forge/command-center?date=2026-03-14&resolvedDate=2026-03-13&team=CAR&position=f&slate=main&mode=week",
    );
  });

  it("uses the first value for repeated compatible query parameters", () => {
    expect(
      buildCommandCenterRedirect({
        date: ["2026-03-14", "2026-03-15"],
        team: ["CAR", "NJD"],
      }),
    ).toBe("/forge/command-center?date=2026-03-14&team=CAR");
  });
});
