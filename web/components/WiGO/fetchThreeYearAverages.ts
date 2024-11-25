// web/utils/fetchThreeYearAverages.ts

import { ThreeYearAveragesResponse } from "components/WiGO/types";

/**
 * Fetches three-year averages and career statistics for a given player.
 *
 * @param {number} playerId - The ID of the player.
 * @returns {Promise<ThreeYearAveragesResponse>} - The API response containing statistics.
 */
export async function fetchThreeYearAverages(
  playerId: number
): Promise<ThreeYearAveragesResponse> {
  const response = await fetch(
    `http://www.fhfhockey.com/api/ThreeYearAverages/${playerId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }

  const data: ThreeYearAveragesResponse = await response.json();

  if (!data.success) {
    throw new Error(data.message || "API returned unsuccessful response.");
  }

  return data;
}
