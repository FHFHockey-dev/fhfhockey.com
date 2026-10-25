import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(__dirname, "../../styles/globals.css"), "utf8");

describe("global input focus", () => {
  it("only hides the outline for pointer focus", () => {
    expect(css).not.toMatch(/textarea:focus,\s*input:focus\s*{\s*outline:\s*none/);
    expect(css).toMatch(/input:focus:not\(:focus-visible\)\s*{\s*outline:\s*none/);
  });

  it("keeps keyboard focus visible with the design focus color", () => {
    expect(css).toMatch(/input:focus-visible\s*{\s*outline:\s*3px solid rgb\(255, 193, 8\)/);
  });
});
