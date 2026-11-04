// WiGO data changes about once a night (writer 08:50 UTC, NST after 10:05), so
// its queries stay fresh for 30 minutes and do not refetch when the tab regains
// focus. Scoped to WiGO rather than _app.tsx, which serves every page (S2).
export const WIGO_QUERY_DEFAULTS = {
  staleTime: 30 * 60_000,
  refetchOnWindowFocus: false
} as const;
