import React from "react";
import { NextSeo } from "next-seo";
import TeamStatsComponent from "components/teamLandingPage/teamLandingPage";

import TeamStatCard from "../components/TeamStatCard";
import styles from "../styles/Stats.module.scss";
import Container from "components/Layout/Container";
import { getTeams } from "lib/NHL/server";

type Team = {
  abbreviation: string;
  name: string;
};
type StatsProps = {
  teams: Team[];
};
function Stats({ teams }: StatsProps) {
  return (
    <Container>
      <NextSeo
        title="FHFH | Stat Catalogue"
        description="Five Hole Fantasy Hockey Podcast Stats for all teams in NHL."
      />

      <TeamStatsComponent />
    </Container>
  );
}

export async function getStaticProps() {
  const teams = await getTeams();

  // sort the teams in alphabetical order
  teams.sort((a, b) => a.name.localeCompare(b.name));

  return {
    props: {
      teams,
    },
  };
}

export default Stats;
