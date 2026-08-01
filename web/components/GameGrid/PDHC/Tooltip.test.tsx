import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Tooltip from "./Tooltip";

afterEach(cleanup);

describe("PDHC dialog trigger", () => {
  it("supports keyboard entry, trapped focus, Escape dismissal, and focus return", () => {
    render(
      <Tooltip content={<p>Probability details</p>}>
        <span>Open matchup</span>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Open matchup" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    const dialog = screen.getByRole("dialog", {
      name: "Game probability details",
    });
    const close = screen.getByRole("button", {
      name: "Close game probability details",
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(document.activeElement).toBe(trigger);
        resolve();
      });
    });
  });

  it("uses a unique dialog ownership id for each trigger", () => {
    render(
      <>
        <Tooltip content={<p>First details</p>}>
          <span>First matchup</span>
        </Tooltip>
        <Tooltip content={<p>Second details</p>}>
          <span>Second matchup</span>
        </Tooltip>
      </>,
    );

    const first = screen.getByRole("button", { name: "First matchup" });
    const second = screen.getByRole("button", { name: "Second matchup" });

    expect(first.getAttribute("aria-controls")).not.toBe(
      second.getAttribute("aria-controls"),
    );
  });
});
