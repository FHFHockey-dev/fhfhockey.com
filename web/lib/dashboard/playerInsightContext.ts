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
        title: "Inside expected band",
        detail: "Recent output is still living near the player’s expected conversion band."
      };
    }
    if (tone === "watch") {
      return {
        title: "Leaning above baseline",
        detail: "The run is still mostly supportable, but it is starting to press the expected band."
      };
    }
    return {
      title: "Still above expected band",
      detail: "The player is producing through a hotter-than-usual band even if the rise still has skill support."
    };
  }

  if (tone === "stable") {
    return {
      title: "Watch for cooling",
      detail: "The heater is not wildly outside baseline yet, but the signal still needs skepticism."
    };
  }
  if (tone === "watch") {
    return {
      title: "Pressing the upper band",
      detail: "The current heater is moving beyond the player’s normal expected range."
    };
  }
  return {
    title: "Outside expected band",
    detail: "This run is materially above the expected band and most exposed to regression."
  };
};

export const describeTrendBand = (
  mode: "hotCold" | "movement",
  score: number
) => {
  if (mode === "movement") {
    if (score >= 2) {
      return {
        title: "Acceleration band",
        detail: "Recent percentile rank is climbing fast enough to matter in the short term."
      };
    }
    if (score <= -2) {
      return {
        title: "Slide band",
        detail: "Recent percentile rank is falling fast enough to flag a real short-term drop."
      };
    }
    return {
      title: "Low movement band",
      detail: "Recent ranking movement is present, but not yet forceful."
    };
  }

  if (score >= 75) {
    return {
      title: "Hot stretch",
      detail: "Current percentile profile is sitting well above the middle of the pool."
    };
  }
  if (score <= 25) {
    return {
      title: "Cold stretch",
      detail: "Current percentile profile is lagging the pool and needs rebound evidence."
    };
  }
  return {
    title: "Middle band",
    detail: "Current percentile profile is active, but not strongly hot or cold."
  };
};

export const describePlayerSignalFrame = (frame: PlayerSignalFrame) => {
  if (frame === "trustworthy") {
    return {
      label: "Trustworthy",
      detail: "Skill-backed rise with manageable luck pressure."
    };
  }

  if (frame === "overheated") {
    return {
      label: "Overheated",
      detail: "Regression-prone heater pushing beyond the expected band."
    };
  }

  return {
    label: "Short-term only",
    detail: "Momentum and movement cues are useful, but they are not trust verdicts."
  };
};
