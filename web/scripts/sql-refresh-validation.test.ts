import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  formatSqlRefreshEntrypointError,
  loadSqlRefreshConfiguration,
  SqlRefreshConfigurationError,
} from "./sql-refresh-config";

const clientMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  executeSqlRpcWithRetry: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: clientMocks.createClient,
}));

vi.mock("lib/cron/sqlRpcExecution", () => ({
  executeSqlRpcWithRetry: clientMocks.executeSqlRpcWithRetry,
}));

describe("SQL refresh validation configuration", () => {
  it("uses the explicit environment names without loading a file", () => {
    const loadEnvironmentFile = vi.fn();
    const configuration = loadSqlRefreshConfiguration({
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      },
      repositoryRoot: "/checkout/fhfhockey.com",
      loadEnvironmentFile,
    });

    expect(configuration).toEqual({
      supabaseUrl: "https://example.supabase.invalid",
      serviceRoleKey: "synthetic-service-key",
      environmentFile: null,
    });
    expect(loadEnvironmentFile).not.toHaveBeenCalled();
  });

  it("resolves an explicitly supplied path from the repository root", () => {
    const environment: Record<string, string | undefined> = {
      SQL_REFRESH_ENV_FILE: "web/.env.validation",
    };
    const loadEnvironmentFile = vi.fn(({ absolutePath }) => {
      expect(absolutePath).toBe(
        path.resolve("/checkout/fhfhockey.com", "web/.env.validation"),
      );
      environment.NEXT_PUBLIC_SUPABASE_URL =
        "https://example.supabase.invalid";
      environment.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-key";
      return {};
    });

    expect(
      loadSqlRefreshConfiguration({
        environment,
        repositoryRoot: "/checkout/fhfhockey.com",
        loadEnvironmentFile,
      }),
    ).toMatchObject({ environmentFile: "web/.env.validation" });
    expect(loadEnvironmentFile).toHaveBeenCalledOnce();
  });

  it("rejects missing and malformed configuration without echoing values", () => {
    expect(() =>
      loadSqlRefreshConfiguration({ environment: {} }),
    ).toThrow(
      "Missing required SQL refresh environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
    );

    const malformedUrl = "not-a-url-with-sensitive-text";
    expect(() =>
      loadSqlRefreshConfiguration({
        environment: {
          NEXT_PUBLIC_SUPABASE_URL: malformedUrl,
          SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
        },
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.");

    try {
      loadSqlRefreshConfiguration({
        environment: {
          NEXT_PUBLIC_SUPABASE_URL: malformedUrl,
          SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
        },
      });
    } catch (error) {
      expect(String(error)).not.toContain(malformedUrl);
      expect(String(error)).not.toContain("synthetic-service-key");
    }
  });

  it("rejects absolute, escaping, and unreadable env-file inputs opaquely", () => {
    for (const configuredPath of [
      "/private/location/secret.env",
      "../outside.env",
    ]) {
      expect(() =>
        loadSqlRefreshConfiguration({
          environment: { SQL_REFRESH_ENV_FILE: configuredPath },
          repositoryRoot: "/checkout/fhfhockey.com",
        }),
      ).toThrow(SqlRefreshConfigurationError);
    }

    const loaderDetail = "synthetic-loader-secret";
    try {
      loadSqlRefreshConfiguration({
        environment: { SQL_REFRESH_ENV_FILE: "web/.env.validation" },
        repositoryRoot: "/checkout/fhfhockey.com",
        loadEnvironmentFile: () => ({ error: new Error(loaderDetail) }),
      });
    } catch (error) {
      expect(String(error)).toContain("SQL_REFRESH_ENV_FILE");
      expect(String(error)).not.toContain(loaderDetail);
    }
  });

  it("does not initialize a client or SQL execution when scripts are imported", async () => {
    await Promise.all([
      import("./sql-refresh-validation"),
      import("./sql-refresh-team-power-validation"),
    ]);

    expect(clientMocks.createClient).not.toHaveBeenCalled();
    expect(clientMocks.executeSqlRpcWithRetry).not.toHaveBeenCalled();
  });

  it("formats unknown entrypoint failures without exposing their message", () => {
    const sensitiveDetail = "synthetic-unexpected-secret";
    expect(formatSqlRefreshEntrypointError(new Error(sensitiveDetail))).toBe(
      "SQL refresh validation failed; configuration values were not logged.",
    );
    expect(formatSqlRefreshEntrypointError(new Error(sensitiveDetail))).not.toContain(
      sensitiveDetail,
    );
  });
});
