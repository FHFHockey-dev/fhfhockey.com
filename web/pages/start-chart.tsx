import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useSWR from "swr";

import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";
import { START_CHART_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import {
  normalizeStartChartResponse,
  type StartChartGame,
  type StartChartGoalie,
  type StartChartPlayer,
  type StartChartResponse,
} from "lib/projections/startChartContract";
import {
  formatStartChartFantasyScoringContract,
  START_CHART_FANTASY_SCORING_CONTRACT,
  type StartChartPosition,
} from "lib/projections/startChartFantasyScoring";
import { teamsInfo } from "lib/teamsInfo";

import styles from "./start-chart.module.scss";

const POSITION_ORDER = ["C", "LW", "RW", "D", "G"] as const;
const INITIAL_POSITION_LIMIT = 25;

const isCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const easternDate = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
};

const fetcher = async (url: string): Promise<StartChartResponse> => {
  const response = await fetch(url);
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Start Chart returned an unreadable response");
  }
  if (!response.ok) {
    const error = payload as any;
    throw new Error(
      error?.error?.message ??
        (typeof error?.error === "string" ? error.error : null) ??
        "Start Chart request failed",
    );
  }
  return normalizeStartChartResponse(payload);
};

const formatNumber = (
  value: number | null | undefined,
  digits = 1,
): string =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);

