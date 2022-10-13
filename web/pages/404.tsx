import Head from "next/head";
import Container from "components/Layout/Container";
import { TextBanner } from "../components/Banner/Banner";

export default function Custom404() {
  return (
    <Container>
      <Head>
        <title>FHFH | Not Found</title>
      </Head>
      <TextBanner text="404 - Page Not Found" />
    </Container>
  );
}
