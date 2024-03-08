import React, { useState } from "react";
import { NextSeo } from "next-seo";
import Image from "next/image";
import { GetStaticProps } from "next";
import Link from "next/link";
import classNames from "classnames";

import PageTitle from "components/PageTitle";
import TimeAgo from "components/TimeAgo";
import arrowDown from "public/pictures/arrow-down-white.png";

import Container from "components/Layout/Container";

import type { Team } from "lib/NHL/types";
import styles from "styles/Lines.module.scss";
import { getTeams } from "lib/NHL/server";
import ClientOnly from "components/ClientOnly";
import { getLineCombinations } from "components/LineCombinations/utilities";
import supabase from "lib/supabase";

export type RowData = {
  playerId: number;
  playerName: string;
  previousLine: number | null;
  currentLine: number | null;
  /**
   * Team abbreviation
   */
  abbreviation: string;
};

type LandingPageProps = {
  teams: Team[];
  promotions: RowData[];
  demotions: RowData[];
  lastUpdated: string;
};

function Lines({
  teams,
  lastUpdated,
  promotions,
  demotions,
}: LandingPageProps) {
  return (
    <Container className={styles.lineCombinations}>
      <NextSeo
        title="FHFH | NHL Line Combinations"
        description="NHL Line Combinations"
      />

      <PageTitle>
        NHL LINE <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
      </PageTitle>
      <Teams teams={teams} />
      <Players
        lastUpdated={lastUpdated}
        promotions={promotions}
        demotions={demotions}
      />
    </Container>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const teams = await getTeams();
  const promotions = [] as RowData[];
  const demotions = [] as RowData[];

  await Promise.all(
    teams.map(async (team) => {
      const lineCombos = await getLineCombinations(team.id);
      // Add team abbreviation
      promotions.push(
        ...lineCombos.promotions.map(
          (p) =>
            ({
              ...p,
              abbreviation: team.abbreviation,
            } as any)
        )
      );

      demotions.push(
        ...lineCombos.demotions.map(
          (p) =>
            ({
              ...p,
              abbreviation: team.abbreviation,
            } as any)
        )
      );
    })
  );
  // Add player name
  const playerIds = new Set<number>();
  promotions.forEach((p) => playerIds.add(p.playerId));
  demotions.forEach((p) => playerIds.add(p.playerId));
  const { data: playersInfo } = await supabase
    .from("players")
    .select("id, playerName:fullName")
    .in("id", [...playerIds])
    .throwOnError();
  const playerNamesMap = new Map<number, string>();
  playersInfo?.forEach((p) => {
    playerNamesMap.set(p.id, p.playerName);
  });

  promotions.forEach(
    (p) => (p.playerName = playerNamesMap.get(p.playerId) ?? "Unknown")
  );
  demotions.forEach(
    (p) => (p.playerName = playerNamesMap.get(p.playerId) ?? "Unknown")
  );

  return {
    props: {
      teams,
      promotions,
      demotions,
      lastUpdated: new Date().toISOString(),
    },
    revalidate: 60, // in seconds
  };
};

function Teams({ teams }: { teams: Team[] }) {
  return (
    <div className={styles.teams}>
      {teams.map((team) => (
        <Link key={team.name} href={`/lines/${team.abbreviation}`}>
          <a>
            <Image
              src={team.logo}
              alt={team.name}
              width={37.35}
              height={37.35}
              objectFit="contain"
            />
          </a>
        </Link>
      ))}
    </div>
  );
}

function Players({
  promotions,
  demotions,
  lastUpdated,
}: {
  promotions: RowData[];
  demotions: RowData[];
  lastUpdated: string;
}) {
  return (
    <section className={styles.players}>
      <a
        className={styles.time}
        href="https://twitter.com/fhfhlines"
        target="_blank"
        rel="noopener noreferrer"
      >
        <ClientOnly style={{ display: "inline" }}>
          Updated: <TimeAgo date={lastUpdated} />
        </ClientOnly>
      </a>
      <div className={styles.tables}>
        <Table type="promotions" data={promotions} />
        <div className={styles.gap} />
        <Table type="demotions" data={demotions} />
      </div>
    </section>
  );
}

const INITIAL_ROWS = 7;

function Table({
  type,
  data,
}: {
  type: "promotions" | "demotions";
  data: RowData[];
}) {
  const [numRows, setNumRows] = useState(INITIAL_ROWS);
  const remainingRows = data.length - numRows;

  const onShowAll = () => {
    setNumRows(data.length);
  };

  return (
    <div
      className={classNames(styles.table, {
        [styles.promotions]: type === "promotions",
        [styles.demotions]: type === "demotions",
      })}
    >
      <Title type={type} />
      {data.slice(0, numRows).map((player) => (
        <Row key={player.playerId} player={player} />
      ))}
      {remainingRows > 0 && (
        <button className={styles.showAll} onClick={onShowAll}>
          SHOW ALL ({remainingRows})
          <Image src={arrowDown} alt="expand" width={16} height={16} />
        </button>
      )}
      {data.length === 0 && <p>No Data Found</p>}
    </div>
  );
}

function Title({ type }: { type: "promotions" | "demotions" }) {
  return (
    <>
      {type === "promotions" ? (
        <div className={styles.title}>
          <div className={styles.arrow}>
            <Image
              src="/pictures/green-arrow-up.svg"
              alt="up"
              width={24}
              height={24}
            />
          </div>
          <h2>
            RECENT <span className={styles.highlight}>PROMOTIONS</span>
          </h2>
        </div>
      ) : (
        <div className={styles.title}>
          <div className={styles.arrow}>
            <Image
              src="/pictures/red-arrow-down.png"
              alt="down"
              width={24}
              height={24}
            />
          </div>
          <h2>
            RECENT <span className={styles.highlight}>DEMOTIONS</span>
          </h2>
        </div>
      )}
    </>
  );
}

function Row({ player }: { player: RowData }) {
  return (
    <div className={styles.row}>
      <Link href={`/charts?playerId=${player.playerId}`}>
        <a className={styles.name} title="go to player details">
          <span className={styles.fullName}>{player.playerName}</span>
          <span className={styles.formattedName}>
            {shorten(player.playerName)}
          </span>
        </a>
      </Link>
      <div className={styles.twoChanges}>
        {/* {player.previousPowerPlayerUnit !== player.currentPowerPlayerUnit && (
          <>
            <PowerUnitChanges
              previousPowerUnit={player.previousPowerPlayerUnit}
              currentPowerUnit={player.currentPowerPlayerUnit}
            />
            <span className={styles.colon}>:</span>
          </>
        )} */}
        <LineChanges
          previousLine={player.previousLine}
          currentLine={player.currentLine}
        />
      </div>
      <div className={styles.abbreviation}>{player.abbreviation}</div>
      <Link href={`/charts?playerId=${player.playerId}`}>
        <a className={styles.expand} title="go to player details">
          <Image
            src="/pictures/expand-icon.png"
            alt="go to player details"
            width={16}
            height={16}
          />
        </a>
      </Link>
    </div>
  );
}

type LineChangesProps = {
  previousLine: number | null;
  currentLine: number | null;
};

function LineChanges({ previousLine, currentLine }: LineChangesProps) {
  const previous = previousLine === null ? "N/A" : `L${previousLine}`;
  const current = currentLine === null ? "N/A" : `L${currentLine}`;

  return (
    <div className={classNames(styles.changes, styles.lineChanges)}>
      {previous}
      {/* the smaller the better */}
      {isPromotion(previousLine, currentLine) ? (
        <Image
          src="/pictures/arrow-right-green.png"
          alt="promote to"
          width={12}
          height={24}
        />
      ) : (
        <Image
          src="/pictures/arrow-right-red.png"
          alt="demote to"
          width={12}
          height={24}
        />
      )}
      {current}
    </div>
  );
}

type PowerUnitChangesProps = {
  previousPowerUnit: number | null;
  currentPowerUnit: number | null;
};
function PowerUnitChanges({
  previousPowerUnit,
  currentPowerUnit,
}: PowerUnitChangesProps) {
  const previous =
    previousPowerUnit === null ? "N/A" : `Pp${previousPowerUnit}`;
  const current = currentPowerUnit === null ? "N/A" : `Pp${currentPowerUnit}`;
  return (
    <div className={styles.changes}>
      {previous}
      {isPromotion(previousPowerUnit, currentPowerUnit) ? (
        <Image
          src="/pictures/arrow-right-green.png"
          alt="promote to"
          width={12}
          height={24}
        />
      ) : (
        <Image
          src="/pictures/arrow-right-red.png"
          alt="demote to"
          width={12}
          height={24}
        />
      )}
      {current}
    </div>
  );
}

/**
 * Shorten a player's name.
 * @param name player name
 * @returns First name initial. Last Name e.g. “A. Athanasiou”

 */
function shorten(name: string) {
  const names = name.split(" ");
  if (names.length === 2 && !name.includes(".")) {
    const firstNameInitial = names[0].charAt(0);
    return `${firstNameInitial}. ${names.slice(1).join(" ")}`;
  } else {
    return name;
  }
}

/**
 * Test if a player is in promotion.
 * @param previous previous line number
 * @param current current line number
 * @returns true if the player is in promotion, otherwise false
 */
function isPromotion(previous: number | null, current: number | null) {
  if (current === null) {
    return false;
  } else if (previous === null) {
    return true;
  }
  // the smaller the better
  if (current < previous) {
    return true;
  } else if (current > previous) {
    return false;
  }
}

export default Lines;
