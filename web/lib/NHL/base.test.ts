import { afterEach, describe, expect, it, vi } from "vitest";

import { get, isNhlGamecenterNotFound, NhlApiHttpError } from "./base";

async function captureRejection(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    return error;
  }
  throw new Error("Expected NHL request to reject.");
}

describe("NHL base HTTP errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves exact status and official URL through the public get wrapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><title>NHL | 404: Not Found</title></html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const error = await captureRejection(() =>
      get("/gamecenter/2025030417/landing"),
    );

    expect(error).toBeInstanceOf(NhlApiHttpError);
    expect(error).toMatchObject({
      status: 404,
      url: "https://api-web.nhle.com/v1/gamecenter/2025030417/landing",
    });
    expect(isNhlGamecenterNotFound(error, 2025030417, "landing")).toBe(true);
  });

  it("rejects mismatched status, game identity, resource, and untyped errors", () => {
    const error = new NhlApiHttpError({
      status: 404,
      url: "https://api-web.nhle.com/v1/gamecenter/2025030417/landing",
      message: "not found",
    });

    expect(isNhlGamecenterNotFound(error, 2025030416, "landing")).toBe(false);
    expect(isNhlGamecenterNotFound(error, 2025030417, "boxscore")).toBe(false);
    expect(
      isNhlGamecenterNotFound(
        new NhlApiHttpError({ ...error, status: 500 }),
        2025030417,
        "landing",
      ),
    ).toBe(false);
    expect(
      isNhlGamecenterNotFound(new Error("404"), 2025030417, "landing"),
    ).toBe(false);
  });

  it("does not classify a successful HTML proxy response as a typed 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><title>Proxy</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const error = await captureRejection(() =>
      get("/gamecenter/2025030417/landing"),
    );

    expect(error).not.toBeInstanceOf(NhlApiHttpError);
    expect(isNhlGamecenterNotFound(error, 2025030417, "landing")).toBe(false);
  });
});
