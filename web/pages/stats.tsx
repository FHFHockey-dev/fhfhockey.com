import Head from "next/head";
import Link from "next/link";
import React from "react";
import { TextBanner } from "./components/Banner/Banner";

function Stats() {
  return (
    <div>
      <Head>
        <title>FHFH | Stat Catalogue</title>
      </Head>
      <TextBanner text="Stat Catalogue" />

      <Link href="/">
        <button>Go Home</button>
      </Link>
    </div>
  );
}

export default Stats;
