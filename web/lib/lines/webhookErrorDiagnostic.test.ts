// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { webhookErrorDiagnostic } from "./webhookErrorDiagnostic";

const endpoint =
  "wss://fixture_user:fixture_password@browserless.invalid/chromium?token=fixture_token&api_key=fixture_key";

describe("webhookErrorDiagnostic", () => {
  it.each([
    endpoint,
    encodeURIComponent(endpoint),
    encodeURIComponent(encodeURIComponent(endpoint)),
    `https://proxy.invalid/connect?url=${encodeURIComponent(endpoint)}`,
    "wss://browserless.invalid/?%74oken=fixture_token&ToKeN=fixture_other#fixture_fragment"
  ])("retains only known diagnostics for URL-bearing errors (%#)", (url) => {
    const error = Object.assign(new Error(`connect ECONNREFUSED ${url}`), {
      code: "ECONNREFUSED",
      syscall: "connect",
      statusCode: 502,
      url,
      headers: { Authorization: "Bearer fixture_bearer" },
      cause: Object.assign(new TypeError(`nested ${url}`), {
        code: "ETIMEDOUT"
      })
    });
    error.stack = `Error: ${url}\n at connect (${url}:1:2)`;

    expect(webhookErrorDiagnostic(error)).toEqual({
      name: "Error",
      code: "ECONNREFUSED",
      syscall: "connect",
      status: 502,
      cause: { name: "TypeError", code: "ETIMEDOUT" }
    });
  });

  it("handles ws ErrorEvent getters without serializing its target or error", () => {
    const toJSON = vi.fn(() => { throw new Error("must not serialize"); });
    const inspect = vi.fn(() => endpoint);
    const event = {
      get message() { return `connect ECONNREFUSED ${endpoint}`; },
      get error() {
        return { code: "ECONNREFUSED", syscall: "connect", stack: endpoint };
      },
      target: { _url: endpoint, connection: { url: endpoint } },
      toJSON,
      [Symbol.for("nodejs.util.inspect.custom")]: inspect
    };

    expect(webhookErrorDiagnostic(event)).toEqual({
      name: "UnknownError",
      code: "ECONNREFUSED",
      error: { name: "UnknownError", code: "ECONNREFUSED", syscall: "connect" }
    });
    expect(toJSON).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
  });

  it("does not trust even normally safe-looking property names", () => {
    expect(webhookErrorDiagnostic({
      name: endpoint,
      message: endpoint,
      stack: endpoint,
      code: `ECONNRESET ${endpoint}`,
      syscall: endpoint,
      status: endpoint,
      cause: { name: endpoint, code: endpoint, error: endpoint }
    })).toEqual({
      name: "UnknownError",
      cause: { name: "UnknownError", error: { name: "UnknownError" } }
    });
  });

  it("keeps known code diagnostics from string throws and HTTP status errors", () => {
    expect(webhookErrorDiagnostic(`ECONNRESET ${endpoint}`)).toEqual({
      name: "UnknownError", code: "ECONNRESET"
    });
    expect(webhookErrorDiagnostic({ status: 503, message: endpoint })).toEqual({
      name: "UnknownError", status: 503
    });
    for (const status of [NaN, Infinity, 503.5, 200, 600]) {
      expect(webhookErrorDiagnostic({ status })).toEqual({ name: "UnknownError" });
    }
  });

  it.each([
    ["Cannot find the matrix", "matrix_not_found"],
    ["PUPPETEER_ENDPOINT is not configured.", "endpoint_not_configured"],
    ["Failed to connect to puppeteer: browser endpoint is unavailable.", "browser_endpoint_unavailable"]
  ])("keeps the fixed local failure reason (%#)", (message, reason) => {
    expect(webhookErrorDiagnostic(new Error(message))).toEqual({ name: "Error", reason });
  });

  it("bounds cyclic and deeply nested causes", () => {
    const cycle: { cause?: unknown } = {};
    cycle.cause = cycle;
    expect(webhookErrorDiagnostic(cycle)).toEqual({
      name: "UnknownError", cause: { name: "UnknownError" }
    });

    let nested: unknown = new Error(endpoint);
    for (let index = 0; index < 100; index++) nested = { cause: nested };
    const output = JSON.stringify(webhookErrorDiagnostic(nested));
    expect(output).not.toContain("fixture_");
    expect(output.length).toBeLessThan(200);
  });

  it("does not let throwing accessors leak or break reporting", () => {
    const value = Object.defineProperties({}, Object.fromEntries(
      ["name", "message", "code", "syscall", "status", "statusCode", "cause", "error"].map(
        (key) => [key, { get() { throw new Error(endpoint); } }]
      )
    ));
    expect(webhookErrorDiagnostic(value)).toEqual({ name: "UnknownError" });
  });
});
