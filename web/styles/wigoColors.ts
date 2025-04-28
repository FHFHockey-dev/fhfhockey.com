// src/styles/wigoColors.ts (or your chosen path)

// 1. Base Colors (Keep as previously defined or adjust as needed)
export const WIGO_COLORS = {
  GREEN: "#00ff99",
  RED: "#ff6384", // Primary Red/Error/Averages
  YELLOW: "#ffcc33", // Warning / Highlight
  BLUE: "#66ccff", // Lighter Blue
  BRAND_BLUE: "#07aae2", // Secondary Brand Blue
  PRIMARY_BLUE: "#14a2d2", // Primary Brand Blue / Accent
  PURPLE: "#9b59b6",
  PINK_RED: "#ff6b6b", // Alternative Red/Pink
  SOFT_GREEN: "#98d8a8",
  TEAL: "#4bc0c0",
  ORANGE: "#ff9f40",

  // Greys & Neutrals
  GREY_LIGHT: "#d3d3d3",
  GREY_MEDIUM: "#808080",
  GREY_DARK: "#505050",
  GREY_DARKER: "#404040",
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

  // --- Specific Mappings for Consistency Chart (Map to Palette/Base) ---
  CONSISTENCY_0: WIGO_COLORS.GREY_MEDIUM, // 0 Pts: Grey
  CONSISTENCY_1: WIGO_COLORS.RED, // 1 Pt: Red (Special Case)
  CONSISTENCY_2: CHART_PALETTE[0], // 2 Pts: Primary Blue
  CONSISTENCY_3: CHART_PALETTE[1], // 3 Pts: Teal
  CONSISTENCY_4: CHART_PALETTE[4], // 4 Pts: Yellow
  CONSISTENCY_5: CHART_PALETTE[5], // 5 Pts: Orange
  // For 6+ points, cycle through palette or repeat distinct colors
  CONSISTENCY_6: WIGO_COLORS.RED, // Repeat Red
  CONSISTENCY_7: CHART_PALETTE[4], // Repeat Yellow
  CONSISTENCY_8: CHART_PALETTE[2], // Purple
  // ... add more mappings as needed

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
  CHART_COLORS.CONSISTENCY_6,
  CHART_COLORS.CONSISTENCY_7,
  CHART_COLORS.CONSISTENCY_8
  // Add more if needed
];

// 5. Helper Function (Keep addAlpha)
