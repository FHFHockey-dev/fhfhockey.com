import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import handler from "../../../../../pages/api/v1/ml/create-materialized-view";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response;
}

describe("retired create-materialized-view route", () => {
  it("returns an inert compatibility response without constructing a client", async () => {
    const response = createResponse();

    await handler({ method: "POST" } as never, response as never);

    expect(response.statusCode).toBe(410);
    expect(response.body).toMatchObject({
      success: false,
      status: "retired",
      canonicalObject: "public.player_stats_unified",
      canonicalObjectType: "view",
    });
  });

  it("rejects methods outside the retained POST compatibility contract", async () => {
    const response = createResponse();

    await handler({ method: "GET" } as never, response as never);

    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toEqual(["POST"]);
  });

  it("contains no database client, RPC, or DDL execution path", () => {
    const source = readFileSync(
      resolve(process.cwd(), "pages/api/v1/ml/create-materialized-view.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@supabase|lib\/supabase|\.rpc\(|execute_sql/i);
    expect(source).not.toMatch(/\b(?:drop|create|refresh)\s+materialized\s+view\b/i);
    expect(vi.isMockFunction(handler)).toBe(false);
  });
});
