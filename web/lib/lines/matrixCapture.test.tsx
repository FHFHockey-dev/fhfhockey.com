import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LinemateMatrixView, type PlayerData, type TOIData } from "components/LinemateMatrix";
import { linemateMatrixCaptureSelector } from "./matrixCapture";

afterEach(cleanup);
const player = (id: number, teamId: number, position = "C"): PlayerData => ({ id, teamId, position, sweaterNumber: id, name: `Player ${id}` });
const toi = (players: PlayerData[]) => players.map((entry): TOIData => ({ toi: 100, p1: entry, p2: entry }));

describe("Discord line-combo capture selector", () => {
  it("finds exactly one grid per team in the rendered matrix (the old direct-child selector finds none)", () => {
    const rosters = { 1: [player(10, 1), player(11, 1, "D")], 2: [player(20, 2), player(21, 2, "D")] };
    const { container } = render(<LinemateMatrixView gameInfo={[{ id: 1, name: "Home" }, { id: 2, name: "Away" }]} rosters={rosters}
      toiData={{ 1: toi(rosters[1]), 2: toi(rosters[2]) }} mode="line-combination" onModeChanged={() => {}} />);
    for (const teamId of [1, 2]) {
      const found = container.querySelectorAll(linemateMatrixCaptureSelector(teamId));
      expect(found).toHaveLength(1);
      expect(found[0]!.closest("section")!.id).toBe(`linemate-matrix-${teamId}`);
      expect(found[0]!.getAttribute("data-matrix-size")).toBe("2");
      expect(container.querySelector(`#linemate-matrix-${teamId} > .content`)).toBeNull();
    }
  });
});
