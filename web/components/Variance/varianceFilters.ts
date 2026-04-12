export interface MinimumGamesPlayedInputResult {
  minimumGamesPlayed: number;
  error: string | null;
}

export const parseMinimumGamesPlayedInput = (
  rawValue: string,
  currentMinimumGamesPlayed: number
): MinimumGamesPlayedInputResult => {
  const trimmed = rawValue.trim();

  if (trimmed === "") {
    return {
      minimumGamesPlayed: 0,
      error: null
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      minimumGamesPlayed: Number.parseInt(trimmed, 10),
      error: null
    };
  }

  return {
    minimumGamesPlayed: currentMinimumGamesPlayed,
    error: "Enter a whole number."
  };
};
