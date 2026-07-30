import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import LegacySurfaceNotice from "components/LegacySurfaceNotice/LegacySurfaceNotice";

describe("LegacySurfaceNotice", () => {
  it("labels retained behavior, points to its replacement, and blocks indexing", () => {
    render(
      <LegacySurfaceNotice
        replacementHref="/FORGE"
        replacementLabel="FORGE Quick Read"
      >
        Retained for old bookmarks.
      </LegacySurfaceNotice>,
    );

    expect(screen.getByRole("note").textContent).toContain(
      "Legacy analysis surface",
    );
    expect(
      screen
        .getByRole("link", { name: "Use FORGE Quick Read" })
        .getAttribute("href"),
    ).toBe("/FORGE");
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex,nofollow");
  });
});
