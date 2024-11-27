// fetchThreeYearAverages.ts

import Fetch from "lib/cors-fetch"; // Ensure you're using the correct import
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
  const response = await Fetch(
    `https://www.fhfhockey.com/api/ThreeYearAverages/${playerId}`
  ).then((res) => res.json());

  if (!response.success) {
    throw new Error(response.message || "API returned unsuccessful response.");
  }

  return response;
}
