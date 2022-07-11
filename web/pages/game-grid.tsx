import Head from "next/head";
import React from "react";
import { TextBanner } from "../components/Banner/Banner";

function GameGrid() {
  return (
    <div>
      <Head>
        <title>FHFH | Game Grid</title>
        <meta
          name="description"
          content="Five Hole Fantasy Hockey Podcast Game Grid."
        />
      </Head>

      <TextBanner text="Game Grid" />

      <div style={{ marginTop: "20px", paddingRight: "8px" }}>
        <iframe
          title="Game Gird"
          src="https://nhl-game-grid.netlify.app/game-grid"
          height={2000}
          width="100%"
          seamless={true}
          style={{ border: "none" }}
        />
      </div>
      <div style={{ marginBottom: "30px" }} />
    </div>
  );
}

export default GameGrid;
