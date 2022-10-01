import React, { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { GetStaticProps } from "next";
import Link from "next/link";
import classNames from "classnames";

import supabase from "lib/supabase";
import { fetchNHL } from "lib/NHL/NHL_API";
import { getTeamLogo } from "hooks/usePlayer";
import PageTitle from "components/PageTitle";

import arrowDown from "public/pictures/arrow-down-white.png";

import styles from "styles/Lines.module.scss";

type Team = {
  logo: string;
  name: string;
  abbreviation: string;
};

type RowData = {
  playerId: number;
  playerName: string;
  previousLine: number;
  currentLine: number;
  previousPowerPlayerUnit: number;
  currentPowerPlayerUnit: number;
  /**
   * Team abbreviation
   */
  abbreviation: string;
};

type LandingPageProps = {
  teams: Team[];
  promotions: RowData[];
  demotions: RowData[];
};

function Lines({ teams, promotions, demotions }: LandingPageProps) {
  return (
    <div className={styles.lineCombinations}>
      <Head>
        <title>FHFH | Line Combinations</title>
      </Head>
      <PageTitle>
        NHL LINE <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
      </PageTitle>
      <Teams teams={teams} />
      <Players promotions={promotions} demotions={demotions} />
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  // let { data: line_combinations, error } = await supabase.from(
  //   "line_combinations"
  // );
  const teams: Team[] = ((await fetchNHL("/teams")).teams as any[])
    .map((team) => ({
      name: team.name,
      abbreviation: team.abbreviation,
      logo: getTeamLogo(team.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const promotions: RowData[] = [
    {
      playerName: "Sidney Crosby",
      playerId: 8471675,
      currentLine: 1,
      previousLine: 2,
      abbreviation: "PIT",
      currentPowerPlayerUnit: 1,
      previousPowerPlayerUnit: 2,
    },
    {
      playerName: "T.J. Oshie",
      playerId: 8475810,
      currentLine: 1,
      previousLine: 3,
      abbreviation: "PIT",
      currentPowerPlayerUnit: 2,
      previousPowerPlayerUnit: 2,
    },
    {
      playerName: "Brayden Point",
      playerId: 8478010,
      currentLine: 1,
      previousLine: 1,
      abbreviation: "TBL",
      currentPowerPlayerUnit: 1,
      previousPowerPlayerUnit: 1,
    },
  ];

  const demotions: RowData[] = [
    {
      playerName: "Jeff Skinner",
      playerId: 8475784,
      currentLine: 2,
      previousLine: 1,
      abbreviation: "BUF",
      currentPowerPlayerUnit: 1,
      previousPowerPlayerUnit: 1,
    },
    {
      playerName: "Andreas Athanasioulonglong",
      playerId: 8476960,
      currentLine: 3,
      previousLine: 1,
      abbreviation: "CHI",
      currentPowerPlayerUnit: 1,
      previousPowerPlayerUnit: 2,
    },
  ];

  return {
    props: {
      teams,
      promotions,
      demotions,
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
}: {
  promotions: RowData[];
  demotions: RowData[];
}) {
  return (
    <section className={styles.players}>
      <p className={styles.time}>Updated: 2h ago</p>
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
          <Image
            src={arrowDown}
            alt="expand"
            placeholder="blur"
            width={16}
            height={16}
          />
        </button>
      )}
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
        {player.previousPowerPlayerUnit !== player.currentPowerPlayerUnit && (
          <>
            <PowerUnitChanges
              previousPowerUnit={player.previousPowerPlayerUnit}
              currentPowerUnit={player.currentPowerPlayerUnit}
            />
            <span className={styles.colon}>:</span>
          </>
        )}
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
  previousLine: number;
  currentLine: number;
};

function LineChanges({ previousLine, currentLine }: LineChangesProps) {
  return (
    <div className={classNames(styles.changes, styles.lineChanges)}>
      L{previousLine}
      {/* the smaller the better */}
      {previousLine > currentLine ? (
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
      L{currentLine}
    </div>
  );
}

type PowerUnitChangesProps = {
  previousPowerUnit: number;
  currentPowerUnit: number;
};
function PowerUnitChanges({
  previousPowerUnit,
  currentPowerUnit,
}: PowerUnitChangesProps) {
  return (
    <div className={styles.changes}>
      Pp{previousPowerUnit}{" "}
      {previousPowerUnit > currentPowerUnit ? (
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
      Pp{currentPowerUnit}
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
    return `${firstNameInitial}. ${names.slice(1)}`;
  } else {
    return name;
  }
}

export default Lines;
