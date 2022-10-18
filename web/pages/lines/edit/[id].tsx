import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import getLineCombinationsById, {
  LineCombinations,
} from "lib/NHL/getLineCombinationsById";
import PageTitle from "components/PageTitle";
import supabase from "lib/supabase";
import type { PlayerBasic } from "../[abbreviation]";
import EditPanel from "components/LineCombinations/EditPanel";

import styles from "./[id].module.scss";

type Action = InitAction | UpdateLineComboAction | UpdateSourceAction;

type InitAction = {
  type: "initialize";
  payload: LineCombinations;
};

type UpdateLineComboAction = {
  type: "lineCombo";
  category: "forwards" | "goalies" | "defensemen";
  line: 1 | 2 | 3 | 4;
  position: number;
  payload: PlayerBasic;
};

type UpdateSourceAction = {
  type: "source";
  payload: string;
};

function reducer(state: LineCombinations, action: Action) {
  switch (action.type) {
    case "initialize":
      return action.payload;
    case "lineCombo": {
      // @ts-ignore
      state[action.category][`line${action.line}`][action.position] =
        action.payload;
      break;
    }
    case "source": {
      state.source_url = action.payload;
      break;
    }
    default:
      throw new Error(`Invalid action`);
  }
}

const initialState = {
  id: 0,
  date: "",
  team_name: "",
  team_abbreviation: "",
  forwards: {
    line1: [],
    line2: [],
    line3: [],
    line4: [],
  },
  defensemen: {
    line1: [],
    line2: [],
    line3: [],
  },
  goalies: {
    line1: [],
    line2: [],
  },
  source_url: "",
};

function EditPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const [lineCombinations, setLineCombinations] = useState<LineCombinations>();

  const onSave = async (draft: LineCombinations) => {
    const { status } = await supabase
      .from("line_combinations")
      .update(draft)
      .eq("id", id);

    if (status === 404) {
      return "Permission denied";
    }
    return null;
  };

  const onDelete = async () => {
    window.alert("Not implemented");
  };

  // fetch line combo
  useEffect(() => {
    if (id)
      getLineCombinationsById(id).then((data) => {
        setLineCombinations(data);
      });
  }, [id]);

  return (
    <Container className={styles.container}>
      <PageTitle>
        {lineCombinations?.team_abbreviation} LINE{" "}
        <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
      </PageTitle>
      <EditPanel
        lineCombinations={lineCombinations ?? initialState}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Container>
  );
}

export default EditPage;
