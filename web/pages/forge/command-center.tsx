import Head from "next/head";
import Link from "next/link";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import CommandCenterControls from "components/forge-command-center/CommandCenterControls";
import FocusedSlateContext from "components/forge-command-center/FocusedSlateContext";
import GoalieContextPanel from "components/forge-command-center/GoalieContextPanel";
import PlayerInsightCore from "components/forge-command-center/PlayerInsightCore";
import TeamPowerTerminal from "components/forge-command-center/TeamPowerTerminal";
import TopAddsWatchlist from "components/forge-command-center/TopAddsWatchlist";
import {
  CommandCenterPanel,
  CommandCenterShell,
  MixedStateBanner,
  ModuleState
} from "components/forge-command-center/CommandCenterShell";
import { loadCommandCenterData, type CommandCenterData } from "lib/dashboard/commandCenterData";
import {
  buildForgeHref,
  parseForgeDateParam,
  parseForgeModeParam,
  parseForgePositionParam,
  parseForgeResolvedDateParam,
  parseForgeSlateParam,
  parseForgeTeamParam
} from "lib/dashboard/forgeLinks";
import { buildCommandCenterDestinations } from "lib/dashboard/commandCenterLinks";
import type {
  CommandCenterAddMode,
  CommandCenterPosition,
  CommandCenterRouteState,
  CommandCenterSlateMode
} from "lib/dashboard/commandCenterTypes";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeCommandCenter.module.scss";

