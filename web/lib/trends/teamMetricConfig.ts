import { teamsInfo } from "lib/teamsInfo";

export type MetricSource = "as" | "pp" | "pk" | "wgo";

export interface MetricDefinition {
  key: string;
  label: string;
  source: MetricSource;
  weight: number;
  higherIsBetter: boolean;
}

export interface TrendCategoryDefinition {
  id: "offense" | "defense" | "powerPlay" | "penaltyKill";
  label: string;
  description: string;
  metrics: MetricDefinition[];
}

export type TrendCategoryId = TrendCategoryDefinition["id"];

const HIGH = 5;
const MED_HIGH = 4;
const MED = 3;
const MED_LOW = 2;
const LOW = 1;

export const TEAM_TREND_CATEGORIES: TrendCategoryDefinition[] = [
  {
    id: "offense",
    label: "Offense",
    description: "All-strength shot and scoring creation",
    metrics: [
      {
        key: "gf",
        label: "Goals For",
        source: "as",
        weight: HIGH,
        higherIsBetter: true
      },
      {
        key: "xgf",
        label: "Expected Goals For",
        source: "as",
        weight: MED_HIGH,
        higherIsBetter: true
      },
      {
        key: "sf",
        label: "Shots For",
        source: "as",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "cf",
        label: "Corsi For",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "scf",
        label: "Scoring Chances For",
        source: "as",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "hdsf",
        label: "High-Danger Shots For",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "hdgf",
        label: "High-Danger Goals For",
        source: "as",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "sh_pct",
        label: "Shooting %",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "pp_opportunities",
        label: "PP Opportunities",
        source: "wgo",
        weight: LOW,
        higherIsBetter: true
      }
    ]
  },
  {
    id: "defense",
    label: "Defense",
    description: "All-strength shot and chance suppression",
    metrics: [
      {
        key: "ga",
        label: "Goals Against",
        source: "as",
        weight: HIGH,
        higherIsBetter: false
      },
      {
        key: "xga",
        label: "Expected Goals Against",
        source: "as",
        weight: MED_HIGH,
        higherIsBetter: false
      },
      {
        key: "sa",
        label: "Shots Against",
        source: "as",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "ca",
        label: "Corsi Against",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: false
      },
      {
        key: "sca",
        label: "Scoring Chances Against",
        source: "as",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "hdsa",
        label: "High-Danger Shots Against",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: false
      },
      {
        key: "hdga",
        label: "High-Danger Goals Against",
        source: "as",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "sv_pct",
        label: "Save %",
        source: "as",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "times_shorthanded",
        label: "Times Shorthanded",
        source: "wgo",
        weight: LOW,
        higherIsBetter: false
      }
    ]
  },
  {
    id: "powerPlay",
    label: "Power Play",
    description: "Special teams offense",
    metrics: [
      {
        key: "pp_goals_per_game",
        label: "PP Goals/GP",
        source: "wgo",
        weight: HIGH,
        higherIsBetter: true
      },
      {
        key: "pp_time_on_ice_per_game",
        label: "PP TOI/GP",
        source: "wgo",
        weight: MED_HIGH,
        higherIsBetter: true
      },
      {
        key: "pp_opportunities",
        label: "PP Opportunities",
        source: "wgo",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "gf",
        label: "PP Goals For",
        source: "pp",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "xgf",
        label: "PP Expected Goals For",
        source: "pp",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "sf",
        label: "PP Shots For",
        source: "pp",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "cf",
        label: "PP Corsi For",
        source: "pp",
        weight: LOW,
        higherIsBetter: true
      },
      {
        key: "scf",
        label: "PP Scoring Chances For",
        source: "pp",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "hdsf",
        label: "PP High-Danger Shots For",
        source: "pp",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "hdgf",
        label: "PP High-Danger Goals For",
        source: "pp",
        weight: MED,
        higherIsBetter: true
      },
      {
        key: "sh_pct",
        label: "PP Shooting %",
        source: "pp",
        weight: MED_LOW,
        higherIsBetter: true
      }
    ]
  },
  {
    id: "penaltyKill",
    label: "Penalty Kill",
    description: "Special teams defense",
    metrics: [
      {
        key: "ga",
        label: "PK Goals Against",
        source: "pk",
        weight: HIGH,
        higherIsBetter: false
      },
      {
        key: "xga",
        label: "PK Expected Goals Against",
        source: "pk",
        weight: MED_HIGH,
        higherIsBetter: false
      },
      {
        key: "sa",
        label: "PK Shots Against",
        source: "pk",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "ca",
        label: "PK Corsi Against",
        source: "pk",
        weight: MED_LOW,
        higherIsBetter: false
      },
      {
        key: "sca",
        label: "PK Scoring Chances Against",
        source: "pk",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "hdsa",
        label: "PK High-Danger Shots Against",
        source: "pk",
        weight: MED_LOW,
        higherIsBetter: false
      },
      {
        key: "hdga",
        label: "PK High-Danger Goals Against",
        source: "pk",
        weight: MED,
        higherIsBetter: false
      },
      {
        key: "sv_pct",
        label: "PK Save %",
        source: "pk",
        weight: MED_LOW,
        higherIsBetter: true
      },
      {
        key: "times_shorthanded",
        label: "Times Shorthanded",
        source: "wgo",
        weight: LOW,
        higherIsBetter: false
      }
    ]
  }
];

export const ACTIVE_TEAM_ABBREVIATIONS = Object.keys(teamsInfo);
