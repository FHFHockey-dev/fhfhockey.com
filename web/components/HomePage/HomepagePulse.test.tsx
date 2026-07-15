import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomepagePulse from "./HomepagePulse";

describe("HomepagePulse", () => {
  it("renders only an unlabeled decorative line", () => {
    const { container } = render(
      <HomepagePulse
        initialPoints={[
          { timestamp: "2026-06-16T12:00:00.000Z", value: 0.08 },
          { timestamp: "2026-06-17T12:00:00.000Z", value: 0.12 },
        ]}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("polyline")).toHaveLength(1);
    expect(svg?.querySelector("text, title, foreignObject")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
