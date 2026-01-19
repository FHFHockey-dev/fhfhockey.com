import { useEffect, useMemo, useState } from "react";
import {
  loadDashboardData,
  type DashboardData,
  type DashboardDataParams
} from "lib/dashboard/dataFetchers";

export type DashboardDataState = {
  data: DashboardData | null;
  error: Error | null;
  isLoading: boolean;
};

export const useDashboardData = (
  params: DashboardDataParams
): DashboardDataState => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const key = useMemo(
    () =>
      JSON.stringify({
        date: params.date,
        skaterPosition: params.skaterPosition,
        skaterWindow: params.skaterWindow,
        skaterLimit: params.skaterLimit
      }),
    [
      params.date,
      params.skaterPosition,
      params.skaterWindow,
      params.skaterLimit
    ]
  );
  const memoParams = useMemo(() => params, [key]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadDashboardData(memoParams)
      .then((response) => {
        if (!isMounted) return;
        setData(response);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err as Error);
        setData(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [key, memoParams]);

  return { data, error, isLoading };
};
