import React from "react";
import Head from "next/head";
import Image from "next/image";
import { GetStaticProps } from "next";
import Link from "next/link";
import classNames from "classnames";

import supabase from "lib/supabase";
import { fetchNHL } from "lib/NHL/NHL_API";
import { getTeamLogo } from "hooks/usePlayer";

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
      <Teams teams={teams} />
      <Players promotions={promotions} demotions={demotions} />
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  let { data: line_combinations, error } = await supabase.from(
    "line_combinations"
  );
  console.log(line_combinations);
  const teams: Team[] = ((await fetchNHL("/teams")).teams as any[]).map(
    (team) => ({
      name: team.name,
      abbreviation: team.abbreviation,
      logo: getTeamLogo(team.name),
    })
  );

  return {
    props: {
      teams,
      promotions: [],
      demotions: [],
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

function Table({
  type,
  data,
}: {
  type: "promotions" | "demotions";
  data: RowData[];
}) {
  return (
    <div
      className={classNames(styles.table, {
        [styles.promotions]: type === "promotions",
        [styles.demotions]: type === "demotions",
      })}
    >
      <Title type={type} />
      {data.map((player) => (
        <div key={player.playerId} className={styles.row}>
          <div>{player.playerName}</div>
          <div>
            {player.previousLine} x {player.currentLine}
          </div>
          <div>{player.abbreviation}</div>
          <button
            className={styles.arrowButton}
            type="button"
            title="go to player details"
          >
            <Image
              src="/pictures/"
              alt="go to player details"
              width={16}
              height={16}
            />
          </button>
        </div>
      ))}
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

export default Lines;
