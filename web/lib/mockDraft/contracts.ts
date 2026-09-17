import { z } from "zod";

export const ENGINE_VERSION = "mock-1";
export const personalities = [
  "Vanilla",
  "BPA",
  "Conservative",
  "Aggressive",
  "Zero-G",
  "Fade",
  "Reach",
  "Hero-G",
  "Contrarian",
] as const;
export type Personality = (typeof personalities)[number];
export const freePersonalities: readonly Personality[] = personalities.slice(
  0,
  4,
);
export const leagueSchema = z
  .object({
    season: z.string().min(1).max(30),
    teamCount: z.number().int().min(2).max(40),
    leagueType: z.enum(["points", "categories"]),
    scoring: z.record(z.number().finite()),
    goalieScoring: z.record(z.number().finite()),
    roster: z
      .record(z.number().int().min(0).max(40))
      .refine(
        (r) =>
          Object.keys(r).every((k) =>
            ["C", "LW", "RW", "FWD", "D", "G", "utility", "bench"].includes(k),
          ) &&
          Object.values(r).reduce((a, b) => a + b, 0) > 0 &&
          Object.values(r).reduce((a, b) => a + b, 0) <= 40,
        "Choose 1–40 roster slots.",
      ),
    grouping: z.enum(["split", "fwd"]),
  })
  .strict();
export type MockLeague = z.infer<typeof leagueSchema>;
export type BotProfile = {
  personality: Personality;
  position?: string;
  variation: number;
};
export type MockConfig = MockLeague & {
  userSeat: number;
  seconds: number;
  timeout: "autopick" | "pause";
  tier: "free" | "pro";
  bots: BotProfile[];
};
export type MockPlayer = {
  id: string;
  canonicalId?: number;
  name: string;
  team: string;
  positions: string[];
  value: number;
  adp: number | null;
  categories: Record<string, number>;
  workload: number | null;
  workloadKind: "starts" | "games" | null;
};
export const pickSchema = z
  .object({
    pick: z.number().int().min(1).max(1600),
    seat: z.number().int().min(0).max(39),
    playerId: z.string().regex(/^\d+$/),
    source: z.enum(["human", "bot", "timeout"]),
    contributes: z.boolean(),
  })
  .strict();
export type MockPick = z.infer<typeof pickSchema> & { reasons: string[] };
export type BotDecision = {
  playerId: string;
  reasons: string[];
  shortlist: { playerId: string; score: number }[];
};
export type MockSession = {
  version: 1;
  id: string;
  engineVersion: string;
  researchVersion: string | null;
  seed: string;
  config: MockConfig;
  players: MockPlayer[];
  picks: MockPick[];
  queue: string[];
  status: "paused" | "running" | "complete";
  pending: {
    pick: number;
    remainingMs: number;
    decision: BotDecision | null;
  } | null;
  contributor: string | null;
  consent: boolean;
  withdrawn: boolean;
  createdAt: string;
};
const botSchema = z.object({
  personality: z.enum(personalities),
  position: z.string().optional(),
  variation: z.number().finite().min(0).max(1),
});
export const configSchema = leagueSchema.extend({
  userSeat: z.number().int().min(0).max(39),
  seconds: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(90),
    z.literal(120),
  ]),
  timeout: z.enum(["autopick", "pause"]),
  tier: z.enum(["free", "pro"]),
  bots: z.array(botSchema).min(2).max(40),
});
const playerSchema = z.object({
  id: z.string().regex(/^\d+$/),
  canonicalId: z.number().int().positive().optional(),
  name: z.string(),
  team: z.string(),
  positions: z.array(z.enum(["C", "LW", "RW", "FWD", "D", "G"])).min(1),
  value: z.number().finite(),
  adp: z.number().finite().positive().nullable(),
  categories: z.record(z.number().finite()),
  workload: z.number().finite().nonnegative().nullable(),
  workloadKind: z.enum(["starts", "games"]).nullable(),
});
export const sessionSchema: z.ZodType<MockSession> = z.object({
  version: z.literal(1),
  id: z.string(),
  engineVersion: z.literal(ENGINE_VERSION),
  researchVersion: z.string().nullable(),
  seed: z.string(),
  config: configSchema,
  players: z.array(playerSchema).max(5000),
  picks: z.array(pickSchema.extend({ reasons: z.array(z.string()) })).max(1600),
  queue: z.array(z.string()).max(5000),
  status: z.enum(["paused", "running", "complete"]),
  pending: z
    .object({
      pick: z.number().int().positive(),
      remainingMs: z.number().finite().nonnegative(),
      decision: z
        .object({
          playerId: z.string(),
          reasons: z.array(z.string()),
          shortlist: z.array(
            z.object({ playerId: z.string(), score: z.number().finite() }),
          ),
        })
        .nullable(),
    })
    .nullable(),
  contributor: z.string().nullable(),
  consent: z.boolean(),
  withdrawn: z.boolean(),
  createdAt: z.string(),
});
export const registrationSchema = z
  .object({
    id: z.string().uuid(),
    league: leagueSchema,
    userSeat: z.number().int().min(0).max(39),
    tier: z.enum(["free", "pro"]),
    engineVersion: z.literal(ENGINE_VERSION),
    researchVersion: z.string().max(100).nullable(),
  })
  .strict()
  .refine((v) => v.userSeat < v.league.teamCount, "Invalid draft seat.");
export const eventsSchema = z
  .object({
    events: z
      .array(pickSchema)
      .min(1)
      .max(100)
      .refine(
        (events) =>
          events.every((e, i) => i === 0 || e.pick === events[i - 1].pick + 1),
        "Events must be consecutive and ordered.",
      ),
    complete: z.boolean(),
  })
  .strict();
export function leagueOf(config: MockLeague): MockLeague {
  return leagueSchema.parse({
    season: config.season,
    teamCount: config.teamCount,
    leagueType: config.leagueType,
    scoring: config.scoring,
    goalieScoring: config.goalieScoring,
    roster: config.roster,
    grouping: config.grouping,
  });
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
