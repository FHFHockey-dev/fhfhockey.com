// pages/draft-dashboard.tsx

import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";

import DraftDashboard from "components/DraftDashboard/DraftDashboard";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

export default function DraftDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Head>
        <title>Draft Dashboard | Five Hole Fantasy Hockey</title>
      </Head>
      {mounted ? (
        <DraftDashboard />
      ) : (
        <div role="status" aria-live="polite">
          Loading draft dashboard…
        </div>
      )}
    </>
  );
}
