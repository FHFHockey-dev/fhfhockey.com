import { describe, expect, it } from "vitest";

import {
  yahooDraftPollDelaySeconds,
} from "./pollPolicy";

const NOW = new Date("2026-08-24T12:00:00.000Z");

describe("Yahoo live-draft worker poll policy", () => {
  it("uses the conservative predraft tiers", () => {
    expect(
      yahooDraftPollDelaySeconds(
        { draftTime: "2026-08-24T12:16:00.000Z", providerStatus: "predraft" },
        { now: NOW, random: () => 0 },
      ),
    ).toBe(60);
    expect(
      yahooDraftPollDelaySeconds(
        { draftTime: "2026-08-24T12:15:00.000Z", providerStatus: "predraft" },
        { now: NOW, random: () => 0 },
      ),
    ).toBe(30);
    expect(
      yahooDraftPollDelaySeconds(
        { draftTime: "2026-08-24T12:02:00.000Z", providerStatus: "predraft" },
        { now: NOW, random: () => 0 },
      ),
    ).toBe(12);
  });

  it("adapts active polling and keeps five-second bursts opt-in", () => {
    expect(
      yahooDraftPollDelaySeconds(
        { providerStatus: "drafting" },
        { random: () => 0 },
      ),
    ).toBe(10);
    expect(
      yahooDraftPollDelaySeconds(
        { providerStatus: "drafting", unchangedPolls: 3 },
        { random: () => 0 },
      ),
    ).toBe(15);
    expect(
      yahooDraftPollDelaySeconds(
        { providerStatus: "drafting", unchangedPolls: 6 },
        { random: () => 0 },
      ),
    ).toBe(30);
    expect(
      yahooDraftPollDelaySeconds(
        { burstPollsRemaining: 1, providerStatus: "drafting" },
        { burstEnabled: true, random: () => 0 },
      ),
    ).toBe(5);
    expect(
      yahooDraftPollDelaySeconds(
        { providerStatus: "drafting" },
        { random: () => 0.99 },
      ),
    ).toBe(12);
  });

  it("honors Retry-After with bounded jitter and caps exponential failures", () => {
    expect(
      yahooDraftPollDelaySeconds(
        { providerStatus: "drafting", retryAfterSeconds: 20 },
        { random: () => 0.99 },
      ),
    ).toBe(22);
    expect(
      yahooDraftPollDelaySeconds(
        { consecutiveFailures: 1, providerStatus: "drafting" },
        { random: () => 0.99 },
      ),
    ).toBe(7);
    expect(
      yahooDraftPollDelaySeconds(
        { consecutiveFailures: 8, providerStatus: "drafting" },
        { random: () => 0 },
      ),
    ).toBe(60);
  });
});
