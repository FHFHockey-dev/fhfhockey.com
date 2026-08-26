import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MobileDraftTabs, {
  MOBILE_DRAFT_TAB_STORAGE_KEY,
  useMobileDraftTab,
} from "../../../components/DraftDashboard/MobileDraftTabs";

function Harness() {
  const [activeTab, setActiveTab] = useMobileDraftTab();
  return (
    <>
      <MobileDraftTabs activeTab={activeTab} onChange={setActiveTab} />
      <section
        role="tabpanel"
        aria-label="Setup panel"
        hidden={activeTab !== "setup"}
      >
        <label>
          League name
          <input />
        </label>
      </section>
      <section
        role="tabpanel"
        aria-label="Board panel"
        hidden={activeTab !== "board"}
      >
        Board state
      </section>
    </>
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("mobile Draft Dashboard quick tabs", () => {
  it("exposes five tabs and supports click and arrow-key activation", async () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Setup",
      "Suggested",
      "Players",
      "Roster",
      "Board",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Players" }));
    const playersTab = screen.getByRole("tab", { name: "Players" });
    expect(playersTab.getAttribute("aria-selected")).toBe("true");
    playersTab.focus();
    fireEvent.keyDown(playersTab, { key: "ArrowRight" });
    const rosterTab = screen.getByRole("tab", { name: "Roster" });
    expect(rosterTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(rosterTab);
    await waitFor(() =>
      expect(
        window.sessionStorage.getItem(MOBILE_DRAFT_TAB_STORAGE_KEY),
      ).toBe("roster"),
    );
  });

  it("restores the active session tab and preserves hidden panel state", async () => {
    window.sessionStorage.setItem(MOBILE_DRAFT_TAB_STORAGE_KEY, "board");
    const view = render(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Board" }).getAttribute(
          "aria-selected",
        ),
      ).toBe("true"),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Setup" }));
    const input = screen.getByRole("textbox", { name: "League name" });
    fireEvent.change(input, { target: { value: "Keeper League" } });
    fireEvent.click(screen.getByRole("tab", { name: "Board" }));
    expect(
      view.container.querySelector<HTMLElement>(
        '[role="tabpanel"][aria-label="Setup panel"]',
      )?.hidden,
    ).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Setup" }));
    expect((screen.getByRole("textbox", { name: "League name" }) as HTMLInputElement).value).toBe(
      "Keeper League",
    );
  });
});
