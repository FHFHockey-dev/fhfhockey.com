import React from "react";
import Head from "next/head";
import Link from "next/link";
import { TextBanner } from "./components/Banner/Banner";

function Charts() {
  return (
    <div>
      <Head>
        <title>FHFH | Charts</title>
      </Head>
      <TextBanner text="FHFH Charts" />

      <Link href="/">
        <button>Go Home</button>
      </Link>
    </div>
  );
}

export default Charts;
