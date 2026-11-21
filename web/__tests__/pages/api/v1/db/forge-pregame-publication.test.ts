// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import route from "pages/api/v1/db/forge-pregame-publication";
import { PublicationError, publishQualifiedPregameCapture } from "lib/projections/pregameCapture/publication";

vi.mock("lib/projections/pregameCapture/publication", async (importOriginal) => ({
  ...await importOriginal<typeof import("lib/projections/pregameCapture/publication")>(),
  publishQualifiedPregameCapture: vi.fn(),
}));

const target = { claimId: "550e8400-e29b-41d4-a716-446655440000", gameId: 1 };
const sha = "a".repeat(40);
const publish = vi.mocked(publishQualifiedPregameCapture);
async function call(body: Record<string, unknown> = target, method = "POST", authorization = "Bearer offline-key") {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  await route({ method, body, headers: { authorization }, query: {} } as any, res as any);
  return res;
}

describe("one-game FORGE publication route", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "offline-key");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    publish.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("requires authentication, POST and an exact target on a pinned production release", async () => {
    expect((await call(target, "POST", "")).status).toHaveBeenCalledWith(401);
    expect((await call(target, "GET")).status).toHaveBeenCalledWith(405);
    expect((await call({ ...target, codeVersion: sha })).status).toHaveBeenCalledWith(400);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await call()).status).toHaveBeenCalledWith(503);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect((await call()).status).toHaveBeenCalledWith(503);
    expect(publish).not.toHaveBeenCalled();
  });

  it("passes only the validated target and server pin and returns the confirmed receipt", async () => {
    const result = { runId: target.claimId, revisionId: "revision", inputSnapshotId: "snapshot", alreadyPublished: false,
      publishedAt: "2026-01-01T12:00:00Z", observedAt: "2026-01-01T12:00:01Z" };
    publish.mockResolvedValue(result);
    const res = await call();
    expect(publish).toHaveBeenCalledWith({ ...target, codeVersion: sha });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it("distinguishes a definite custody refusal from an unconfirmed write", async () => {
    publish.mockRejectedValueOnce(new PublicationError(409, "capture_not_qualified"));
    expect((await call()).status).toHaveBeenCalledWith(409);
    publish.mockRejectedValueOnce(new PublicationError(503, "capture_cutoff_pending"));
    const early = await call();
    expect(early.status).toHaveBeenCalledWith(503);
    expect(early.setHeader).toHaveBeenCalledWith("Retry-After", "1");
    publish.mockRejectedValueOnce(new Error("private database details"));
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "publication_unconfirmed" });
  });
});
