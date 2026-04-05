import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { format } from "date-fns";

import { calculateAverages } from "./calculateAverages";

const { fetchSeasonWeeks } = require("./goaliePageWeeks");
const { fetchGoalieDataForWeek } = require("./fetchGoalieDataForWeek");
const { upsertWeekData } = require("./upsertGoalieData");

dotenv.config({ path: "../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase anon Role Key:", supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Service Role Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateWeeklyData(): Promise<void> {
  try {
    const weeks = await fetchSeasonWeeks();
    console.log(`Fetched ${weeks.length} weeks.`);

    for (let index = 0; index < weeks.length; index += 1) {
      const week = weeks[index];
      const weekId = index + 1;

      console.log(
        `Processing Week ${weekId}: ${format(
          week.start,
          "yyyy-MM-dd"
        )} to ${format(week.end, "yyyy-MM-dd")}`
      );

      const { error: weekError } = await supabase
        .from("goalie_page_weeks")
        .upsert(
          {
            id: weekId,
            start_date: format(week.start, "yyyy-MM-dd"),
            end_date: format(week.end, "yyyy-MM-dd")
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

      const goalies = await fetchGoalieDataForWeek(week);
      console.log(`Fetched ${goalies.length} goalies for Week ${weekId}.`);

      if (goalies.length === 0) {
        console.log(`No goalie data for week ${weekId}`);
        continue;
      }

      const averages = calculateAverages(goalies);
      console.log("Calculated Averages:", averages);

      await upsertWeekData(weekId, { goalies, averages });

      console.log(`Week ${weekId} data upserted successfully.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      const errorWithMeta = error as Error & {
        details?: string;
        hint?: string;
      };
      console.error("Error updating weekly data:", error.message);
      console.error("Details:", errorWithMeta.details || "No details provided");
      console.error("Hint:", errorWithMeta.hint || "No hint provided");
      return;
    }

    console.error("Error updating weekly data: Unknown error");
  }
}

void updateWeeklyData();
