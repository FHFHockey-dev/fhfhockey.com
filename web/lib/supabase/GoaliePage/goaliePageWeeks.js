// goaliePageWeeks.js

const fetch = require("node-fetch");
const {
  parseISO,
  eachWeekOfInterval,
  endOfWeek,
  addDays,
  format,
  startOfWeek,
} = require("date-fns");

/**
 * Fetch and define all season weeks.
 * Week 1: Season start to the first Sunday.
 * Weeks 2+: Monday to Sunday.
 * @returns {Promise<Array<{ start: Date, end: Date }>>}
 */
async function fetchSeasonWeeks() {
  const response = await fetch(
    'https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch season data: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error("Invalid season data received from API.");
  }

  let seasonData = data.data[0];
  let seasonStart = parseISO(seasonData.startDate);
  let seasonEnd = parseISO(seasonData.regularSeasonEndDate);
  const today = new Date();

  // If the current date is before the first season, use the previous season
  if (today < seasonStart && data.data.length > 1) {
    seasonData = data.data[1];
    seasonStart = parseISO(seasonData.startDate);
    seasonEnd = parseISO(seasonData.regularSeasonEndDate);
  }

  // Define Week 1: Season start to the first Sunday
  const firstSunday = endOfWeek(seasonStart, { weekStartsOn: 1 }); // weekStartsOn: Monday
  const firstWeek = {
    start: seasonStart,
    end: firstSunday,
  };

  // Define Weeks 2+: Monday to Sunday without overlaps
  const remainingWeeks = eachWeekOfInterval(
    {
      start: addDays(firstSunday, 1), // Start on the next day after the first Sunday (Monday)
      end: seasonEnd,
    },
    { weekStartsOn: 1 }
  ).map((weekStart) => ({
    start: weekStart, // Monday
    end: endOfWeek(weekStart, { weekStartsOn: 1 }), // Sunday
  }));

  const allWeeks = [firstWeek, ...remainingWeeks];

  // Optional: Log weeks for verification
  console.log("Defined Weeks:");
  allWeeks.forEach((week, index) => {
    console.log(
      `Week ${index + 1}: ${format(week.start, "yyyy-MM-dd")} to ${format(
        week.end,
        "yyyy-MM-dd"
      )}`
    );
  });

  return allWeeks;
}

module.exports = {
  fetchSeasonWeeks,
};
