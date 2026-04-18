import SkaterLeaderboard from "./SkaterLeaderboard";
import type {
  SkaterGameRow,
  SkaterWeek,
  YahooSkaterRow
} from "./skaterTypes";

interface SkaterListProps {
  seasonId: number | null;
  gameRows: SkaterGameRow[];
  yahooRows: YahooSkaterRow[];
  matchupWeeks: SkaterWeek[];
}

export default function SkaterList(props: SkaterListProps) {
  return <SkaterLeaderboard {...props} />;
}

