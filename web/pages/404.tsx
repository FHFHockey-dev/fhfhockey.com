import Head from "next/head";
import { TextBanner } from "../components/Banner/Banner";

export default function Custom404() {
  return (
    <div>
      <Head>
        <title>FHFH | Not Found</title>
      </Head>
      <TextBanner text="404 - Page Not Found" />
    </div>
  );
}
