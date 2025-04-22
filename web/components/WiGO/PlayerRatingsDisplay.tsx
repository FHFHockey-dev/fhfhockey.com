// components/WiGO/PlayerRatingsDisplay.tsx
import React, { useState, useEffect } from "react";
// **** Use the correct fetch function ****
import { fetchPercentilePlayerData } from "utils/fetchWigoPlayerStats";
import { calculatePercentileRank } from "utils/calculatePercentiles";
import { PlayerRawStats, PercentileStrength } from "components/WiGO/types";
import {
  OFFENSE_RATING_STATS,
  DEFENSE_RATING_STATS,
  HIGHER_IS_BETTER_MAP
} from "./ratingsConstants"; // Adjust import path
import styles from "./PlayerRatingsDisplay.module.scss";

interface PlayerRatingsProps {
  playerId: number | null | undefined;
  minGp: number; // Prop still received, but NOT used for filtering here
}

interface CalculatedRatings {
  offense: { as: number | null; es: number | null; pp: number | null };
  defense: { as: number | null; es: number | null; pk: number | null };
  overall: {
    as: number | null;
    es: number | null;
    st: number | null;
    final: number | null;
  };
}

const PlayerRatingsDisplay: React.FC<PlayerRatingsProps> = ({
  playerId,
  minGp // Keep prop for potential future use or consistency, but don't filter with it
}) => {
  const [ratings, setRatings] = useState<CalculatedRatings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setRatings(null);
      setIsLoading(false);
      setError(null);
      console.log("[Ratings] No Player ID, clearing state.");
      return;
    }

    const calculateRatings = async () => {
      // Note: minGp is available here from props, but we won't use it for filtering below
      console.log(
        `[Ratings] Starting calculation for Player ID: ${playerId} (minGp prop: ${minGp} - NOT used for filtering percentile data)`
      );
      setIsLoading(true);
      setError(null);
      setRatings(null);

      try {
        // 1. Fetch Data (using fetchPercentilePlayerData)
        console.log("[Ratings] Fetching data from PERCENTILE tables...");
        const results = await Promise.allSettled([
          fetchPercentilePlayerData("as"),
          fetchPercentilePlayerData("es"),
          fetchPercentilePlayerData("pp"),
          fetchPercentilePlayerData("pk")
        ]);

        const getDataFromResult = (
          result: PromiseSettledResult<PlayerRawStats[]>,
          strength: string
        ): PlayerRawStats[] => {
          if (result.status === "fulfilled") {
            console.log(
              `[Ratings] Fetched ${result.value.length} players for ${strength}.`
            );
            // Log first few player data for inspection (optional, can be large)
            // if (result.value.length > 0) {
            //     console.log(`[Ratings] Sample ${strength} data[0]:`, JSON.stringify(result.value[0], null, 2));
            // }
            return result.value;
          } else {
            console.error(
              `[Ratings] Failed to fetch data for strength ${strength}:`,
              result.reason
            );
            setError((prev) =>
              `${prev || ""} Failed to fetch ${strength} data.`.trim()
            ); // Append error
            return [];
          }
        };

        const dataAS = getDataFromResult(results[0], "AS");
        const dataES = getDataFromResult(results[1], "ES");
        const dataPP = getDataFromResult(results[2], "PP");
        const dataPK = getDataFromResult(results[3], "PK");

        // Check if essential data was fetched
        if (
          dataAS.length === 0 &&
          dataES.length === 0 &&
          dataPP.length === 0 &&
          dataPK.length === 0
        ) {
          throw new Error("Failed to fetch data for all strengths.");
        }

        // Get Player TOI using toi_seconds
        const targetPlayerDataPP = dataPP.find((p) => p.player_id === playerId);
        const targetPlayerDataPK = dataPK.find((p) => p.player_id === playerId);
        const player_pp_toi_seconds = targetPlayerDataPP?.toi_seconds ?? 0; // USE toi_seconds
        const player_pk_toi_seconds = targetPlayerDataPK?.toi_seconds ?? 0; // USE toi_seconds
        console.log(
          `[Ratings] Player TOI - PP: ${player_pp_toi_seconds}s, PK: ${player_pk_toi_seconds}s`
        );

        // Filter data - **** REMOVE THIS IF GP IS NOT SEASON TOTAL ****
        const filterByGp = (data: PlayerRawStats[]) =>
          data.filter((p) => p.gp != null && p.gp >= minGp);
        const filteredAS = filterByGp(dataAS);
        const filteredES = filterByGp(dataES);
        const filteredPP = filterByGp(dataPP);
        const filteredPK = filterByGp(dataPK);

        // 3. Calculate Percentiles Helper (Now receives unfiltered data)
        const getAvgPercentile = (
          categoryStats: (keyof PlayerRawStats)[] | undefined,
          playerData: PlayerRawStats[], // Unfiltered data
          targetId: number,
          strengthForDebug: PercentileStrength
        ): number | null => {
          const debugPrefix = `[Ratings][${strengthForDebug}]`;
          if (!categoryStats || categoryStats.length === 0) {
            /* ... */ return null;
          }
          if (playerData.length === 0) {
            console.log(`${debugPrefix} Source player data is empty.`); // Changed log message
            return null;
          }
          // **** Check if target exists in the UNFILTERED source data ****
          const targetPlayerExists = playerData.some(
            (p) => p.player_id === targetId
          );
          if (!targetPlayerExists) {
            console.log(
              `${debugPrefix} Target player ${targetId} not found in source data.`
            );
            return null; // Player not in this percentile table at all
          }

          let sumPercentiles = 0;
          let countValidStats = 0;
          console.log(
            `${debugPrefix} Calculating average percentile for ${categoryStats.length} stats across ${playerData.length} players...`
          );

          for (const statKey of categoryStats) {
            // Prepare comparison group by filtering ONLY for valid values of the specific stat
            const statDataForCalc = playerData
              .map((p) => ({
                player_id: p.player_id,
                value: p[statKey] as number | null
              }))
              .filter(
                (p): p is { player_id: number; value: number } =>
                  p.value !== null && !isNaN(p.value) && isFinite(p.value)
              );

            // Find the target player's value *within this specific stat's valid data*
            const targetStatValue = statDataForCalc.find(
              (p) => p.player_id === targetId
            )?.value;

            // Log info about this specific stat calculation (optional)
            // const targetOriginalValue = playerData.find(p => p.player_id === targetId)?.[statKey];
            // console.log(`${debugPrefix} Stat: ${String(statKey)} - Comparison Group Size: ${statDataForCalc.length}. Target Value for Calc: ${targetStatValue}`);

            // Proceed only if comparison group exists AND target player has a valid value *for this stat*
            if (
              statDataForCalc.length > 0 &&
              targetStatValue !== null &&
              targetStatValue !== undefined
            ) {
              const higherIsBetter = HIGHER_IS_BETTER_MAP[statKey];
              if (higherIsBetter === undefined) {
                /* ... warning ... */ continue;
              }

              const percentile = calculatePercentileRank(
                statDataForCalc,
                targetId,
                "value",
                higherIsBetter
              );
              if (percentile !== null) {
                sumPercentiles += percentile;
                countValidStats++;
              }
            }
          }
          console.log(
            `${debugPrefix} Calculated average from ${countValidStats} valid stats.`
          );
          return countValidStats > 0
            ? (sumPercentiles / countValidStats) * 100
            : null;
        };

        // 4. Calculate All Ratings (using unfiltered data)
        console.log("[Ratings] Calculating individual strength ratings...");
        const offAS = getAvgPercentile(
          OFFENSE_RATING_STATS.as,
          filteredAS,
          playerId,
          "as"
        );
        const defAS = getAvgPercentile(
          DEFENSE_RATING_STATS.as,
          filteredAS,
          playerId,
          "as"
        );
        const offES = getAvgPercentile(
          OFFENSE_RATING_STATS.es,
          filteredES,
          playerId,
          "es"
        );
        const defES = getAvgPercentile(
          DEFENSE_RATING_STATS.es,
          filteredES,
          playerId,
          "es"
        );
        const offPP = getAvgPercentile(
          OFFENSE_RATING_STATS.pp,
          filteredPP,
          playerId,
          "pp"
        );
        const defPK = getAvgPercentile(
          DEFENSE_RATING_STATS.pk,
          filteredPK,
          playerId,
          "pk"
        );
        console.log(
          `[Ratings] Individual Results - offAS: ${offAS}, defAS: ${defAS}, offES: ${offES}, defES: ${defES}, offPP: ${offPP}, defPK: ${defPK}`
        ); // Check these values

        // 5. Calculate Weighted ST Rating
        let overallST: number | null = null;
        // **** USE toi_seconds ****
        const total_st_toi_seconds =
          player_pp_toi_seconds + player_pk_toi_seconds;
        if (total_st_toi_seconds > 0) {
          if (typeof offPP === "number" && typeof defPK === "number") {
            // **** USE toi_seconds ****
            const pp_weight = player_pp_toi_seconds / total_st_toi_seconds;
            const pk_weight = player_pk_toi_seconds / total_st_toi_seconds;
            overallST = offPP * pp_weight + defPK * pk_weight;
            console.log(`[Ratings] Weighted ST: ...`);
          } else if (typeof offPP === "number") {
            overallST = offPP;
            console.log(
              `[Ratings] Weighted ST based only on PP: ${overallST?.toFixed(1)}`
            );
          } else if (typeof defPK === "number") {
            overallST = defPK;
            console.log(
              `[Ratings] Weighted ST based only on PK: ${overallST?.toFixed(1)}`
            );
          }
        } else {
          console.log("[Ratings] Skipping ST Rating: Total PP/PK TOI is 0.");
        }

        // 6. Calculate Final Overall Ratings
        const calculateOverall = (
          off: number | null,
          def: number | null
        ): number | null =>
          typeof off === "number" && typeof def === "number"
            ? (off + def) / 2
            : null;
        const overallAS = calculateOverall(offAS, defAS);
        const overallES = calculateOverall(offES, defES);
        const finalRatingsComponents = [overallAS, overallES, overallST];
        const validFinalRatings = finalRatingsComponents.filter(
          (r) => typeof r === "number"
        ) as number[];
        const finalOverall =
          validFinalRatings.length > 0
            ? validFinalRatings.reduce((a, b) => a + b, 0) /
              validFinalRatings.length
            : null;
        console.log(
          `[Ratings] Final Overall Inputs - OverallAS: ${overallAS}, OverallES: ${overallES}, OverallST: ${overallST}. Final Result: ${finalOverall}`
        );

        // 7. Set State
        const finalRatingsObj = {
          offense: { as: offAS, es: offES, pp: offPP },
          defense: { as: defAS, es: defES, pk: defPK },
          overall: {
            as: overallAS,
            es: overallES,
            st: overallST,
            final: finalOverall
          }
        };
        console.log("[Ratings] Setting final ratings state:", finalRatingsObj);
        setRatings(finalRatingsObj);
      } catch (err: any) {
        console.error("[Ratings] Error during calculation:", err);
        setError(
          `Failed to calculate ratings: ${err.message || "Unknown error"}`
        );
        setRatings(null);
      } finally {
        setIsLoading(false);
        console.log("[Ratings] Calculation process finished.");
      }
    };

    calculateRatings();
  }, [playerId, minGp]); // Dependencies

  const formatRating = (rating: number | null): string => {
    return rating !== null && !isNaN(rating) ? rating.toFixed(0) : "-";
  };

  // --- Render Logic (Updated to show values) ---
  const renderContent = () => {
    if (isLoading)
      return <div className={styles.loading}>Loading Ratings...</div>;
    if (error) return <div className={styles.error}>{error}</div>;
    // Show calculating message if loading is done but ratings are still null (and no error)
    if (!ratings && !isLoading && playerId)
      return <div className={styles.calculating}>Calculating...</div>;
    if (!playerId)
      return <div className={styles.noPlayer}>Select player for ratings</div>;
    if (!ratings) return null; // Should be covered by above, but as a fallback

    return (
      <div className={styles.ratingsRoot}>
        {/* Column 1: Offense */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Offense</h3>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>All</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.offense.as)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>Even</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.offense.es)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>PP</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.offense.pp)}
            </span>
          </div>
        </div>

        {/* Column 2: Overall */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Overall</h3>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>All</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.overall.as)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>Even</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.overall.es)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>Special</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.overall.st)}
            </span>
          </div>
          <div className={`${styles.ratingBox} ${styles.finalRating}`}>
            <span className={styles.ratingLabel}>Total</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.overall.final)}
            </span>
          </div>
        </div>

        {/* Column 3: Defense */}
        <div className={styles.ratingSection}>
          <h3 className={styles.ratingTitle}>Defense</h3>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>All</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.defense.as)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>Even</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.defense.es)}
            </span>
          </div>
          <div className={styles.ratingBox}>
            <span className={styles.ratingLabel}>PK</span>
            <span className={styles.ratingValue}>
              {formatRating(ratings.defense.pk)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return renderContent();
};

export default PlayerRatingsDisplay;
