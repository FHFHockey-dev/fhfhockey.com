export {
  parseMinimumGamesPlayedInput
} from "components/Variance/varianceFilters";
export type {
  MinimumGamesPlayedInputResult
} from "components/Variance/varianceFilters";

export interface PercentDraftedInputResult {
  minimumPercentDrafted: number;
  error: string | null;
}

export const DEFAULT_MINIMUM_PERCENT_DRAFTED = 0.5;

export const parseMinimumPercentDraftedInput = (
  rawValue: string,
  currentMinimumPercentDrafted: number
): PercentDraftedInputResult => {
  const trimmed = rawValue.trim();

  if (trimmed === "") {
    return {
      minimumPercentDrafted: DEFAULT_MINIMUM_PERCENT_DRAFTED,
      error: null
    };
  }

  const parsed = Number.parseFloat(trimmed);

  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return {
      minimumPercentDrafted: parsed,
      error: null
    };
  }

  return {
    minimumPercentDrafted: currentMinimumPercentDrafted,
    error: "Enter a decimal from 0 to 1."
  };
};

