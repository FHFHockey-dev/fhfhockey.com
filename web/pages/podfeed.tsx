import Head from "next/head";
import React from "react";
import { TextBanner } from "./components/Banner/Banner";

function Podfeed() {
  return (
    <div>
      <Head>
        <title>FHFH | Library</title>
      </Head>
      <TextBanner text="FHFH Library" />

      <div style={{ paddingRight: "8px" }}>
        <iframe
          title="Five Hole Fantasy Hockey"
          allowTransparency={true}
          height={515}
          width="100%"
          style={{
            border: "5px solid white",
            borderRadius: "8px",
          }}
          scrolling="no"
          data-name="pb-iframe-player"
          src="https://www.podbean.com/player-v2/?i=97hve-b3a8a6-pbblog-playlist&share=1&download=1&rtl=0&fonts=Arial&skin=2&order=episodic&limit=10&filter=all&ss=a713390a017602015775e868a2cf26b0&btn-skin=4&size=315"
          allowFullScreen
        />
      </div>

      <div style={{ marginBottom: "30px" }} />
    </div>
  );
}

export default Podfeed;
