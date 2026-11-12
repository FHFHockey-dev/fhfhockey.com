export type AvailabilitySemanticType = "availability" | "participation";

export type AvailabilitySeasonScope =
  | "player_season_all_stints"
  | "player_season_current_team_only";

export type AvailabilityRollingScope =
  | "team_of_record_last_n_team_games_by_date"
  | "appearance_anchored_span";

export type AvailabilityHistoricalScope =
  | "all_stints_within_window"
  | "season_team_bucket";

export type AvailabilityStrengthContract = {
  semanticType: AvailabilitySemanticType;
  numeratorMeaning: string;
  denominatorMeaning: string;
  seasonScope: AvailabilitySeasonScope;
  rollingScope: AvailabilityRollingScope;
  historicalScope: AvailabilityHistoricalScope;
};

export type RollingPlayerAvailabilityContract = {
  currentImplementation: {
    allStrength: AvailabilityStrengthContract;
    splitStrength: AvailabilityStrengthContract;
  };
  intendedReplacement: {
    allStrength: AvailabilityStrengthContract;
    splitStrength: AvailabilityStrengthContract;
  };
  legacyFieldPolicy: {
    allStrengthGpPctFields:
      "derived_aliases_from_canonical_availability_fields";
    splitStrengthGpPctFields:
      "legacy_participation_aliases_until_schema_replacement";
    gpPctAvgFields: "deprecated_aliases_not_real_averages";
    splitStrengthCompatibility:
      "legacy_gp_fields_with_gp_semantic_type_until_participation_schema";
    canonicalSeasonFields: [
      "season_games_played",
      "season_team_games_available",
      "season_availability_pct"
    ];
    canonicalRollingFields: [
      "games_played_lastN_team_games",
      "team_games_available_lastN",
      "availability_pct_lastN_team_games"
    ];
    canonicalHistoricalFields: [
      "three_year_games_played",
      "three_year_team_games_available",
      "three_year_availability_pct",
      "career_games_played",
      "career_team_games_available",
      "career_availability_pct"
    ];
    rawSupportFields: {
      season: ["season_games_played", "season_team_games_available"];
      rolling: [
        "games_played_lastN_team_games",
        "team_games_available_lastN"
      ];
      historical: [
        "three_year_games_played",
        "three_year_team_games_available",
        "career_games_played",
        "career_team_games_available"
      ];
    };
  };
};

// Owner decision 16 (2026-11-11): availability follows the player's team of
// record by date, labelled "games available". Each regular-season game belongs
// to the team he was with on that date; trade dates are not stored, so stints
// use an appearance-bounded proxy (see updateHistoricalGpPctAccumulator).
// This shared contract is the code-level translation of the audit's intended
// availability model. Runtime behavior is still being remediated in follow-up
// tasks, but any GP% or participation change should target this contract rather
// than the legacy appearance-anchored / team-bucketed assumptions.
export const ROLLING_PLAYER_AVAILABILITY_CONTRACT: RollingPlayerAvailabilityContract =
  {
    currentImplementation: {
      allStrength: {
        semanticType: "availability",
        numeratorMeaning: "regular-season team-of-record games in which the player appeared",
        denominatorMeaning:
          "regular-season games of the team of record on each date (games available)",
        seasonScope: "player_season_all_stints",
        rollingScope: "team_of_record_last_n_team_games_by_date",
        historicalScope: "all_stints_within_window"
      },
      splitStrength: {
        semanticType: "participation",
        numeratorMeaning: "team-of-record games with positive TOI in the strength state",
        denominatorMeaning:
          "regular-season games of the team of record on each date (games available)",
        seasonScope: "player_season_all_stints",
        rollingScope: "team_of_record_last_n_team_games_by_date",
        historicalScope: "all_stints_within_window"
      }
    },
    intendedReplacement: {
      allStrength: {
        semanticType: "availability",
        numeratorMeaning: "team games in which the player appeared",
        denominatorMeaning: "team games available in scope",
        seasonScope: "player_season_all_stints",
        rollingScope: "team_of_record_last_n_team_games_by_date",
        historicalScope: "all_stints_within_window"
      },
      splitStrength: {
        semanticType: "participation",
        numeratorMeaning: "team games with positive TOI in the strength state",
        denominatorMeaning: "team games available in scope",
        seasonScope: "player_season_all_stints",
        rollingScope: "team_of_record_last_n_team_games_by_date",
        historicalScope: "all_stints_within_window"
      }
    },
    legacyFieldPolicy: {
      allStrengthGpPctFields:
        "derived_aliases_from_canonical_availability_fields",
      splitStrengthGpPctFields:
        "legacy_participation_aliases_until_schema_replacement",
      gpPctAvgFields: "deprecated_aliases_not_real_averages",
      splitStrengthCompatibility:
        "legacy_gp_fields_with_gp_semantic_type_until_participation_schema",
      canonicalSeasonFields: [
        "season_games_played",
        "season_team_games_available",
        "season_availability_pct"
      ],
      canonicalRollingFields: [
        "games_played_lastN_team_games",
        "team_games_available_lastN",
        "availability_pct_lastN_team_games"
      ],
      canonicalHistoricalFields: [
        "three_year_games_played",
        "three_year_team_games_available",
        "three_year_availability_pct",
        "career_games_played",
        "career_team_games_available",
        "career_availability_pct"
      ],
      rawSupportFields: {
        season: ["season_games_played", "season_team_games_available"],
        rolling: [
          "games_played_lastN_team_games",
          "team_games_available_lastN"
        ],
        historical: [
          "three_year_games_played",
          "three_year_team_games_available",
          "career_games_played",
          "career_team_games_available"
        ]
      }
    }
  };
