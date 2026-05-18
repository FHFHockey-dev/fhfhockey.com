import type { NormalizedSustainabilityRow } from "./normalizers";

export type InsightTone = "stable" | "watch" | "risk";
export type PlayerSignalFrame = "trustworthy" | "overheated" | "shortTerm";

export const resolveInsightTone = (magnitude: number): InsightTone => {
  const abs = Math.abs(magnitude);
  if (abs >= 1.25) return "risk";
  if (abs >= 0.75) return "watch";
  return "stable";
};

export const describeSustainabilityBand = (
  row: NormalizedSustainabilityRow,
  direction: "sustainable" | "unsustainable"
) => {
  const tone = resolveInsightTone(row.luck_pressure);

  if (direction === "sustainable") {
    if (tone === "stable") {
      return {
        title: "Looks repeatable",
        detail: "Recent scoring is close to what the player usually earns from his chances."
      };
    }
    if (tone === "watch") {
      return {
        title: "Mostly believable",
        detail: "The run still has support, but it is getting a little hot."
      };
    }
    return {
      title: "Good, but hot",
      detail: "The rise has some skill support, but the scoring pace is still hotter than normal."
    };
  }

  if (tone === "stable") {
    return {
      title: "Could cool",
      detail: "The streak is not extreme yet, but it still deserves skepticism."
    };
  }
  if (tone === "watch") {
    return {
      title: "Running hot",
      detail: "The current streak is moving beyond the player’s normal range."
    };
  }
  return {
    title: "Likely to cool",
    detail: "This run is well above normal and most exposed to a drop."
  };
};

export const describeTrendBand = (
  mode: "hotCold" | "movement",
  score: number
) => {
  if (mode === "movement") {
    if (score >= 2) {
      return {
        title: "Moving up fast",
        detail: "Recent form is climbing quickly enough to matter short term."
      };
    }
    if (score <= -2) {
      return {
        title: "Dropping fast",
        detail: "Recent form is falling quickly enough to flag a short-term problem."
      };
    }
    return {
      title: "Small move",
      detail: "Recent movement is present, but not strong yet."
    };
  }

  if (score >= 75) {
    return {
      title: "Hot stretch",
      detail: "Current form is well above the middle of the player pool."
    };
  }
  if (score <= 25) {
    return {
      title: "Cold stretch",
      detail: "Current form is lagging the pool and needs rebound evidence."
    };
  }
  return {
    title: "Middle range",
    detail: "Current form is active, but not strongly hot or cold."
  };
};

export const describePlayerSignalFrame = (frame: PlayerSignalFrame) => {
  if (frame === "trustworthy") {
    return {
      label: "Trustworthy",
      detail: "The rise looks supported by more than luck."
    };
  }

  if (frame === "overheated") {
    return {
      label: "Overheated",
      detail: "The hot streak may cool off."
    };
  }

  return {
    label: "Short-term only",
    detail: "Useful for quick decisions, but not a long-term verdict."
  };
};
