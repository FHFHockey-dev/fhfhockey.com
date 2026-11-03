// src/styles/wigoColors.ts (or your chosen path)

// 1. Base Colors (Keep as previously defined or adjust as needed)
export const WIGO_COLORS = {
  GREEN: "#00ff99",
  RED: "#ff6384", // Primary Red/Error/Averages #ff6384
  YELLOW: "#ffcc33", // Warning / Highlight #ffcc33
  BLUE: "#66ccff", // Lighter Blue #66ccff
  BRAND_BLUE: "#07aae2", // Secondary Brand Blue #07aae2
  PRIMARY_BLUE: "#14a2d2", // Primary Brand Blue / Accent   #14a2d2
  PURPLE: "#9b59b6", // Purple #9b59b6
  PINK_RED: "#ff6b6b", // Alternative Red/Pink #ff6b6b
  SOFT_GREEN: "#98d8a8", // Soft Green #98d8a8
  TEAL: "#4bc0c0", // Teal #4bc0c0
  ORANGE: "#ff9f40", // Orange #ff9f40

  // Greys & Neutrals
  GREY_LIGHT: "#d3d3d3", // #d3d3d3
  GREY_MEDIUM: "#808080", // #808080
  GREY_DARK: "#505050", // #505050
  GREY_DARKER: "#404040", // #404040
  GREY_TEXT: "#cccccc", // Main text/ticks on dark
  GREY_TEXT_SEC: "#aaaaaa", // Secondary text / Axis titles
  WHITE: "#ffffff",
  BLACK: "#000000",
  TRANSPARENT: "transparent",

  // Backgrounds (Assuming dark theme from vars.scss)
  BG_DARK_1: "#101010",
  BG_DARK_2: "#1a1d21",
  BG_DARK_3: "#202020"
};

export const addAlpha = (hexColor: string, opacity: number): string => {
  if (!hexColor || typeof hexColor !== "string") return "rgba(0,0,0,0)"; // Handle invalid input
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexColor)) {
    if (hexColor === "transparent") return "rgba(0,0,0,0)";
    // Maybe it's already rgba? Basic check
    if (hexColor.startsWith("rgba")) return hexColor;
    console.warn(`Invalid hex color "${hexColor}" passed to addAlpha.`);
    return "rgba(0,0,0,0)"; // Fallback for invalid format
  }
  let c = hexColor.substring(1).split("");
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  const hexValue = parseInt(c.join(""), 16); // Convert hex string to number
  const r = (hexValue >> 16) & 255;
  const g = (hexValue >> 8) & 255;
  const b = hexValue & 255;
  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
};

// 2. Consistent Chart Color Palette (Primary source for datasets)
//    Ordered for typical use (e.g., Blues/Teals first)
export const CHART_PALETTE = [
  WIGO_COLORS.PRIMARY_BLUE, // #14a2d2
  WIGO_COLORS.TEAL, // #4bc0c0
  WIGO_COLORS.PURPLE, // #9b59b6
  WIGO_COLORS.BRAND_BLUE, // #07aae2 (Slightly different blue)
  WIGO_COLORS.YELLOW, // #ffcc33
  WIGO_COLORS.ORANGE, // #ff9f40
  WIGO_COLORS.SOFT_GREEN, // #98d8a8
  WIGO_COLORS.BLUE, // #66ccff (Lightest Blue)
  WIGO_COLORS.PINK_RED // #ff6b6b
  // Add more distinct colors if needed, ensure good contrast
];

