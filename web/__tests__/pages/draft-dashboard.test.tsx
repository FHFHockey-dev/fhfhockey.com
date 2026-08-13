import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DraftDashboardPage from "../../pages/draft-dashboard";

describe("Draft Dashboard route", () => {
  it("server-renders a non-dismissible season update notice", () => {
    const html = renderToString(<DraftDashboardPage />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Draft Dashboard");
    expect(html).toContain(
      "Actively being updated for the 2026-2027 season. Check back soon"
    );
  });
});
