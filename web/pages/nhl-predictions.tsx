import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";

import type { AccountabilityDashboard } from "lib/game-predictions/accountability";
import type {
  PublicGamePrediction,
  PublicGamePredictionsPayload,
  PublicPredictionPerformance,
} from "lib/game-predictions/publicPredictions";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/NhlPredictions.module.scss";

type PageProps = {
  initialPayload?: PublicGamePredictionsPayload | null;
};

type AccountabilityApiPayload = AccountabilityDashboard & {
  success?: boolean;
  error?: string;
};

function formatPercent(value: number | null): string {
  return value == null ? "--" : `${Math.round(value * 100)}%`;
}

function formatNumber(value: number | null, digits = 3): string {
  return value == null ? "--" : value.toFixed(digits);
}

function formatCompactDecimal(value: number | null, digits = 3): string {
  return value == null ? "--" : value.toFixed(digits);
}

function formatSignedNumber(value: number | null, digits = 2): string {
  if (value == null) return "--";
  return value > 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits);
}

function formatDateTime(value: string | null): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function winnerLabel(prediction: PublicGamePrediction): string {
  if (prediction.predictedWinnerTeamId === prediction.homeTeam.id) {
    return prediction.homeTeam.abbreviation;
  }
  if (prediction.predictedWinnerTeamId === prediction.awayTeam.id) {
    return prediction.awayTeam.abbreviation;
  }
  return "--";
}

function goalieStatusLabel(args: {
  confirmed?: boolean;
  source?: string | null;
  name?: string | null;
  id?: number | null;
}): string {
  const identity = args.name ?? (args.id != null ? `#${args.id}` : null);
  const prefix =
    args.source === "lines_ccc"
      ? "Confirmed via CCC"
      : args.source === "recent_usage"
        ? "Inferred from recent usage"
        : args.source === "lineCombinations"
          ? "Projected from lineup"
          : args.confirmed
            ? "Confirmed"
            : "Projected";

  return identity ? `${prefix}: ${identity}` : prefix;
}

function factorDirectionLabel(
  factor: PublicGamePrediction["factors"][number],
  prediction: PublicGamePrediction,
): string {
  if (factor.direction === "home") return prediction.homeTeam.abbreviation;
  if (factor.direction === "away") return prediction.awayTeam.abbreviation;
  return "Neutral";
}

function isDarkColor(hex: string | undefined): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 72;
}

function teamBarColor(abbreviation: string): string {
  const info = teamsInfo[abbreviation];
  if (!info) return "#98a2a8";
  return isDarkColor(info.primaryColor)
    ? (info.lightColor ?? info.accent ?? info.secondaryColor)
    : info.primaryColor;
}

function comparisonShares(awayValue: number | null, homeValue: number | null) {
  if (awayValue == null || homeValue == null) {
    return { away: 50, home: 50, available: false };
  }

  if (awayValue === homeValue) {
    return { away: 50, home: 50, available: true };
  }

  const min = Math.min(awayValue, homeValue);
  const awayScore = min < 0 ? awayValue - min : awayValue;
  const homeScore = min < 0 ? homeValue - min : homeValue;
  const total = awayScore + homeScore;
  if (total <= 0) {
    return { away: 50, home: 50, available: true };
  }

  const away = Math.max(3, Math.min(97, (awayScore / total) * 100));
  return { away, home: 100 - away, available: true };
}

