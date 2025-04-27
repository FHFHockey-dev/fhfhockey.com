// components/WiGO/PlayerRatingsDisplay.tsx
import React, { useState, useEffect } from "react";

import { fetchRawStatsForAllStrengths } from "utils/fetchWigoRatingStats"; // Adjust path as needed
import { calculatePlayerRatings } from "utils/calculateWigoRatings"; // Adjust path
import { CalculatedPlayerRatings } from "components/WiGO/types"; // Import the final ratings type

import styles from "./PlayerRatingsDisplay.module.scss"; // Keep your styles import
import useCurrentSeason from "hooks/useCurrentSeason";

interface PlayerRatingsProps {
  playerId: number | null | undefined;
  minGp: number;
}

// --- COLOR INTERPOLATION HELPER ---
// Define the key color points
const COLOR_POINTS = {
  0: { r: 255, g: 0, b: 0 }, // Neon Red (Pure Red)
  50: { r: 255, g: 255, b: 0 }, // Neon Yellow (Pure Yellow)
  100: { r: 57, g: 255, b: 20 } // Neon Green
};
// Linear interpolation function between two numbers
const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

// Function to get the interpolated color based on rating value (0-100)
const getColorForRating = (
  rating: number | null
): { color: string; borderColor: string } => {
  if (rating === null || isNaN(rating)) {
    // Return default colors if rating is null or invalid
    return { color: "#e0e0e0", borderColor: "#4a4f5a" }; // Default text and border
  }

  // Clamp rating between 0 and 100
  const clampedRating = Math.max(0, Math.min(100, rating));

  let r, g, b;

  if (clampedRating <= 50) {
    // Interpolate between Red (0) and Orange (50)
    const t = clampedRating / 50; // Normalize to 0-1 range for this segment
    r = Math.round(lerp(COLOR_POINTS[0].r, COLOR_POINTS[50].r, t));
    g = Math.round(lerp(COLOR_POINTS[0].g, COLOR_POINTS[50].g, t));
    b = Math.round(lerp(COLOR_POINTS[0].b, COLOR_POINTS[50].b, t));
  } else {
    // Interpolate between Orange (50) and Teal (100)
    const t = (clampedRating - 50) / 50; // Normalize to 0-1 range for this segment
    r = Math.round(lerp(COLOR_POINTS[50].r, COLOR_POINTS[100].r, t));
    g = Math.round(lerp(COLOR_POINTS[50].g, COLOR_POINTS[100].g, t));
    b = Math.round(lerp(COLOR_POINTS[50].b, COLOR_POINTS[100].b, t));
  }

  const colorString = `rgb(${r}, ${g}, ${b})`;

  return {
    color: colorString, // For text
    borderColor: colorString // For border
  };
};

