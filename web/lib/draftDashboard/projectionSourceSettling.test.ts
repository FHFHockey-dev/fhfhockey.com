import { describe, expect, it } from "vitest";

import { fetchProjectionSourcesSettled } from "./projectionSourceSettling";

const sources = [
  { id: "healthy", displayName: "Healthy Source" },
  { id: "failed", displayName: "Failed Source" },
];

describe("fetchProjectionSourcesSettled", () => {
  it("preserves healthy results and reports a failed source", async () => {
    const result = await fetchProjectionSourcesSettled(
      sources,
      async (source) => {
        if (source.id === "failed") throw new Error("page unavailable");
        return [{ player_id: 1 }];
      },
    );

    expect(result.successes).toEqual([
      { source: sources[0], result: [{ player_id: 1 }] },
    ]);
    expect(result.warnings).toEqual([
      {
        sourceId: "failed",
        sourceName: "Failed Source",
        message: "page unavailable",
      },
    ]);
  });

  it("fails clearly when every enabled source fails", async () => {
    await expect(
      fetchProjectionSourcesSettled(sources, async (source) => {
        throw new Error(`${source.id} unavailable`);
      }),
    ).rejects.toThrow(
      "All enabled projection sources failed: Healthy Source: healthy unavailable; Failed Source: failed unavailable",
    );
  });
});
