import React from "react";
import { NextSeo } from "next-seo";
import { TextBanner } from "../components/Banner/Banner";
import GameGrid from "components/GameGrid";
import Container from "components/Layout/Container";

function GameGridPage() {
  return (
    <Container>
      <NextSeo
        title="FHFH | Game Grid"
        description="Five Hole Fantasy Hockey Podcast Game Grid."
      />

      <TextBanner text="Game Grid" />

      <div style={{ marginTop: "20px", width: "100%"}}>
        <GameGrid />
      </div>
      <div style={{ marginBottom: "30px" }} />
    </Container>
  );
}

export default GameGridPage;
