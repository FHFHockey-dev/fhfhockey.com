// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\game-grid\[mode].tsx

import React, { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import Router from "next/router";
import { NextSeo } from "next-seo";
import GameGrid from "components/GameGrid";
import Container from "components/Layout/Container";
import SurfaceWorkflowLinks from "components/SurfaceWorkflowLinks";

import { GameGridMode } from "components/GameGrid/GameGrid";
import { GAME_GRID_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";

function GameGridPage({ initialMode }: { initialMode: GameGridMode }) {
  const MODE_TO_LABEL = {
    "7-Day-Forecast": "7-Day",
    "10-Day-Forecast": "10-Day",
  } as const;

  const [mode, setMode] = useState<GameGridMode>(
    initialMode ?? "7-Day-Forecast",
  );

  useEffect(() => {
    Router.replace({
      query: {
        ...Router.query,
        mode,
      },
    });
  }, [mode]);

  return (
    <Container contentVariant="full">
      <NextSeo
        title="FHFH | Game Grid"
        description="Five Hole Fantasy Hockey Podcast Game Grid."
      />

      <div style={{ marginTop: "0px", width: "100%" }}>
        <button
          style={{ display: "none" }}
          onClick={() => {
            setMode(
              mode === "7-Day-Forecast" ? "10-Day-Forecast" : "7-Day-Forecast",
            );
          }}
        >
          {MODE_TO_LABEL[mode]}
        </button>
        <GameGrid mode={mode} setMode={setMode} />
      </div>
      <SurfaceWorkflowLinks
        eyebrow="Keep exploring"
        title="Carry the schedule edge into the next decision"
        description="Connect weekly volume and opponents to recent form, deployment, and goalie reliability."
        links={GAME_GRID_SURFACE_LINKS}
      />
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
