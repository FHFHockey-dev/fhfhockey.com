import React, { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import Router from "next/router";
import { NextSeo } from "next-seo";
import { TextBanner } from "components/Banner/Banner";
import GameGrid from "components/GameGrid";
import Container from "components/Layout/Container";
import { GameGridMode } from "components/GameGrid/GameGrid";

function GameGridPage({ initialMode }: { initialMode: GameGridMode }) {
  const [mode, setMode] = useState<GameGridMode>(initialMode ?? "basic");
  useEffect(() => {
    Router.replace({
      query: {
        ...Router.query,
        mode,
      },
    });
  }, [mode]);

  return (
    <Container>
      <NextSeo
        title="FHFH | Game Grid"
        description="Five Hole Fantasy Hockey Podcast Game Grid."
      />

      <TextBanner text="Game Grid" />
      <button
        onClick={() => {
          setMode(mode === "basic" ? "extended" : "basic");
        }}
      >
        mode: {mode}
      </button>
      <div style={{ marginTop: "20px", width: "100%" }}>
        <GameGrid mode={mode} />
      </div>
      <div style={{ marginBottom: "30px" }} />
    </Container>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  return {
    props: {
      initialMode: query.mode ?? "basic",
    },
  };
};

export default GameGridPage;