function ComparisonRow({
  label,
  awayTeam,
  homeTeam,
  awayValue,
  homeValue,
  awayDisplay,
  homeDisplay,
}: {
  label: string;
  awayTeam: PublicGamePrediction["awayTeam"];
  homeTeam: PublicGamePrediction["homeTeam"];
  awayValue: number | null;
  homeValue: number | null;
  awayDisplay: string;
  homeDisplay: string;
}) {
  const shares = comparisonShares(awayValue, homeValue);
  return (
    <div
      className={styles.comparisonRow}
      style={
        {
          "--away-color": teamBarColor(awayTeam.abbreviation),
          "--home-color": teamBarColor(homeTeam.abbreviation),
          "--away-share": `${shares.away}%`,
          "--home-share": `${shares.home}%`,
          "--bar-opacity": shares.available ? "1" : "0.35",
        } as React.CSSProperties
      }
    >
      <div className={styles.comparisonValues}>
        <strong>{awayDisplay}</strong>
        <span>{label}</span>
        <strong>{homeDisplay}</strong>
      </div>
      <div
        className={styles.comparisonBar}
        aria-label={`${awayTeam.abbreviation} ${awayDisplay}, ${homeTeam.abbreviation} ${homeDisplay}`}
      >
        <span className={styles.awaySegment} />
        <span className={styles.homeSegment} />
      </div>
      <div className={styles.comparisonTeams} aria-hidden="true">
        <span>{awayTeam.abbreviation}</span>
        <span>{homeTeam.abbreviation}</span>
      </div>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: PublicGamePrediction }) {
  const matchup = prediction.matchup;
  return (
    <article className={styles.gameCard}>
      <div className={styles.gameHeader}>
        <div>
          <div className={styles.gameDate}>
            {prediction.snapshotDate}{" "}
            {prediction.startTime ? `- ${prediction.startTime}` : ""}
          </div>
          <h2 className={styles.matchupTitle}>
            {prediction.awayTeam.abbreviation} at{" "}
            {prediction.homeTeam.abbreviation}
          </h2>
        </div>
        <div className={styles.modelStamp}>
          <span>{prediction.modelVersion}</span>
          <span>{formatDateTime(prediction.computedAt)}</span>
        </div>
      </div>

      <div className={styles.teamStrip}>
        <span>{prediction.awayTeam.name}</span>
        <span>{prediction.homeTeam.name}</span>
      </div>

      <ComparisonRow
        label="Win Probability"
        awayTeam={prediction.awayTeam}
        homeTeam={prediction.homeTeam}
        awayValue={prediction.awayWinProbability}
        homeValue={prediction.homeWinProbability}
        awayDisplay={formatPercent(prediction.awayWinProbability)}
        homeDisplay={formatPercent(prediction.homeWinProbability)}
      />

      <div className={styles.summaryRow}>
        <span>Model winner: {winnerLabel(prediction)}</span>
        <span>Confidence: {prediction.confidenceLabel ?? "--"}</span>
        {prediction.freshness.hasStaleSource ? (
          <span className={styles.warningText}>Stale source flagged</span>
        ) : (
          <span>Sources fresh</span>
        )}
      </div>

      <div className={styles.detailGrid}>
        <section>
          <h3>Team Context</h3>
          <div className={styles.comparisonList}>
            <ComparisonRow
              label="Offense Rating"
              awayTeam={prediction.awayTeam}
              homeTeam={prediction.homeTeam}
              awayValue={matchup?.awayOffRating ?? null}
              homeValue={matchup?.homeOffRating ?? null}
              awayDisplay={formatNumber(matchup?.awayOffRating ?? null, 2)}
              homeDisplay={formatNumber(matchup?.homeOffRating ?? null, 2)}
            />
            <ComparisonRow
              label="Defense Rating"
              awayTeam={prediction.awayTeam}
              homeTeam={prediction.homeTeam}
              awayValue={matchup?.awayDefRating ?? null}
              homeValue={matchup?.homeDefRating ?? null}
              awayDisplay={formatNumber(matchup?.awayDefRating ?? null, 2)}
              homeDisplay={formatNumber(matchup?.homeDefRating ?? null, 2)}
            />
            <ComparisonRow
              label="Special Teams"
              awayTeam={prediction.awayTeam}
              homeTeam={prediction.homeTeam}
              awayValue={matchup?.awaySpecialRating ?? null}
              homeValue={matchup?.homeSpecialRating ?? null}
              awayDisplay={formatNumber(matchup?.awaySpecialRating ?? null, 2)}
              homeDisplay={formatNumber(matchup?.homeSpecialRating ?? null, 2)}
            />
          </div>
        </section>

        <section>
          <h3>Goalie And Rest</h3>
          <div className={styles.comparisonList}>
            <ComparisonRow
              label="Goalie GSAA/60"
              awayTeam={prediction.awayTeam}
              homeTeam={prediction.homeTeam}
              awayValue={matchup?.awayGoalieGsaaPer60 ?? null}
              homeValue={matchup?.homeGoalieGsaaPer60 ?? null}
              awayDisplay={formatSignedNumber(
                matchup?.awayGoalieGsaaPer60 ?? null,
                2,
              )}
              homeDisplay={formatSignedNumber(
                matchup?.homeGoalieGsaaPer60 ?? null,
                2,
              )}
            />
            <ComparisonRow
              label="Rest Days"
              awayTeam={prediction.awayTeam}
              homeTeam={prediction.homeTeam}
              awayValue={matchup?.awayRestDays ?? null}
              homeValue={matchup?.homeRestDays ?? null}
              awayDisplay={
                matchup?.awayRestDays != null
                  ? String(matchup.awayRestDays)
                  : "--"
              }
              homeDisplay={
                matchup?.homeRestDays != null
                  ? String(matchup.homeRestDays)
                  : "--"
              }
            />
            <div className={styles.statusComparison}>
              <span>
                {goalieStatusLabel({
                  confirmed: matchup?.awayGoalieConfirmed,
                  source: matchup?.awayGoalieSource,
                  name: matchup?.awayGoalieName,
                  id: matchup?.awayGoalieId,
                })}
              </span>
              <strong>Goalie Status</strong>
              <span>
                {goalieStatusLabel({
                  confirmed: matchup?.homeGoalieConfirmed,
                  source: matchup?.homeGoalieSource,
                  name: matchup?.homeGoalieName,
                  id: matchup?.homeGoalieId,
                })}
              </span>
            </div>
            <div>
              <span className={styles.contextPill}>
                {matchup?.optionalPlayerImpactAvailable
                  ? "Player context available"
                  : "Player context unavailable"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.factorBlock}>
        <h3>Stored Model Factors</h3>
        {prediction.factors.length ? (
          <ul>
            {prediction.factors.map((factor) => (
              <li key={`${prediction.gameId}-${factor.featureKey}`}>
                <span>{factor.label}</span>
                <span>{factorDirectionLabel(factor, prediction)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No stored factor metadata for this prediction.</p>
        )}
      </section>
    </article>
  );
}

function PerformancePanel({
  performance,
}: {
  performance: PublicPredictionPerformance;
}) {
  if (!performance) {
    return (
      <section className={styles.performancePanel}>
        <h2>Model Performance</h2>
        <p>Completed-game evaluation metrics are not available yet.</p>
      </section>
    );
  }

  return (
    <section className={styles.performancePanel}>
      <div>
        <h2>Model Performance</h2>
        <p>
          {performance.evaluationStartDate} to {performance.evaluationEndDate}
        </p>
      </div>
      <div className={styles.performanceGrid}>
        <div>
          <span>Accuracy</span>
          <strong>{formatPercent(performance.accuracy)}</strong>
        </div>
        <div>
          <span>Log loss</span>
          <strong>{formatNumber(performance.logLoss)}</strong>
        </div>
        <div>
          <span>Brier</span>
          <strong>{formatNumber(performance.brierScore)}</strong>
        </div>
        <div>
          <span>Evaluated games</span>
          <strong>{performance.evaluatedGames}</strong>
        </div>
      </div>
      {performance.calibrationSummary ? (
        <p className={styles.calibration}>{performance.calibrationSummary}</p>
      ) : null}
    </section>
  );
}

function AccountabilityPanel({
  accountability,
}: {
  accountability: AccountabilityDashboard | null;
}) {
  if (!accountability) {
    return (
      <section className={styles.performancePanel}>
        <h2>Accountability Index</h2>
        <p>Completed-game accountability is not available yet.</p>
      </section>
    );
  }

  const recentCandles = accountability.candles.slice(-12).reverse();
  return (
    <section className={styles.accountabilityPanel}>
      <div className={styles.accountabilityHeader}>
        <div>
          <h2>Accountability Index</h2>
          <p>
            {accountability.summary.correctGames} correct /{" "}
            {accountability.summary.wrongGames} wrong
          </p>
        </div>
        <div className={styles.accountabilityMeta}>
          <span>{accountability.modelVersion}</span>
          <span>{formatDateTime(accountability.generatedAt)}</span>
        </div>
      </div>

      <div className={styles.accountabilityGrid}>
        <div>
          <span>Accuracy</span>
          <strong>{formatPercent(accountability.summary.accuracy)}</strong>
        </div>
        <div>
          <span>Rolling 10</span>
          <strong>
            {formatPercent(accountability.summary.rolling10Accuracy)}
          </strong>
        </div>
        <div>
          <span>Brier</span>
          <strong>
            {formatCompactDecimal(accountability.summary.brierScore)}
          </strong>
        </div>
        <div>
          <span>Log loss</span>
          <strong>
            {formatCompactDecimal(accountability.summary.logLoss)}
          </strong>
        </div>
      </div>

      {recentCandles.length ? (
        <div className={styles.candleList}>
          {recentCandles.map((candle) => {
            const low = candle.lowHomeWinProbability * 100;
            const high = candle.highHomeWinProbability * 100;
            const open = candle.openHomeWinProbability * 100;
            const final = candle.finalHomeWinProbability * 100;
            const actual = candle.actualHomeWinProbability * 100;
            return (
              <div
                key={`${candle.gameId}-${candle.finalPredictionCutoffAt}`}
                className={styles.candleRow}
                style={
                  {
                    "--range-left": `${low}%`,
                    "--range-width": `${Math.max(1, high - low)}%`,
                    "--open-left": `${open}%`,
                    "--final-left": `${final}%`,
                    "--actual-left": `${actual}%`,
                  } as React.CSSProperties
                }
              >
                <div className={styles.candleTeams}>
                  <span>
                    {candle.awayTeamAbbreviation} at{" "}
                    {candle.homeTeamAbbreviation}
                  </span>
                  <strong>
                    {candle.predictedWinnerCorrect ? "Correct" : "Wrong"}
                  </strong>
                </div>
                <div className={styles.candleTrack}>
                  <span className={styles.candleRange} />
                  <span className={styles.candleOpen} />
                  <span className={styles.candleFinal} />
                  <span className={styles.candleActual} />
                </div>
                <div className={styles.candleMeta}>
                  <span>Low {Math.round(low)}%</span>
                  <span>Final {Math.round(final)}%</span>
                  <span>High {Math.round(high)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default function NhlPredictionsPage({
  initialPayload = null,
}: PageProps) {
  const [payload, setPayload] = useState<PublicGamePredictionsPayload | null>(
    initialPayload,
  );
  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState<string | null>(null);
  const [accountability, setAccountability] =
    useState<AccountabilityDashboard | null>(null);

  useEffect(() => {
    if (initialPayload) return;
    let active = true;
    setLoading(true);
    fetch("/api/v1/game-predictions/latest")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body.success === false) {
          throw new Error(body.error ?? "Unable to load predictions");
        }
        return body as PublicGamePredictionsPayload;
      })
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialPayload]);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/game-predictions/accountability?limit=250")
      .then(async (response) => {
        const body = (await response.json()) as AccountabilityApiPayload;
        if (!response.ok || body.success === false) {
          throw new Error(body.error ?? "Unable to load accountability");
        }
        return body;
      })
      .then((nextPayload) => {
        if (!active) return;
        setAccountability(nextPayload);
      })
      .catch(() => {
        if (active) setAccountability(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const predictions = payload?.predictions ?? [];
  const slateLabel = useMemo(() => {
    if (!predictions.length) return "Upcoming NHL Games";
    const dates = Array.from(
      new Set(predictions.map((prediction) => prediction.snapshotDate)),
    );
    return dates.length === 1
      ? dates[0]
      : `${dates[0]} through ${dates[dates.length - 1]}`;
  }, [predictions]);

  return (
    <>
      <Head>
        <title>NHL Game Predictions | FHFH</title>
        <meta
          name="description"
          content="Pregame NHL win probability model summaries, stored factors, and model evaluation metrics."
        />
      </Head>
      <main className={styles.pageShell}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>NHL model</p>
            <h1>NHL Game Predictions</h1>
            <p>
              Pregame win probabilities with stored model factors, matchup
              context, and completed-game evaluation.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span>{slateLabel}</span>
            <span>Updated {formatDateTime(payload?.generatedAt ?? null)}</span>
          </div>
        </header>

        {loading ? (
          <div className={styles.statePanel}>Loading predictions...</div>
        ) : null}
        {error ? <div className={styles.errorPanel}>{error}</div> : null}
        {!loading && !error && !predictions.length ? (
          <div className={styles.statePanel}>
            No model-ready game predictions are available yet.
          </div>
        ) : null}

        {predictions.length ? (
          <section className={styles.predictionGrid}>
            {predictions.map((prediction) => (
              <PredictionCard
                key={`${prediction.gameId}-${prediction.computedAt}`}
                prediction={prediction}
              />
            ))}
          </section>
        ) : null}

        <PerformancePanel performance={payload?.performance ?? null} />
        <AccountabilityPanel accountability={accountability} />
      </main>
    </>
  );
}
