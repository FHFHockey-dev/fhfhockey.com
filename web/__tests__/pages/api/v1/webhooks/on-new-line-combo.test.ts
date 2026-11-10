// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  upload: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn()
}));

vi.mock("puppeteer-core", () => ({ default: { connect: mocks.connect } }));
vi.mock("lib/supabase/server", () => ({ default: { storage: { from: mocks.from } } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));

import handler from "../../../../../pages/api/v1/webhooks/on-new-line-combo";

const endpoint =
  "wss://fixture_user:fixture_password@browserless.invalid/chromium?token=fixture_token";
const encodedEndpoint = encodeURIComponent(encodeURIComponent(endpoint));

function dependencyError() {
  const error = Object.assign(new Error(`request failed ${encodedEndpoint}`), {
    code: "ECONNRESET",
    syscall: "read",
    cause: {
      message: `https://proxy.invalid/?connection=${encodeURIComponent(endpoint)}`,
      stack: endpoint,
      connection: { url: endpoint },
      error: { code: "ETIMEDOUT", url: endpoint }
    }
  });
  error.stack = `Error: ${endpoint}\n at connect (${encodedEndpoint})`;
  return error;
}

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

async function invoke(res: ReturnType<typeof response>) {
  await handler({ query: { gameId: "2026020001", teamId: "10" } } as any, res as any);
}

function expectSafeFailure(res: ReturnType<typeof response>) {
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error: "Line-combination webhook processing failed."
  });
  const output = JSON.stringify({
    logs: vi.mocked(console.log).mock.calls,
    errors: vi.mocked(console.error).mock.calls,
    response: res.json.mock.calls
  });
  for (const secret of ["fixture_", "browserless.invalid", "proxy.invalid", endpoint, encodedEndpoint]) {
    expect(output).not.toContain(secret);
  }
}

describe("line-combination webhook safe dependency diagnostics", () => {
  let page: {
    setViewport: ReturnType<typeof vi.fn>;
    goto: ReturnType<typeof vi.fn>;
    waitForSelector: ReturnType<typeof vi.fn>;
    evaluate: ReturnType<typeof vi.fn>;
    $: ReturnType<typeof vi.fn>;
  };
  let browser: { newPage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("PUPPETEER_ENDPOINT", endpoint);
    vi.stubEnv("CRON_SECRET", "fixture_cron");
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    page = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      $: vi.fn().mockResolvedValue({ screenshot: vi.fn().mockResolvedValue(Buffer.from("fixture-image")) })
    };
    browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined)
    };
    mocks.connect.mockResolvedValue(browser);
    mocks.from.mockReturnValue({ upload: mocks.upload });
    mocks.upload.mockResolvedValue({ data: { path: "line-combos/2026020001-10.png" }, error: null });
    mocks.fetch.mockResolvedValue({ json: vi.fn().mockResolvedValue({ success: true }) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["event", "error", "string"])("does not serialize connection failure (%s) or retry it", async (shape) => {
    const nested = dependencyError();
    const toJSON = vi.fn(() => { throw new Error("do not serialize"); });
    const error = shape === "event"
      ? { message: endpoint, error: nested, target: { _url: endpoint }, toJSON }
      : shape === "error" ? nested : `connect ECONNREFUSED ${encodedEndpoint}`;
    mocks.connect.mockRejectedValue(error);
    const res = response();
    await invoke(res);

    expectSafeFailure(res);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("on-new-line-combo error:", {
      gameId: 2026020001, teamId: 10, stage: "screenshots",
      error: { name: "NonRetryableWebhookError", reason: "browser_endpoint_unavailable" }
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain(
      shape === "string" ? "ECONNREFUSED" : "ECONNRESET"
    );
  });

  it("reports missing configuration without connecting or retrying", async () => {
    vi.stubEnv("PUPPETEER_ENDPOINT", "");
    const res = response();
    await invoke(res);
    expectSafeFailure(res);
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("endpoint_not_configured");
  });

  it.each(["newPage", "goto", "upload", "discord"])("keeps retries and safe diagnostics after a %s failure", async (stage) => {
    const error = dependencyError();
    if (stage === "newPage") browser.newPage.mockRejectedValue(error);
    if (stage === "goto") page.goto.mockRejectedValue(error);
    if (stage === "upload") mocks.upload.mockResolvedValue({ error, data: null });
    if (stage === "discord") mocks.fetch.mockRejectedValue(error);
    const res = response();
    const pending = invoke(res);
    await vi.runAllTimersAsync();
    await pending;

    expectSafeFailure(res);
    expect(mocks.connect).toHaveBeenCalledTimes(stage === "discord" ? 1 : 4);
    expect(mocks.fetch).toHaveBeenCalledTimes(stage === "discord" ? 4 : 0);
    const errors = vi.mocked(console.error).mock.calls;
    expect(errors).toHaveLength(4);
    expect(errors.slice(0, 3).map(([label]) => label)).toEqual([
      "Attempt 1 failed:", "Attempt 2 failed:", "Attempt 3 failed:"
    ]);
    expect(errors[3][1]).toMatchObject({
      gameId: 2026020001, teamId: 10,
      stage: stage === "discord" ? "discord" : "screenshots",
      error: { name: "Error", code: "ECONNRESET", syscall: "read" }
    });
    expect(JSON.stringify(errors)).toContain("ETIMEDOUT");
  });

  it("preserves the existing nonretryable ECONNREFUSED classification", async () => {
    page.goto.mockRejectedValue(new Error(`ECONNREFUSED ${endpoint}`));
    const res = response();
    await invoke(res);
    expectSafeFailure(res);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("ECONNREFUSED");
  });

  it("keeps the useful matrix-not-found reason", async () => {
    page.$.mockResolvedValue(null);
    const res = response();
    const pending = invoke(res);
    await vi.runAllTimersAsync();
    await pending;
    expectSafeFailure(res);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("matrix_not_found");
  });

  it("preserves browser options, screenshot upload, Discord request and success response", async () => {
    const res = response();
    await invoke(res);
    expect(mocks.connect).toHaveBeenCalledWith({ browserWSEndpoint: endpoint });
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1440, height: 900, deviceScaleFactor: 1 });
    expect(page.goto).toHaveBeenCalledWith("https://fhfhockey.com/lines/line-combo/2026020001?isScreenshot=1");
    expect(page.waitForSelector).toHaveBeenCalledWith(".content");
    expect(page.$).toHaveBeenCalledWith("#linemate-matrix-10 .content");
    expect(mocks.from).toHaveBeenCalledWith("images");
    expect(mocks.upload).toHaveBeenCalledWith("line-combos/2026020001-10.png", Buffer.from("fixture-image"), {
      cacheControl: "604800", contentType: "image/png", upsert: true
    });
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://fhfhockey.com/api/v1/discord/send-message/line-combo/2026020001?teamId=10",
      { method: "POST", headers: { Authorization: "Bearer fixture_cron" } }
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Successfully handled the line combo for 2026020001" });
    expect(console.error).not.toHaveBeenCalled();
  });
});
