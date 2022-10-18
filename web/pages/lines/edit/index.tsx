import React, { useEffect, useState } from "react";
import Link from "next/link";
import { compareDesc } from "date-fns";

import { Button } from "@mui/material";
import Container from "components/Layout/Container";
import { fetchNHL } from "lib/NHL/NHL_API";
import supabase from "lib/supabase";
import type { Team } from "..";
import PageTitle from "components/PageTitle";

import styles from "./index.module.scss";

type LineUpPreview = {
  id: number;
  date: string;
  team_name: string;
  team_abbreviation: string;
};

function LandingPage() {
  const [lineUps, setLineUps] = useState<[LineUpPreview, LineUpPreview][]>([]);

  useEffect(() => {
    (async () => {
      const lineUps = await getLineUps();
      setLineUps(lineUps);
    })();
  }, []);

  return (
    <Container className={styles.container}>
      <PageTitle>
        NHL LINE <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
      </PageTitle>

      <Link href="create">
        <Button variant="contained" size="large">
          Create
        </Button>
      </Link>

      {lineUps.map((lineup) => (
        <Row
          key={lineup[0].team_name}
          current={lineup[0]}
          previous={lineup[1]}
        />
      ))}
    </Container>
  );
}

function Row({
  current,
  previous,
}: {
  current: LineUpPreview;
  previous: LineUpPreview;
}) {
  return (
    <div className={styles.row}>
      <h2 id={current.team_abbreviation}>
        <Link href={`edit#${current.team_abbreviation}`}>
          <a>
            {current.team_name} ({current.team_abbreviation})
          </a>
        </Link>
      </h2>
      <ul>
        <li>
          <Link href={`edit/${current.id}`}>
            <a> date: {current.date}</a>
          </Link>
        </li>
        <li>
          <Link href={`edit/${previous.id}`}>
            <a> date: {previous.date}</a>
          </Link>
        </li>
      </ul>
    </div>
  );
}

async function getLineUps() {
  const teams: Team[] = ((await fetchNHL("/teams")).teams as any[])
    .map((team) => ({
      name: team.name,
      abbreviation: team.abbreviation,
      logo: "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const allTeamLineUps = (
    await Promise.all(
      teams.map(async (team) => {
        const { data: line_combinations } = await supabase
          .from("line_combinations")
          .select("id, date, team_name, team_abbreviation")
          .eq("team_name", team.name)
          .order("date", { ascending: false })
          .limit(2);
        return line_combinations;
      })
    )
  ).filter((el) => el?.length === 2) as [any, any][];

  // sort by date, display most recent at the top
  allTeamLineUps.sort((a, b) =>
    compareDesc(new Date(a[0].date), new Date(b[0].date))
  );

  return allTeamLineUps;
}

export default LandingPage;
