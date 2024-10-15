// components/GameGrid/PDHC/PoissonHeatMap.tsx

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  Bar,
} from "recharts";
import { poissonProbability } from "../utils/poisson";
import { calculateAttackDefenseRatings } from "../utils/calculateRatings";
import { GameSituation } from "lib/NHL/types"; // Ensure correct import
import styles from "styles/PoissonHeatmap.module.scss";

type PoissonHeatmapProps = {
  homeTeamAbbreviation: string;
  awayTeamAbbreviation: string;
  situation: GameSituation; // e.g., "5v5", "pp", etc.
};

type PoissonData = {
  outcome: string; // "Win", "Loss", "Draw"
  probability: number; // Percentage
};

const PoissonHeatmap: React.FC<PoissonHeatmapProps> = ({
  homeTeamAbbreviation,
  awayTeamAbbreviation,
  situation,
}) => {
  const [data, setData] = useState<PoissonData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndCalculate = async () => {
      console.log("Fetching and calculating Poisson probabilities...");
      setLoading(true);
      setError(null);
      try {
        const { teamRatings, leagueAverages } =
          await calculateAttackDefenseRatings();

        console.log("Received teamRatings:", teamRatings);
        console.log("Received leagueAverages:", leagueAverages);

        const homeTeamRatings = teamRatings[homeTeamAbbreviation]?.[situation];
        const awayTeamRatings = teamRatings[awayTeamAbbreviation]?.[situation];

        console.log(
          `Home Team Ratings for ${homeTeamAbbreviation} in ${situation}:`,
          homeTeamRatings
        );
        console.log(
          `Away Team Ratings for ${awayTeamAbbreviation} in ${situation}:`,
          awayTeamRatings
        );

        if (!homeTeamRatings || !awayTeamRatings) {
          throw new Error("Team ratings not found.");
        }

        // Expected Goals
        const homeLambda =
          homeTeamRatings.attackRating * leagueAverages[situation].perMinuteSA;
        const awayLambda =
          awayTeamRatings.attackRating * leagueAverages[situation].perMinuteSA;

        console.log(
          `Calculated homeLambda: ${homeLambda}, awayLambda: ${awayLambda}`
        );

        // Calculate probabilities
        const poissonData = calculatePoissonProbabilities(
          homeLambda,
          awayLambda
        );
        console.log("Calculated Poisson probabilities:", poissonData);

        setData(poissonData);
      } catch (err: any) {
        console.error("Error in PoissonHeatmap:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCalculate();
  }, [homeTeamAbbreviation, awayTeamAbbreviation, situation]);

  const calculatePoissonProbabilities = (
    homeLambda: number,
    awayLambda: number
  ): PoissonData[] => {
    const maxGoals = 5;
    let homeWinProb = 0;
    let awayWinProb = 0;
    let drawProb = 0;

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const prob =
          poissonProbability(h, homeLambda) * poissonProbability(a, awayLambda);
        if (h > a) {
          homeWinProb += prob;
        } else if (h < a) {
          awayWinProb += prob;
        } else {
          drawProb += prob;
        }
      }
    }

    // Normalize probabilities to sum to 100%
    const totalProb = homeWinProb + awayWinProb + drawProb;
    const normalizationFactor = totalProb > 0 ? 100 / totalProb : 0;

    const poissonData: PoissonData[] = [
      {
        outcome: "Win",
        probability: parseFloat((homeWinProb * normalizationFactor).toFixed(2)),
      },
      {
        outcome: "Loss",
        probability: parseFloat((awayWinProb * normalizationFactor).toFixed(2)),
      },
      {
        outcome: "Draw",
        probability: parseFloat((drawProb * normalizationFactor).toFixed(2)),
      },
    ];

    console.log("PoissonData calculated:", poissonData);

    return poissonData;
  };

  if (loading) {
    return <div>Loading PDHC...</div>;
  }

  if (error) {
    return <div>Error loading PDHC: {error}</div>;
  }

  // Define custom tooltip content
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className="label">{`${label}`}</p>
          <p className="intro">{`Probability: ${payload[0].value}%`}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data}>
        <CartesianGrid stroke="#f5f5f5" />
        <XAxis dataKey="outcome" />
        <YAxis />
        <RechartsTooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          dataKey="probability"
          barSize={30}
          fill="#82ca9d" // Distinct color
          name="Probability (%)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default PoissonHeatmap;
