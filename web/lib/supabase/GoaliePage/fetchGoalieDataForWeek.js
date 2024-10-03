// fetchGoalieDataForWeek.js
const fetch = require("node-fetch");
const { format } = require("date-fns");

/**
 * Fetch all goalie data for a given week using pagination with retry logic.
 * @param {Object} week - The week object containing start and end dates.
 * @param {number} [maxRetries=3] - Maximum number of retries for failed fetches.
 * @returns {Promise<Array>} - A promise that resolves to an array of goalie data.
 */
async function fetchGoalieDataForWeek(week, maxRetries = 3) {
  const startDate = format(week.start, "yyyy-MM-dd HH:mm:ss");
  const endDate = format(week.end, "yyyy-MM-dd HH:mm:ss");
  const limit = 100; // Number of records per fetch
  let start = 0; // Starting index for fetch
  let allGoalies = []; // Accumulator for all fetched goalies
  let fetchMore = true; // Flag to control the fetch loop

  while (fetchMore) {
    const url = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=[{"property":"wins","direction":"DESC"},{"property":"savePct","direction":"DESC"},{"property":"playerId","direction":"ASC"}]&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${encodeURIComponent(
      endDate
    )}%22 and gameDate>=%22${encodeURIComponent(
      startDate
    )}%22 and gameTypeId=2`;

    let attempt = 0;
    let success = false;
    let data;

    while (attempt < maxRetries && !success) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(
            `Error fetching data: ${response.status} ${response.statusText}`
          );
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        data = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
          console.warn(`No data returned for start=${start}, limit=${limit}`);
          break;
        }

        success = true; // Exit the retry loop on success
      } catch (error) {
        attempt += 1;
        console.error(`Fetch attempt ${attempt} failed: ${error.message}`);
        if (attempt < maxRetries) {
          console.log(`Retrying fetch (attempt ${attempt + 1})...`);
          await delay(1000 * attempt); // Exponential backoff
        } else {
          console.error(
            `Max retries reached for start=${start}. Skipping this batch.`
          );
          throw error; // Propagate the error to be handled upstream
        }
      }
    }

    if (success) {
      allGoalies = allGoalies.concat(data.data);
      console.log(
        `Fetched ${data.data.length} goalies for Week (start=${start})`
      );

      if (data.data.length < limit) {
        // Fetched fewer records than the limit, no more data to fetch
        fetchMore = false;
      } else {
        // Increment the start index to fetch the next batch
        start += limit;
      }
    } else {
      // If not successful after retries, stop fetching to prevent infinite loop
      fetchMore = false;
    }
  }

  console.log(`Total goalies fetched for Week: ${allGoalies.length}`);
  return allGoalies;
}

/**
 * Helper function to delay execution for a specified duration.
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise} - A promise that resolves after the delay.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  fetchGoalieDataForWeek,
};
