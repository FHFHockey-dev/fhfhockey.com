import React, { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/router";

import Container from "components/Layout/Container";
import getLineCombinationsById, {
  LineCombinations,
} from "lib/NHL/getLineCombinationsById";
import PageTitle from "components/PageTitle";
import Line from "components/LineCombinations/Line";
import CategoryTitle from "components/LineCombinations/CategoryTitle";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import Spinner from "components/Spinner";
import supabase from "lib/supabase";
import formatDate from "utils/formatDate";
import type { PlayerBasic } from "../[abbreviation]";

import styles from "./[id].module.scss";
import { useImmerReducer } from "use-immer";
import signInWithGitHub from "lib/supabase/signInWithGitHub";
import { PostgrestError } from "@supabase/supabase-js";
import { Alert, IconButton, Snackbar } from "@mui/material";
import ClientOnly from "components/ClientOnly";
import Link from "next/link";

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
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // @ts-ignore
  const [draft, dispatch] = useImmerReducer(reducer, initialState);

  const onSave = async () => {
    setSubmitting(true);
    const { status } = await supabase
      .from("line_combinations")
      .update(draft)
      .eq("id", id);

    setOpen(true);
    if (status === 404) {
      setError("Permission denied");
    }
    setSubmitting(false);
  };

  const onDelete = async () => {
    window.alert("Not implemented");
  };

  // fetch line combo
  useEffect(() => {
    if (id)
      getLineCombinationsById(id).then((data) => {
        setLineCombinations(data);
        dispatch({ type: "initialize", payload: data });
      });
  }, [id, dispatch]);

  // snackbar
  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };

  return (
    <Container className={styles.container}>
      <PageTitle>
        {lineCombinations?.team_abbreviation} LINE{" "}
        <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
      </PageTitle>
      <div className={styles.top}>
        <div className={styles.user}>
          <ClientOnly>
            {supabase.auth.user() ? (
              <>
                Hello,{" "}
                <Link href="/auth">
                  <a
                    style={{
                      fontStyle: "italic",
                      opacity: 0.8,
                    }}
                  >
                    {supabase.auth.user()?.user_metadata["preferred_username"]}
                  </a>
                </Link>
              </>
            ) : (
              <p>
                Please{" "}
                <Link href="/auth">
                  <a>login</a>
                </Link>
              </p>
            )}
          </ClientOnly>
        </div>

        <div className={styles.time}>
          <span>Created at:</span>{" "}
          {lineCombinations?.date && formatDate(lineCombinations?.date)}
        </div>
      </div>
      <div className={styles.mainContent}>
        <section className={styles.forwards}>
          <CategoryTitle type="large" className={styles.categoryTitle}>
            FORWARDS
          </CategoryTitle>
          <Line className={styles.line} title="LINE 1" columns={3}>
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.forwards.line1[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "forwards",
                        line: 1,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="LINE 2" columns={3}>
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.forwards.line2[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "forwards",
                        line: 2,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="LINE 3" columns={3}>
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.forwards.line3[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "forwards",
                        line: 3,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="LINE 4" columns={3}>
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.forwards.line4[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "forwards",
                        line: 4,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>

          <div className={styles.sourceUrl}>
            <label htmlFor="hyperlink">HYPERLINK: </label>
            <input
              id="hyperlink"
              type="text"
              spellCheck={false}
              value={draft.source_url}
              onChange={(e) => {
                dispatch({ type: "source", payload: e.target.value });
              }}
            />
          </div>
        </section>

        <section className={styles.defenseAndGoalies}>
          <CategoryTitle type="large" className={styles.categoryTitle}>
            DEFENSE & GOALIES
          </CategoryTitle>
          <Line className={styles.line} title="1ST PAIR" columns={2}>
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.defensemen.line1[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "defensemen",
                        line: 1,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="2ND PAIR" columns={2}>
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.defensemen.line2[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "defensemen",
                        line: 2,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="3RD PAIR" columns={2}>
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <PlayerAutocomplete
                  showButton={false}
                  key={i}
                  playerId={lineCombinations?.defensemen.line3[i]?.playerId}
                  onPlayerChange={(player) => {
                    if (player)
                      dispatch({
                        type: "lineCombo",
                        category: "defensemen",
                        line: 3,
                        position: i,
                        payload: {
                          playerId: player.id,
                          playerName: player.fullName,
                        },
                      });
                  }}
                />
              ))}
          </Line>
          <Line className={styles.line} title="GOALIES" columns={2}>
            <PlayerAutocomplete
              showButton={false}
              playerId={lineCombinations?.goalies.line1[0]?.playerId}
              onPlayerChange={(player) => {
                if (player)
                  dispatch({
                    type: "lineCombo",
                    category: "goalies",
                    line: 1,
                    position: 0,
                    payload: {
                      playerId: player.id,
                      playerName: player.fullName,
                    },
                  });
              }}
            />

            <PlayerAutocomplete
              showButton={false}
              playerId={lineCombinations?.goalies.line2[0]?.playerId}
              onPlayerChange={(player) => {
                if (player)
                  dispatch({
                    type: "lineCombo",
                    category: "goalies",
                    line: 2,
                    position: 0,
                    payload: {
                      playerId: player.id,
                      playerName: player.fullName,
                    },
                  });
              }}
            />
          </Line>
          <div className={styles.action}>
            <button onClick={onSave}>SAVE</button>
            <button className={styles.delete} onClick={onDelete}>
              DELETE
            </button>
            {submitting && <Spinner />}
          </div>
        </section>
      </div>

      <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
        {error ? (
          <Alert severity="error">
            Unable to update the line combination. {error}
          </Alert>
        ) : (
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {`Successfully updated the line combination for '${lineCombinations?.team_name}'!`}
          </Alert>
        )}
      </Snackbar>
    </Container>
  );
}

export default EditPage;
