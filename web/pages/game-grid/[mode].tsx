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
        title="NHL Schedule & Fantasy Hockey Game Grid | FHFH"
        description="Compare NHL team schedules, off-night games, and upcoming matchups to plan your fantasy hockey lineup and waiver pickups."
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
      <div style={{ marginBottom: "30px" }} />
    </Container>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const mode = params?.mode;
  if (mode !== "7-Day-Forecast" && mode !== "10-Day-Forecast") {
    return { notFound: true };
  }
  return { props: { initialMode: mode } };
};

export default GameGridPage;
