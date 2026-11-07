import type { NextPage } from "next";
import Head from "next/head";

import AdminPageGate from "components/Admin/AdminPageGate";
import BeatReporterReview from "components/BeatReporterReview/BeatReporterReview";

const BeatReporterReviewPage: NextPage = () => (
  <AdminPageGate>
    <Head>
      <title>Beat Reporter Review | FHFH</title>
    </Head>
    <BeatReporterReview />
  </AdminPageGate>
);

export default BeatReporterReviewPage;
