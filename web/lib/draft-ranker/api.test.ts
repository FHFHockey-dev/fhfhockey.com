import { describe, expect, it } from "vitest";

import {
  DraftRankerApiError,
  isCommunityDraftRankingsEnabled,
  isDraftRankerCommunityContributionEnabled,
  isDraftRankerDiscoveryEnabled,
  isDraftRankerEnabled,
  isDraftRankerHomepageEnabled,
  isDraftRankerUserEntitled,
  draftRankerRolloutStage,
  parseDraftRankerInput,
  sendDraftRankerError,
} from "./api";
import {
  draftPlayerSearchQuerySchema,
  operationContextSchema,
  operationPayloadHash,
  requestDraftPlayerAdditionSchema,
  reorderDraftRankingSchema,
} from "./contracts";

describe("Draft Ranker API contracts", () => {
  it("keeps the server kill switch off unless explicitly enabled", () => {
    for (const value of [undefined, "", "0", "false", "disabled"]) {
      expect(isDraftRankerEnabled(value)).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isDraftRankerEnabled(value)).toBe(true);
    }
  });

  it("stages account access from staff through allowlist to authenticated", () => {
    const staff = "11111111-1111-4111-8111-111111111111";
    const beta = "22222222-2222-4222-8222-222222222222";
    const ordinary = "33333333-3333-4333-8333-333333333333";
    expect(draftRankerRolloutStage(undefined)).toBe("off");
    expect(draftRankerRolloutStage("unknown")).toBe("off");
    expect(
      isDraftRankerUserEntitled(staff, {
        DRAFT_RANKER_ROLLOUT_STAGE: "staff",
        DRAFT_RANKER_STAFF_USER_IDS: staff,
      }),
    ).toBe(true);
    expect(
      isDraftRankerUserEntitled(beta, {
        DRAFT_RANKER_ROLLOUT_STAGE: "allowlist",
        DRAFT_RANKER_STAFF_USER_IDS: staff,
        DRAFT_RANKER_BETA_USER_IDS: beta,
      }),
    ).toBe(true);
    expect(
      isDraftRankerUserEntitled(ordinary, {
        DRAFT_RANKER_ROLLOUT_STAGE: "allowlist",
        DRAFT_RANKER_BETA_USER_IDS: beta,
      }),
    ).toBe(false);
    expect(
      isDraftRankerUserEntitled(ordinary, {
        DRAFT_RANKER_ROLLOUT_STAGE: "authenticated",
      }),
    ).toBe(true);
    expect(
      isDraftRankerUserEntitled(staff, {
        DRAFT_RANKER_ROLLOUT_STAGE: "off",
        DRAFT_RANKER_STAFF_USER_IDS: staff,
      }),
    ).toBe(false);
  });

  it("keeps the homepage pairwise experience behind its own disabled flag", () => {
    for (const value of [undefined, "", "0", "false", "disabled"]) {
      expect(isDraftRankerHomepageEnabled(value)).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isDraftRankerHomepageEnabled(value)).toBe(true);
    }
  });

  it("keeps community evidence collection behind an independent emergency switch", () => {
    for (const value of [undefined, "", "0", "false", "disabled"]) {
      expect(isDraftRankerCommunityContributionEnabled(value)).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isDraftRankerCommunityContributionEnabled(value)).toBe(true);
    }
  });

  it("keeps explainable discovery behind an independent disabled flag", () => {
    for (const value of [undefined, "", "0", "false", "disabled"]) {
      expect(isDraftRankerDiscoveryEnabled(value)).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isDraftRankerDiscoveryEnabled(value)).toBe(true);
    }
  });

  it("keeps public Community Rankings behind an independent disabled flag", () => {
    for (const value of [undefined, "", "0", "false", "disabled"]) {
      expect(isCommunityDraftRankingsEnabled(value)).toBe(false);
    }
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      expect(isCommunityDraftRankingsEnabled(value)).toBe(true);
    }
  });

  it("accepts only UUID operation ids and nonnegative integer versions", () => {
    expect(
      parseDraftRankerInput(operationContextSchema, {
        operationId: "019f5a10-89aa-7000-8000-000000000001",
        expectedVersion: 0,
      }),
    ).toEqual({
      operationId: "019f5a10-89aa-7000-8000-000000000001",
      expectedVersion: 0,
    });

    expect(() =>
      parseDraftRankerInput(operationContextSchema, {
        operationId: "not-a-uuid",
        expectedVersion: -1,
        userId: "forged-owner",
      }),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 400,
        code: "validation_error",
      }),
    );
  });

  it("produces a stable retry fingerprint independent of object key order", () => {
    const left = operationPayloadHash({
      operationId: "op-1",
      move: { playerId: 8, rank: 12 },
    });
    const reordered = operationPayloadHash({
      move: { rank: 12, playerId: 8 },
      operationId: "op-1",
    });
    const changed = operationPayloadHash({
      operationId: "op-1",
      move: { playerId: 8, rank: 13 },
    });

    expect(left).toHaveLength(64);
    expect(reordered).toBe(left);
    expect(changed).not.toBe(left);
  });

  it("uses the frozen forbidden response envelope", () => {
    const res: any = {
      statusCode: 0,
      body: null,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(value: unknown) {
        this.body = value;
        return this;
      },
    };

    sendDraftRankerError(
      res,
      "request-forbidden-1",
      new DraftRankerApiError(
        403,
        "forbidden",
        "This action is not permitted.",
      ),
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: {
        code: "forbidden",
        message: "This action is not permitted.",
        requestId: "request-forbidden-1",
        details: {},
      },
    });
  });

  it("requires action-specific reorder targets without accepting owner IDs", () => {
    const common = {
      operationId: "019f5a30-0000-7000-8000-000000000001",
      expectedVersion: 2,
      rankingId: "019f5a30-0000-7000-8000-000000000002",
      playerId: 101,
    };
    expect(
      parseDraftRankerInput(reorderDraftRankingSchema, {
        ...common,
        action: "move_to_rank",
        targetRank: 12,
      }),
    ).toMatchObject({ action: "move_to_rank", targetRank: 12 });
    expect(() =>
      parseDraftRankerInput(reorderDraftRankingSchema, {
        ...common,
        action: "insert_above",
        userId: "forged-owner",
      }),
    ).toThrowError(expect.objectContaining({ code: "validation_error" }));
  });

  it("bounds search and player-addition payloads without owner input", () => {
    expect(
      parseDraftRankerInput(draftPlayerSearchQuerySchema, {
        query: "  Elias Pettersson ",
        includeArchived: true,
        limit: 25,
      }),
    ).toEqual({
      query: "Elias Pettersson",
      includeArchived: true,
      limit: 25,
    });
    expect(() =>
      parseDraftRankerInput(requestDraftPlayerAdditionSchema, {
        rawName: "Prospect Example",
        notes: "x".repeat(501),
        userId: "forged-owner",
      }),
    ).toThrowError(expect.objectContaining({ code: "validation_error" }));
  });

  it("emits Retry-After for stable rate-limit errors", () => {
    const res: any = {
      statusCode: 0,
      body: null,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(value: unknown) {
        this.body = value;
        return this;
      },
    };

    sendDraftRankerError(
      res,
      "request-rate-1",
      new DraftRankerApiError(429, "rate_limited", "Try later.", {
        retryAfterSeconds: 120,
      }),
    );

    expect(res.headers["Retry-After"]).toBe("120");
    expect(res.statusCode).toBe(429);
  });
});
