import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import RankingsPage from "pages/rankings";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function App() {
  const [query, setQuery] = useState(Object.fromEntries(new URLSearchParams(location.search)));
  const router = { isReady: true, pathname: "/rankings", query, replace: async ({ query: next }: any) => {
    history.replaceState({}, "", "/rankings?" + new URLSearchParams(next));
    setQuery(next);
    return true;
  }};
  return <RouterContext.Provider value={router as any}><QueryClientProvider client={queryClient}>
    <RankingsPage />
  </QueryClientProvider></RouterContext.Provider>;
}
performance.mark("mount");
createRoot(document.getElementById("root")!).render(<App />);
