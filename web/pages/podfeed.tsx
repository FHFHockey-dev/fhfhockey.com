import Head from "next/head";
import Link from "next/link";
import React from "react";
import { TextBanner } from "./components/Banner/Banner";

function Podfeed() {
  return (
    <div>
      <Head>
        <title>FHFH | Library</title>
      </Head>
      <main>
        <TextBanner text="FHFH Library" />

        <Link href="/">
          <button>Go Home</button>
        </Link>
      </main>
    </div>
  );
}

export default Podfeed;
