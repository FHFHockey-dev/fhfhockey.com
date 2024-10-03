// updateWeeklyData.js

const { createClient } = require("@supabase/supabase-js"); // Supabase client
require("dotenv").config({ path: "../../../.env.local" });

// Initialize Supabase client with Service Role Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase anon Role Key:", supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Service Role Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import required functions
const { fetchSeasonWeeks } = require("./goaliePageWeeks");
const { fetchGoalieDataForWeek } = require("./fetchGoalieDataForWeek");
const { calculateAverages } = require("./calculateAverages");
const { upsertWeekData } = require("./upsertGoalieData");
const { format } = require("date-fns");

async function updateWeeklyData() {
  try {
    const weeks = await fetchSeasonWeeks();
    console.log(`Fetched ${weeks.length} weeks.`);

    for (let index = 0; index < weeks.length; index++) {
      const week = weeks[index];
      const weekId = index + 1;

      console.log(
        `Processing Week ${weekId}: ${format(
          week.start,
          "yyyy-MM-dd"
        )} to ${format(week.end, "yyyy-MM-dd")}`
      );

      // Upsert week info
      const { error: weekError } = await supabase
        .from("goalie_page_weeks")
        .upsert(
          {
            id: weekId,
            start_date: format(week.start, "yyyy-MM-dd"),
            end_date: format(week.end, "yyyy-MM-dd"),
          },
          { onConflict: "id" }
        );

      if (weekError) {
        console.error("Error upserting week info:", weekError.message);
        console.error("Details:", weekError.details);
        console.error("Hint:", weekError.hint);
        console.error("Full Error Object:", weekError);
        continue;
      }

      console.log("Week info upserted successfully.");

      // Fetch goalie data for the week
      const goalies = await fetchGoalieDataForWeek(week);
      console.log(`Fetched ${goalies.length} goalies for Week ${weekId}.`);

      if (goalies.length === 0) {
        console.log(`No goalie data for week ${weekId}`);
        continue;
      }

      // Calculate league averages
      const averages = calculateAverages(goalies);
      console.log("Calculated Averages:", averages);

      // Upsert goalie stats and league averages
      await upsertWeekData(weekId, { goalies, averages });

      console.log(`Week ${weekId} data upserted successfully.`);
    }
  } catch (error) {
    if (error) {
      console.error("Error updating weekly data:", error.message || error);
      console.error("Details:", error.details || "No details provided");
      console.error("Hint:", error.hint || "No hint provided");
    } else {
      console.error("Error updating weekly data: Unknown error");
    }
  }
}

updateWeeklyData();
