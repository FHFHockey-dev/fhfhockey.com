import React from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchRawStatsForAllStrengths } from "utils/fetchWigoRatingStats";
import { calculatePlayerRatings } from "utils/calculateWigoRatings";
import { CalculatedPlayerRatings } from "components/WiGO/types";

import styles from "./PlayerRatingsDisplay.module.scss";

interface PlayerRatingsProps {
  playerId: number | null | undefined;
  seasonId?: number | null;
  minGp: number;
}

const COLOR_POINTS = {
  0: { r: 255, g: 0, b: 0 },
  50: { r: 255, g: 255, b: 0 },
  100: { r: 57, g: 255, b: 20 }
};
const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

const getColorForRating = (
  rating: number | null
): { color: string; borderColor: string } => {
  if (rating === null || isNaN(rating)) {
    return { color: "#e0e0e0", borderColor: "#4a4f5a" };
  }

  const clampedRating = Math.max(0, Math.min(100, rating));

  let r, g, b;

  if (clampedRating <= 50) {
    const t = clampedRating / 50;
    r = Math.round(lerp(COLOR_POINTS[0].r, COLOR_POINTS[50].r, t));
    g = Math.round(lerp(COLOR_POINTS[0].g, COLOR_POINTS[50].g, t));
    b = Math.round(lerp(COLOR_POINTS[0].b, COLOR_POINTS[50].b, t));
  } else {
    const t = (clampedRating - 50) / 50;
    r = Math.round(lerp(COLOR_POINTS[50].r, COLOR_POINTS[100].r, t));
    g = Math.round(lerp(COLOR_POINTS[50].g, COLOR_POINTS[100].g, t));
    b = Math.round(lerp(COLOR_POINTS[50].b, COLOR_POINTS[100].b, t));
  }

  const colorString = `rgb(${r}, ${g}, ${b})`;

  return {
    color: colorString,
    borderColor: colorString
  };
};

const PlayerRatingsDisplay: React.FC<PlayerRatingsProps> = ({
  playerId,
  seasonId,
  minGp
}) => {
  const { data: ratings, isLoading, error } =
    useQuery<CalculatedPlayerRatings | null>({
      queryKey: ["wigoPlayerRatings", playerId, seasonId, minGp],
      queryFn: async () => {
        const rawStats = await fetchRawStatsForAllStrengths(seasonId as number);
        return calculatePlayerRatings(
          playerId as number,
          rawStats,
          undefined,
          undefined,
          minGp
        );
      },
      enabled: typeof playerId === "number" && typeof seasonId === "number"
    });

  const formatRating = (rating: number | null): string => {
    return rating !== null && !isNaN(rating) ? rating.toFixed(1) : "-";
  };

  const renderContent = () => {
    if (isLoading)
      return <div className={styles.loading}>Loading Ratings...</div>;
    if (error instanceof Error)
      return (
        <div className={styles.error}>
          Failed to calculate ratings: {error.message || "Unknown error"}
        </div>
      );
    if (!ratings && !isLoading && playerId)
      return <div className={styles.calculating}>Calculating...</div>;
    if (!playerId)
      return <div className={styles.noPlayer}>Select player for ratings</div>;
    if (!seasonId)
      return <div className={styles.loading}>Loading season info...</div>;
    if (!ratings)
      return (
        <div className={styles.noData}>
          No rating data available for this player/season.
        </div>
      );

    const getRatingStyles = (ratingValue: number | null) => {
      const { color, borderColor } = getColorForRating(ratingValue);
      return {
        boxStyle: {
          borderColor: borderColor,
          borderWidth: "3px",
          borderStyle: "solid"
        },
        valueStyle: { color: color }
      };
    };

    return (
      <div className={styles.ratingsRoot}>
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Offense</h3>
          <div className={styles.ratingsBoxes}>
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
          </div>
        </div>

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
