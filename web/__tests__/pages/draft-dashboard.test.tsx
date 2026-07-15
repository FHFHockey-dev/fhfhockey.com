import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DraftDashboardPage from "../../pages/draft-dashboard";

describe("Draft Dashboard route", () => {
  it("server-renders a truthful loading state before client mount", () => {
    const html = renderToString(<DraftDashboardPage />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Draft Dashboard");
    expect(html).toContain("Loading draft tools and projection data");
  });
});
