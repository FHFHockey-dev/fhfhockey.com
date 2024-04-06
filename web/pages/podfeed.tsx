import React from "react";
import { NextSeo } from "next-seo";

import { TextBanner } from "../components/Banner/Banner";
import Container from "components/Layout/Container";

import styles from "styles/Podfeed.module.scss";

function Podfeed() {
  return (
    <Container>
      <NextSeo
        title="FHFH | Library"
        description="Five Hole Fantasy Hockey Podcast Podcast Feed."
      />

      <TextBanner text="FHFH Library" />

      <div className={styles.podbeanWrapper}>
        <iframe
          src="https://podcasters.spotify.com/pod/show/fhfhockey/embed"
          height="100%"
          width="100%"
          scrolling="no"
        ></iframe>
      </div>

      <div style={{ marginBottom: "30px" }} />
    </Container>
  );
}

export default Podfeed;
