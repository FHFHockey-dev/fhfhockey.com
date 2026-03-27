import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireApiUserMock,
  maybeSingleMock,
  deleteEqMock,
  updateEqMock,
} = vi.hoisted(() => ({
  requireApiUserMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  deleteEqMock: vi.fn(),
  updateEqMock: vi.fn(),
}));

vi.mock("lib/api/requireApiUser", () => ({
  requireApiUser: requireApiUserMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      if (table === "connected_accounts") {
        return {
          select: () => ({
            eq: (_field: string, _value: string) => ({
              eq: (_nextField: string, _nextValue: string) => ({
                maybeSingle: maybeSingleMock,
              }),
            }),
          }),
          delete: () => ({
            eq: deleteEqMock,
          }),
        };
      }

      if (table === "user_settings") {
        return {
          update: () => ({
            eq: updateEqMock,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

import handler from "../../../../../../pages/api/v1/account/yahoo/disconnect";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  return res;
}

describe("/api/v1/account/yahoo/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    maybeSingleMock.mockResolvedValue({
      data: { id: "yahoo-account-1" },
      error: null,
    });
    deleteEqMock.mockResolvedValue({ error: null });
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("disconnects yahoo and clears the active context", async () => {
    const req: any = { method: "POST" };
    const res = createMockRes();

    await handler(req, res);

    expect(deleteEqMock).toHaveBeenCalledWith("id", "yahoo-account-1");
    expect(updateEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Yahoo Fantasy disconnected.",
    });
  });
});
