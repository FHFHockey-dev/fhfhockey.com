import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";

test("Page", () => {
  render(
    <div>
      <h1>Good</h1>
    </div>
  );
  expect(screen.getByRole("heading", { level: 1, name: "Good" })).toBeDefined();
});
