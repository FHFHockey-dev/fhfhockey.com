import type { CSSProperties } from "react";

import Link from "next/link";

import ClientOnly from "components/ClientOnly";
import OptimizedImage from "components/common/OptimizedImage";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import styles from "styles/Home.module.scss";
import { formatLocalStartTime } from "./homepageGameFormatting";
import {
  compactHomepageMetric,
  formatHomepageEdge,
  getHomepageGamePresentation,
  type HomepageGameGroup,
  type HomepageGamePresentation,
  type HomepageSlateMode,
} from "./homepageGamePresentation";

type GameGroup = {
  key: HomepageGameGroup;
  label: string;
  games: any[];
};

type HomepageDesktopGameSlatesProps = {
  mode: HomepageSlateMode;
  gameCount: number;
  groups: GameGroup[];
  getGameColorStyle: (
    homeTeamAbbreviation: string,
    awayTeamAbbreviation: string,
  ) => CSSProperties;
};

type Metric = {
  label: string;
  value: string;
};

const gameTime = (presentation: HomepageGamePresentation) => {
  if (presentation.group === "live") {
    return [presentation.periodLabel, presentation.clock]
      .filter(Boolean)
      .join(" ");
  }
  if (presentation.group === "final") return "";
  return formatLocalStartTime(presentation.game.startTimeUTC);
};

const getEdgeMetric = (
  presentation: HomepageGamePresentation,
): Metric | null => {
  const { analytics, awayTeam, homeTeam } = presentation;

  if (presentation.edgeAvailable) {
    return {
      label: "Edge",
      value: `${analytics!.edgeTeamAbbreviation} ${formatHomepageEdge(
        analytics!.edgePercentagePoints!,
      )}`,
    };
  }

  if (!presentation.probabilitiesAvailable) return null;

  const awayProbability = analytics!.awayWinProbability!;
  const homeProbability = analytics!.homeWinProbability!;
  if (awayProbability === homeProbability) {
    return { label: "Win", value: "50 / 50" };
  }

  const awayFavored = awayProbability > homeProbability;
  return {
    label: "Win",
    value: `${awayFavored ? awayTeam.abbrev : homeTeam.abbrev} ${Math.round(
      (awayFavored ? awayProbability : homeProbability) * 100,
    )}%`,
  };
};

const getProjectionMetric = (
  presentation: HomepageGamePresentation,
): Metric | null =>
  presentation.projectedGoalsAvailable
    ? {
        label: "Proj",
        value: `${compactHomepageMetric(
          presentation.analytics!.awayProjectedGoals!,
        )}–${compactHomepageMetric(
          presentation.analytics!.homeProjectedGoals!,
        )}`,
      }
    : null;

const getXgMetric = (
  presentation: HomepageGamePresentation,
): Metric | null =>
  presentation.xgAvailable
    ? {
        label: "xGF",
        value: `${compactHomepageMetric(
          presentation.analytics!.awayXg!,
        )}–${compactHomepageMetric(presentation.analytics!.homeXg!)}`,
      }
    : null;

const getShotsMetric = (
  presentation: HomepageGamePresentation,
): Metric | null =>
  presentation.shotsAvailable
    ? {
        label: "SOG",
        value: `${presentation.analytics!.awayShotsOnGoal}–${presentation.analytics!.homeShotsOnGoal}`,
      }
    : null;

const getLightMetrics = (presentation: HomepageGamePresentation) =>
  (presentation.group === "scheduled"
    ? [getEdgeMetric(presentation), getProjectionMetric(presentation)]
    : [getXgMetric(presentation), getShotsMetric(presentation)]
  ).filter((metric): metric is Metric => Boolean(metric));

const getStarterSummary = (presentation: HomepageGamePresentation) => {
  const { analytics, awayTeam, homeTeam } = presentation;
  const away = analytics?.awayStarter?.name
    ? `${analytics.awayStarter.confirmed ? "Confirmed " : ""}${analytics.awayStarter.name} (${awayTeam.abbrev})`
    : "";
  const home = analytics?.homeStarter?.name
    ? `${analytics.homeStarter.confirmed ? "Confirmed " : ""}${analytics.homeStarter.name} (${homeTeam.abbrev})`
    : "";

  return [away, home].filter(Boolean).join(" vs ");
};

