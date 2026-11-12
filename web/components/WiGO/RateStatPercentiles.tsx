import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import styles from "styles/wigoCharts.module.scss";
import { fetchPercentileCohortForPlayer } from "utils/fetchWigoPercentiles";
import { PlayerRawStats, PercentileStrength } from "components/WiGO/types";
import {
  calculateRankingResult
} from "utils/calculatePercentiles";
import { formatOrdinal } from "utils/formattingUtils";
import { WIGO_ERROR_MESSAGES } from "./errorMessages";
import { formatSeasonRange } from "./tableUtils";
import useCurrentSeason, { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";
import {
  WIGO_ST_FLOOR_VALIDATED,
  WIGO_ST_MIN_MINUTES_DEFAULT,
  isWigoSpecialTeamsStrength,
  meetsWigoMinutesFloor,
  type WigoSpecialTeamsStrength
} from "utils/calculateWigoRatings";
import { fetchSkaterPositionGroups } from "utils/fetchWigoRatingStats";

// Datalabels is passed to this chart only. Registered globally, it would join
// charts created before this lazy panel loaded, whose plugin state it never
// set up, and crash them on their next update (`_labels` of undefined).
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface RateStatPercentilesProps {
  desktop?: boolean;
  playerId: number | null | undefined;
  seasonId?: number | null;
  minGp: number;
  onMinGpChange: (newMinGp: number) => void;
  // PP/PK cohorts use a minutes floor and rank F and D apart (decision 81).
  stMinMinutes?: Record<WigoSpecialTeamsStrength, number>;
  onStMinMinutesChange?: (strength: WigoSpecialTeamsStrength, minutes: number) => void;
}

const ALL_STATS_TO_DISPLAY: Array<{
  label: string;
  key: string;
  higherIsBetter: boolean;
}> = [
  { label: "TOI/GP", key: "toi_per_gp_calc", higherIsBetter: true },
  { label: "G/60", key: "goals_per_60", higherIsBetter: true },
  { label: "A/60", key: "total_assists_per_60", higherIsBetter: true },
  { label: "Pts/60", key: "total_points_per_60", higherIsBetter: true },
  { label: "SOG/60", key: "shots_per_60", higherIsBetter: true },
  { label: "iSCF/60", key: "iscfs_per_60", higherIsBetter: true },
  { label: "iHDCF/60", key: "i_hdcf_per_60", higherIsBetter: true },
  { label: "ixG/60", key: "ixg_per_60", higherIsBetter: true },
  { label: "iCF/60", key: "icf_per_60", higherIsBetter: true },
  { label: "SCF/60", key: "scf_per_60", higherIsBetter: true },
  { label: "HDCF/60", key: "oi_hdcf_per_60", higherIsBetter: true },
  { label: "CF%", key: "cf_pct", higherIsBetter: true },
  { label: "SF%", key: "sf_pct", higherIsBetter: true },
  { label: "GF%", key: "gf_pct", higherIsBetter: true },
  { label: "SCF%", key: "scf_pct", higherIsBetter: true },
  { label: "HDCF%", key: "hdcf_pct", higherIsBetter: true }
];

type CalculatedData = {
  [key: string]: number | null;
};

/** Ice time in seconds, or null when unknown (rows may carry it as text). */
const toiSecondsOf = (player: PlayerRawStats): number | null => {
  if (player.toi == null || player.toi === "") return null;
  const seconds = Number(player.toi);
  return Number.isFinite(seconds) ? seconds : null;
};

const generateChartConfig = (
  statsToDisplay: Array<{
    label: string;
    key: string;
    higherIsBetter: boolean;
  }>,
  percentiles: CalculatedData | null,
  ranks: CalculatedData | null,
  cohortSizes: CalculatedData | null = null
): { data: ChartData<"bar">; options: ChartOptions<"bar"> } => {
  const labels = statsToDisplay.map((stat) => stat.label);
  const dataValues = statsToDisplay.map((stat) => {
    const percentile = percentiles ? percentiles[stat.key] : null;
    const validPercentile =
      percentile !== null && !isNaN(percentile)
        ? Math.max(0, Math.min(1, percentile))
        : null;
    return validPercentile !== null ? Math.round(validPercentile * 100) : null;
  });

  const backgroundColors = dataValues.map((value) => {
    if (value === null) {
      return "#555555";
    }

    const brandHue = 195;
    const brandSaturation = 70;
    const minLightness = 25;
    const maxLightness = 65;
    const lightness =
      minLightness + (value / 100) * (maxLightness - minLightness);

    return `hsl(${brandHue}, ${brandSaturation}%, ${lightness}%)`;
  });
  const data: ChartData<"bar"> = {
    labels: labels,
    datasets: [
      {
        label: "Percentile Rank",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 1
      }
    ]
  };

  // Phone tab only (one-page mode uses tiles): one row per stat so 16 labels fit a 390px screen.
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          display: false,
          stepSize: 25
        },
        border: { display: false },
        grid: {
          color: "rgba(255, 255, 255, 0.1)"
        }
      },
      y: {
        ticks: {
          color: "#ccc",
          autoSkip: false,
          font: { size: 12, family: "Roboto Condensed, sans-serif" }
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.x !== null) {
              label += context.parsed.x + "%";
            }
            return label;
          },
          title: function (context) {
            return context[0]?.label || "";
          }
        }
      },
      datalabels: {
        labels: {
          valueLabel: {
            display: true,
            // Dark on the light long bars, white on the page background beside short ones.
            color: (context) =>
              ((context.dataset.data[context.dataIndex] as number | null) ?? 0) >= 65
                ? "#06202b"
                : "#fff",
            anchor: "end",
            // Long bars carry the label inside so it cannot run off the canvas.
            align: (context) =>
              ((context.dataset.data[context.dataIndex] as number | null) ?? 0) >= 65
                ? "start"
                : "end",
            font: {
              size: 12,
              weight: "bold",
              family: "Roboto Condensed, sans-serif"
            },
            formatter: (value, context) => {
              if (value === null) return null;
              const statKey = statsToDisplay[context.dataIndex]?.key;
              const rank = statKey && ranks ? formatOrdinal(ranks[statKey]) : null;
              const size = statKey && cohortSizes ? cohortSizes[statKey] : null;
              return `${value}% · ${rank ?? "-"}${rank && size ? `/${size}` : ""}`;
            }
          }
        }
      }
    }
  };

  return { data, options };
};