const formatPercent = (
  value: number | null | undefined,
  fractional = true,
): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(fractional ? value * 100 : value).toFixed(0)}%`;
};

const formatGameTime = (value: string | null | undefined): string => {
  if (!value) return "Time TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
};

const getColorDistance = (hex1: string, hex2: string): number => {
  const channels = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = channels(hex1);
  const [r2, g2, b2] = channels(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
};

const adjustBrightness = (hex: string, percent: number): string => {
  const numeric = parseInt(hex.replace("#", ""), 16);
  const amount = Math.round(2.55 * percent);
  const channel = (value: number) => Math.max(0, Math.min(255, value + amount));
  return `#${(
    0x1000000 +
    channel(numeric >> 16) * 0x10000 +
    channel((numeric >> 8) & 0xff) * 0x100 +
    channel(numeric & 0xff)
  )
    .toString(16)
    .slice(1)}`;
};

const buildContextHref = (
  href: string,
  context: {
    date: string;
    resolvedDate: string | null;
    position: StartChartPosition;
    team: string | null;
    mode: string;
  },
): string => {
  const url = new URL(href, "https://fhfh.local");
  url.searchParams.set("date", context.date);
  if (context.resolvedDate) {
    url.searchParams.set("resolvedDate", context.resolvedDate);
  }
  url.searchParams.set("position", context.position);
  if (context.team) url.searchParams.set("team", context.team);
  url.searchParams.set("mode", context.mode);
  return `${url.pathname}${url.search}`;
};

const TeamEndpointDot = (props: any) => {
  const { cx, cy, dataKey, payload, lastDate } = props;
  if (!lastDate || payload?.date !== lastDate || cx == null || cy == null) {
    return null;
  }
  return (
    <image
      x={cx - 10}
      y={cy - 10}
      width={20}
      height={20}
      href={`/teamLogos/${dataKey}.png`}
    />
  );
};

const RenderGoalie = ({ goalies }: { goalies?: StartChartGoalie[] }) => {
  const normalized = useMemo(() => {
    const candidates = (goalies ?? [])
      .flatMap((goalie) =>
        typeof goalie.start_probability === "number" &&
        Number.isFinite(goalie.start_probability)
          ? [
              {
                goalie,
                probability: Math.max(0, Math.min(1, goalie.start_probability)),
              },
            ]
          : [],
      )
      .sort(
        (left, right) =>
          right.probability - left.probability ||
          left.goalie.player_id - right.goalie.player_id,
      );
    const total = candidates.reduce((sum, row) => sum + row.probability, 0);
    const withNormalizedProbability = candidates.map((row) => ({
      ...row,
      probability: total > 0 ? row.probability / total : 0,
    }));
    const visible = withNormalizedProbability.filter(
      (row) => row.probability >= 0.05,
    );
    return visible.length > 0
      ? visible
      : withNormalizedProbability.slice(0, 1);
  }, [goalies]);

  if (normalized.length === 0) {
    return <div className={styles.goalieUnavailable}>Goalie TBD</div>;
  }

  return (
    <div className={styles.goalieBarContainer}>
      {normalized.map(({ goalie, probability }, visibleIndex) => {
        const percent = probability * 100;
        const barColor =
          percent >= 80
            ? "#3bd4ae"
            : percent >= 50
              ? "#ffd166"
              : percent >= 30
                ? "#118ab2"
                : "#6c757d";
        const name = goalie.name.split(" ").at(-1) ?? goalie.name;
        return (
          <div
            key={goalie.player_id}
            className={styles.goalieSegment}
            style={{
              width: `${percent}%`,
              backgroundColor: `${barColor}66`,
              borderColor: barColor,
            }}
            title={`${goalie.name}: ${percent.toFixed(0)}%${
              goalie.confirmed_status ? ", confirmed" : ""
            }`}
            role="img"
            aria-label={`${goalie.name}, ${percent.toFixed(0)} percent start probability${
              goalie.confirmed_status ? ", confirmed starter" : ""
            }`}
          >
            {visibleIndex === 0 ? (
              <span className={styles.goalieSegmentText}>
                {name} {percent.toFixed(0)}%
                {goalie.confirmed_status ? " ✓" : ""}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const ratingClass = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "";
  if (value > 102) return styles.glowGreen;
  if (value < 98) return styles.glowRed;
  return "";
};

const RenderRating = ({ rating }: { rating?: StartChartGame["homeRating"] }) => {
  if (!rating) return <div className={styles.ratingUnavailable}>Ratings —</div>;
  return (
    <div className={styles.teamRating} title="Team ratings use 100 as neutral.">
      <div className={styles.ratingRow}>
        <span className={styles.ratingLabel}>OFF</span>
        <span className={`${styles.ratingValue} ${ratingClass(rating.offRating)}`}>
          {formatNumber(rating.offRating, 0)}
        </span>
      </div>
      <div className={styles.ratingRow}>
        <span className={styles.ratingLabel}>DEF</span>
        <span className={`${styles.ratingValue} ${ratingClass(rating.defRating)}`}>
          {formatNumber(rating.defRating, 0)}
        </span>
      </div>
    </div>
  );
};

const ContextChips = ({
  player,
  position,
  opponentGoalie,
}: {
  player: StartChartPlayer;
  position: StartChartPosition;
  opponentGoalie: StartChartGoalie | null;
}) => {
  const opponentGoalieStatus = opponentGoalie
    ? opponentGoalie.confirmed_status
      ? "confirmed"
      : opponentGoalie.start_probability != null
        ? `projected ${formatPercent(opponentGoalie.start_probability)}`
        : "status unavailable"
    : null;
  const chips = [
    position === "G"
      ? null
      : `Role ${player.context?.es_role ?? "unavailable"}`,
    position === "G"
      ? null
      : player.context?.unit_tier
        ? `${player.context.unit_tier}${
            player.context.pp_share != null
              ? ` · ${formatPercent(player.context.pp_share)}`
              : ""
          }`
        : "PP role unavailable",
    player.context?.role_probability != null
      ? `Role confidence ${formatPercent(player.context.role_probability)}`
      : null,
    player.context?.role_continuity != null
      ? `Continuity ${formatPercent(player.context.role_continuity)}`
      : null,
    player.context?.opponent_defense_edge != null
      ? `DEF edge ${player.context.opponent_defense_edge >= 0 ? "+" : ""}${player.context.opponent_defense_edge.toFixed(2)}`
      : null,
    player.context?.goalie_goal_rate_multiplier != null
      ? `Goal rate ×${player.context.goalie_goal_rate_multiplier.toFixed(2)}`
      : null,
    player.context?.goalie_starter_certainty != null
      ? `Goalie ${formatPercent(player.context.goalie_starter_certainty)}`
      : null,
    opponentGoalie
      ? `Opp G ${opponentGoalie.name} · ${opponentGoalieStatus}`
      : "Opp G unavailable",
    player.context?.rest_delta != null
      ? `Rest ${player.context.rest_delta >= 0 ? "+" : ""}${player.context.rest_delta}`
      : null,
    player.context?.trend_effect && player.context.trend_effect !== "none"
      ? `Trend ${player.context.trend_effect.replaceAll("_", " ")}`
      : null,
    ...(player.context?.flags ?? []).map((flag) => flag.replaceAll("_", " ")),
  ].filter((value): value is string => Boolean(value));
  if (chips.length === 0) return null;
  return (
    <ul className={styles.contextChips} aria-label="Projection context">
      {chips.map((chip) => (
        <li key={chip}>{chip}</li>
      ))}
    </ul>
  );
};

export default function StartChartPage() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [ownershipMax, setOwnershipMax] = useState(100);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [activePosition, setActivePosition] =
    useState<StartChartPosition>("C");
  const [positionLimits, setPositionLimits] = useState<
    Record<StartChartPosition, number>
  >({ C: 25, LW: 25, RW: 25, D: 25, G: 25 });

  const queryDate = Array.isArray(router.query.date)
    ? router.query.date[0]
    : router.query.date;
  const queryPosition = Array.isArray(router.query.position)
    ? router.query.position[0]
    : router.query.position;
  const queryTeam = Array.isArray(router.query.team)
    ? router.query.team[0]
    : router.query.team;
  const queryMode = Array.isArray(router.query.mode)
    ? router.query.mode[0]
    : router.query.mode;

  useEffect(() => {
    if (!router.isReady) return;
    const resolvedDate = isCalendarDate(queryDate) ? queryDate : easternDate();
    setDate(resolvedDate);
    const resolvedPosition = POSITION_ORDER.includes(
      queryPosition?.toUpperCase() as StartChartPosition,
    )
      ? (queryPosition?.toUpperCase() as StartChartPosition)
      : null;
    if (resolvedPosition) setActivePosition(resolvedPosition);
    setSelectedTeam(queryTeam?.toUpperCase() ?? null);

    if (!isCalendarDate(queryDate)) {
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, date: resolvedDate },
        },
        undefined,
        { shallow: true },
      );
    }
  }, [
    queryDate,
    queryPosition,
    queryTeam,
    router,
    router.isReady,
    router.pathname,
  ]);

  const { data, error, isLoading, mutate } = useSWR<StartChartResponse>(
    date ? `/api/v1/start-chart?date=${encodeURIComponent(date)}` : null,
    fetcher,
  );

  const updateQuery = (values: Record<string, string | null>) => {
    const query = Object.fromEntries(
      Object.entries(router.query).filter(
        (entry): entry is [string, string | string[]] => entry[1] !== undefined,
      ),
    );
    for (const [key, value] of Object.entries(values)) {
      if (value) query[key] = value;
      else delete query[key];
    }
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setSelectedGameId(null);
    updateQuery({ date: nextDate, resolvedDate: null });
  };

  const selectPosition = (position: StartChartPosition, focus = false) => {
    setActivePosition(position);
    updateQuery({ position });
    if (focus) {
      requestAnimationFrame(() =>
        document.getElementById(`start-chart-tab-${position}`)?.focus(),
      );
    }
  };

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    position: StartChartPosition,
  ) => {
    const index = POSITION_ORDER.indexOf(position);
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const next = POSITION_ORDER[(index + direction + POSITION_ORDER.length) % POSITION_ORDER.length];
    selectPosition(next, true);
  };

  useEffect(() => {
    setPositionLimits({ C: 25, LW: 25, RW: 25, D: 25, G: 25 });
  }, [date, search, ownershipMax, selectedGameId, selectedTeam]);

  const allowedGameTeamIds = useMemo(() => {
    if (!selectedGameId) return null;
    const game = data?.games.find((candidate) => candidate.id === selectedGameId);
    return game ? new Set([game.homeTeamId, game.awayTeamId]) : null;
  }, [data?.games, selectedGameId]);

  const gamesById = useMemo(
    () => new Map((data?.games ?? []).map((game) => [game.id, game] as const)),
    [data?.games],
  );

  const unknownOwnershipExcluded = useMemo(
    () =>
      ownershipMax < 100
        ? (data?.players ?? []).filter(
            (player) =>
              (player.ownership ?? player.percent_ownership) == null,
          ).length
        : 0,
    [data?.players, ownershipMax],
  );

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (data?.players ?? []).filter((player) => {
      const ownership = player.ownership ?? player.percent_ownership;
      const passesOwnership =
        ownershipMax === 100
          ? true
          : ownership != null && ownership <= ownershipMax;
      const passesSearch =
        !normalizedSearch || player.name.toLowerCase().includes(normalizedSearch);
      const passesGame = allowedGameTeamIds
        ? player.team_id != null && allowedGameTeamIds.has(player.team_id)
        : true;
      const passesTeam = selectedTeam
        ? player.team_abbrev === selectedTeam || String(player.team_id) === selectedTeam
        : true;
      return passesOwnership && passesSearch && passesGame && passesTeam;
    });
  }, [
    allowedGameTeamIds,
    data?.players,
    ownershipMax,
    search,
    selectedTeam,
  ]);

  const playersByPosition = useMemo(() => {
    const result = new Map<StartChartPosition, StartChartPlayer[]>(
      POSITION_ORDER.map((position) => [position, []]),
    );
    for (const player of filteredPlayers) {
      for (const position of player.positions) {
        if (!POSITION_ORDER.includes(position as StartChartPosition)) continue;
        result.get(position as StartChartPosition)?.push(player);
      }
    }
    for (const position of POSITION_ORDER) {
      result.get(position)?.sort(
        (left, right) =>
          (left.position_ranks[position] ?? Number.MAX_SAFE_INTEGER) -
            (right.position_ranks[position] ?? Number.MAX_SAFE_INTEGER) ||
          left.player_id - right.player_id ||
          left.game_id - right.game_id ||
          left.row_key.localeCompare(right.row_key),
      );
    }
    return result;
  }, [filteredPlayers]);

  useEffect(() => {
    if (queryPosition || !data?.players.length) return;
    const firstAvailable = POSITION_ORDER.find(
      (position) => (playersByPosition.get(position)?.length ?? 0) > 0,
    );
    if (firstAvailable && firstAvailable !== activePosition) {
      setActivePosition(firstAvailable);
    }
  }, [activePosition, data?.players.length, playersByPosition, queryPosition]);

  const teamsPlaying = useMemo(() => {
    const teams = new Set<string>();
    for (const game of data?.games ?? []) {
      const home = game.homeAbbrev ?? findTeamAbbrev(game.homeTeamId);
      const away = game.awayAbbrev ?? findTeamAbbrev(game.awayTeamId);
      if (home) teams.add(home);
      if (away) teams.add(away);
    }
    return Array.from(teams);
  }, [data?.games]);

  const teamColors = useMemo(() => {
    const colors: Record<string, string> = {};
    const used: string[] = [];
    for (const abbreviation of teamsPlaying) {
      const team = Object.values(teamsInfo).find(
        (candidate) => candidate.abbrev === abbreviation,
      );
      if (!team) continue;
      let color = team.primaryColor;
      if (used.some((candidate) => getColorDistance(candidate, color) < 50)) {
        color = team.secondaryColor;
      }
      if (used.some((candidate) => getColorDistance(candidate, color) < 50)) {
        color = adjustBrightness(team.primaryColor, 40);
      }
      if (used.some((candidate) => getColorDistance(candidate, color) < 50)) {
        color = adjustBrightness(team.primaryColor, -40);
      }
      colors[abbreviation] = color;
      used.push(color);
    }
    return colors;
  }, [teamsPlaying]);

  const lastCtpiDateByTeam = useMemo(() => {
    const dates = new Map<string, string>();
    for (const row of data?.ctpi ?? []) {
      for (const team of teamsPlaying) {
        if (typeof row[team] === "number") dates.set(team, row.date);
      }
    }
    return dates;
  }, [data?.ctpi, teamsPlaying]);

  const yAxisDomain = useMemo<[number, number]>(() => {
    const values = (data?.ctpi ?? []).flatMap((row) =>
      teamsPlaying.flatMap((team) =>
        typeof row[team] === "number" ? [row[team] as number] : [],
      ),
    );
    if (values.length === 0) return [0, 100];
    return [
      Math.max(0, Math.floor(Math.min(...values) - 5)),
      Math.min(100, Math.ceil(Math.max(...values) + 5)),
    ];
  }, [data?.ctpi, teamsPlaying]);

  const workflowContext = {
    date: date || easternDate(),
    resolvedDate: data?.resolvedDate ?? data?.dateUsed ?? null,
    position: activePosition,
    team: selectedTeam,
    mode: queryMode ?? "tonight",
  };
  const workflowLinks = START_CHART_SURFACE_LINKS.map((link) => ({
    ...link,
    href: buildContextHref(link.href, workflowContext),
  }));
  const fantasyScoringDescription = formatStartChartFantasyScoringContract(
    data?.fantasyScoringContract ?? START_CHART_FANTASY_SCORING_CONTRACT,
  );
  const isFallback = data?.serving?.mode === "fallback" || data?.fallbackApplied;
  const isPartial = data?.serving?.mode === "partial";
  const isDegraded = data?.sourceStatus?.overall === "degraded";

  return (
    <div className={styles.page}>
      <Head>
        <title>Starter Board | FHFH</title>
      </Head>

      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>FORGE Daily</p>
          <h1>Starter Board</h1>
          <p className={styles.subtitle}>
            One-game projections, matchup context, and starter probabilities for
            the selected slate.
          </p>
        </div>
        <dl className={styles.provenanceSummary}>
          <div>
            <dt>Requested</dt>
            <dd>{data?.requestedDate ?? (date || "—")}</dd>
          </div>
          <div>
            <dt>Resolved</dt>
            <dd>{data?.resolvedDate ?? data?.dateUsed ?? "—"}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{data?.sourceStatus?.projection?.modelVersion ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Run</dt>
            <dd title={data?.projectionRunId ?? undefined}>
              {data?.projectionRunId?.slice(0, 12) ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Scoring</dt>
            <dd title={data?.fantasyScoringContract?.version}>
              {data?.fantasyScoringContract?.label ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Input</dt>
            <dd title={data?.sourceStatus?.projection?.inputVersion ?? undefined}>
              {data?.sourceStatus?.projection?.inputVersion ?? "Unverified"}
            </dd>
          </div>
        </dl>
      </header>

      {isFallback || isPartial || isDegraded ? (
        <section
          className={`${styles.statusBanner} ${
            isPartial || isDegraded ? styles.statusWarning : ""
          }`}
          role="status"
        >
          <strong>
            {isFallback
              ? `Showing ${data?.resolvedDate ?? data?.dateUsed}, not ${data?.requestedDate}.`
              : "This slate has incomplete source coverage."}
          </strong>
          <span>
            {data?.serving?.message ??
              data?.sourceStatus?.degradedReasons?.join(", ") ??
              "Review source details before acting on the board."}
          </span>
        </section>
      ) : null}

      <section className={styles.chartPanel} aria-labelledby="ctpi-heading">
        <div className={styles.chartHeader}>
          <div>
            <h2 id="ctpi-heading" className={styles.chartTitle}>
              CTPI Pulse
            </h2>
            <p>Thirty-day team power trend through the resolved slate date.</p>
          </div>
          <span className={styles.meta}>
            Through {data?.sourceStatus?.ctpi?.throughDate ?? "Unavailable"}
          </span>
        </div>
        {(data?.ctpi?.length ?? 0) > 0 ? (
          <>
            <div
              className={styles.chartGraphic}
              role="img"
              aria-label={`Thirty-day team power trend for ${teamsPlaying.join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.ctpi ?? []} margin={{ right: 20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9ea7b3" }}
                    padding={{ right: 20 }}
                  />
                  <YAxis
                    domain={yAxisDomain}
                    width={30}
                    tick={{ fill: "#9ea7b3" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.9)",
                      border: "1px solid #596272",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  {teamsPlaying.map((abbreviation) => (
                    <Line
                      key={abbreviation}
                      type="monotone"
                      dataKey={abbreviation}
                      stroke={teamColors[abbreviation] ?? "#fff"}
                      strokeWidth={2}
                      connectNulls
                      dot={(props: any) => (
                        <TeamEndpointDot
                          {...props}
                          dataKey={abbreviation}
                          lastDate={lastCtpiDateByTeam.get(abbreviation)}
                        />
                      )}
                      activeDot={{ r: 4 }}
                      name={abbreviation}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.chartLegend} aria-label="CTPI team legend">
              {teamsPlaying.map((team) => (
                <li key={team}>
                  <span style={{ backgroundColor: teamColors[team] }} />
                  {team}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className={styles.chartEmpty} role="status">
            CTPI history is unavailable for this slate. Rankings remain based on
            canonical FORGE projections.
          </div>
        )}
      </section>

      {(data?.games?.length ?? 0) > 0 ? (
        <section className={styles.gameStrip} aria-label="Games on this slate">
          {data?.games.map((game) => {
            const home = teamFor(game.homeTeamId);
            const away = teamFor(game.awayTeamId);
            const isSelected = selectedGameId === game.id;
            return (
              <button
                type="button"
                key={game.id}
                className={`${styles.gameCard} ${
                  isSelected ? styles.selected : ""
                }`}
                onClick={() => setSelectedGameId(isSelected ? null : game.id)}
                aria-pressed={isSelected}
                aria-label={`${away?.abbrev ?? "Away"} at ${
                  home?.abbrev ?? "Home"
                }; ${isSelected ? "remove" : "apply"} game filter`}
                style={
                  {
                    "--away-color": away?.primaryColor ?? "#333",
                    "--home-color": home?.primaryColor ?? "#333",
                  } as React.CSSProperties
                }
              >
                <div className={styles.gameTime}>{formatGameTime(game.startTime)}</div>
                <div className={styles.teamRow}>
                  <div className={styles.teamRowHeader}>
                    <div className={styles.teamIdentity}>
                      {away?.abbrev ? (
                        <Image
                          src={`/teamLogos/${away.abbrev}.png`}
                          alt=""
                          width={28}
                          height={28}
                          className={styles.teamLogo}
                        />
                      ) : null}
                      <span className={styles.teamAbbrev}>{away?.abbrev ?? "TBD"}</span>
                    </div>
                    <RenderRating rating={game.awayRating} />
                  </div>
                  <RenderGoalie goalies={game.awayGoalies} />
                </div>
                <div className={styles.gameDivider}>
                  <div className={styles.dividerLine} />
                  <div className={styles.vsCircle}>vs</div>
                  <div className={styles.dividerLine} />
                </div>
                <div className={styles.teamRow}>
                  <div className={`${styles.teamRowHeader} ${styles.reverse}`}>
                    <div className={`${styles.teamIdentity} ${styles.reverse}`}>
                      {home?.abbrev ? (
                        <Image
                          src={`/teamLogos/${home.abbrev}.png`}
                          alt=""
                          width={28}
                          height={28}
                          className={styles.teamLogo}
                        />
                      ) : null}
                      <span className={styles.teamAbbrev}>{home?.abbrev ?? "TBD"}</span>
                    </div>
                    <RenderRating rating={game.homeRating} />
                  </div>
                  <RenderGoalie goalies={game.homeGoalies} />
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      <section className={styles.filters} aria-label="Starter Board controls">
        <div className={styles.filterGroup}>
          <label htmlFor="start-chart-search">Player</label>
          <input
            id="start-chart-search"
            className={styles.search}
            placeholder="Player name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="start-chart-date">Date</label>
          <input
            id="start-chart-date"
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(event) => selectDate(event.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="start-chart-team">Team</label>
          <select
            id="start-chart-team"
            className={styles.selectInput}
            value={selectedTeam ?? ""}
            onChange={(event) => {
              const team = event.target.value || null;
              setSelectedTeam(team);
              updateQuery({ team });
            }}
          >
            <option value="">All slate teams</option>
            {teamsPlaying.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="start-chart-ownership">
            {ownershipMax === 100 ? "All ownership" : `Ownership ≤ ${ownershipMax}%`}
          </label>
          <input
            id="start-chart-ownership"
            className={styles.rangeInput}
            type="range"
            min={0}
            max={100}
            value={ownershipMax}
            onChange={(event) => setOwnershipMax(Number(event.target.value))}
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="start-chart-profile">Profile</label>
          <select
            id="start-chart-profile"
            className={styles.selectInput}
            disabled
          >
            <option>
              {data?.fantasyScoringContract?.label ??
                START_CHART_FANTASY_SCORING_CONTRACT.label}
            </option>
          </select>
        </div>
        {unknownOwnershipExcluded > 0 ? (
          <p className={styles.controlNote} role="status">
            {unknownOwnershipExcluded} player
            {unknownOwnershipExcluded === 1 ? " was" : "s were"} excluded because
            ownership is unavailable; unknown values are never treated as 0%.
          </p>
        ) : null}
        <p className={styles.controlNote}>
          Weekly game volume and Yahoo ownership are informational only. FORGE
          one-game fantasy points determine skater rank; starter probability
          determines goalie rank.
        </p>
        <details className={styles.legendContainer}>
          <summary className={styles.legendIcon} aria-label="Explain metrics">
            i
          </summary>
          <div className={styles.legendTooltip}>
            <div className={styles.legendItem}>
              <strong>Fantasy points</strong>
              {fantasyScoringDescription}.
            </div>
            <div className={styles.legendItem}>
              <strong>DEF ease</strong>
              Slate-relative opponent defense grade. Higher opponent xGA/60 is
              easier; missing as-of ratings display as unavailable.
            </div>
            <div className={styles.legendItem}>
              <strong>Uncertainty</strong>
              Low/high values are model outcome bounds, not guarantees.
            </div>
          </div>
        </details>
      </section>

      <div
        className={styles.positionTabs}
        role="tablist"
        aria-label="Starter Board positions"
      >
        {POSITION_ORDER.map((position) => (
          <button
            id={`start-chart-tab-${position}`}
            key={position}
            type="button"
            role="tab"
            aria-selected={activePosition === position}
            aria-controls={`start-chart-panel-${position}`}
            tabIndex={activePosition === position ? 0 : -1}
            onClick={() => selectPosition(position)}
            onKeyDown={(event) => handleTabKeyDown(event, position)}
          >
            {position}
            <span>{playersByPosition.get(position)?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <section
        className={styles.columns}
        aria-label="Starter Board rankings by position"
        aria-busy={isLoading || !date}
      >
        {error ? (
          <div className={styles.requestState} role="alert">
            <strong>Starter Board is unavailable.</strong>
            <span>{error.message}</span>
            <button type="button" onClick={() => void mutate()}>
              Retry
            </button>
          </div>
        ) : null}
        {!error && data?.serving?.mode === "no_games" ? (
          <div className={styles.requestState} role="status">
            <strong>No games found.</strong>
            <span>{data.serving.message}</span>
          </div>
        ) : null}
        {!error && data?.games?.length && data.players.length === 0 ? (
          <div className={styles.requestState} role="status">
            <strong>No player projections found.</strong>
            <span>
              {data.games.length} game{data.games.length === 1 ? " is" : "s are"}
              scheduled, but canonical projection rows are not ready.
            </span>
          </div>
        ) : null}

        {POSITION_ORDER.map((position) => {
          const fullList = playersByPosition.get(position) ?? [];
          const visibleList = fullList.slice(0, positionLimits[position]);
          const headingId = `start-chart-position-${position}`;
          const isActive = activePosition === position;
          return (
            <section
              id={`start-chart-panel-${position}`}
              role="tabpanel"
              aria-labelledby={`start-chart-tab-${position}`}
              className={`${styles.column} ${styles[`pos${position}`]} ${
                isActive ? "" : styles.columnInactive
              }`}
              key={position}
            >
              <div className={styles.columnHeader}>
                <h2 id={headingId}>{position}</h2>
                <span className={styles.pill}>{fullList.length}</span>
              </div>
              {isLoading || !date ? (
                <div className={styles.emptyState} role="status">
                  Loading projections…
                </div>
              ) : fullList.length === 0 ? (
                <div className={styles.emptyState}>
                  No players match this position and filter set.
                </div>
              ) : (
                <ol className={styles.cardList}>
                  {visibleList.map((player) => {
                    const game = gamesById.get(player.game_id);
                    const opponentGoalie = game
                      ? player.team_id === game.homeTeamId
                        ? (game.awayGoalies[0] ?? null)
                        : (game.homeGoalies[0] ?? null)
                      : null;
                    const playerHref = buildContextHref(
                      `/forge/player/${player.player_id}`,
                      {
                        ...workflowContext,
                        team: player.team_abbrev,
                        position,
                      },
                    );
                    const teamHref = player.team_abbrev
                      ? buildContextHref(`/forge/team/${player.team_abbrev}`, {
                          ...workflowContext,
                          team: player.team_abbrev,
                          position,
                        })
                      : null;
                    const opponentHref = player.opponent_abbrev
                      ? buildContextHref(
                          `/forge/team/${player.opponent_abbrev}`,
                          {
                            ...workflowContext,
                            team: player.opponent_abbrev,
                            position,
                          },
                        )
                      : null;
                    return (
                      <li className={styles.card} key={`${position}-${player.row_key}`}>
                        <div className={styles.header}>
                          <Link
                            href={playerHref}
                            className={styles.name}
                            title={player.name}
                          >
                            {player.position_ranks[position] != null
                              ? `#${player.position_ranks[position]} ${player.name}`
                              : player.name}
                          </Link>
                          <div className={styles.meta}>
                            <span>
                              {teamHref ? (
                                <Link href={teamHref}>{player.team_abbrev}</Link>
                              ) : (
                                "Team TBD"
                              )}{" "}
                              vs{" "}
                              {opponentHref ? (
                                <Link href={opponentHref}>
                                  {player.opponent_abbrev}
                                </Link>
                              ) : (
                                "Opponent TBD"
                              )}
                              {game ? ` · ${formatGameTime(game.startTime)}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statsContainer}>
                          {position === "G" ? (
                            <>
                              <Metric label="Start" value={formatPercent(player.start_probability)} />
                              <Metric label="GSAA/60" value={formatNumber(player.projected_gsaa, 2)} />
                              <Metric
                                label="Status"
                                value={
                                  player.confirmed_status
                                    ? "Confirmed"
                                    : player.start_probability == null
                                      ? "Unavailable"
                                      : "Projected"
                                }
                              />
                            </>
                          ) : (
                            <>
                              <Metric
                                label="FP"
                                value={formatNumber(player.proj_fantasy_points, 2)}
                              />
                              <Metric
                                label="G / A / S"
                                value={`${formatNumber(player.proj_goals)} / ${formatNumber(
                                  player.proj_assists,
                                )} / ${formatNumber(player.proj_shots)}`}
                              />
                              <Metric
                                label="DEF ease"
                                value={formatNumber(player.matchup_grade, 0)}
                              />
                            </>
                          )}
                        </div>

                        {position !== "G" ? (
                          <dl className={styles.secondaryStats}>
                            <StatTerm label="PPP" value={formatNumber(player.proj_pp_points)} />
                            <StatTerm label="HIT" value={formatNumber(player.proj_hits)} />
                            <StatTerm label="BLK" value={formatNumber(player.proj_blocks)} />
                            <StatTerm label="PIM" value={formatNumber(player.proj_pim)} />
                            <StatTerm
                              label="TOI"
                              value={
                                player.proj_toi_minutes == null
                                  ? "—"
                                  : `${player.proj_toi_minutes.toFixed(1)}m`
                              }
                            />
                          </dl>
                        ) : null}

                        {player.context?.projection_low != null ||
                        player.context?.projection_high != null ? (
                          <div className={styles.uncertainty}>
                            Range {formatNumber(player.context.projection_low, 2)}–
                            {formatNumber(player.context.projection_high, 2)} FP
                          </div>
                        ) : null}
                        <ContextChips
                          player={player}
                          position={position}
                          opponentGoalie={opponentGoalie}
                        />
                        <div className={styles.cardFooter}>
                          <span>
                            Own {formatPercent(player.percent_ownership, false)}
                            {player.ownership_as_of_date
                              ? ` · ${player.ownership_as_of_date}`
                              : ""}
                          </span>
                          <span>
                            {player.games_remaining_week == null
                              ? "Weekly volume unavailable"
                              : `${player.games_remaining_week} ${
                                  player.games_remaining_week === 1 ? "game" : "games"
                                } left this week`}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {visibleList.length < fullList.length ? (
                <button
                  type="button"
                  className={styles.loadMore}
                  onClick={() =>
                    setPositionLimits((current) => ({
                      ...current,
                      [position]: current[position] + INITIAL_POSITION_LIMIT,
                    }))
                  }
                >
                  Load 25 more {position}
                </button>
              ) : null}
            </section>
          );
        })}
      </section>

      {data?.sourceStatus ? (
        <details className={styles.sourceDetails}>
          <summary>Source coverage and provenance</summary>
          <dl>
            <SourceRow
              label="FORGE projections"
              state={data.sourceStatus.projection.state}
              value={`${data.sourceStatus.projection.date ?? "No date"} · ${
                data.sourceStatus.projection.inputVersion ?? "unverified provenance"
              }`}
            />
            <SourceRow
              label="Team ratings"
              state={data.sourceStatus.teamRatings.state}
              value={data.sourceStatus.teamRatings.resolvedDate ?? "Unavailable"}
            />
            <SourceRow
              label="Goalies"
              state={data.sourceStatus.goalies.state}
              value={`${data.sourceStatus.goalies.coveredTeams}/${data.sourceStatus.goalies.expectedTeams} teams · ${data.sourceStatus.goalies.freshTeams} fresh · ${data.sourceStatus.goalies.staleTeams} stale`}
            />
            <SourceRow
              label="Yahoo ownership"
              state={data.sourceStatus.ownership.state}
              value={`${data.sourceStatus.ownership.mappedPlayers} mapped · ${
                data.sourceStatus.ownership.unmappedPlayers
              } unmapped · ${data.sourceStatus.ownership.playersWithAsOf} with as-of · ${
                data.sourceStatus.ownership.playersMissingAsOf
              } without · ${
                data.sourceStatus.ownership.oldestAsOfDate &&
                data.sourceStatus.ownership.latestAsOfDate
                  ? `${data.sourceStatus.ownership.oldestAsOfDate}–${data.sourceStatus.ownership.latestAsOfDate}`
                  : "no as-of date"
              }`}
            />
            <SourceRow
              label="CTPI"
              state={data.sourceStatus.ctpi.state}
              value={data.sourceStatus.ctpi.throughDate ?? "Unavailable"}
            />
            <SourceRow
              label="Weekly volume"
              state={data.sourceStatus.gamesRemaining.state}
              value={
                data.sourceStatus.gamesRemaining.date ??
                data.sourceStatus.gamesRemaining.message ??
                "Unavailable"
              }
            />
          </dl>
        </details>
      ) : null}

      <SurfaceWorkflowLinks
        title="Continue in FORGE"
        description="Carry this date, position, team, and mode into the next decision surface."
        links={workflowLinks}
      />
    </div>
  );
}

function findTeamAbbrev(teamId: number): string | null {
  return teamFor(teamId)?.abbrev ?? null;
}

function teamFor(teamId: number) {
  return Object.values(teamsInfo).find((team) => team.id === teamId);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

function StatTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SourceRow({
  label,
  state,
  value,
}: {
  label: string;
  state: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span data-state={state}>{state}</span> {value}
      </dd>
    </div>
  );
}
