import {
  afterEach as afterEachHook,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const { loaderMock, legacyMainMock } = vi.hoisted(() => ({
  loaderMock: vi.fn(),
  legacyMainMock: vi.fn().mockResolvedValue(undefined)
}));

import handler, {
  loadLegacyMain,
  setLegacyMainLoaderForTests
} from "../../../../../pages/api/v1/db/update-rolling-games";

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
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/update-rolling-games", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loaderMock.mockResolvedValue(legacyMainMock);
    setLegacyMainLoaderForTests(loaderMock);
  });

  it("loads the legacy rolling-games module through the async bridge", async () => {
    const main = await loadLegacyMain();

    await main("recent");

    expect(loaderMock).toHaveBeenCalled();
    expect(legacyMainMock).toHaveBeenCalledWith("recent");
  });

  it("runs the legacy loader in recent mode when date=recent", async () => {
    const req: any = {
      method: "GET",
      query: { date: "recent" }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(legacyMainMock).toHaveBeenCalledWith("recent");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Rolling games data processed successfully in recent mode."
    });
  });

  afterEachHook(() => {
    setLegacyMainLoaderForTests(null);
  });
});
