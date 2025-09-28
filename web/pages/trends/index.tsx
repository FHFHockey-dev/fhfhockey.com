// Minimal placeholder for TrendsIndexPage after surgical deletion.
// v2 pipeline will provide next-game predictions via predictions_next_game.
// TODO: Re-implement leaderboard and metrics once v2 data population is ready.

import { useEffect, useState } from "react";

export default function TrendsIndexPage() {
  const [message, setMessage] = useState("Initializing predictions v2...");

  useEffect(() => {
    setMessage("Predictions v2 refactor in progress. UI temporarily minimized.");
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Player Predictions (Refactor)</h1>
      <p style={{ lineHeight: 1.5 }}>{message}</p>
      <p style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.7 }}>
        Legacy multi-horizon UI removed. This placeholder will be replaced with
        the streamlined next-game + rollup view once the new pipeline is live.
      </p>
    </div>
  );
}
