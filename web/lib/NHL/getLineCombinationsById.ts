import supabase from "lib/supabase";
import type { PlayerBasic } from "pages/lines/[abbreviation]";

export type LineCombinations = {
  id?: number;
  date: string;
  team_name: string;
  team_abbreviation: string;
  forwards: {
    line1: PlayerBasic[];
    line2: PlayerBasic[];
    line3: PlayerBasic[];
    line4: PlayerBasic[];
  };
  defensemen: {
    line1: PlayerBasic[];
    line2: PlayerBasic[];
    line3: PlayerBasic[];
  };
  goalies: {
    line1: PlayerBasic[];
    line2: PlayerBasic[];
  };
  source_url: string;
};

export default async function getLineCombinationsById(
  id: number
): Promise<LineCombinations> {
  const { data: line_combinations } = await supabase
    .from("line_combinations")
    .select(
      "id, date, team_name, team_abbreviation, forwards, defensemen, goalies, source_url"
    )
    .eq("id", id)
    .single();

  return line_combinations;
}
