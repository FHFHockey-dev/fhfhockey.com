import supabase from "lib/supabase/server";

export type PredictionsSkoDependencyIssue = {
  code: "missing_player_stats_unified";
  message: string;
  detail: string;
  action: string;
};

export class PredictionsSkoDependencyError extends Error {
  statusCode: number;
  issue: PredictionsSkoDependencyIssue;

  constructor(issue: PredictionsSkoDependencyIssue, statusCode = 424) {
    super(issue.message);
    this.name = "PredictionsSkoDependencyError";
    this.statusCode = statusCode;
    this.issue = issue;
  }
}

export function isPredictionsSkoDependencyError(
  error: unknown
): error is PredictionsSkoDependencyError {
  return error instanceof PredictionsSkoDependencyError;
}

export async function assertPredictionsSkoPrerequisites(args: {
  asOfDate: string;
  startDate: string;
}) {
  const { count, error } = await (supabase as any)
    .from("player_stats_unified")
    .select("*", { count: "exact", head: true })
    .lte("date", args.asOfDate)
    .gte("date", args.startDate)
    .eq("games_played", 1)
    .not("player_id", "is", null);

  if (error) throw error;

  if ((count ?? 0) === 0) {
    throw new PredictionsSkoDependencyError({
      code: "missing_player_stats_unified",
      message:
        "Missing prerequisite data in player_stats_unified for sKO prediction refresh.",
      detail: `No eligible player_stats_unified rows were found between ${args.startDate} and ${args.asOfDate}.`,
      action:
        "Refresh player_stats_unified before running /api/v1/ml/update-predictions-sko."
    });
  }
}
