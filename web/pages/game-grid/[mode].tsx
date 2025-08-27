// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\game-grid\[mode].tsx

import React, { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import Router from "next/router";
import { NextSeo } from "next-seo";
import GameGrid from "components/GameGrid";
import Container from "components/Layout/Container";
import { GameGridMode } from "components/GameGrid/GameGrid";

function GameGridPage({ initialMode }: { initialMode: GameGridMode }) {
  const MODE_TO_LABEL = {
    "7-Day-Forecast": "7-Day",
    "10-Day-Forecast": "10-Day"
  } as const;

  const [mode, setMode] = useState<GameGridMode>(
    initialMode ?? "7-Day-Forecast"
  );
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal"
  );
  useEffect(() => {
    Router.replace({
      query: {
        ...Router.query,
        mode
      }
    });
  }, [mode]);

  return (
    <Container>
      <NextSeo
        title="FHFH | Game Grid"
        description="Five Hole Fantasy Hockey Podcast Game Grid."
      />

      <div style={{ marginTop: "0px", width: "100%" }}>
        <button
          style={{ display: "none" }}
          onClick={() => {
            setMode(
              mode === "7-Day-Forecast" ? "10-Day-Forecast" : "7-Day-Forecast"
            );
          }}
        >
          {MODE_TO_LABEL[mode]}
        </button>
        <GameGrid
          mode={mode}
          setMode={setMode}
          orientation={orientation}
          setOrientation={setOrientation}
        />
      </div>
      <div style={{ marginBottom: "30px" }} />
    </Container>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const mode =
    query.mode === "10-Day-Forecast" ? "10-Day-Forecast" : "7-Day-Forecast";
  return { props: { initialMode: mode } };
};

export default GameGridPage;
