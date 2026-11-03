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

  // Luck pressure compares shooting, on-ice shooting and IPP with league norms for the
  // position (not the player's own history). "Sustainable" rows run at or below those norms;
  // "unsustainable" rows run above them. Neither side measures recent production itself.
  if (direction === "sustainable") {
    if (tone === "stable") {
      return {
        title: "Luck near normal",
        detail: "Shooting and on-ice luck are close to normal for the position, so recent results lean little on luck."
      };
    }
    if (tone === "watch") {
      return {
        title: "Running unlucky",
        detail: "Shooting and on-ice luck are below normal for the position; recent results are not inflated by luck."
      };
    }
    return {
      title: "Well below normal luck",
      detail: "Shooting and on-ice luck are well below normal for the position; recent results may understate the underlying play."
    };
  }

  if (tone === "stable") {
    return {
      title: "Slightly lucky",
      detail: "Shooting and on-ice luck are only slightly above normal for the position."
    };
  }
  if (tone === "watch") {
    return {
      title: "Running lucky",
      detail: "Shooting and on-ice luck are above normal for the position."
    };
  }
  return {
    title: "Most luck-dependent",
    detail: "Shooting and on-ice luck are well above normal for the position; recent results lean most on luck."
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
      detail: "Recent results are not inflated by shooting or on-ice luck."
    };
  }

  if (frame === "overheated") {
    return {
      label: "Overheated",
      detail: "Recent results lean on above-normal shooting or on-ice luck."
    };
  }

  return {
    label: "Short-term only",
    detail: "Useful for quick decisions, but not a long-term verdict."
  };
};