const getFooterSummary = (presentation: HomepageGamePresentation) => {
  if (presentation.starterAvailable) {
    return { label: "Starters", value: getStarterSummary(presentation) };
  }

  const records = [
    presentation.awayTeam.record
      ? `${presentation.awayTeam.abbrev} ${presentation.awayTeam.record}`
      : "",
    presentation.homeTeam.record
      ? `${presentation.homeTeam.abbrev} ${presentation.homeTeam.record}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return records
    ? { label: "Records", value: records }
    : { label: "Matchup", value: "Open game details" };
};

function TeamLogo({ abbreviation, size }: { abbreviation: string; size: number }) {
  return (
    <OptimizedImage
      src={getTeamLogoSvg(abbreviation)}
      alt={`${abbreviation} logo`}
      width={size}
      height={size}
      priority={false}
      fallbackSrc={fallbackNHLLogo}
    />
  );
}

function LightGameCard({
  presentation,
  style,
}: {
  presentation: HomepageGamePresentation;
  style: CSSProperties;
}) {
  const metrics = getLightMetrics(presentation);
  const footer = getFooterSummary(presentation);
  const showScore = presentation.group !== "scheduled";

  return (
    <Link
      href={`/game/${presentation.game.id}`}
      className={styles.desktopLightCard}
      data-card-variant="light"
      data-game-state={presentation.group}
      aria-label={presentation.matchupLabel}
      style={style}
    >
      <span className={styles.desktopCardMeta}>
        <span className={styles.desktopStateLabel}>
          <i aria-hidden="true" />
          {presentation.stateLabel}
        </span>
        <ClientOnly>
          <span className={styles.desktopCardTime}>
            {gameTime(presentation)}
          </span>
        </ClientOnly>
        <span
          className={styles.desktopCardNetwork}
          title={presentation.broadcast ?? undefined}
        >
          {presentation.broadcast ?? ""}
        </span>
      </span>

      <span className={styles.desktopLightMatchup}>
        <span className={styles.desktopLightTeam}>
          <TeamLogo abbreviation={presentation.awayTeam.abbrev} size={42} />
          <strong>{presentation.awayTeam.abbrev}</strong>
          {showScore && presentation.awayTeam.score != null ? (
            <b data-team-score="away">{presentation.awayTeam.score}</b>
          ) : null}
        </span>
        <span className={styles.desktopLightDivider}>
          {presentation.group === "scheduled" ? "AT" : "–"}
        </span>
        <span
          className={`${styles.desktopLightTeam} ${styles.desktopLightHomeTeam}`}
        >
          {showScore && presentation.homeTeam.score != null ? (
            <b data-team-score="home">{presentation.homeTeam.score}</b>
          ) : null}
          <strong>{presentation.homeTeam.abbrev}</strong>
          <TeamLogo abbreviation={presentation.homeTeam.abbrev} size={42} />
        </span>
      </span>

      {metrics.length > 0 ? (
        <span
          className={styles.desktopLightAnalytics}
          data-light-analytics="true"
          data-metric-count={metrics.length}
        >
          {metrics.map((metric) => (
            <span key={metric.label} data-analytics-metric={metric.label.toLowerCase()}>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </span>
      ) : null}

      <span className={styles.desktopLightFooter}>
        <span>
          <small>{footer.label}</small>
          {footer.value}
        </span>
        <b aria-hidden="true">›</b>
      </span>
    </Link>
  );
}

function MediumLiveCard({
  presentation,
  style,
}: {
  presentation: HomepageGamePresentation;
  style: CSSProperties;
}) {
  const metrics = [getXgMetric(presentation), getShotsMetric(presentation)].filter(
    (metric): metric is Metric => Boolean(metric),
  );

  return (
    <Link
      href={`/game/${presentation.game.id}`}
      className={styles.desktopMediumLiveCard}
      data-card-variant="medium-live"
      data-game-state="live"
      aria-label={presentation.matchupLabel}
      style={style}
    >
      <span className={styles.desktopCardMeta}>
        <span className={styles.desktopStateLabel}>
          <i aria-hidden="true" /> Live
        </span>
        <span className={styles.desktopCardTime}>
          {gameTime(presentation)}
        </span>
        <span
          className={styles.desktopCardNetwork}
          title={presentation.broadcast ?? undefined}
        >
          {presentation.broadcast ?? ""}
        </span>
      </span>
      <span className={styles.desktopMediumMatchup}>
        <span className={styles.desktopMediumTeam}>
          <TeamLogo abbreviation={presentation.awayTeam.abbrev} size={34} />
          <strong>{presentation.awayTeam.abbrev}</strong>
          {presentation.awayTeam.score != null ? (
            <b data-team-score="away">{presentation.awayTeam.score}</b>
          ) : null}
        </span>
        <span>AT</span>
        <span
          className={`${styles.desktopMediumTeam} ${styles.desktopMediumHomeTeam}`}
        >
          {presentation.homeTeam.score != null ? (
            <b data-team-score="home">{presentation.homeTeam.score}</b>
          ) : null}
          <strong>{presentation.homeTeam.abbrev}</strong>
          <TeamLogo abbreviation={presentation.homeTeam.abbrev} size={34} />
        </span>
      </span>
      {metrics.length > 0 ? (
        <span className={styles.desktopMediumAnalytics}>
          {metrics.map((metric) => (
            <span key={metric.label}>
              <small>{metric.label}</small> {metric.value}
            </span>
          ))}
        </span>
      ) : null}
      <span className={styles.desktopCardChevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function HeavyLiveScoreboard({
  presentation,
  style,
}: {
  presentation: HomepageGamePresentation;
  style: CSSProperties;
}) {
  return (
    <Link
      href={`/game/${presentation.game.id}`}
      className={styles.desktopHeavyLiveCard}
      data-card-variant="heavy-live"
      data-game-state="live"
      aria-label={presentation.matchupLabel}
      style={style}
    >
      <span className={styles.desktopHeavyMeta}>
        <span>
          <i aria-hidden="true" /> {gameTime(presentation)}
        </span>
        <span title={presentation.broadcast ?? undefined}>
          {presentation.broadcast ?? ""}
        </span>
      </span>
      <span className={styles.desktopHeavyTeamRow} data-scoreboard-team-row="away">
        <TeamLogo abbreviation={presentation.awayTeam.abbrev} size={24} />
        <strong>{presentation.awayTeam.abbrev}</strong>
        {presentation.awayTeam.score != null ? (
          <b data-team-score="away">{presentation.awayTeam.score}</b>
        ) : null}
      </span>
      <span className={styles.desktopHeavyTeamRow} data-scoreboard-team-row="home">
        <TeamLogo abbreviation={presentation.homeTeam.abbrev} size={24} />
        <strong>{presentation.homeTeam.abbrev}</strong>
        {presentation.homeTeam.score != null ? (
          <b data-team-score="home">{presentation.homeTeam.score}</b>
        ) : null}
      </span>
    </Link>
  );
}

function TableHeader({
  mode,
  group,
}: {
  mode: "medium" | "heavy";
  group: Exclude<HomepageGameGroup, "live">;
}) {
  if (mode === "heavy") {
    return (
      <div className={styles.desktopTableHeader} data-table-columns="heavy">
        <span>{group === "final" ? "Final" : "Time"}</span>
        <span>Matchup</span>
        <span>Network</span>
        <span aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={styles.desktopTableHeader}
      data-table-columns={`medium-${group}`}
    >
      <span>{group === "final" ? "Final" : "Time"}</span>
      <span>Matchup</span>
      <span>{group === "final" ? "xGF" : "Edge"}</span>
      <span>{group === "final" ? "SOG" : "Proj"}</span>
      <span>Network</span>
      <span aria-hidden="true" />
    </div>
  );
}

function CompactGameRow({
  presentation,
  mode,
}: {
  presentation: HomepageGamePresentation;
  mode: "medium" | "heavy";
}) {
  const isFinal = presentation.group === "final";
  const edge = getEdgeMetric(presentation);
  const projection = getProjectionMetric(presentation);
  const xg = getXgMetric(presentation);
  const shots = getShotsMetric(presentation);

  return (
    <Link
      href={`/game/${presentation.game.id}`}
      className={styles.desktopTableRow}
      data-table-columns={
        mode === "heavy" ? "heavy" : `medium-${presentation.group}`
      }
      data-game-state={presentation.group}
      aria-label={presentation.matchupLabel}
    >
      <ClientOnly>
        <span className={styles.desktopTableTime}>
          {isFinal ? "Final" : formatLocalStartTime(presentation.game.startTimeUTC)}
        </span>
      </ClientOnly>
      <span className={styles.desktopTableMatchup}>
        <span>
          <TeamLogo abbreviation={presentation.awayTeam.abbrev} size={22} />
          <strong>{presentation.awayTeam.abbrev}</strong>
          {isFinal && presentation.awayTeam.score != null ? (
            <b data-team-score="away">{presentation.awayTeam.score}</b>
          ) : null}
        </span>
        <small>{isFinal ? "–" : "AT"}</small>
        <span>
          <TeamLogo abbreviation={presentation.homeTeam.abbrev} size={22} />
          <strong>{presentation.homeTeam.abbrev}</strong>
          {isFinal && presentation.homeTeam.score != null ? (
            <b data-team-score="home">{presentation.homeTeam.score}</b>
          ) : null}
        </span>
      </span>
      {mode === "medium" ? (
        <>
          <span className={styles.desktopTableMetric} data-table-metric="primary">
            {isFinal ? xg?.value : edge?.value}
          </span>
          <span className={styles.desktopTableMetric} data-table-metric="secondary">
            {isFinal ? shots?.value : projection?.value}
          </span>
        </>
      ) : null}
      <span
        className={styles.desktopTableNetwork}
        title={presentation.broadcast ?? undefined}
      >
        {presentation.broadcast ?? ""}
      </span>
      <span className={styles.desktopTableChevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

function CompactGameTable({
  mode,
  group,
  games,
}: {
  mode: "medium" | "heavy";
  group: Exclude<HomepageGameGroup, "live">;
  games: any[];
}) {
  const presentations = games
    .map(getHomepageGamePresentation)
    .filter(
      (presentation): presentation is HomepageGamePresentation =>
        Boolean(presentation),
    );
  if (presentations.length === 0) return null;

  const useTwoTables =
    mode === "heavy" &&
    (group === "scheduled" || presentations.length > 2) &&
    presentations.length > 1;
  const splitIndex = useTwoTables
    ? Math.ceil(presentations.length / 2)
    : presentations.length;
  const columns = useTwoTables
    ? [presentations.slice(0, splitIndex), presentations.slice(splitIndex)]
    : [presentations];

  return (
    <section
      className={styles.desktopRoutineGroup}
      data-game-group={group}
      data-table-group={group}
      aria-labelledby={`desktop-${group}-games`}
    >
      <h3 id={`desktop-${group}-games`}>
        {group === "scheduled" ? "Scheduled" : "Final"}{" "}
        <span>({presentations.length})</span>
      </h3>
      <div
        className={styles.desktopTableColumns}
        data-column-count={columns.length}
      >
        {columns.map((column, index) => (
          <div
            className={styles.desktopTableSurface}
            data-table-surface={group}
            key={`${group}-${index}`}
          >
            <TableHeader mode={mode} group={group} />
            {column.map((presentation) => (
              <CompactGameRow
                key={presentation.game.id}
                presentation={presentation}
                mode={mode}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomepageDesktopGameSlates({
  mode,
  gameCount,
  groups,
  getGameColorStyle,
}: HomepageDesktopGameSlatesProps) {
  const orderedGames = groups.flatMap((group) => group.games);
  const liveGames = groups.find((group) => group.key === "live")?.games ?? [];
  const scheduledGames =
    groups.find((group) => group.key === "scheduled")?.games ?? [];
  const finalGames = groups.find((group) => group.key === "final")?.games ?? [];

  return (
    <div
      className={styles.desktopGamesSlate}
      data-desktop-slate="true"
      data-slate-mode={mode}
      data-game-count={gameCount}
      aria-label={`${mode} desktop slate, ${gameCount} games`}
    >
      {mode === "light" ? (
        <div className={styles.desktopLightGrid}>
          {orderedGames.map((game) => {
            const presentation = getHomepageGamePresentation(game);
            return presentation ? (
              <LightGameCard
                key={game.id}
                presentation={presentation}
                style={getGameColorStyle(
                  presentation.homeTeam.abbrev,
                  presentation.awayTeam.abbrev,
                )}
              />
            ) : null;
          })}
        </div>
      ) : null}

      {mode !== "light" && liveGames.length > 0 ? (
        <section
          className={styles.desktopLiveGroup}
          data-game-group="live"
          aria-labelledby={`desktop-${mode}-live-games`}
        >
          <h3 id={`desktop-${mode}-live-games`}>
            Live now <span>({liveGames.length})</span>
          </h3>
          <div className={styles.desktopLiveGrid}>
            {liveGames.map((game) => {
              const presentation = getHomepageGamePresentation(game);
              if (!presentation) return null;
              const style = getGameColorStyle(
                presentation.homeTeam.abbrev,
                presentation.awayTeam.abbrev,
              );
              return mode === "medium" ? (
                <MediumLiveCard
                  key={game.id}
                  presentation={presentation}
                  style={style}
                />
              ) : (
                <HeavyLiveScoreboard
                  key={game.id}
                  presentation={presentation}
                  style={style}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {mode !== "light" && scheduledGames.length > 0 ? (
        <CompactGameTable
          mode={mode}
          group="scheduled"
          games={scheduledGames}
        />
      ) : null}

      {mode !== "light" && finalGames.length > 0 ? (
        <CompactGameTable mode={mode} group="final" games={finalGames} />
      ) : null}

      <Link
        href="/game-grid/7-Day-Forecast"
        className={styles.desktopGamesViewAll}
      >
        View all {gameCount} games
        <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
