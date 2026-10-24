import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import DraftWorkspaceHeader from "../../../components/DraftDashboard/DraftWorkspaceHeader";
import ProjectionSourceSettings from "../../../components/DraftDashboard/ProjectionSourceSettings";

it("changes quick weight shares and equalizes only the displayed player group", () => {
  const onSkatersChange = vi.fn();
  const onGoaliesChange = vi.fn();
  const sources = { alpha: { isSelected: true, weight: 0.5 }, beta: { isSelected: true, weight: 0.5 } };
  render(<ProjectionSourceSettings compact skaters={sources} goalies={sources} onSkatersChange={onSkatersChange} onGoaliesChange={onGoaliesChange} customSources={[]} hasPicks={false} />);
  fireEvent.change(screen.getByRole("slider", { name: "Skaters alpha weight percent" }), { target: { value: "40" } });
  expect(onSkatersChange).toHaveBeenCalledWith({ alpha: { isSelected: true, weight: 0.4 }, beta: { isSelected: true, weight: 0.6 } });
  expect(onGoaliesChange).not.toHaveBeenCalled();
  onSkatersChange.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Goalies" }));
  expect(screen.queryByRole("slider", { name: "Skaters alpha weight percent" })).toBeNull();
  expect(screen.getByRole("slider", { name: "Goalies alpha weight percent" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Equalize Weights" }));
  expect(onGoaliesChange).toHaveBeenCalledWith(sources);
  expect(onSkatersChange).not.toHaveBeenCalled();
});

it("separates quick-settings expansion from the full settings dialog", () => {
  const onSettings = vi.fn();
  const onFullSettings = vi.fn();
  render(<DraftWorkspaceHeader health="healthy" healthLabel="Draft sources ready" draftProEligible={false} settingsExpanded onSettings={onSettings} onFullSettings={onFullSettings} onHealth={vi.fn()} />);
  const toggle = screen.getByRole("button", { name: "Toggle quick settings" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(onSettings).toHaveBeenCalledTimes(1);
  expect(onFullSettings).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open full draft settings" }));
  expect(onFullSettings).toHaveBeenCalledTimes(1);
  expect(onSettings).toHaveBeenCalledTimes(1);
});

import DraftSettingsShell, {
  type SettingsSection,
} from "../../../components/DraftDashboard/DraftSettingsShell";
import type { DraftSettings } from "../../../components/DraftDashboard/DraftDashboard";
import type { DraftSettingsValidation } from "../../../lib/draftDashboard/settingsValidation";

const settings: DraftSettings = {
  teamCount: 2,
  draftOrder: ["Team 1", "Team 2"],
  scoringCategories: { GOALS: 1 },
  rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 1, utility: 0, bench: 0 },
  isKeeper: false,
};
const validation = {
  valid: true,
  errors: [],
  issues: [],
  warnings: [],
  domains: { league: true, roster: true, scoring: true, projections: true },
  spots: 2,
  scoringCount: 1,
  skaterWeight: 100,
  goalieWeight: 100,
} as DraftSettingsValidation;

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("league");
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open settings</button>
    <DraftSettingsShell
      settings={settings}
      sourceControls={{}}
      goalieSourceControls={{}}
      validation={validation}
      open={open}
      full={false}
      configured
      onToggle={vi.fn()}
      onClose={() => { onClose(); setOpen(false); }}
      onFullSetup={vi.fn()}
      onDone={() => true}
      onResetSettings={vi.fn()}
      onImport={vi.fn()}
      onExport={vi.fn()}
      section={section}
      onSectionChange={setSection}
    >
      <div hidden={section !== "saved-drafts"}>
        <label>Saved draft note<input defaultValue="kept" /></label>
      </div>
    </DraftSettingsShell>
  </>;
}

afterEach(cleanup);

describe("DraftSettingsShell", () => {
  it("closes with Escape, returns focus, and preserves mounted workspace content", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open settings" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Draft Settings" });

    fireEvent.click(screen.getByRole("tab", { name: "Saved Drafts" }));
    const note = screen.getByRole("textbox", { name: "Saved draft note" });
    fireEvent.change(note, { target: { value: "keep this draft" } });
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Draft Settings" });
    fireEvent.click(screen.getByRole("tab", { name: "Saved Drafts" }));
    expect((screen.getByRole("textbox", { name: "Saved draft note" }) as HTMLInputElement).value).toBe("keep this draft");
  });
  it("uses one keyboard-navigable tab list without duplicate setup navigation", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await screen.findByRole("dialog", { name: "Draft Settings" });
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    const league = screen.getByRole("tab", { name: "League & Draft" });
    fireEvent.keyDown(league, { key: "ArrowDown" });
    expect(screen.getByRole("tab", { name: "Roster" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Roster" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Reports" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Setup$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Open Full Setup/ })).toBeNull();
  });

});
