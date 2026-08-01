import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DASHBOARD_SECTIONS,
  loadTrendsDashboardData,
  mergeDashboardSections,
  type DashboardData,
  type DashboardDataParams,
  type DashboardSection
} from "lib/dashboard/dataFetchers";

export type DashboardDataState = {
  data: DashboardData | null;
  error: Error | null;
  isLoading: boolean;
  loadingSections: DashboardSection[];
  sectionErrors: DashboardData["sectionErrors"];
  retrySection: (section: DashboardSection) => void;
};

export const useDashboardData = (
  params: DashboardDataParams
): DashboardDataState => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loadingSections, setLoadingSections] = useState<DashboardSection[]>([]);
  const dataRef = useRef<DashboardData | null>(null);
  const requestEpochRef = useRef(0);

  const memoParams = useMemo<DashboardDataParams>(
    () => ({
      date: params.date,
      skaterPosition: params.skaterPosition,
      skaterWindow: params.skaterWindow,
      skaterLimit: params.skaterLimit,
      sustainabilityWindow: params.sustainabilityWindow,
      sustainabilityLimit: params.sustainabilityLimit
    }),
    [
      params.date,
      params.skaterPosition,
      params.skaterWindow,
      params.skaterLimit,
      params.sustainabilityWindow,
      params.sustainabilityLimit
    ]
  );
  const loadSections = useCallback(
    (sections: DashboardSection[], epoch: number) => {
      setLoadingSections((current) => [
        ...new Set([...current, ...sections])
      ]);
      setError(null);

      loadTrendsDashboardData(memoParams, {
        sections,
        base: dataRef.current
      })
        .then((response) => {
          if (requestEpochRef.current !== epoch) return;
          setData((current) => {
            const merged = mergeDashboardSections(current, response, sections);
            dataRef.current = merged;
            return merged;
          });
        })
        .catch((err) => {
          if (requestEpochRef.current !== epoch) return;
          setError(err as Error);
        })
        .finally(() => {
          if (requestEpochRef.current !== epoch) return;
          setLoadingSections((current) =>
            current.filter((section) => !sections.includes(section))
          );
        });
    },
    [memoParams]
  );

  useEffect(() => {
    const epoch = requestEpochRef.current + 1;
    requestEpochRef.current = epoch;
    setError(null);
    DASHBOARD_SECTIONS.forEach((section) => loadSections([section], epoch));
  }, [loadSections]);

  const retrySection = useCallback(
    (section: DashboardSection) => {
      loadSections([section], requestEpochRef.current);
    },
    [loadSections]
  );

  return {
    data,
    error,
    isLoading: loadingSections.length > 0,
    loadingSections,
    sectionErrors: data?.sectionErrors ?? {},
    retrySection
  };
};
