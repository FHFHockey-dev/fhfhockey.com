import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const csvModalMocks = vi.hoisted(() => ({
  onDrop: null as null | ((files: File[]) => void),
  parseResult: {
    data: [
      {
        Player_Name: "Sebastian Aho",
        Team_Abbreviation: "CAR",
        Position: "C",
        Goals: 30,
        Assists: 50,
      },
    ],
    errors: [] as Array<{ row?: number; message: string }>,
  },
}));

vi.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[]) => void }) => {
    csvModalMocks.onDrop = onDrop;
    return {
      getRootProps: () => ({ tabIndex: 0 }),
      getInputProps: () => ({}),
      isDragActive: false,
    };
  },
}));

vi.mock("papaparse", () => ({
  default: {
    parse: (_file: File, options: any) =>
      options.complete(csvModalMocks.parseResult),
  },
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

import ImportCsvModal from "../../../components/DraftDashboard/ImportCsvModal";

afterEach(() => {
  cleanup();
  csvModalMocks.onDrop = null;
  csvModalMocks.parseResult.errors = [];
});

describe("ImportCsvModal", () => {
  it("exposes an accessible modal, clears selected CSV state, and restores focus", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open importer";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const onImported = vi.fn();

    const view = render(
      <ImportCsvModal
        open
        onClose={onClose}
        onImported={onImported}
      />
    );

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByLabelText("CSV Dropzone")).toBeTruthy();
    expect(screen.getByLabelText("CSV File Input")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).not.toBe(opener));

    await act(async () => {
      csvModalMocks.onDrop?.([
        new File(["Player_Name,Team_Abbreviation,Position,Goals,Assists"], "players.csv", {
          type: "text/csv",
        }),
      ]);
    });
    expect(screen.getByRole("button", { name: "Clear file" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear file" }));
    expect(screen.queryByRole("button", { name: "Clear file" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(
      <ImportCsvModal
        open={false}
        onClose={onClose}
        onImported={onImported}
      />
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ImportCsvModal open onClose={onClose} onImported={vi.fn()} />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces malformed-row warnings and missing required headers", async () => {
    csvModalMocks.parseResult.errors = [
      { row: 0, message: "Too few fields: expected 11 fields but parsed 5" },
    ];
    render(<ImportCsvModal open onClose={vi.fn()} onImported={vi.fn()} />);

    await act(async () => {
      csvModalMocks.onDrop?.([
        new File(["malformed"], "malformed.csv", { type: "text/csv" }),
      ]);
    });

    expect(screen.getByText("Parser warnings: 1")).toBeTruthy();
    expect(screen.getByText(/Too few fields/)).toBeTruthy();
    expect(screen.getByText(/Missing required:/)).toBeTruthy();
  });
});
