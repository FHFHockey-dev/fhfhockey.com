import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomepagePulse from "./HomepagePulse";

describe("HomepagePulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    const paths = svg?.querySelectorAll("path");
    expect(paths).toHaveLength(3);
    expect(paths?.[0].getAttribute("d")).toBe(paths?.[1].getAttribute("d"));
    expect(paths?.[1].getAttribute("d")).toBe(paths?.[2].getAttribute("d"));
    expect(svg?.querySelector("text, title, foreignObject")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("fades between the model and daily visitor lines without adding labels", () => {
    vi.useFakeTimers();
    const { container } = render(
      <HomepagePulse
        initialPoints={[
          { timestamp: "2026-08-03T00:00:00.000Z", value: 0.08 },
          { timestamp: "2026-08-04T00:00:00.000Z", value: 0.16 },
          { timestamp: "2026-08-05T00:00:00.000Z", value: 0.11 },
        ]}
        initialVisitorPoints={[
          { timestamp: "2026-08-03T00:00:00.000Z", value: 30 },
          { timestamp: "2026-08-04T00:00:00.000Z", value: 18 },
          { timestamp: "2026-08-05T00:00:00.000Z", value: 42 },
        ]}
      />,
    );
    const firstPath = container.querySelector("path")?.getAttribute("d");
    const series = container.querySelector("g");

    act(() => vi.advanceTimersByTime(8_000));
    expect(series?.className.baseVal).toContain("homepagePulseSeriesFading");

    act(() => vi.advanceTimersByTime(600));
    expect(container.querySelector("path")?.getAttribute("d")).not.toBe(
      firstPath,
    );
    expect(series?.className.baseVal).not.toContain(
      "homepagePulseSeriesFading",
    );
    expect(container.querySelector("text, title, foreignObject")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
