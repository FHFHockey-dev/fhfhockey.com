import { expect, it } from "vitest";
import { defaultOutlineStack, moveOutlineRing, readOutlineDraft, teamOutlineColors, validateOutlineStack } from "./outlineStack";

it("normalizes exact team presets and validates bounded geometry including empty stacks", () => {
  expect(defaultOutlineStack("MIN")).toEqual(["#154734", "#A6192E", "#DDCBA4"].map(color => ({ color, width: 5 })));
  expect(teamOutlineColors("MIN").map(r => r.color)).toEqual(["#FFFFFF", "#154734", "#A6192E", "#DDCBA4"]);
  expect(validateOutlineStack([{ color: "#abcdef", width: .5 }])).toEqual([{ color: "#ABCDEF", width: .5 }]);
  expect(validateOutlineStack([])).toEqual([]);
  for (const width of [0, -1, NaN, Infinity, 12.5, .75]) expect(() => validateOutlineStack([{ color: "#FFFFFF", width }])).toThrow();
  expect(() => validateOutlineStack(Array(6).fill({ color: "#FFFFFF", width: 1 }))).toThrow("5");
  expect(() => validateOutlineStack(Array(4).fill({ color: "#FFFFFF", width: 12 }))).toThrow("40");
  expect(() => validateOutlineStack([{ color: "red", width: 5 }])).toThrow("color");
  expect(readOutlineDraft([{ id: "a", color: "#FFFFFF", width: "", colorMode: "preset" }]).rings).toBeNull();
});
it("moves whole rings without mutation and preserves widths/colors across repeated ordering", () => {
  const draft = defaultOutlineStack("MIN").map((r, i) => ({ id: String(i), color: r.color, width: String(i + 1), colorMode: "preset" as const }));
  let moved = moveOutlineRing(draft, 0, 1); expect(moved.map(r => r.id)).toEqual(["1", "0", "2"]);
  moved = moveOutlineRing(moved, 1, 1); expect(moved[2]).toEqual(draft[0]);
  expect(moveOutlineRing(moved, 2, 1)).toEqual(moved); expect(draft.map(r => r.id)).toEqual(["0", "1", "2"]);
});
