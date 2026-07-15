import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../lib/supabase/database-generated.types";
import type { NhlShotFeatureRow } from "../lib/supabase/Upserts/nhlShotFeatureBuilder";
import type { ParsedNhlPbpEvent } from "../lib/supabase/Upserts/nhlPlayByPlayParser";
import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
  type BinaryLabel,
  type BinaryLogisticModel,
} from "../lib/xg/binaryLogistic";
import { buildRichReboundLabels, type RichReboundLabel } from "../lib/xg/reboundRichLabels";
import {
  encodeFeatureVector,
  loadXgModelArtifact,
  type PersistedXgModelArtifact,
} from "../lib/xg/shotFeaturePersistence";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type Split = "train" | "validation" | "test";
type Example = { rowId: string; split: Split; label: BinaryLabel; features: number[] };
type HeadName = "conditional_rebound_danger" | "goalie_freeze_control" | "conditional_second_chance_xg";
type FeatureRow = { game_id: number; event_id: number; feature_payload: unknown };
type PbpRow = Database["public"]["Tables"]["nhl_api_pbp_events"]["Row"];

const PAGE_SIZE = 1000;
const GAME_CHUNK_SIZE = 20;
const DEFAULT_ARTIFACT = path.resolve(
  process.cwd(),
  "scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json"
);
const DEFAULT_REFERENCE = path.resolve(
  process.cwd(),
  "scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706/dataset-artifact.json"
);
const DEFAULT_OUTPUT = path.resolve(
  process.cwd(),
  "scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json"
);

function cliValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]!) : fallback;
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function key(gameId: number, eventId: number): string {
  return `${gameId}:${eventId}`;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Missing production Supabase read credentials.");
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function fetchPbp(client: ReturnType<typeof createSupabaseClient>, gameIds: number[]) {
  const rows: PbpRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("nhl_api_pbp_events")
      .select("*")
      .in("game_id", gameIds)
      .eq("parser_version", 1)
      .eq("strength_version", 1)
      .order("game_id", { ascending: true })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("event_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchFeatures(client: ReturnType<typeof createSupabaseClient>, gameIds: number[]) {
  const rows: FeatureRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("nhl_xg_shot_features")
      .select("game_id,event_id,feature_payload")
      .in("game_id", gameIds)
      .eq("feature_version", 1)
      .order("game_id", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as FeatureRow[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

function labelForHead(head: HeadName, row: RichReboundLabel): BinaryLabel | null {
  if (head === "conditional_rebound_danger") return row.conditionalHighDanger;
  if (head === "goalie_freeze_control") {
    return row.sourceGoalieInNetId == null ? null : row.goalieFreezeCoveredPuck;
  }
  return row.conditionalNextAttemptGoal;
}

function auc(labels: number[], probabilities: number[]): number | null {
  const positives = labels.reduce<number>((sum, label) => sum + label, 0);
  const negatives = labels.length - positives;
  if (!positives || !negatives) return null;
  const ranked = probabilities.map((probability, index) => ({ probability, label: labels[index]! }))
    .sort((left, right) => left.probability - right.probability);
  let positiveRankSum = 0;
  for (let start = 0; start < ranked.length; ) {
    let end = start + 1;
    while (end < ranked.length && ranked[end]!.probability === ranked[start]!.probability) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      if (ranked[index]!.label === 1) positiveRankSum += averageRank;
    }
    start = end;
  }
  return (positiveRankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function metrics(rows: Example[], model: BinaryLogisticModel, baseRate: number) {
  const labels = rows.map((row) => row.label);
  const probabilities = rows.map((row) => predictBinaryLogisticProbability(model, row.features));
  const positives = labels.reduce<number>((sum, label) => sum + label, 0);
  const brier = labels.reduce<number>((sum, label, index) => sum + (probabilities[index]! - label) ** 2, 0) / labels.length;
  const logLoss = labels.reduce<number>((sum, label, index) => {
    const probability = Math.min(1 - 1e-9, Math.max(1e-9, probabilities[index]!));
    return sum - (label * Math.log(probability) + (1 - label) * Math.log(1 - probability));
  }, 0) / labels.length;
  const baseBrier = labels.reduce<number>((sum, label) => sum + (baseRate - label) ** 2, 0) / labels.length;
  const baseLogLoss = labels.reduce<number>((sum, label) => {
    const probability = Math.min(1 - 1e-9, Math.max(1e-9, baseRate));
    return sum - (label * Math.log(probability) + (1 - label) * Math.log(1 - probability));
  }, 0) / labels.length;
  return {
    rows: rows.length,
    positives,
    positiveRate: positives / rows.length,
    averagePrediction: probabilities.reduce((sum, value) => sum + value, 0) / rows.length,
    brier,
    logLoss,
    auc: auc(labels, probabilities),
    baseRateBrier: baseBrier,
    baseRateLogLoss: baseLogLoss,
  };
}

function trainHead(head: HeadName, examples: Example[]) {
  const bySplit = {
    train: examples.filter((row) => row.split === "train"),
    validation: examples.filter((row) => row.split === "validation"),
    test: examples.filter((row) => row.split === "test"),
  };
  const trainPositives = bySplit.train.reduce<number>((sum, row) => sum + row.label, 0);
  const trainNegatives = bySplit.train.length - trainPositives;
  if (trainPositives < 10 || trainNegatives < 10 || !bySplit.validation.length || !bySplit.test.length) {
    return { head, trained: false, blockingReasons: ["insufficient_binary_training_or_holdout_coverage"] };
  }
  const model = trainBinaryLogisticModel(bySplit.train, {
    iterations: 500,
    learningRate: 0.05,
    l2: 0.01,
  });
  const baseRate = trainPositives / bySplit.train.length;
  const validation = metrics(bySplit.validation, model, baseRate);
  const test = metrics(bySplit.test, model, baseRate);
  const blockingReasons: string[] = [];
  for (const [split, report] of [["validation", validation], ["test", test]] as const) {
    if (report.rows < 100) blockingReasons.push(`${split}_rows_below_100`);
    if (report.positives < 10) blockingReasons.push(`${split}_positives_below_10`);
    if (report.brier >= report.baseRateBrier) blockingReasons.push(`${split}_brier_not_better_than_base_rate`);
    if (report.logLoss >= report.baseRateLogLoss) blockingReasons.push(`${split}_log_loss_not_better_than_base_rate`);
    if (report.auc == null || report.auc < 0.5) blockingReasons.push(`${split}_auc_below_0_5`);
  }
  return {
    head,
    trained: true,
    promotionAuthorized: false,
    fit: { family: "logistic_l2", iterations: 500, learningRate: 0.05, l2: 0.01 },
    splitCounts: Object.fromEntries(Object.entries(bySplit).map(([split, rows]) => [split, rows.length])),
    trainPositiveRate: baseRate,
    validation,
    test,
    offlineGatePassed: blockingReasons.length === 0,
    blockingReasons,
    model,
  };
}

async function main() {
  const artifactPath = cliValue("--artifact", DEFAULT_ARTIFACT);
  const referencePath = cliValue("--reference", DEFAULT_REFERENCE);
  const outputPath = cliValue("--output", DEFAULT_OUTPUT);
  const artifact = loadXgModelArtifact(artifactPath) as PersistedXgModelArtifact;
  const reference = JSON.parse(fs.readFileSync(referencePath, "utf8")) as {
    splitAssignments: Array<{ gameId: number; split: Split }>;
  };
  const splitByGame = new Map(reference.splitAssignments.map((row) => [row.gameId, row.split]));
  const gameIds = Array.from(splitByGame.keys());
  const examplesByHead = new Map<HeadName, Example[]>([
    ["conditional_rebound_danger", []],
    ["goalie_freeze_control", []],
    ["conditional_second_chance_xg", []],
  ]);
  const terminationCounts = new Map<string, number>();
  let labelRows = 0;
  let missingFeatureRows = 0;
  const client = createSupabaseClient();

  for (const [chunkIndex, gameChunk] of chunks(gameIds, GAME_CHUNK_SIZE).entries()) {
    const [pbp, features] = await Promise.all([fetchPbp(client, gameChunk), fetchFeatures(client, gameChunk)]);
    const featureByKey = new Map(features.map((row) => [key(row.game_id, row.event_id), row.feature_payload]));
    const labels = buildRichReboundLabels(pbp as unknown as ParsedNhlPbpEvent[]);
    labelRows += labels.length;
    for (const label of labels) {
      terminationCounts.set(label.termination, (terminationCounts.get(label.termination) ?? 0) + 1);
      const payload = featureByKey.get(key(label.gameId, label.sourceEventId));
      const split = splitByGame.get(label.gameId);
      if (!payload || !split) {
        missingFeatureRows += 1;
        continue;
      }
      const featuresVector = encodeFeatureVector(payload as NhlShotFeatureRow, artifact);
      for (const head of examplesByHead.keys()) {
        const target = labelForHead(head, label);
        if (target == null) continue;
        examplesByHead.get(head)!.push({
          rowId: key(label.gameId, label.sourceEventId),
          split,
          label: target,
          features: featuresVector,
        });
      }
    }
    console.error(JSON.stringify({
      phase: "rebound-rich-labels",
      processedGames: Math.min((chunkIndex + 1) * GAME_CHUNK_SIZE, gameIds.length),
      totalGames: gameIds.length,
      labelRows,
      missingFeatureRows,
    }));
  }

  const result = {
    artifactKind: "nhl_xg_rebound_rich_offline_heads",
    artifactVersion: 1,
    generatedAt: new Date().toISOString(),
    offlineOnly: true,
    promotionAuthorized: false,
    sourceFeatureArtifactTag: artifact.artifactTag,
    sourceFeatureArtifactSha256: sha256(fs.readFileSync(artifactPath, "utf8")),
    referenceDatasetSha256: sha256(fs.readFileSync(referencePath, "utf8")),
    contract: {
      labelVersion: "rebound_rich_labels_v1",
      rowGrain: "one eligible rebound-source shot event",
      windowSeconds: 3,
      possessionRule: "next eligible attempt must remain in the source possession sequence",
      terminationRules: ["opponent_control", "stoppage", "faceoff", "penalty", "period_or_game_end", "window_expired"],
      dangerRule: "conditional next-attempt distance <=20 feet and angle <=35 degrees",
      freezeRule: "shot-on-goal followed by bounded stoppage; interpreted as freeze/covered-puck proxy",
      secondChanceRule: "conditional next unblocked attempt goal label; separate shot-goal head",
      splitRule: "exact frozen champion game-level chronological splits",
    },
    coverage: {
      games: gameIds.length,
      labelRows,
      missingFeatureRows,
      terminationCounts: Object.fromEntries([...terminationCounts.entries()].sort()),
    },
    heads: [...examplesByHead.entries()].map(([head, examples]) => trainHead(head, examples)),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, coverage: result.coverage, heads: result.heads.map((head) => ({
    head: head.head,
    trained: head.trained,
    offlineGatePassed: "offlineGatePassed" in head ? head.offlineGatePassed : false,
    blockingReasons: head.blockingReasons,
    validation: "validation" in head ? head.validation : null,
    test: "test" in head ? head.test : null,
  })) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
