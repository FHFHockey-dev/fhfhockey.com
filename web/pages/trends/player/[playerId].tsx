// Player trend placeholder (legacy implementation removed as part of v2 refactor).
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function PlayerTrendPage() {
  const router = useRouter();
  const { playerId } = router.query;
  const [message, setMessage] = useState("Loading player refactor placeholder...");

  useEffect(() => {
    if (playerId) {
      setMessage(
        `Refactor in progress for player #${playerId}. Upcoming: per-game predictions + rollup aggregates.`
      );
    }
  }, [playerId]);

  return (
    <div style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Player Predictions (Refactor)</h1>
      <p style={{ lineHeight: 1.5 }}>{message}</p>
      <ul style={{ marginTop: "1.5rem", fontSize: "0.9rem", opacity: 0.75 }}>
        <li>Legacy multi-horizon & candlestick visualization removed.</li>
        <li>New data source: predictions_next_game (per-game next matchup).</li>
        <li>Derived rollups (3/5/10/20) will use SQL view, not forward horizons.</li>
      </ul>
      <button
        type="button"
        onClick={() => router.push("/trends")}
        style={{ marginTop: "2rem" }}
      >
        ← Back to Trends
      </button>
    </div>
  );
}
