import { describe, expect, it } from "vitest";

import { parsePlayerIds } from "../../../../../pages/api/v1/trends/player-trends";

describe("player trend rebuild batching", () => {
  it("normalizes an explicit player-id chunk without invalid or duplicate ids", () => {
    expect(parsePlayerIds("12, 16,12,bad,-1,0")).toEqual([12, 16]);
  });

  it("leaves an empty chunk unspecified so the route retains full-scope semantics", () => {
    expect(parsePlayerIds([])).toBeUndefined();
  });
});
