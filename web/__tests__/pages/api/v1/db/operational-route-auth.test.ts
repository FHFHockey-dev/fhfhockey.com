import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  createClientWithToken: vi.fn(),
  serviceRoleClient: {
    from: vi.fn(),
  },
}));

vi.mock("lib/supabase/server", () => ({
  default: mocks.serviceRoleClient,
}));

vi.mock("lib/supabase", () => ({
  createClientWithToken: mocks.createClientWithToken,
}));

import {
  operationalRouteContracts,
  withOperationalRouteAuth,
} from "lib/cron/withOperationalRouteAuth";

const activeRoutes = [
  ["audit-nhl-xg-backfill.ts", "auditNhlXgBackfill"],
  ["check-missing-goalie-data.ts", "checkMissingGoalieData"],
  ["update-goalie-starter-mixtures.ts", "updateGoalieStarterMixtures"],
  ["update-last-7-14-30.ts", "updateLast71430"],
  ["update-nhl-xg-adjusted-impact.ts", "updateNhlXgAdjustedImpact"],
  ["update-nhl-xg-created-xg.ts", "updateNhlXgCreatedXg"],
  ["update-nhl-xg-qot-qoc.ts", "updateNhlXgQotQoc"],
  ["update-nhl-xg-rebound-control.ts", "updateNhlXgReboundControl"],
  ["update-nhl-xg-shot-assists.ts", "updateNhlXgShotAssists"],
  ["update-nhl-xg-shot-features.ts", "updateNhlXgShotFeatures"],
  ["update-nhl-xg-transitions.ts", "updateNhlXgTransitions"],
  ["update-nhl-xg-travel-fatigue.ts", "updateNhlXgTravelFatigue"],
  ["update-nst-last-ten.ts", "updateNstLastTen"],
  ["update-nst-player-reports.ts", "updateNstPlayerReports"],
  ["update-nhl-ppt-replay-tracking.ts", "updateNhlPptReplayTracking"],
] as const;

const inertRoutes = [
  ["pages/api/v1/db/skaterArray.ts", 410],
  ["pages/api/v1/db/update-nhl-edge-teams.ts", 410],
  ["pages/api/v1/db/update-power-rankings.ts", 410],
  ["pages/api/v1/db/update-team-power-ratings-new.ts", 200],
  ["pages/api/v1/ml/create-materialized-view.ts", 410],
] as const;

function createRequest(method: string, authorization?: string) {
  return {
    method,
    url: "/api/v1/db/test-operational-route",
    query: {},
    headers: {
      authorization,
      host: "fhfhockey.com",
    },
  } as any;
}

function createResponse() {
  return {
    statusCode: 200,
    headersSent: false,
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
      this.headersSent = true;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
  } as any;
}

describe("operational route authorization contracts", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    mocks.auditInsert.mockReset().mockResolvedValue({ error: null });
    mocks.serviceRoleClient.from.mockReset().mockImplementation(() => ({
      insert: mocks.auditInsert,
    }));
    mocks.createClientWithToken.mockReset().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
        })),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.entries(operationalRouteContracts))(
    "rejects an unauthenticated %s request before handler or audit work",
    async (_name, contract) => {
      const handler = vi.fn();
      const wrapped = withOperationalRouteAuth(handler, contract);
      const response = createResponse();

      await wrapped(createRequest(contract.methods[0]), response);

      expect(response.statusCode).toBe(401);
      expect(handler).not.toHaveBeenCalled();
      expect(mocks.auditInsert).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(operationalRouteContracts))(
    "rejects an unapproved %s method before handler or audit work",
    async (_name, contract) => {
      const handler = vi.fn();
      const wrapped = withOperationalRouteAuth(handler, contract);
      const response = createResponse();

      await wrapped(
        createRequest("DELETE", "Bearer test-cron-secret"),
        response,
      );

      expect(response.statusCode).toBe(405);
      expect(response.headers.Allow).toEqual(contract.methods);
      expect(handler).not.toHaveBeenCalled();
      expect(mocks.auditInsert).not.toHaveBeenCalled();
    },
  );

  it.each(Object.entries(operationalRouteContracts))(
    "allows an authenticated %s request through its production wrapper",
    async (_name, contract) => {
      const handler = vi.fn((_req, res) =>
        res.status(200).json({ success: true }),
      );
      const wrapped = withOperationalRouteAuth(handler, contract);
      const request = createRequest(
        contract.methods[0],
        "Bearer test-cron-secret",
      );
      const response = createResponse();

      await wrapped(request, response);

      expect(response.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledOnce();
      expect(request.supabase).toBe(mocks.serviceRoleClient);
      if (contract.audit === false) {
        expect(mocks.auditInsert).not.toHaveBeenCalled();
      } else {
        expect(mocks.auditInsert).toHaveBeenCalledOnce();
      }
      if ("defaultDryRun" in contract && contract.defaultDryRun) {
        expect(request.query.dryRun).toBe("true");
      }
    },
  );

  it("allows a verified admin token through the same outer boundary", async () => {
    const handler = vi.fn((_req, res) =>
      res.status(200).json({ success: true }),
    );
    const wrapped = withOperationalRouteAuth(
      handler,
      operationalRouteContracts.updateLast71430,
    );

    await wrapped(
      createRequest("POST", "Bearer verified-admin-token"),
      createResponse(),
    );

    expect(mocks.createClientWithToken).toHaveBeenCalledWith(
      "verified-admin-token",
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(activeRoutes)(
    "binds %s to its canonical production contract",
    (fileName, contractName) => {
      const source = readFileSync(
        resolve(process.cwd(), "pages/api/v1/db", fileName),
        "utf8",
      );

      expect(source).toContain(
        'from "lib/cron/withOperationalRouteAuth"',
      );
      expect(source).toContain(
        `operationalRouteContracts.${contractName}`,
      );
      expect(source).toContain("export default withOperationalRouteAuth(");
      expect(source).not.toContain("export default withCronJobAudit(");
    },
  );

  it.each(inertRoutes)("keeps %s inert", (routePath, responseStatus) => {
    const source = readFileSync(resolve(process.cwd(), routePath), "utf8");

    expect(source).toContain(`status(${responseStatus})`);
    expect(source).not.toContain("withCronJobAudit(");
    expect(source).not.toContain("withOperationalRouteAuth(");
    expect(source).not.toMatch(/from ["'](?:lib\/supabase|@supabase)/);
    expect(source).not.toContain(".rpc(");
  });
});
