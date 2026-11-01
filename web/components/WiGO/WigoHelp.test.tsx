import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import WigoHelp from "./WigoHelp";

describe("WigoHelp", () => {
  it("names its button and ties it to a popover holding the note", () => {
    render(<WigoHelp label="How this works"><p>The note.</p></WigoHelp>);
    const button = screen.getByRole("button", { name: "How this works" });
    const panel = screen.getByText("The note.").parentElement!;
    expect(panel.getAttribute("popover")).toBe("auto");
    expect(button.getAttribute("popovertarget")).toBe(panel.id);
  });
});
