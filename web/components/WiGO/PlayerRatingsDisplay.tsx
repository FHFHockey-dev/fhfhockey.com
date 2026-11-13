import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchRawStatsForAllStrengths,
  fetchSkaterPositionGroups
} from "utils/fetchWigoRatingStats";
import {
  calculatePlayerRatings,
  WIGO_RATING_MIN_COHORT_PEERS,
  WIGO_ST_MIN_MINUTES_DEFAULT,
  WIGO_PK_LOW_RELIABILITY_NOTE,
  wigoSpecialTeamsCohortOptions,
  type WigoSpecialTeamsStrength
} from "utils/calculateWigoRatings";
import type { Strength } from "components/WiGO/types";

import styles from "./PlayerRatingsDisplay.module.scss";
import { WIGO_ERROR_MESSAGES } from "./errorMessages";
import { formatSeasonRange } from "./tableUtils";
import { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

interface PlayerRatingsProps {
  playerId: number | null | undefined;
  seasonId?: number | null;
  minGp: number;
  stMinMinutes?: Record<WigoSpecialTeamsStrength, number>;
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
  minGp,
  stMinMinutes = WIGO_ST_MIN_MINUTES_DEFAULT
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
  // PP/PK rank forwards and defensemen apart (decision 81). A failed position
  // read leaves PP/PK unranked rather than pooled.
  const positions = useQuery({
    queryKey: ["wigoPositionGroups", seasonId],
    queryFn: () => fetchSkaterPositionGroups(seasonId!),
    enabled: !!playerId && !!seasonId,
    ...WIGO_QUERY_DEFAULTS
  });
  const positionsSettled = !positions.isLoading;
  const ratings = useMemo(
    () => playerId && rawStats && positionsSettled
      ? calculatePlayerRatings(
          playerId,
          rawStats,
          undefined,
          undefined,
          minGp,
          WIGO_RATING_MIN_COHORT_PEERS,
          wigoSpecialTeamsCohortOptions(positions.data ?? null, stMinMinutes)
        )
      : null,
    [playerId, rawStats, positionsSettled, positions.data, minGp, stMinMinutes]
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
    if (isLoading || (rawStats && !positionsSettled))
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

    // A withheld rating says how much of its weight had data (A3); a partial
    // weighted mean is never shown.
    // PP/PK below the minutes floor, or with no position, say so (decision 81).
    const specialTeamsNote = (strength: WigoSpecialTeamsStrength) => {
      const side = strength === "pp" ? rawStats?.pp?.offense : rawStats?.pk?.defense;
      const row = side?.find((p) => p.player_id === playerId);
      const label = strength.toUpperCase();
      if (positions.error || !positions.data?.has(playerId))
        return `Unranked: position unknown, so there is no forward or defense ${label} cohort`;
      const minutes = typeof row?.toi_seconds === "number" ? row.toi_seconds / 60 : null;
      if (minutes === null || minutes < stMinMinutes[strength])
        return `Insufficient sample: ${minutes === null ? "no" : Math.round(minutes)} ${label} min, below the ${stMinMinutes[strength]}-min floor`;
      return null;
    };
    const coverageNote = (type: "offense" | "defense", strength: Strength) => {
      if (strength === "pp" || strength === "pk") {
        const floorNote = specialTeamsNote(strength);
        if (floorNote) return floorNote;
      }
      const coverage = ratings.coverage?.[type]?.[strength];
      if (!coverage || coverage.available === coverage.total) return null;
      return `Insufficient data: ${coverage.available} of ${coverage.total} weight units have a percentile`;
    };
    // The visible value and labeled bar share the same 0–100 rating; missing data has no meter.
    const renderBox = (
      family: string,
      label: string,
      rating: number | null,
      isAll = false,
      note: string | null = null,
      labelNote: string | null = null
    ) => {
      const { color } = getColorForRating(rating);
      const fill = rating == null || isNaN(rating) ? 0 : Math.max(0, Math.min(100, rating));
      return (
        <div className={styles.ratingBox}>
          <span className={styles.ratingLabel} title={labelNote ?? undefined}>
            {label}
            {labelNote && (
              <>
                <span aria-hidden="true">*</span>
                <span className={styles.visuallyHidden}>: {labelNote}</span>
              </>
            )}
          </span>
          <span className={styles.ratingTrack}>
            {rating !== null && !isNaN(rating) && (
              <meter
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={fill}
                className={styles.ratingMeter}
                min={0}
                max={100}
                value={fill}
                aria-label={`${family} ${label}`}
                style={{ "--rating-color": color } as React.CSSProperties}
              />
            )}
          </span>
          {isAll && (asEmpty || !note) ? renderAllValue(rating, {}) : (
            <span className={styles.ratingValue} title={rating === null && note ? note : undefined}>
              {formatRating(rating)}
              {rating === null && note && <span className={styles.visuallyHidden}>: {note}</span>}
            </span>
          )}
        </div>
      );
    };

    return (
      <div className={styles.ratingsFrame}>
      <div className={styles.ratingsRoot}>
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Offense</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("Offense", "All", ratings.offense.as, true, coverageNote("offense", "as"))}
            {renderBox("Offense", "Even", ratings.offense.es, false, coverageNote("offense", "es"))}
            {renderBox("Offense", "PP", ratings.offense.pp, false, coverageNote("offense", "pp"))}
          </div>
        </div>

        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Overall</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("Overall", "All", ratings.overall.as, true)}
            {renderBox("Overall", "Even", ratings.overall.es)}
            {renderBox("Overall", "Special", ratings.overall.st)}
          </div>
        </div>

        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Defense</h3>
          <div className={styles.ratingsBoxes}>
            {renderBox("Defense", "All", ratings.defense.as, true, coverageNote("defense", "as"))}
            {renderBox("Defense", "Even", ratings.defense.es, false, coverageNote("defense", "es"))}
            {renderBox("Defense", "PK", ratings.defense.pk, false, coverageNote("defense", "pk"), WIGO_PK_LOW_RELIABILITY_NOTE)}
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