// 3. Semantic Chart Colors (Map meaning to palette or base colors)
//    THIS IS KEY FOR CONSISTENCY
export const CHART_COLORS = {
  // --- Datasets ---
  BAR_PRIMARY: CHART_PALETTE[0], // Use first palette color for primary bars
  BAR_SECONDARY: CHART_PALETTE[1], // Use second for secondary bars (e.g., GameScore)
  LINE_PRIMARY: CHART_PALETTE[1], // Use second for primary lines (e.g., Rolling Avg 1, Total TOI)
  LINE_SECONDARY: CHART_PALETTE[2], // Use third for secondary lines (e.g., Rolling Avg 2, PP TOI)
  LINE_TERTIARY: CHART_PALETTE[4], // Use fifth for tertiary lines (e.g., PP Pct)
  AREA_PRIMARY: addAlpha(CHART_PALETTE[0], 0.2), // Background fill for primary area/bar

  AVG_LINE_PRIMARY: WIGO_COLORS.RED, // Standout color for averages
  AVG_LINE_SECONDARY: WIGO_COLORS.GREY_MEDIUM, // Less prominent average

  // --- UI Elements ---
  GRID_LINE: "rgba(255, 255, 255, 0.1)",
  AXIS_BORDER: "rgba(255, 255, 255, 0.1)",
  TICK_LABEL: WIGO_COLORS.GREY_TEXT,
  AXIS_TITLE: WIGO_COLORS.GREY_TEXT_SEC,

  TOOLTIP_BACKGROUND: "rgba(0, 0, 0, 0.8)",
  TOOLTIP_TEXT: WIGO_COLORS.WHITE,
  TOOLTIP_BORDER: WIGO_COLORS.GREY_DARK,

  DATALABEL_TEXT: WIGO_COLORS.WHITE, // Default for labels on bars/lines

  // --- Point consistency: an ordinal ramp, one brand-blue hue, dark (0 Pts)
  // to light (6+ Pts). Validated with the dataviz ordinal checks on the dark
  // panel surface #15171a: monotone lightness, adjacent dL >= 0.06, dark end
  // 2.60:1, hue spread 23 degrees (U5, E-04).
  CONSISTENCY_0: "#005f90",
  CONSISTENCY_1: "#0077a8",
  CONSISTENCY_2: "#0c8fbf",
  CONSISTENCY_3: "#45a7d5",
  CONSISTENCY_4: "#6ec0e9",
  CONSISTENCY_5: "#97d8fa",
  CONSISTENCY_6: "#c0f0ff",

  // --- Rate Percentile Specific (Map value ranges to palette) ---
  PERCENTILE_0_20: WIGO_COLORS.RED,
  PERCENTILE_21_40: CHART_PALETTE[5], // Orange
  PERCENTILE_41_60: CHART_PALETTE[4], // Yellow
  PERCENTILE_61_80: CHART_PALETTE[1], // Teal
  PERCENTILE_81_100: CHART_PALETTE[0], // Primary Blue
  PERCENTILE_NULL: WIGO_COLORS.GREY_MEDIUM,
  PP_TOI: WIGO_COLORS.ORANGE,

  // --- Other ---
  FALLBACK: WIGO_COLORS.GREY_LIGHT,
  BORDER_DARK: WIGO_COLORS.GREY_DARK // e.g., Doughnut border
};

// 4. Chart Palette for Consistency Chart (Derived from CHART_COLORS)
export const CONSISTENCY_CHART_COLORS = [
  CHART_COLORS.CONSISTENCY_0,
  CHART_COLORS.CONSISTENCY_1,
  CHART_COLORS.CONSISTENCY_2,
  CHART_COLORS.CONSISTENCY_3,
  CHART_COLORS.CONSISTENCY_4,
  CHART_COLORS.CONSISTENCY_5,
  CHART_COLORS.CONSISTENCY_6
];

// Chart-row colour roles (U8), one meaning each. Bars are the per-game values
// and stay recessive; blue is the primary series and the left comparison
// period; amber is the right comparison period only; magenta is the second
// series (10-game average, power play); dashed ink is an average. Lines vs
// panel #15171a pass the dataviz checks in dark mode (blue/magenta: CVD dE 12.4,
// normal 27.7; blue/amber: 22.5, 26.4). Lines that cross bars get a 2 px
// surface ring, since magenta is 2.37:1 against the bars.
export const WIGO_CHART_ROLES = {
  BAR: "#34495a",
  PRIMARY: "#14a2d2",
  SECONDARY: "#d55181",
  RIGHT: "#c98500",
  AVERAGE: "#cfcfcf",
  OTHER_PERIOD: "#7d8790",
  SERIES_INK: "#e6e6e6",
  SURFACE: "#15171a"
} as const;

// The dark ring drawn under a line so it reads where it crosses a bar.
export const withSurfaceRing = <T extends { label?: string; order?: number; borderWidth?: number }>(
  dataset: T
) => [
  {
    ...dataset,
    label: `${dataset.label ?? ""} ring`,
    borderColor: WIGO_CHART_ROLES.SURFACE,
    borderWidth: (dataset.borderWidth ?? 2) + 3,
    backgroundColor: "transparent",
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    order: (dataset.order ?? 0) + 0.5,
    isSurfaceRing: true
  },
  dataset
];
export const isSurfaceRing = (dataset: unknown) =>
  !!(dataset as { isSurfaceRing?: boolean } | undefined)?.isSurfaceRing;

// One tick font for the chart row (U6): the SVG game log inherits Roboto
// Condensed, so the canvas charts name it, with the generic fallback.
export const CHART_TICK_FONT = {
  size: 12,
  family: "Roboto Condensed, sans-serif"
} as const;

// 5. Helper Function (Keep addAlpha)
