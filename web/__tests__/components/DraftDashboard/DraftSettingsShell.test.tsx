import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

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
});
