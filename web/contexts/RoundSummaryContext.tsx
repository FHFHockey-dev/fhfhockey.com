import React, { createContext, useContext } from "react";

// Define the structure for a single round's summary data
export interface RoundSummaryValue {
  roundNumber: number;
  projectedPerGame: number | null;
  actualPerGame: number | null;
  diffPercentagePerGame: number | null;
  // Add other fields from RoundSummaryRow.fantasyPoints if needed later
}

// Create the context with a default value (undefined, or an empty array)
export const RoundSummaryContext = createContext<
  RoundSummaryValue[] | undefined
>(undefined);

// Custom hook for consuming the context, makes it easier and provides error handling
export const useRoundSummaryData = () => {
  const context = useContext(RoundSummaryContext);
  if (context === undefined) {
    throw new Error(
      "useRoundSummaryData must be used within a RoundSummaryProvider"
    );
  }
  return context;
};

// The Provider component will be used in ProjectionsPage.tsx
// No need to define it here, ProjectionsPage will use RoundSummaryContext.Provider directly.
