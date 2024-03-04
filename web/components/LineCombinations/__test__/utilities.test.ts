import { describe, expect, test } from "vitest";
import { lineCombos_2023020951_2023020970 } from "./LineCombinationsData";
import { getLineChanges } from "../utilities";

describe("getLineChanges", () => {
  test("game 2023020951 vs 2023020970", () => {
    const changes = getLineChanges(lineCombos_2023020951_2023020970 as any);
    expect(changes.promotions).toEqual([1]);
    expect(changes.demotions).toEqual([1]);
  });
});
