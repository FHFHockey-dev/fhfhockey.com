import { beforeEach, describe, expect, it, vi } from "vitest";

const { finalizeMock, getMock } = vi.hoisted(() => ({
  finalizeMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock("../NHL/base", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../NHL/base")>()),
  get: getMock,
}));

vi.mock("./transactionalGameStatsPersistence", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("./transactionalGameStatsPersistence")
  >()),
  finalizeScheduleNotRealizedGameStats: finalizeMock,
}));

import { NhlApiHttpError } from "../NHL/base";
import { tryFinalizeScheduleNotRealizedGameStats } from "./nonRealizedGameStats";

const gameId = 2025030417;
const officialUrl = (resource: "landing" | "right-rail" | "boxscore") =>
  `https://api-web.nhle.com/v1/gamecenter/${gameId}/${resource}`;
const notFound = (resource: "landing" | "right-rail" | "boxscore") =>
  new NhlApiHttpError({
    status: 404,
    url: officialUrl(resource),
    message: "not found",
  });
const receipt = {
  gameId,
  outcome: "quarantined" as const,
  reason: "schedule_not_realized" as const,
  contractVersion: 1 as const,
  expectedTeamRows: 0 as const,
  observedTeamRows: 0 as const,
  expectedSkaterRows: 0 as const,
  observedSkaterRows: 0 as const,
  expectedGoalieRows: 0 as const,
  observedGoalieRows: 0 as const,
  completedAt: "2026-07-15T16:00:00.000Z",
};

describe("tryFinalizeScheduleNotRealizedGameStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finalizeMock.mockResolvedValue(receipt);
  });

  it("terminalizes only after exact independent landing, right-rail, and boxscore 404s", async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/right-rail")) throw notFound("right-rail");
      if (path.endsWith("/boxscore")) throw notFound("boxscore");
      throw new Error(`Unexpected path ${path}`);
    });

    await expect(
      tryFinalizeScheduleNotRealizedGameStats({
        supabase: { rpc: vi.fn() } as any,
        gameId,
        landingError: notFound("landing"),
      }),
    ).resolves.toEqual(receipt);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(finalizeMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["untyped landing", new Error("404")],
    [
      "wrong landing URL",
      new NhlApiHttpError({
        status: 404,
        url: officialUrl("boxscore"),
        message: "not found",
      }),
    ],
    [
      "non-404 landing",
      new NhlApiHttpError({
        status: 503,
        url: officialUrl("landing"),
        message: "unavailable",
      }),
    ],
  ])("keeps the row pending for %s", async (_label, landingError) => {
    await expect(
      tryFinalizeScheduleNotRealizedGameStats({
        supabase: {} as any,
        gameId,
        landingError,
      }),
    ).resolves.toBeNull();
    expect(getMock).not.toHaveBeenCalled();
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("keeps the row pending when either corroborating endpoint is not an exact 404", async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/right-rail")) throw notFound("right-rail");
      return { id: gameId };
    });

    await expect(
      tryFinalizeScheduleNotRealizedGameStats({
        supabase: {} as any,
        gameId,
        landingError: notFound("landing"),
      }),
    ).resolves.toBeNull();
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it("propagates terminal RPC or receipt failures instead of hiding them", async () => {
    getMock.mockImplementation(async (path: string) => {
      throw path.endsWith("/right-rail")
        ? notFound("right-rail")
        : notFound("boxscore");
    });
    finalizeMock.mockRejectedValue(new Error("receipt mismatch"));

    await expect(
      tryFinalizeScheduleNotRealizedGameStats({
        supabase: {} as any,
        gameId,
        landingError: notFound("landing"),
      }),
    ).rejects.toThrow("receipt mismatch");
  });
});
