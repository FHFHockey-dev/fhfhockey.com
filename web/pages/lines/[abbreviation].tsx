import dynamic from "next/dynamic";
import ProjectedLineups from "components/LineCombinations/ProjectedLineups";

import React, { useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import type { GetStaticPaths, GetStaticProps } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { toPng } from "html-to-image";

import PageTitle from "components/PageTitle";
import Container from "components/Layout/Container";
import TeamSelect from "components/TeamSelect";
import TimeAgo from "components/TimeAgo";
import Select from "components/Select";
import CategoryTitle from "components/LineCombinations/CategoryTitle";
import Line from "components/LineCombinations/Line";
import { mapTeamAbbreviation } from "lib/NHL/utils/utils";
import PowerPlayCombos from "components/PowerPlayCombos";
import type {
  GoalieWindowStats,
  LineSource
} from "components/LineCombinations/utilities";

import { LineChange } from "components/LineCombinations/PlayerCard/SkaterCard";
import Custom404 from "pages/404";
import TeamColorProvider, { useTeamColor } from "contexts/TeamColorContext";

import styles from "./[abbreviation].module.scss";
import { readableInk } from "components/LineCombinations/PlayerCard/teamInk";
import useScreenSize from "hooks/useScreenSize";
import { getTeamLogo, getTeams, getCurrentSeason } from "lib/NHL/server";
import { Team } from "lib/NHL/types";
import {
  getLineCombinations,
  type LineCombinations
} from "components/LineCombinations/utilities";
import { getLinesSurfaceLinks } from "lib/navigation/siteSurfaceLinks";
import LineShareBars from "components/LineCombinations/LineShareBars";
import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";

export type PlayerBasic = {
  playerId: number;
  playerName: string;
  position: string;
  sweaterNumber: number;
  lineChange: LineChange;
};

export type SkaterStats = PlayerBasic & {
  Goals: number;
  Assists: number;
  PTS: number;
  PPP: number;
  Shots: number;
  Hits: number;
  Blocks: number;
  PlusMinus: number;
  TOISeconds?: number;
};

export type GoalieStats = PlayerBasic & {
  /** The goalie's last 10 appearances, pooled. */
  last10Games: GoalieWindowStats;
  /** The goalie's season appearances, pooled. */
  season: GoalieWindowStats;
};

const ObservedLinemateMatrix = dynamic(() => import("components/LinemateMatrix"), { ssr: false });

type Props = {
  teamName: string;
  /**
   * An array of team info.
   */
  teams: Team[];

  lineCombinations: LineCombinations | null;
  lastUpdated: string | null;
  /** The lines query failed (as opposed to the team having no game data yet). */
  loadError?: boolean;
};

export default function TeamLC({
  teamName,
  teams,
  lineCombinations,
  lastUpdated,
  loadError = false
}: Props) {
  const router = useRouter();
  const { abbreviation } = router.query;
  const mappedAbbreviation = mapTeamAbbreviation(abbreviation as string); // Map abbreviation
  const sourceTeamMeta = useMemo(
    () => teams.find((team) => lineCombinations ? team.id === lineCombinations.game.teamId : team.abbreviation === mappedAbbreviation),
    [teams, lineCombinations, mappedAbbreviation]
  );

  const onTeamChange = (newAbbreviation: string) => {
    const mappedNewAbbreviation = mapTeamAbbreviation(newAbbreviation);
    router.push(`/lines/${mappedNewAbbreviation}`);
  };
  const onGameChange = (gameId: number) => { void router.push({ pathname: router.pathname, query: { abbreviation, gameId } }, undefined, { shallow: true }); };

  // download the line combo
  const size = useScreenSize();
  const lineComboRef = useRef<HTMLDivElement>(null);
  const downloadImage = () => {
    if (lineComboRef.current === null) return;

    toPng(lineComboRef.current, { backgroundColor: PANEL_SURFACE })
      .then((dataUrl) => {
        const link = document.createElement("a");
        const dateLabel = lastUpdated
          ? new Date(lastUpdated).toLocaleDateString()
          : "latest";
        link.download = `${teamName}-${dateLabel}-${size.screen}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const selectedGameId =
    typeof router.query.gameId === "string" &&
    /^[1-9]\d*$/.test(router.query.gameId)
      ? Number(router.query.gameId)
      : undefined;

  // NOTE: workaround for weird vercel client side bug
  if (!teams || !sourceTeamMeta) return <Custom404 />;

  const pageTop = (
    <>
      <NextSeo
        title={`FHFH | ${mappedAbbreviation} Line Combinations`}
        description={`${teamName} line combinations, power-play units and shared ice time.`}
      />
      <div className={styles.top}>
        {/* Per-team h1, same pattern as the game page ("VGK at DET LINES"). */}
        <PageTitle className={styles.title}>
          {mappedAbbreviation} <PageTitle.Highlight>LINES</PageTitle.Highlight>
        </PageTitle>
        <Select
          ariaLabel="Team"
          className={styles.select}
          option={abbreviation as string}
          options={teams.map((team) => ({
            label: team.abbreviation,
            value: team.abbreviation
          }))}
          onOptionChange={onTeamChange}
        />
      </div>
      <ProjectedLineups
        teamId={sourceTeamMeta.id}
        onGameChange={onGameChange}
        gameId={selectedGameId}
      />
    </>
  );

  if (!lineCombinations) {
    return (
      <Container className={styles.container}>
        {pageTop}
        <section className={styles.panel} aria-labelledby="lines-observed-empty">
          <h2 id="lines-observed-empty" className={styles.sectionTitle}>
            {teamName} last-game lineup
          </h2>
          <p className={styles.emptyNote}>
            {loadError
              ? "Lines couldn't load right now. This page retries within a minute."
              : "No completed game with shift data yet. Lines appear here after the team's next completed game."}
          </p>
        </section>
      </Container>
    );
  }

  return (
    <TeamColorProvider teamName={teamName}>
      <Container className={styles.container}>
        <nav className={styles.teamSelect} aria-label="Teams">
          <TeamSelect
            teams={teams}
            team={abbreviation as string}
            onTeamChange={onTeamChange}
          />
        </nav>
        {pageTop}

        <div ref={lineComboRef} className={styles.lineup}>
          <Header
            sourceUrl={
              `/shiftChart?gameId=${lineCombinations.game.id}` +
              "&linemate-matrix-mode=line-combination#linemate-matrix"
            }
            lineSource={lineCombinations.lineSource}
            teamName={teamName}
            teamAbbreviation={mappedAbbreviation}
            lastUpdated={lastUpdated}
            onSaveImage={downloadImage}
          />
          <div className={styles.mainContent}>
            <section className={styles.forwards} aria-label="Forwards">
              <CategoryTitle type="large" className={styles.categoryTitle}>
                FORWARDS
              </CategoryTitle>
              <Line
                className={styles.line}
                title="LINE 1"
                columns={3}
                players={lineCombinations.forwards.line1}
              />
              <Line
                className={styles.line}
                title="LINE 2"
                columns={3}
                players={lineCombinations.forwards.line2}
              />
              <Line
                className={styles.line}
                title="LINE 3"
                columns={3}
                players={lineCombinations.forwards.line3}
              />
              <Line
                className={styles.line}
                title="LINE 4"
                columns={3}
                players={lineCombinations.forwards.line4}
              />
            </section>

            {/* mobile only */}
            <section className={styles.defense} aria-label="Defense">
              <CategoryTitle type="large">DEFENSE</CategoryTitle>
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line1}
              />
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line2}
              />
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line3}
              />
            </section>

            {/* mobile only */}
            <section className={styles.goalies} aria-label="Goalies">
              <CategoryTitle type="large">GOALIES</CategoryTitle>
              <Line
                className={styles.line}
                columns={2}
                type="goalies"
                players={[
                  ...lineCombinations.goalies.line1,
                  ...lineCombinations.goalies.line2
                ]}
              />
            </section>

            <section
              className={styles.defenseAndGoalies}
              aria-label="Defense and goalies"
            >
              <CategoryTitle type="large" className={styles.categoryTitle}>
                DEFENSE & GOALIES
              </CategoryTitle>
              <Line
                className={styles.line}
                title="1ST PAIR"
                columns={2}
                players={lineCombinations.defensemen.line1}
              />
              <Line
                className={styles.line}
                title="2ND PAIR"
                columns={2}
                players={lineCombinations.defensemen.line2}
              />
              <Line
                className={styles.line}
                title="3RD PAIR"
                columns={2}
                players={lineCombinations.defensemen.line3}
              />

              <Line
                className={styles.line}
                title="GOALIES"
                columns={2}
                type="goalies"
                players={[
                  ...lineCombinations.goalies.line1,
                  ...lineCombinations.goalies.line2
                ]}
              />
            </section>

            <div className={styles.lineShare}>
              <LineShareBars
                lines={[
                  { label: "L1", players: lineCombinations.forwards.line1 },
                  { label: "L2", players: lineCombinations.forwards.line2 },
                  { label: "L3", players: lineCombinations.forwards.line3 },
                  { label: "L4", players: lineCombinations.forwards.line4 }
                ]}
              />
            </div>
          </div>
          {lineCombinations.game.teamId ? (
            <div className={styles.powerPlay}>
              <PowerPlayCombos
                teamId={lineCombinations.game.teamId}
                gameId={lineCombinations.game.id}
                seasonId={lineCombinations.game.seasonId}
                teamAbbreviation={sourceTeamMeta?.abbreviation}
                statsGameIds={lineCombinations.statsGameIds}
              />
            </div>
          ) : null}
        </div>

        <section
          className={styles.panel}
          aria-labelledby="lines-shared-ice"
        >
          <h2 id="lines-shared-ice" className={styles.sectionTitle}>
            {teamName} shared ice time, last game
          </h2>
          <ObservedLinemateMatrix
            id={lineCombinations.game.id}
            mode="line-combination"
            teamId={lineCombinations.game.teamId ?? sourceTeamMeta.id}
            headingLevel="h3"
            labelGrid
            wideNames
            controlsAlign="start"
          />
        </section>

        <SurfaceWorkflowLinks
          eyebrow="Deployment workflow"
          title={`Use ${mappedAbbreviation} lines in context`}
          description="Carry the current combinations into Team HQ, matchup, schedule, and trend decisions."
          links={getLinesSurfaceLinks(mappedAbbreviation)}
        />
      </Container>
    </TeamColorProvider>
  );
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const abbreviation = params!.abbreviation as string;
  const mappedAbbreviation = mapTeamAbbreviation(abbreviation); // Map abbreviation

  const teams = await getTeams();
  const team = teams.find((team) => team.abbreviation === mappedAbbreviation);

  if (!team) {
    console.warn(`Team not found for abbreviation: ${mappedAbbreviation}`);
    return { notFound: true };
  }

  try {
    const lineCombinations = await getLineCombinations(team.id);
    return {
      props: {
        teamName: team.name,
        lastUpdated: lineCombinations.game.startTime,
        lineCombinations,
        teams
      },
      revalidate: 60 // In seconds
    };
  } catch (error) {
    // If UTA doesn't have enough current-season data yet, try last season with prior team ID
    if (team.abbreviation === "UTA") {
      try {
        const { lastSeasonId } = await getCurrentSeason();
        const utahLastSeasonTeamId = 59;
        const lineCombinations = await getLineCombinations(
          utahLastSeasonTeamId,
          lastSeasonId
        );
        return {
          props: {
            teamName: team.name,
            lastUpdated: lineCombinations.game.startTime,
            lineCombinations,
            teams
          },
          revalidate: 60
        };
      } catch (fallbackError) {
        console.error(
          `Failed fallback for UTA (last season/team 59):`,
          fallbackError
        );
      }
    }
    console.error(
      `Failed to get line combinations for team ${mappedAbbreviation}:`,
      error
    );

    // Instead of returning notFound immediately, check if this is a data availability issue
    const errorMessage = error?.toString() || "";
    const noGameData = errorMessage.includes("Cannot find at least 2 games");
    if (noGameData) {
      console.warn(
        `Insufficient line combination data for ${mappedAbbreviation}. Will retry on-demand.`
      );
    } else if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      // A query failure (timeout, aborted transaction) is not "no games yet". Throwing
      // during ISR revalidation keeps the last good page instead of caching an empty
      // state over it. At build time, fall through so one flaky query can't fail the build.
      throw error;
    }
    return {
      props: {
        teamName: team.name,
        teams,
        lineCombinations: null,
        lastUpdated: null,
        loadError: !noGameData
      },
      revalidate: 60
    };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  const teams = await getTeams();
  const paths = teams.map((team) => ({
    params: { abbreviation: team.abbreviation }
  }));

  return {
    paths,
    fallback: "blocking" // Allow pages to be generated on-demand if they fail at build time
  };
};

type HeaderProps = {
  /** Defaults to the legacy grouping, which is what Lines serves today. */
  lineSource?: LineSource;
  teamName: string;
  teamAbbreviation: string;
  lastUpdated: string | null;
  sourceUrl: string;
  onSaveImage: () => void;
};

const PANEL_SURFACE = "#1a1c21"; // v.$surface-1

export function Header({
  lineSource = "all_strength_legacy",
  teamName,
  teamAbbreviation,
  lastUpdated,
  sourceUrl,
  onSaveImage
}: HeaderProps) {
  const names = teamName.split(" ");
  const color = useTeamColor();
  const rail = readableInk(PANEL_SURFACE, [color.primary, color.secondary], 3);
  const highlight = readableInk(PANEL_SURFACE, [color.secondary, color.jersey]);

  return (
    <div
      className={styles.header}
      style={{ "--team-rail": rail } as React.CSSProperties}
    >
      <div className={styles.left}>
        <h2 className={styles.teamName}>
          {names.slice(0, -1).join(" ")}{" "}
          <span className={styles.highlight} style={{ color: highlight }}>
            {names.at(-1)}
          </span>
        </h2>
        <p className={styles.subtitle}>
          {lineSource === "five_on_five_observed"
            ? "Last game's most-used 5v5 units, one slot per player"
            : "Last game's lines, grouped by all-strength shared ice time (legacy view)"}{" "}
          · skater stats from the team&apos;s last 10 games with lines
        </p>
        {lastUpdated ? (
          <p className={styles.time}>
            <a href={sourceUrl}>
              Updated <TimeAgo date={lastUpdated} />
            </a>
          </p>
        ) : null}
      </div>
      <div className={styles.right}>
        <img
          className={styles.logo}
          alt=""
          src={getTeamLogo(teamAbbreviation)}
        />
        <button type="button" className={styles.saveButton} onClick={onSaveImage}>
          Save image
        </button>
      </div>
    </div>
  );
}
