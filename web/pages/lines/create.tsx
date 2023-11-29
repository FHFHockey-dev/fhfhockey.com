import React, { useEffect, useState } from "react";
import type { GetStaticProps } from "next";

import Container from "components/Layout/Container";
import PageTitle from "components/PageTitle";
import Select from "components/Select";
import EditPanel from "components/LineCombinations/EditPanel";
import { initialState } from "components/LineCombinations/EditPanel/EditPanel";

import styles from "./Create.module.scss";
import { LineCombinations } from "lib/NHL/getLineCombinationsById";
import supabase from "lib/supabase";
import { Team } from "lib/NHL/types";
import { getTeams } from "lib/NHL/server";

type Props = {
  teams: Team[];
};

function CreatePage({ teams }: Props) {
  const [team, setTeam] = useState<Team>();
  const onTeamChange = (abbreviation: string) => {
    setTeam(teams.find((t) => t.abbreviation === abbreviation));
  };

  // Select the first team by default
  useEffect(() => {
    setTeam(teams[0]);
  }, [teams]);

  const onSave = async (draft: LineCombinations) => {
    if (!team) return "Please select a team";
    const lineup: LineCombinations = {
      ...draft,
      team_name: team.name,
      team_abbreviation: team.abbreviation,
      date: new Date().toISOString(),
    };

    const { error } = await supabase.from("line_combinations").insert(lineup);
    return error?.message || null;
  };

  return (
    <Container className={styles.container}>
      <div className={styles.top}>
        <PageTitle>
          CREATE LINE <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
        </PageTitle>
        <Select
          className={styles.select}
          option={team ? team.abbreviation : teams[0].abbreviation}
          options={teams.map((team) => ({
            label: team.name,
            value: team.abbreviation,
          }))}
          onOptionChange={onTeamChange}
        />
      </div>
      <EditPanel lineCombinations={initialState} onSave={onSave} />
    </Container>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  // for Team Select
  const teams: Team[] = (await getTeams()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    props: { teams },
  };
};

export default CreatePage;
