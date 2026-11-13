// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  upload: vi.fn(),
  storageFrom: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn(),
  createClientWithToken: vi.fn()
}));

vi.mock("puppeteer-core", () => ({ default: { connect: mocks.connect } }));
vi.mock("lib/supabase/server", () => ({
  default: { storage: { from: mocks.storageFrom }, from: mocks.from }
}));
vi.mock("lib/supabase", () => ({ createClientWithToken: mocks.createClientWithToken }));

// Keep the real authentication wrapper; all external clients are fixture mocks.
import handler from "../../../../../pages/api/v1/webhooks/on-new-line-combo";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

function expectNoEffects() {
  for (const effect of Object.values(mocks)) expect(effect).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
}

describe("parked line-combination webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("CRON_SECRET", "fixture_cron");
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    undefined,
    "ws://browserless.invalid:3000/?token=fixture_token",
    "wss://fixture_user:fixture_password@browserless.invalid/?token=fixture_token"
  ])("acknowledges a parked event without effects for endpoint %s", async (endpoint) => {
    vi.stubEnv("PUPPETEER_ENDPOINT", endpoint);
    const res = response();
    await handler({
      headers: { authorization: "Bearer fixture_cron" },
      query: { gameId: "2026020001", teamId: "10" }
    } as any, res as any);

    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      success: true,
      status: "skipped",
      reason: "line_combo_webhook_parked"
    });
    expectNoEffects();
  });

  it("returns before reading query data or leaking it into logs or the response", async () => {
    const res = response();
    await handler({
      headers: { authorization: "Bearer fixture_cron" },
      get query() { throw new Error("fixture_sensitive_url_or_token"); }
    } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      success: true,
      status: "skipped",
      reason: "line_combo_webhook_parked"
    });
    expectNoEffects();
  });

  it("preserves authentication before acknowledging a parked event", async () => {
    const res = response();
    await handler({ headers: {}, query: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledExactlyOnceWith(401);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({ message: "Unauthorized.", success: false });
    expectNoEffects();
  });
});
