import { useState, useEffect } from "react";
import { fetchCurrentSeason, SeasonInfo } from "utils/fetchCurrentSeason";

interface OffseasonInfo {
  isOffseason: boolean;
  isLoading: boolean;
  nextSeasonStartDate?: string;
  previousSeasonEndDate?: string;
  seasonInfo?: SeasonInfo;
}

export const useOffseason = (): OffseasonInfo => {
  const [offseasonInfo, setOffseasonInfo] = useState<OffseasonInfo>({
    isOffseason: false,
    isLoading: true
  });

  useEffect(() => {
    const checkOffseason = async () => {
      try {
        const currentSeason = await fetchCurrentSeason();
        const now = new Date();

        const seasonStart = new Date(currentSeason.startDate);
        const seasonEnd = new Date(currentSeason.endDate);

        // Check if we're in the offseason
        // Offseason is defined as being after the previous season's end date
        // and before the next season's start date
        const isOffseason = now < seasonStart || now > seasonEnd;

        setOffseasonInfo({
          isOffseason,
          isLoading: false,
          nextSeasonStartDate: currentSeason.startDate,
          previousSeasonEndDate: currentSeason.endDate,
          seasonInfo: currentSeason
        });
      } catch (error) {
        console.error("Error checking offseason status:", error);
        // Default to not offseason if we can't determine
        setOffseasonInfo({
          isOffseason: false,
          isLoading: false
        });
      }
    };

    checkOffseason();
  }, []);

  return offseasonInfo;
};

// Utility function to check if we're in offseason without the hook
export const checkIsOffseason = async (): Promise<boolean> => {
  try {
    const currentSeason = await fetchCurrentSeason();
    const now = new Date();

    const seasonStart = new Date(currentSeason.startDate);
    const seasonEnd = new Date(currentSeason.endDate);

    return now < seasonStart || now > seasonEnd;
  } catch (error) {
    console.error("Error checking offseason status:", error);
    return false; // Default to not offseason if we can't determine
  }
};
