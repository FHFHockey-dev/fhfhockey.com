import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { getServerSideProps } from "pages/stats/player/[playerId]";

describe("player stats route", () => {
  beforeEach(() => fromMock.mockReset());

  it("returns 404 for invalid IDs without querying players", async () => {
    for (const playerId of ["abc", "0", "01", "9007199254740992"]) {
      await expect(getServerSideProps({ query: { playerId } } as any)).resolves.toEqual({ notFound: true });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the player row is absent", async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });

    await expect(getServerSideProps({ query: { playerId: "123" } } as any)).resolves.toEqual({ notFound: true });
    expect(fromMock).toHaveBeenCalledWith("players");
  });

  it("propagates a database failure instead of returning 404", async () => {
    const error = new Error("database unavailable");
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error }) }) }),
    });

    await expect(getServerSideProps({ query: { playerId: "123" } } as any)).rejects.toThrow(error);
  });
});
