import Head from "next/head";
import Link from "next/link";
import React from "react";
import { TextBanner } from "./components/Banner/Banner";

function Lines() {
  return (
    <div>
      <Head>
        <title>FHFH | Line Combinations</title>
      </Head>
      <TextBanner text="Line Combinations" />

      <Link href="/">
        <button>Go Home</button>
      </Link>
    </div>
  );
}

export default Lines;
