import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PlayerLookup from "./PlayerLookup";
afterEach(() => cleanup());
it("does not auto-select or fetch, exposes dated results and selects an exact ID", () => {
  const onSelect = vi.fn(); render(<PlayerLookup disabled={false} onSelect={onSelect} />);
  expect(screen.queryByRole("list")).toBeNull(); expect(onSelect).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Player name, team or NHL ID"), { target: { value: "Kucherov" } });
  expect(screen.getByText(/Identity catalog: 2026-10-24/)).toBeTruthy(); expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Nikita Kucherov.*TBL.*8476453/ }));
  expect(onSelect).toHaveBeenCalledWith({ id: 8476453, name: "Nikita Kucherov", team: "TBL", position: "R" }); expect(screen.queryByRole("list")).toBeNull();
});
it("keeps duplicate names distinguishable, supports Escape and announces empty results", () => {
  render(<PlayerLookup disabled={false} onSelect={vi.fn()} />); const input = screen.getByLabelText("Player name, team or NHL ID");
  fireEvent.change(input, { target: { value: "Elias Pettersson" } }); expect(screen.getAllByRole("button", { name: /Elias Pettersson/ })).toHaveLength(2); expect(screen.getByRole("status").textContent).toContain("2 catalog matches");
  fireEvent.keyDown(input, { key: "Escape" }); expect((input as HTMLInputElement).value).toBe(""); expect(screen.queryByRole("list")).toBeNull();
  fireEvent.change(input, { target: { value: "zzzzzzzzz" } }); expect(screen.getByRole("status").textContent).toContain("No catalog matches");
});
it("labels unsupported goalie results rather than silently trying the skater adapter", () => {
  const onSelect = vi.fn(); render(<PlayerLookup disabled={false} onSelect={onSelect} />);
  fireEvent.change(screen.getByLabelText("Player name, team or NHL ID"), { target: { value: "Vasilevskiy" } });
  const button = screen.getByRole("button", { name: /Andrei Vasilevskiy/ }); expect(button.hasAttribute("disabled")).toBe(true); expect(screen.getByText(/Goalie card data is unavailable/)).toBeTruthy(); fireEvent.click(button); expect(onSelect).not.toHaveBeenCalled();
});
it("disables lookup during export without losing the query", () => {
  const { rerender } = render(<PlayerLookup disabled={false} onSelect={vi.fn()} />); const input = screen.getByLabelText("Player name, team or NHL ID"); fireEvent.change(input, { target: { value: "Nikita" } });
  rerender(<PlayerLookup disabled onSelect={vi.fn()} />); expect(input.closest("fieldset")?.hasAttribute("disabled")).toBe(true); expect((input as HTMLInputElement).value).toBe("Nikita");
});