const RateStatPercentiles: React.FC<RateStatPercentilesProps> = ({
  playerId,
  seasonId,
  minGp,
  onMinGpChange,
  stMinMinutes = WIGO_ST_MIN_MINUTES_DEFAULT,
  onStMinMinutesChange,
  desktop = false
}) => {
  const [selectedStrength, setSelectedStrength] =
    useState<PercentileStrength>("as");
  const seasonPending = useSeasonPendingMessage();
  const queryClient = useQueryClient();
  const currentSeason = useCurrentSeason();
  const {
    data: percentileCohort,
    isLoading,
    error
  } = useQuery({
    queryKey: ["wigoPercentileStats", selectedStrength, seasonId, playerId],
    queryFn: () =>
      fetchPercentileCohortForPlayer(
        selectedStrength,
        seasonId as number,
        playerId as number,
        queryClient
      ),
    ...WIGO_QUERY_DEFAULTS,
    enabled: typeof seasonId === "number" && typeof playerId === "number"
  });
  const allPlayersStats = useMemo<PlayerRawStats[]>(
    () => percentileCohort?.stats ?? [],
    [percentileCohort?.stats]
  );
  const specialTeams = isWigoSpecialTeamsStrength(selectedStrength) ? selectedStrength : null;
  const floorMinutes = specialTeams ? stMinMinutes[specialTeams] : undefined;
  const cohortSeasonId = percentileCohort?.appliedSeasonId ?? seasonId;
  const positionQuery = useQuery({
    queryKey: ["wigoPositionGroups", cohortSeasonId],
    queryFn: () => fetchSkaterPositionGroups(cohortSeasonId as number),
    ...WIGO_QUERY_DEFAULTS,
    enabled: specialTeams !== null && typeof cohortSeasonId === "number"
  });
  const positionGroups = specialTeams ? positionQuery.data ?? null : null;
  const playerGroup = playerId && positionGroups ? positionGroups.get(playerId) ?? null : null;
  const selectedPlayerToiMinutes = useMemo(() => {
    const player = allPlayersStats.find((row) => row.player_id === playerId);
    const toi = player ? toiSecondsOf(player) : null;
    return toi === null ? null : toi / 60;
  }, [allPlayersStats, playerId]);

  // Regular-season length of the season shown, when the current-season record
  // knows it (current or previous season); otherwise null.
  const displayedSeasonId = percentileCohort?.appliedSeasonId ?? seasonId;
  const seasonGameCount = useMemo(() => {
    if (!currentSeason || typeof displayedSeasonId !== "number") return null;
    const count =
      displayedSeasonId === currentSeason.seasonId
        ? currentSeason.numberOfGames
        : displayedSeasonId === currentSeason.lastSeasonId
          ? currentSeason.lastNumberOfGames
          : null;
    return typeof count === "number" && Number.isSafeInteger(count) && count > 0
      ? count
      : null;
  }, [currentSeason, displayedSeasonId]);

  const maxPossibleGp = useMemo(() => {
    const maxGpOverall = allPlayersStats.reduce(
      (max, player) => Math.max(max, player.gp ?? 0),
      0
    );

    return maxGpOverall > 0 ? maxGpOverall : (seasonGameCount ?? 0);
  }, [allPlayersStats, seasonGameCount]);

  const selectedPlayerGp = useMemo(() => {
    if (!playerId) {
      return null;
    }

    const cohortGp =
      allPlayersStats.find((player) => player.player_id === playerId)?.gp ??
      null;

    return cohortGp;
  }, [allPlayersStats, playerId]);

  const { calculatedPercentiles, calculatedRanks, cohortSizes } = useMemo(() => {
    if (!playerId || allPlayersStats.length === 0 || (specialTeams && positionQuery.isLoading)) {
      return {
        calculatedPercentiles: null as CalculatedData | null,
        calculatedRanks: null as CalculatedData | null,
        cohortSizes: null as CalculatedData | null
      };
    }

    // PP/PK: same F/D group and a minutes floor for everyone, the selected player
    // included (decision 81). Other strengths keep the games floor.
    const filteredPlayers = allPlayersStats.filter((player) =>
      specialTeams
        ? playerGroup !== null &&
          positionGroups?.get(player.player_id) === playerGroup &&
          meetsWigoMinutesFloor(toiSecondsOf(player), floorMinutes)
        : player.gp !== null &&
          (player.gp >= minGp || player.player_id === playerId)
    );

    // A cohort of the selected player alone ranks them 1st at 50% on every
    // stat, which says nothing (C-23).
    if (
      !filteredPlayers.some((player) => player.player_id === playerId) ||
      !filteredPlayers.some((player) => player.player_id !== playerId)
    ) {
      return {
        calculatedPercentiles: {} as CalculatedData,
        calculatedRanks: {} as CalculatedData,
        cohortSizes: {} as CalculatedData
      };
    }

    const percentileResults: CalculatedData = {};
    const rankResults: CalculatedData = {};
    const sizeResults: CalculatedData = {};
    // Each stat ranks only the rows with a finite value for it; the selected player
    // and at least one peer must be among them, or the stat is unranked (A3).
    const rankStat = (
      key: string,
      rows: Array<{ player_id: number; value: number }>,
      higherIsBetter: boolean
    ) => {
      const ranked =
        rows.some((row) => row.player_id === playerId) &&
        rows.some((row) => row.player_id !== playerId)
          ? calculateRankingResult(rows, playerId, higherIsBetter)
          : null;
      percentileResults[key] = ranked?.percentile ?? null;
      rankResults[key] = ranked?.rank ?? null;
      sizeResults[key] = ranked ? rows.length : null;
    };

    const toiGpData = filteredPlayers
      .map((player) => ({
        player_id: player.player_id,
        value:
          player.toi != null && player.gp != null && player.gp > 0
            ? Number(player.toi) / Number(player.gp)
            : null
      }))
      .filter(
        (player): player is { player_id: number; value: number } =>
          player.value !== null && Number.isFinite(player.value)
      );

    rankStat("toi_per_gp_calc", toiGpData, true);

    ALL_STATS_TO_DISPLAY.forEach((stat) => {
      if (stat.key === "toi_per_gp_calc") {
        return;
      }

      const validStatKey = stat.key as keyof PlayerRawStats;
      const statData = filteredPlayers
        .map((player) => ({
          player_id: player.player_id,
          value: player[validStatKey] as number | null
        }))
        .filter(
          (player): player is { player_id: number; value: number } =>
            player.value !== null && Number.isFinite(player.value)
        );

      rankStat(stat.key, statData, stat.higherIsBetter);
    });

    return {
      calculatedPercentiles: percentileResults,
      calculatedRanks: rankResults,
      cohortSizes: sizeResults
    };
  }, [allPlayersStats, minGp, playerId, specialTeams, positionQuery.isLoading, playerGroup, positionGroups, floorMinutes]);

  const handleStrengthChange = useCallback((strength: PercentileStrength) => {
    setSelectedStrength(strength);
  }, []);

  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (specialTeams) onStMinMinutesChange?.(specialTeams, value);
      else onMinGpChange(value);
    },
    [onMinGpChange, onStMinMinutesChange, specialTeams]
  );

  const selectedPlayerMeetsGpThreshold = useMemo(() => {
    return selectedPlayerGp !== null && selectedPlayerGp >= minGp;
  }, [selectedPlayerGp, minGp]);

  // Never below the current minimum, so the thumb stays on the track.
  const maxToiMinutes = Math.ceil(
    allPlayersStats.reduce((max, player) => Math.max(max, (toiSecondsOf(player) ?? 0) / 60), 0)
  );
  const sliderValue = specialTeams ? (floorMinutes ?? 0) : minGp;
  const sliderMax = specialTeams
    ? Math.max(maxToiMinutes, sliderValue, 1)
    : Math.max(selectedPlayerGp ?? 0, maxPossibleGp, minGp, 1);

  const combinedChartConfig = useMemo(
    () =>
      generateChartConfig(
        ALL_STATS_TO_DISPLAY,
        calculatedPercentiles,
        calculatedRanks,
        cohortSizes
      ),
    [calculatedPercentiles, calculatedRanks, cohortSizes]
  );

  const strengthLabel = selectedStrength.toUpperCase();
  const thresholdMessages: Array<{ short: string; full: string }> = [];
  const seasonLabel = typeof seasonId === "number" ? formatSeasonRange(seasonId) : "this season";
  if (allPlayersStats.length === 0) {
    thresholdMessages.push({ short: `No ${strengthLabel} data yet`, full: `No ${strengthLabel} percentile data for ${seasonLabel} yet.` });
  } else if (
    percentileCohort?.fallbackReason &&
    percentileCohort.appliedSeasonId === percentileCohort.requestedSeasonId
  ) {
    thresholdMessages.push({ short: `${strengthLabel} data incomplete`, full: percentileCohort.fallbackReason });
  }
  const groupName = playerGroup === "D" ? "defensemen" : "forwards";
  if (specialTeams && calculatedPercentiles !== null && allPlayersStats.length > 0) {
    const floorText = `${floorMinutes} ${strengthLabel} min`;
    if (positionQuery.error || (playerId && playerGroup === null)) {
      thresholdMessages.push({ short: "Position unknown", full: `The player's position is unknown, so there is no forward or defense ${strengthLabel} cohort to rank against.` });
    } else if (selectedPlayerToiMinutes === null || !meetsWigoMinutesFloor(selectedPlayerToiMinutes * 60, floorMinutes)) {
      thresholdMessages.push({
        short: "Insufficient sample",
        full: `Insufficient sample: ${selectedPlayerToiMinutes === null ? "no" : Math.round(selectedPlayerToiMinutes)} ${strengthLabel} minutes, below the ${floorText} floor.`
      });
    }
    thresholdMessages.push({
      short: `${groupName} · ${floorText}+`,
      full: `${strengthLabel} ranks ${groupName} only, with at least ${floorText}. The ${floorText} default is provisional${WIGO_ST_FLOOR_VALIDATED ? "" : " (not yet validated by split-half stability)"}; lower it with the slider.`
    });
  }
  if (
    !specialTeams &&
    calculatedPercentiles !== null &&
    allPlayersStats.length > 0 &&
    !allPlayersStats.some((player) => player.player_id !== playerId && player.gp !== null && player.gp >= minGp)
  ) {
    thresholdMessages.push({ short: `No others at ${minGp}+ GP`, full: `No other players have ${minGp}+ GP at ${strengthLabel}, so there is nothing to rank against.` });
  }
  if (
    calculatedPercentiles !== null &&
    percentileCohort?.fallbackReason &&
    percentileCohort.appliedSeasonId !== percentileCohort.requestedSeasonId
  ) {
    thresholdMessages.push({
      short: `${formatSeasonRange(percentileCohort.appliedSeasonId)} values and cohort, not ${formatSeasonRange(seasonId as number)}`,
      full: percentileCohort.fallbackReason
    });
  }
  if (!specialTeams && calculatedPercentiles !== null && !selectedPlayerMeetsGpThreshold && selectedPlayerGp !== null) {
    thresholdMessages.push({
      short: `GP ${selectedPlayerGp} below min ${minGp}`,
      full: `Selected Player GP (${selectedPlayerGp}) below threshold (${minGp}). Comparing against ${minGp}+ GP players.`
    });
  }
  if (selectedPlayerGp === 0) {
    thresholdMessages.push({ short: `0 GP at ${strengthLabel}`, full: `Selected Player has 0 GP for ${strengthLabel}.` });
  }
  if (selectedPlayerGp === null && playerId && !isLoading) {
    thresholdMessages.push({ short: `No ${strengthLabel} GP data`, full: `Selected Player has no GP data for ${strengthLabel}.` });
  }

  return (
    <div className={`${styles.rateStatPercentilesComponent} ${desktop ? styles.percentileDesktop : ""}`}>
      {isLoading && (
        <div className={styles.loadingMessage}>Loading percentiles…</div>
      )}
      {!isLoading && error && (
        <div className={styles.errorMessage}>
          {WIGO_ERROR_MESSAGES.percentile}
        </div>
      )}
      {!isLoading && !error && !seasonId && playerId && (
        <div className={styles.loadingMessage}>{seasonPending}</div>
      )}
      {!isLoading && !error && !playerId && (
        <div className={styles.noPlayerMessage}>Select a player</div>
      )}

      {!isLoading && !error && playerId && seasonId && (
        <div className={styles.mainContentWrapper}>
          <div className={styles.percentileFiltersContainer}>
            <h3 className={styles.filtersTitle}>Rate stat percentiles</h3>
            <div className={styles.filterControlsWrapper}>
              <div className={styles.strengthSelector}>
                {(["as", "es", "pp", "pk"] as PercentileStrength[]).map(
                  (strength) => (
                    <button
                      key={strength}
                      onClick={() => handleStrengthChange(strength)}
                      className={
                        selectedStrength === strength ? styles.active : ""
                      }
                      aria-pressed={selectedStrength === strength}
                      disabled={isLoading}
                    >
                      {strength.toUpperCase()}
                    </button>
                  )
                )}
              </div>
              <div className={styles.gpSliderContainer}>
                <label htmlFor="gpSlider">
                  {specialTeams ? `Min ${strengthLabel} min:` : "Min GP:"}
                  <span className={styles.minGpValue}>{sliderValue}</span>
                </label>
                <span className={styles.gpSliderMaxLabel}>
                  {sliderMax > 1
                    ? sliderMax
                    : selectedPlayerGp !== null
                      ? selectedPlayerGp
                      : ""}
                </span>

                <input
                  type="range"
                  id="gpSlider"
                  min="0"
                  max={sliderMax}
                  value={sliderValue}
                  onChange={handleSliderChange}
                  disabled={isLoading || allPlayersStats.length === 0}
                  className={styles.gpSlider}
                  style={
                    {
                      "--min": 0,
                      "--max": sliderMax,
                      "--val": sliderValue
                    } as React.CSSProperties
                  }
                />

              </div>
            </div>

            <div className={desktop ? styles.percentileStatusRow : undefined}>
              {/* One-page mode keeps the requested and applied seasons for screen readers; the chip says when they differ. */}
              {desktop ? (
                <div className={styles.percentileContext}>
                  {/* AS/ES pool F and D; PP/PK rank them apart (decision 81). */}
                  Player GP: {selectedPlayerGp ?? "—"} · {specialTeams ? `${groupName} only` : "all skaters"}
                  <span className={styles.visuallyHidden}> · Requested {seasonId} · Applied {percentileCohort?.appliedSeasonId ?? seasonId}</span>
                </div>
              ) : (
                <div className={styles.percentileContext}>
                  Player GP: {selectedPlayerGp ?? "—"} ·{" "}
                  {percentileCohort && percentileCohort.appliedSeasonId !== percentileCohort.requestedSeasonId
                    ? `${formatSeasonRange(percentileCohort.appliedSeasonId)} values, not ${formatSeasonRange(seasonId)}`
                    : specialTeams ? `${groupName} only` : "all skaters"}
                </div>
              )}
              <div className={desktop ? styles.thresholdChips : styles.thresholdMessagesContainer}>
                {thresholdMessages.map(message => desktop
                  // One-page mode keeps each notice to a short chip; the full sentence stays for screen readers and hover.
                  ? <div key={message.full} className={styles.thresholdMessage} title={message.full}>
                      {message.short}<span className={styles.visuallyHidden}>: {message.full}</span>
                    </div>
                  : <div key={message.full} className={styles.thresholdMessage}>{message.full}</div>)}
              </div>
            </div>
          </div>
          {desktop ? <div className={styles.percentileTileGrid}>
            {ALL_STATS_TO_DISPLAY.map(stat => {
              const percentile = calculatedPercentiles?.[stat.key];
              const rank = calculatedRanks?.[stat.key];
              const size = cohortSizes?.[stat.key];
              const available = percentile != null && Number.isFinite(percentile);
              return <div className={styles.percentileTile} key={stat.key}>
                <span>{stat.label}</span>
                <strong>{available ? `${Math.round(percentile * 100)}%` : "—"}</strong>
                <meter aria-label={`${stat.label} percentile`} min={0} max={100} value={available ? percentile * 100 : 0} />
                {/* A sparse tile shows one dash, in the value; "Rank unavailable" overflows 3x6 at 1280 (E proto2). */}
                <small>{rank != null ? <>{formatOrdinal(rank)}{size != null && <>/{size}</>}<span className={styles.visuallyHidden}> rank of {size} with this stat</span></> : <span className={styles.visuallyHidden}>Rank unavailable</span>}</small>
              </div>;
            })}
          </div> : <div className={styles.chartAndRanksArea}>
            <div className={styles.percentileChartsContainer}>
              {calculatedPercentiles !== null ? (
                <Bar
                  options={combinedChartConfig.options}
                  data={combinedChartConfig.data}
                  plugins={[ChartDataLabels]}
                  role="img"
                  aria-label={`Percentile by stat: ${(combinedChartConfig.data.labels ?? [])
                    .map((statLabel, index) => `${statLabel} ${combinedChartConfig.data.datasets[0]?.data[index] ?? "unavailable"}%`)
                    .join(", ")}`}
                />
              ) : (
                <div className={styles.chartLoadingPlaceholder}>
                  Calculating…
                </div>
              )}
            </div>
          </div>}
        </div>
      )}
    </div>
  );
};

export default RateStatPercentiles;
