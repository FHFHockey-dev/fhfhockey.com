import { useRouter } from "next/router";
import Link from "next/link";
import DateRangeTeamGrid from "components/GameGrid/DateRangeTeamGrid";

export default function GameGridDateRangePage() {
  const router = useRouter();

  const start = typeof router.query.start === "string" ? router.query.start : null;
  const end = typeof router.query.end === "string" ? router.query.end : null;

  if (!start || !end) {
    return (
      <div style={{ padding: 24 }}>
        <p>Missing date range. Use the Game Grid “Date Range” button.</p>
        <Link href="/game-grid/7-Day-Forecast">Back to Game Grid</Link>
      </div>
    );
  }

  return <DateRangeTeamGrid start={start} end={end} />;
}
