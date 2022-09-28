import React from "react";
import { NextSeo } from "next-seo";
import { TextBanner } from "../components/Banner/Banner";
import GameGrid from "components/GameGrid";

function GameGridPage() {
  return (
    <div>
      <NextSeo
        title="FHFH | Game Grid"
        description="Five Hole Fantasy Hockey Podcast Game Grid."
      />

      <TextBanner text="Game Grid" />

      <div style={{ marginTop: "20px", paddingRight: "8px" }}>
        <GameGrid />
      </div>
      <div style={{ marginBottom: "30px" }} />
    </div>
  );
}

export default GameGridPage;