// --- Component ---
const PlayerRatingsDisplay: React.FC<PlayerRatingsProps> = ({
  playerId,
  minGp
}) => {
  const [ratings, setRatings] = useState<CalculatedPlayerRatings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const season = useCurrentSeason();

  useEffect(() => {
    if (!playerId || !season?.seasonId) {
      setRatings(null);
      setIsLoading(false);
      setError(null);
      if (!playerId) console.log("[Ratings] No Player ID, clearing state.");
      if (!season?.seasonId) console.log("[Ratings] No season loaded yet.");
      return;
    }

    const loadAndCalculateRatings = async () => {
      setIsLoading(true);
      setError(null);
      setRatings(null);
      console.log(
        `[Ratings] Starting calculation for Player ${playerId}, Season ${season.seasonId}`
      );

      try {
        console.log(`[Ratings] Fetching raw stats...`);
        const rawStats = await fetchRawStatsForAllStrengths(season.seasonId);

        if (!rawStats || Object.keys(rawStats).length === 0) {
          console.warn(
            `[Ratings] No raw stats data returned for season ${season.seasonId}.`
          );
        } else {
          console.log(`[Ratings] Raw stats fetched successfully.`);
        }

        console.log(`[Ratings] Calculating ratings...`);
        const calculatedData = calculatePlayerRatings(playerId, rawStats);

        if (calculatedData) {
          console.log(
            "[Ratings] Calculation successful. Setting final ratings state:",
            calculatedData
          );
          setRatings(calculatedData);
          if (calculatedData._debug) {
            console.log(
              "[Ratings Debug] Intermediate Percentiles:",
              calculatedData._debug.percentiles
            );
            console.log(
              "[Ratings Debug] Regressed Percentiles:",
              calculatedData._debug.regressedPercentiles
            );
          }
        } else {
          console.warn(
            `[Ratings] Calculation returned null for Player ${playerId}. Player might not have data for this season.`
          );
          setRatings(null);
        }
      } catch (err: any) {
        console.error("[Ratings] Error during fetch or calculation:", err);
        setError(
          `Failed to calculate ratings: ${err.message || "Unknown error"}`
        );
        setRatings(null);
      } finally {
        setIsLoading(false);
        console.log("[Ratings] Load and calculation process finished.");
      }
    };

    loadAndCalculateRatings();
  }, [playerId, season?.seasonId]);

  const formatRating = (rating: number | null): string => {
    return rating !== null && !isNaN(rating) ? rating.toFixed(1) : "-";
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading)
      return <div className={styles.loading}>Loading Ratings...</div>;
    if (error) return <div className={styles.error}>{error}</div>;
    if (!ratings && !isLoading && playerId)
      return <div className={styles.calculating}>Calculating...</div>;
    if (!playerId)
      return <div className={styles.noPlayer}>Select player for ratings</div>;
    if (!ratings)
      return (
        <div className={styles.noData}>
          No rating data available for this player/season.
        </div>
      );

    // Helper to generate styles for a rating box
    const getRatingStyles = (ratingValue: number | null) => {
      const { color, borderColor } = getColorForRating(ratingValue);
      return {
        // Apply border color to the box
        boxStyle: {
          borderColor: borderColor,
          borderWidth: "3px",
          borderStyle: "solid"
        },
        // Apply text color to the value span
        valueStyle: { color: color }
      };
    };

    return (
      <div className={styles.ratingsRoot}>
        {/* Column 1: Offense */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Offense</h3>
          <div className={styles.ratingsBoxes}>
            {/* --- Apply dynamic styles --- */}
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.offense.as).boxStyle}
            >
              <span className={styles.ratingLabel}>All</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.offense.as).valueStyle}
              >
                {formatRating(ratings.offense.as)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.offense.es).boxStyle}
            >
              <span className={styles.ratingLabel}>Even</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.offense.es).valueStyle}
              >
                {formatRating(ratings.offense.es)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.offense.pp).boxStyle}
            >
              <span className={styles.ratingLabel}>PP</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.offense.pp).valueStyle}
              >
                {formatRating(ratings.offense.pp)}
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Overall */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Overall</h3>
          <div className={styles.ratingsBoxes}>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.overall.as).boxStyle}
            >
              <span className={styles.ratingLabel}>All</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.overall.as).valueStyle}
              >
                {formatRating(ratings.overall.as)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.overall.es).boxStyle}
            >
              <span className={styles.ratingLabel}>Even</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.overall.es).valueStyle}
              >
                {formatRating(ratings.overall.es)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.overall.st).boxStyle}
            >
              <span className={styles.ratingLabel}>Special</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.overall.st).valueStyle}
              >
                {formatRating(ratings.overall.st)}
              </span>
            </div>
            {/* Final rating uses class for background, but we can add dynamic text/border */}
            {/* <div
              className={`${styles.ratingBox} ${styles.finalRating}`}
              // Override border color, keep background from class
              style={{
                ...getRatingStyles(ratings.overall.final).boxStyle,
                backgroundColor: ""
              }}
            >
              <span className={styles.ratingLabel}>Total</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.overall.final).valueStyle}
              >
                {formatRating(ratings.overall.final)}
              </span>
            </div> */}
          </div>
        </div>

        {/* Column 3: Defense */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Defense</h3>
          <div className={styles.ratingsBoxes}>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.defense.as).boxStyle}
            >
              <span className={styles.ratingLabel}>All</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.defense.as).valueStyle}
              >
                {formatRating(ratings.defense.as)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.defense.es).boxStyle}
            >
              <span className={styles.ratingLabel}>Even</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.defense.es).valueStyle}
              >
                {formatRating(ratings.defense.es)}
              </span>
            </div>
            <div
              className={styles.ratingBox}
              style={getRatingStyles(ratings.defense.pk).boxStyle}
            >
              <span className={styles.ratingLabel}>PK</span>
              <span
                className={styles.ratingValue}
                style={getRatingStyles(ratings.defense.pk).valueStyle}
              >
                {formatRating(ratings.defense.pk)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return renderContent();
};

export default PlayerRatingsDisplay;