function getTodayEt(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

const ForgeCommandCenterPage: NextPage = () => {
  const router = useRouter();
  const todayEt = useMemo(() => getTodayEt(), []);
  const [date, setDate] = useState(todayEt);
  const [resolvedDate, setResolvedDate] = useState<string | null>(null);
  const [team, setTeam] = useState("all");
  const [position, setPosition] = useState<CommandCenterPosition>("all");
  const [slateMode, setSlateMode] = useState<CommandCenterSlateMode>("main");
  const [addMode, setAddMode] = useState<CommandCenterAddMode>("tonight");
  const [commandData, setCommandData] = useState<CommandCenterData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [routeStateHydrated, setRouteStateHydrated] = useState(false);
  const teamOptions = useMemo(
    () =>
      Object.values(teamsInfo)
        .map((teamInfo) => teamInfo.abbrev)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    []
  );
  const requestedState = useMemo(() => {
    const requestedDate = parseForgeDateParam(router.query.date, todayEt);
    const requestedResolvedDate = parseForgeResolvedDateParam(
      router.query.resolvedDate
    );
    const requestedTeam = parseForgeTeamParam(router.query.team);
    const requestedPosition = parseForgePositionParam(router.query.position);
    const requestedSlate = parseForgeSlateParam(router.query.slate);
    const requestedMode = parseForgeModeParam(router.query.mode);
    const normalizedTeam =
      requestedTeam && requestedTeam !== "ALL" && teamOptions.includes(requestedTeam)
        ? requestedTeam
        : "all";

    return {
      date: requestedDate,
      resolvedDate: requestedResolvedDate,
      team: normalizedTeam,
      position: requestedPosition ?? "all",
      slateMode: requestedSlate ?? "main",
      addMode: requestedMode ?? "tonight"
    };
  }, [router.query, teamOptions, todayEt]);
  const dateLabel = useMemo(() => formatDateLabel(date), [date]);
  const hasCustomFilters =
    date !== todayEt ||
    resolvedDate != null ||
    team !== "all" ||
    position !== "all" ||
    slateMode !== "main" ||
    addMode !== "tonight";
  const destinations = useMemo(
    () =>
      buildCommandCenterDestinations({
        date,
        resolvedDate,
        team,
        position,
        slateMode,
        addMode,
        returnTo: buildForgeHref("/forge/command-center", {
          date,
          resolvedDate,
          team,
          position,
          slate: slateMode,
          mode: addMode
        })
      }),
    [addMode, date, position, resolvedDate, slateMode, team]
  );
  const routeState = useMemo<CommandCenterRouteState>(
    () => ({
      date,
      resolvedDate,
      team,
      position,
      slateMode,
      addMode
    }),
    [addMode, date, position, resolvedDate, slateMode, team]
  );

  useEffect(() => {
    if (!router.isReady) return;
    setDate(requestedState.date);
    setResolvedDate(requestedState.resolvedDate);
    setTeam(requestedState.team);
    setPosition(requestedState.position);
    setSlateMode(requestedState.slateMode);
    setAddMode(requestedState.addMode);
    setRouteStateHydrated(true);
  }, [requestedState, router.isReady]);

  useEffect(() => {
    if (
      !router.isReady ||
      !routeStateHydrated ||
      typeof router.replace !== "function"
    ) return;
    const href = buildForgeHref("/forge/command-center", {
      date,
      resolvedDate,
      team,
      position,
      slate: slateMode,
      mode: addMode
    });

    if (router.asPath === href) return;
    void router.replace(href, undefined, { shallow: true, scroll: false });
  }, [addMode, date, position, resolvedDate, routeStateHydrated, router, slateMode, team]);

  useEffect(() => {
    if (!router.isReady || !routeStateHydrated) return;
    let active = true;
    setDataLoading(true);
    setDataError(null);

    loadCommandCenterData(routeState)
      .then((data) => {
        if (!active) return;
        setCommandData(data);
        if (data.routeState.resolvedDate && data.routeState.resolvedDate !== resolvedDate) {
          setResolvedDate(data.routeState.resolvedDate);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDataError(
          error instanceof Error ? error.message : "Failed to load command-center data."
        );
        setCommandData(null);
      })
      .finally(() => {
        if (!active) return;
        setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedDate, routeState, routeStateHydrated, router.isReady]);

  const resetFilters = () => {
    setDate(todayEt);
    setResolvedDate(null);
    setTeam("all");
    setPosition("all");
    setSlateMode("main");
    setAddMode("tonight");
  };

  return (
    <>
      <Head>
        <title>FORGE Command Center | FHFHockey</title>
        <meta
          name="description"
          content="Scratch-built FORGE command center for fantasy hockey slate, add, player insight, and goalie risk decisions."
        />
      </Head>

      <CommandCenterShell
        title="FORGE Command Center"
        subtitle="A clean rebuild route for the next-generation fantasy hockey slate, waiver, player insight, and goalie risk dashboard."
        dateLabel={dateLabel}
      >
        <CommandCenterControls
          date={date}
          team={team}
          position={position}
          slateMode={slateMode}
          addMode={addMode}
          teamOptions={teamOptions}
          onDateChange={setDate}
          onTeamChange={(value) => setTeam(value === "all" ? "all" : value)}
          onPositionChange={setPosition}
          onSlateModeChange={setSlateMode}
          onAddModeChange={setAddMode}
          onReset={resetFilters}
        />

        {commandData ? <MixedStateBanner mixedState={commandData.mixedState} /> : null}
        {dataError ? <p className={styles.moduleStateWarning}>{dataError}</p> : null}

        <section className={styles.commandLayout} aria-label="Command center modules">
          <CommandCenterPanel
            eyebrow="Team Power Terminal"
            title="Power + CTPI"
            meta={commandData?.modules.teamPower.resolvedDate ?? date}
            className={styles.teamPanel}
          >
            {commandData ? (
              <TeamPowerTerminal
                module={commandData.modules.teamPower}
                slateModule={commandData.modules.focusedSlate}
                selectedTeam={team}
                teamHref={destinations.team}
              />
            ) : (
              <ModuleState
                module={{
                  status: dataLoading ? "loading" : "empty",
                  data: null,
                  requestedDate: date,
                  resolvedDate: date,
                  fallbackApplied: false,
                  message: null,
                  error: dataError,
                  contract: {
                    id: "team_power",
                    label: "Team Power Terminal",
                    sourceApis: [],
                    sourceTables: [],
                    freshnessExpectation: "",
                    fallbackStrategy: "",
                    emptyStateRule: "Team power has not loaded yet.",
                    clickDestination: "/forge/team/[teamId]"
                  }
                }}
              />
            )}
          </CommandCenterPanel>

          <CommandCenterPanel
            eyebrow="Focused Slate + Goalie Context"
            title="Best Fantasy Environment"
            meta={commandData?.modules.focusedSlate.resolvedDate ?? date}
            className={styles.slatePanel}
          >
            {commandData ? (
              <FocusedSlateContext
                module={commandData.modules.focusedSlate}
                selectedTeam={team}
                startChartHref={destinations.startChart}
              />
            ) : (
              <p className={styles.panelText}>Loading slate context...</p>
            )}
          </CommandCenterPanel>

          <CommandCenterPanel
            eyebrow="Top Adds Watchlist"
            title="Ownership-Aware Adds"
            meta={addMode === "tonight" ? "Adds 1D" : "Adds 5D"}
            className={styles.addsPanel}
          >
            {commandData ? (
              <TopAddsWatchlist
                module={commandData.modules.topAdds}
                position={position}
                addMode={addMode}
                playerHref={destinations.forgePlayer}
              />
            ) : (
              <p className={styles.panelText}>Loading add candidates...</p>
            )}
          </CommandCenterPanel>
          <CommandCenterPanel
            eyebrow="Player Insight Core"
            title="Trust, Fade + Momentum"
            meta="Own 25-50%"
            className={styles.insightPanel}
          >
            {commandData ? (
              <PlayerInsightCore
                module={commandData.modules.playerInsight}
                playerHref={destinations.trendsPlayer}
              />
            ) : (
              <p className={styles.panelText}>Loading player insight...</p>
            )}
          </CommandCenterPanel>

          <CommandCenterPanel
            eyebrow="Goalie Context"
            title="Probability + Risk"
            meta={commandData?.modules.goalieContext.resolvedDate ?? date}
            className={styles.goaliePanel}
          >
            {commandData ? (
              <GoalieContextPanel
                module={commandData.modules.goalieContext}
                selectedTeam={team}
                playerHref={destinations.forgePlayer}
              />
            ) : (
              <p className={styles.panelText}>Loading goalie context...</p>
            )}
          </CommandCenterPanel>

          <CommandCenterPanel
            eyebrow="Route Boundary"
            title="Build Surface"
            meta="/forge/command-center"
            className={styles.routePanel}
          >
            <p className={styles.routeStateText}>
              Active context: {date} / {team} / {position.toUpperCase()} /{" "}
              {slateMode} slate / {addMode}
              {resolvedDate ? ` / resolved ${resolvedDate}` : ""}
              {hasCustomFilters ? "" : " / default filters"}
            </p>
            <div className={styles.quickLinkRow} aria-label="Command center destinations">
              <Link href={destinations.startChart}>Start Chart</Link>
              <Link href={destinations.trends}>Trends</Link>
              <Link href={destinations.legacyDashboard}>Legacy Dashboard</Link>
              {destinations.teamDetail ? (
                <Link href={destinations.teamDetail}>Team Detail</Link>
              ) : null}
            </div>
          </CommandCenterPanel>
        </section>
      </CommandCenterShell>
    </>
  );
};

export default ForgeCommandCenterPage;
