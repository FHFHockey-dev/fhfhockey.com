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
      <main>
        <TextBanner text="FHFH Charts" />

        <Link href="/">
          <button>Go Home</button>
        </Link>
      </main>
    </div>
  );
}

export default Charts;
