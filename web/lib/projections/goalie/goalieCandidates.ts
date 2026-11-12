/**
 * One row per candidate goalie for one team-game (decisions 25, 63; W1 P0 #20).
 *
 * Each row carries the goalie's own line if he starts, his start probability and the
 * unconditional product. The team's win probability is reported once, apart from any goalie's
 * credited Win, and no row is rescaled against another (no slot rescale). Values are per single
 * game: a probability is never multiplied by a horizon scalar (decision 28).
 *
 * Relief: counts, saves, goals against and shutouts assume zero relief (labelled), so the
 * unconditional count line is P(start)·E[stat | start]. Credited wins include the modelled relief
 * share (goalieWinPopulations). This is the "explicit, labelled zero-relief assumption" decision 63
 * allows until relief is qualified on held-out games.
 */

export const GOALIE_CANDIDATES_CONTRACT = "forge_goalie_candidates_v1" as const;

export type GoalieCandidateLine = {
  shotsAgainst: number;
  saves: number;
  goalsAllowed: number;
  shutoutProbability: number;
  modeledSavePct: number;
};

export type GoalieCandidateInput = {
  goalieId: number;
  startProbability: number;
  /** "override" (manual), "confirmed_evidence" (scoped source evidence) or "uncalibrated_model". */
  startProbabilityStatus: "override" | "confirmed_evidence" | "uncalibrated_model";
  confirmationEvidenceIds: string[];
  ifStarts: GoalieCandidateLine;
  /** P(credited with the win | starts); null when the team win probability is unknown. */
  creditedWinIfStarts: number | null;
  /** P(credited with the win) over the candidate's game, relief share included; null when unknown. */
  unconditionalCreditedWin: number | null;
};

export type GoalieCandidateRow = {
  goalie_id: number;
  rank: number;
  start_probability: number;
  start_probability_status: GoalieCandidateInput["startProbabilityStatus"];
  confirmation_evidence_ids: string[];
  if_starts: {
    shots_against: number;
    saves: number;
    goals_allowed: number;
    shutout_prob: number;
    modeled_save_pct: number;
    credited_win_prob: number | null;
  };
  unconditional: {
    shots_against: number;
    saves: number;
    goals_allowed: number;
    shutout_prob: number;
    credited_win_prob: number | null;
  };
};

export type GoalieCandidatesContract = {
  contract: typeof GOALIE_CANDIDATES_CONTRACT;
  population: "candidate_goalie_game";
  values_per: "single_game";
  game_id: number;
  team_id: number;
  team_win_probability: number | null;
  team_win_source: string | null;
  relief_basis: { counts: "zero_relief_assumption"; shutout: "zero_relief_assumption"; credited_win: "modelled_decision_share" };
  start_probability_mass: number;
  /** 1 − Σ P(start), kept as unresolved, never redistributed to the listed goalies. */
  unresolved_start_mass: number;
  issuance: {
    run_id: string;
    as_of_date: string;
    issued_at: string;
    information_cutoff_at: string | null;
    starter_labels: { source: string; window_games: number | null; known_games: number | null; unknown_games: number | null } | null;
  };
  rows: GoalieCandidateRow[];
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const roundOrNull = (value: number | null, digits: number) =>
  value == null || !Number.isFinite(value) ? null : round(value, digits);

export function buildGoalieCandidatesContract(args: {
  gameId: number;
  teamId: number;
  teamWinProbability: number | null;
  teamWinSource: string | null;
  issuance: GoalieCandidatesContract["issuance"];
  candidates: GoalieCandidateInput[];
}): GoalieCandidatesContract {
  // Unrounded probabilities until the wire (W2-8 D2): rounding first can push a closed set above 1.
  const ordered = [...args.candidates].sort((a, b) => b.startProbability - a.startProbability || a.goalieId - b.goalieId);
  const mass = ordered.reduce((sum, c) => sum + Math.max(0, c.startProbability), 0);
  return {
    contract: GOALIE_CANDIDATES_CONTRACT,
    population: "candidate_goalie_game",
    values_per: "single_game",
    game_id: args.gameId,
    team_id: args.teamId,
    team_win_probability: roundOrNull(args.teamWinProbability, 4),
    team_win_source: args.teamWinSource,
    relief_basis: { counts: "zero_relief_assumption", shutout: "zero_relief_assumption", credited_win: "modelled_decision_share" },
    start_probability_mass: round(mass, 6),
    unresolved_start_mass: round(Math.max(0, 1 - mass), 6),
    issuance: args.issuance,
    rows: ordered.map((c, index) => {
      const p = Math.max(0, Math.min(1, c.startProbability));
      return {
        goalie_id: c.goalieId,
        rank: index + 1,
        start_probability: round(p, 6),
        start_probability_status: c.startProbabilityStatus,
        confirmation_evidence_ids: [...c.confirmationEvidenceIds].sort(),
        if_starts: {
          shots_against: round(c.ifStarts.shotsAgainst, 3),
          saves: round(c.ifStarts.saves, 3),
          goals_allowed: round(c.ifStarts.goalsAllowed, 3),
          shutout_prob: round(c.ifStarts.shutoutProbability, 4),
          modeled_save_pct: round(c.ifStarts.modeledSavePct, 4),
          credited_win_prob: roundOrNull(c.creditedWinIfStarts, 4),
        },
        unconditional: {
          shots_against: round(p * c.ifStarts.shotsAgainst, 3),
          saves: round(p * c.ifStarts.saves, 3),
          goals_allowed: round(p * c.ifStarts.goalsAllowed, 3),
          shutout_prob: round(p * c.ifStarts.shutoutProbability, 4),
          credited_win_prob: roundOrNull(c.unconditionalCreditedWin, 4),
        },
      };
    }),
  };
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Readers' entry point: the contract stored in a forge_goalie_projections row's uncertainty, or null
 * when the row predates it or fails validation (fail closed; never rebuild a partner as 1 − p(top)).
 */
export function readGoalieCandidatesContract(uncertainty: unknown): GoalieCandidatesContract | null {
  const value = (uncertainty as { goalie_candidates?: unknown } | null)?.goalie_candidates as GoalieCandidatesContract | undefined;
  if (!value || value.contract !== GOALIE_CANDIDATES_CONTRACT || value.values_per !== "single_game" || !Array.isArray(value.rows)) return null;
  const ids = new Set<number>();
  for (const row of value.rows) {
    if (!finite(row?.goalie_id) || ids.has(row.goalie_id)) return null;
    ids.add(row.goalie_id);
    if (!finite(row.start_probability) || row.start_probability < 0 || row.start_probability > 1) return null;
    if (!row.if_starts || !row.unconditional) return null;
  }
  const mass = value.rows.reduce((sum, row) => sum + row.start_probability, 0);
  // Each stored value carries at most 5e-7 of rounding.
  if (mass > 1 + value.rows.length * 5e-7) return null;
  return value;
}
