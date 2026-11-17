import { runPregameCapture } from "../custody";
import type { HostedPregameDeps, HostedPregameRequest } from "../hostedGame";
import { DEFAULT_CAPTURE_BUDGET } from "../policy";
import { CAPTURE_ENABLED_ENV, captureDeps } from "../runner";
import { scheduleReader } from "../scheduleReader";
import { DEFAULT_TRANSPORT_BUDGET } from "../transport";
import { FakeClock, FakeCustodyDb } from "./fakeCustody";
import { mintTimeStampResponse, testTsaTrust } from "./testTsa";
import { buildLeague, TARGET } from "./world/league";
import { createWorldClient } from "./world/store";

/** Offline hosted flow. Tests set Date.now to clock.ms for the native collector's deadline. */
export function makeHostedGameFixture() {
  const request: HostedPregameRequest = {
    gameId: TARGET.gameId, slateDate: TARGET.slateDate, scheduledStart: TARGET.startTime,
    codeVersion: "0123456789abcdef0123456789abcdef01234567",
  };
  const world = buildLeague({});
  const clock = new FakeClock(Date.parse(request.scheduledStart) - 70 * 60_000);
  const db = new FakeCustodyDb(clock, { ...TARGET, scheduledStart: TARGET.startTime });
  const testTrust = testTsaTrust();
  const now = () => clock.ms;
  const deps = {
    now,
    env: {
      [CAPTURE_ENABLED_ENV]: "true", NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
    },
    readSchedule: async (_url, _key, target) => scheduleReader(createWorldClient(world), [target.gameId], target.slateDate)(),
    runCapture: (config, captureRequest) => runPregameCapture(captureDeps({
      writer: db.rpc(), verifier: db.rpc(), trust: testTrust,
      tsa: { stamp: async (query) => {
        clock.advance(400);
        return mintTimeStampResponse(query, { genTimeMicros: BigInt(clock.ms) * BigInt(1_000) });
      } },
      restBaseUrl: "https://fixture.invalid/rest/v1",
      createReadClient: () => createWorldClient(world),
      collectNative: config.collectNative, seasonBootstrap: config.seasonBootstrap, modelEnvironment: config.modelEnvironment,
      budget: { ...DEFAULT_CAPTURE_BUDGET, ...config.budget },
      transportLimits: { ...DEFAULT_TRANSPORT_BUDGET, ...config.transportLimits }, now,
    }), captureRequest),
  } satisfies HostedPregameDeps;
  return { request, world, clock, db, testTrust, deps };
}
