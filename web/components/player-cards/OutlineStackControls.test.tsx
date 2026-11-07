import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import OutlineStackControls from "./OutlineStackControls";
import { defaultOutlineStack, type OutlineDraftRing } from "../../lib/player-cards/outlineStack";
afterEach(cleanup);
const preset = (): OutlineDraftRing[] => defaultOutlineStack("MIN").map((r, i) => ({ id: String(i), color: r.color, width: "5", colorMode: "preset" }));
function Harness() { const [draft, setDraft] = useState(preset); return <OutlineStackControls team="MIN" draft={draft} pending={false} onChange={setDraft} onReset={() => setDraft(preset())} />; }
it("adds/removes, reorders whole rings with buttons, adjusts widths/custom colors and resets", () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText("Ring 1 width"), { target: { value: "7.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Move ring 1 outward" }));
  expect((screen.getByLabelText("Ring 2 width") as HTMLInputElement).value).toBe("7.5");
  expect((screen.getByLabelText("Ring 2 color") as HTMLSelectElement).value).toBe("#154734");
  fireEvent.change(screen.getByLabelText("Ring 2 color"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Ring 2 custom color"), { target: { value: "#123456" } });
  expect((screen.getByLabelText("Ring 2 custom color") as HTMLInputElement).value).toBe("#123456");
  fireEvent.click(screen.getByRole("button", { name: "Add outline" })); expect(screen.getByLabelText("Ring 4 width")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove ring 2" })); expect(screen.queryByLabelText("Ring 4 width")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset team stack" })); expect((screen.getByLabelText("Ring 1 color") as HTMLSelectElement).value).toBe("#154734");
  expect((screen.getByLabelText("Ring 1 width") as HTMLInputElement).value).toBe("5");
});
it("bounds repeated additions and total expansion, and permits removing every ring", () => {
  render(<Harness />); const add = screen.getByRole("button", { name: "Add outline" });
  fireEvent.click(add); fireEvent.click(add); expect(add.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Ring 1 width"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("Ring 2 width"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("Ring 3 width"), { target: { value: "12" } });
  expect(screen.getByRole("alert").textContent).toContain("40");
  for (let n = 5; n > 0; n--) fireEvent.click(screen.getByRole("button", { name: `Remove ring ${n}` }));
  expect(screen.getByText("No outlines. Add a ring to start.")).toBeTruthy(); expect(add.hasAttribute("disabled")).toBe(false);
});
