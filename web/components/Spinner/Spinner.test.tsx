import fs from "fs";
import path from "path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Spinner from "components/Spinner";

afterEach(cleanup);

describe("Spinner", () => {
  it("announces its label as a status when it is the only loading indicator", () => {
    render(<Spinner center label="Loading comments" />);

    expect(screen.getByRole("status").textContent).toBe("Loading comments");
  });

  it("stays silent and decorative when the caller already reports loading", () => {
    const { container } = render(<Spinner size="small" />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("stops rotating for people who prefer reduced motion", () => {
    const css = fs.readFileSync(path.join(__dirname, "Spinner.module.scss"), "utf8");

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.loadingSpinner\s*{\s*animation: none;/);
  });
});
