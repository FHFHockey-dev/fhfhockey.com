import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useImmerReducer } from "use-immer";
import { Alert, Snackbar } from "@mui/material";

import ClientOnly from "components/ClientOnly";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import Spinner from "components/Spinner";
import { useUser } from "contexts/AuthProviderContext";
import type { LineCombinations } from "lib/NHL/getLineCombinationsById";
import { PlayerBasic } from "pages/lines/[abbreviation]";
import formatDate from "utils/formatDate";
import CategoryTitle from "../CategoryTitle";
import Line from "../Line";

import styles from "./EditPanel.module.scss";

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

export const initialState = {
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

type Props = {
  lineCombinations: LineCombinations;
  /**
   * Return an error message if failed to save the data, otherwise null.
   */
  onSave?: (lineCombinations: LineCombinations) => Promise<string | null>;
  onDelete?: (id: number) => Promise<void>;
};

function EditPanel({
  lineCombinations,
  onSave = async () => null,
  onDelete = async () => {},
}: Props) {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // @ts-ignore
  const [draft, dispatch] = useImmerReducer(reducer, initialState);

  // populate the draft
  useEffect(() => {
    dispatch({ type: "initialize", payload: lineCombinations });
  }, [lineCombinations, dispatch]);

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

  const onSaveClick = async () => {
    setSubmitting(true);
    const error = await onSave(draft);
    setError(error);
    setSubmitting(false);
    setOpen(true);
  };

  const onDeleteClick = async () => {
    if (lineCombinations.id) {
      setSubmitting(true);
      await onDelete(lineCombinations.id);
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.top}>
        <div className={styles.user}>
          <ClientOnly>
            {user ? (
              <>
                Hello,{" "}
                <Link href="/auth">
                  <a
                    style={{
                      fontStyle: "italic",
                      opacity: 0.8,
                    }}
                  >
                    {user.name}
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
            <button onClick={onSaveClick}>SAVE</button>
            <button className={styles.delete} onClick={onDeleteClick}>
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
    </section>
  );
}

export default EditPanel;
