import Head from "next/head";
import Link from "next/link";
import React from "react";
import { TextBanner } from "./components/Banner/Banner";

function GameGrid() {
  return (
    <div>
      <Head>
        <title>FHFH | Game Grid</title>
      </Head>

      <TextBanner text="Game Grid" />

      <Link href="/">
        <button>Go Home</button>
      </Link>
    </div>
  );
}

export default GameGrid;
