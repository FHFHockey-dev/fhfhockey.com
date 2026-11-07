import { describe, expect, it } from "vitest";
import { resolveScheduledHttpUrl } from "./scheduledHttpUrl";

const command = (expression: string) => `SELECT net.http_get(url := ${expression}, timeout_milliseconds := 300000);`;
const rollingWindow = (days: number) => command(`'https://fhfhockey.com/api/example?startDate=' ||
  to_char((CURRENT_DATE - INTERVAL '${days} days')::date, 'YYYY-MM-DD') ||
  '&endDate=' || to_char(CURRENT_DATE::date, 'YYYY-MM-DD') || '&mode=recent'`);

describe("scheduled HTTP URL dates", () => {
  it.each([
    ["2026-11-07T08:05:00Z", "2026-11-05", "2026-11-07"],
    ["2026-01-01T23:59:00Z", "2025-12-30", "2026-01-01"],
    ["2024-03-01T00:00:00Z", "2024-02-28", "2024-03-01"],
  ])("resolves the scheduled UTC day %s, including calendar rollover", (at, start, end) => {
    expect(resolveScheduledHttpUrl(rollingWindow(2), at))
      .toBe(`https://fhfhockey.com/api/example?startDate=${start}&endDate=${end}&mode=recent`);
  });

  it("handles a one-day offset, future day and escaped SQL literals", () => {
    expect(resolveScheduledHttpUrl(command(`'/api/example?label=it''s&date=' ||
      to_char((CURRENT_DATE + INTERVAL '1 day')::date, 'YYYY-MM-DD')`), "2026-12-31T23:00:00Z"))
      .toBe("/api/example?label=it's&date=2027-01-01");
  });

  it.each([
    "'/api/example?startDate=' || secret_function()",
    "'/api/example?startDate=' || to_char(NOW(), 'YYYY-MM-DD')",
    "'/api/example?startDate=' || to_char(CURRENT_DATE::date, 'DD-MM-YYYY')",
    "'/api/example?startDate=' ||",
    "'/api/example'::text",
  ])("fails closed for unsupported URL SQL: %s", (expression) => {
    expect(resolveScheduledHttpUrl(command(expression), "2026-11-07T08:05:00Z")).toBeNull();
  });

  it("returns null without a valid slot or URL argument", () => {
    expect(resolveScheduledHttpUrl(rollingWindow(2), "invalid")).toBeNull();
    expect(resolveScheduledHttpUrl("SELECT 1;", "2026-11-07T08:05:00Z")).toBeNull();
  });
});
