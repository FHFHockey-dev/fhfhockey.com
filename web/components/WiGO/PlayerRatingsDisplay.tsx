import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchRawStatsForAllStrengths } from "utils/fetchWigoRatingStats";
import {
  calculatePlayerRatings,
  WIGO_RATING_MIN_COHORT_PEERS
} from "utils/calculateWigoRatings";

import styles from "./PlayerRatingsDisplay.module.scss";
import { WIGO_ERROR_MESSAGES } from "./errorMessages";
import { formatSeasonRange } from "./tableUtils";
import { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

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
): { color: string } => {
  if (rating === null || isNaN(rating)) {
    return { color: "#e0e0e0" };
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

  return { color: colorString };
};

const PlayerRatingsDisplay: React.FC<PlayerRatingsProps> = ({
  playerId,
  seasonId,
  minGp
}) => {
  const seasonPending = useSeasonPendingMessage();
  const { data: rawStats, isLoading, error } = useQuery({
    queryKey: ["wigoRatingCohort", seasonId],
    queryFn: () => fetchRawStatsForAllStrengths(seasonId!),
    enabled: !!playerId && !!seasonId,
    ...WIGO_QUERY_DEFAULTS,
    // The pager already retries blips per page and gives a timeout one
    // attempt; a query retry would repeat all eight reads (S1, D-01).
    retry: false
  });
  const ratings = useMemo(
    () => playerId && rawStats
      ? calculatePlayerRatings(playerId, rawStats, undefined, undefined, minGp, WIGO_RATING_MIN_COHORT_PEERS)
      : null,
    [playerId, rawStats, minGp]
  );

  const formatRating = (rating: number | null): string => {
    return rating !== null && !isNaN(rating) ? rating.toFixed(1) : "-";
  };
  // AS has no rows this season yet (no writer; P-2), so every All rating is
  // blank. Say why rather than leaving a bare "-" (C-24).
  const asEmpty =
    !!rawStats?.as &&
    (rawStats.as.offense?.length ?? 0) === 0 &&
    (rawStats.as.defense?.length ?? 0) === 0;
  const asEmptyReason = seasonId
    ? `No all-situations data for ${formatSeasonRange(seasonId)} yet`
    : "No all-situations data yet";
  const renderAllValue = (rating: number | null, valueStyle: React.CSSProperties) => (
    <span
      className={styles.ratingValue}
      style={valueStyle}
      title={asEmpty ? asEmptyReason : undefined}
    >
      {formatRating(rating)}
      {asEmpty && <span className={styles.visuallyHidden}>: {asEmptyReason}</span>}
    </span>
  );

  const renderContent = () => {
    if (isLoading)
      return <div className={styles.loading}>Loading ratings…</div>;
    if (error)
      return <div className={styles.error}>{WIGO_ERROR_MESSAGES.ratings}</div>;
    if (!playerId)
      return <div className={styles.noPlayer}>Select a player</div>;
    if (!seasonId)
      return <div className={styles.loading}>{seasonPending}</div>;
    if (!ratings)
      return (
        <div className={styles.noData}>
          No rating data available for this player/season.
        </div>
      );

    // Each rating is a 0–100 semicircle gauge; the notch at the top marks 50, the cohort middle.
    const renderBox = (label: string, rating: number | null, isAll = false) => {
      const { color } = getColorForRating(rating);
      const fill = rating == null || isNaN(rating) ? 0 : Math.max(0, Math.min(100, rating));
      return (
        <div className={styles.ratingBox}>
          <span className={styles.ratingGauge}>
            <svg viewBox="0 0 100 54" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
              <path className={styles.gaugeTrack} d="M 8 50 A 42 42 0 0 1 92 50" pathLength={100} />
              {fill > 0 && (
                <path d="M 8 50 A 42 42 0 0 1 92 50" pathLength={100} className={styles.gaugeFill} stroke={color} strokeDasharray={`${fill} 100`} />
              )}
              <line className={styles.gaugeMid} x1="50" y1="2" x2="50" y2="15" />
            </svg>
            {isAll ? renderAllValue(rating, { color }) : (
              <span className={styles.ratingValue} style={{ color }}>{formatRating(rating)}</span>
            )}
          </span>
          <span className={styles.ratingLabel}>{label}</span>
        </div>
      );
    };

    return (
      <div className={styles.ratingsFrame}>
      <div className={styles.ratingsRoot}>
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Offense</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("All", ratings.offense.as, true)}
            {renderBox("Even", ratings.offense.es)}
            {renderBox("PP", ratings.offense.pp)}
          </div>
        </div>

        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Overall</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("All", ratings.overall.as, true)}
            {renderBox("Even", ratings.overall.es)}
            {renderBox("Special", ratings.overall.st)}
          </div>
        </div>

        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Defense</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("All", ratings.defense.as, true)}
            {renderBox("Even", ratings.defense.es)}
            {renderBox("PK", ratings.defense.pk)}
          </div>
        </div>
      </div>
      {asEmpty && (
        <p className={styles.ratingsNote}>
          {asEmptyReason}: All shows “-”, and Overall uses Even and Special.
        </p>
      )}
      </div>
    );
  };

  return renderContent();
};

export default PlayerRatingsDisplay;
