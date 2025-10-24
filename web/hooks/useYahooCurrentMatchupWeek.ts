import { useEffect, useState } from "react";
import { format } from "date-fns";
import supabase from "lib/supabase";

type YahooMatchupWeek = {
  week: number;
  start_date: string;
  end_date: string;
};

type DateRange = {
  start: string;
  end: string;
};

export type CurrentMatchupWeekState = {
  weekNumber: number | null;
  dateRange: DateRange | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Fetches the current Yahoo matchup week for the provided season.
 * The lookup uses the user's local date (based on the browser timezone) and
 * returns the week whose start/end dates contain today's date (inclusive).
 */
export default function useYahooCurrentMatchupWeek(
  season: string | null
): CurrentMatchupWeekState {
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!season) {
      setWeekNumber(null);
      setDateRange(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadWeek = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const todayLocal = format(new Date(), "yyyy-MM-dd");
        const { data, error: queryError } = await supabase
          .from("yahoo_matchup_weeks")
          .select("week,start_date,end_date")
          .eq("season", season)
          .lte("start_date", todayLocal)
          .gte("end_date", todayLocal)
          .order("week", { ascending: true })
          .limit(1)
          .maybeSingle<YahooMatchupWeek>();

        if (isCancelled) return;

        if (queryError) {
          throw queryError;
        }

        if (!data) {
          setWeekNumber(null);
          setDateRange(null);
          return;
        }

        setWeekNumber(data.week);
        setDateRange({ start: data.start_date, end: data.end_date });
      } catch (err: any) {
        if (isCancelled) return;
        setWeekNumber(null);
        setDateRange(null);
        setError(err?.message ?? "Failed to load matchup week");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadWeek();

    return () => {
      isCancelled = true;
    };
  }, [season]);

  return {
    weekNumber,
    dateRange,
    isLoading,
    error
  };
}
