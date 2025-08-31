yahoo_game_keys:
| column_name                | data_type                | is_nullable | column_default | character_maximum_length |
| -------------------------- | ------------------------ | ----------- | -------------- | ------------------------ |
| game_id                    | integer                  | NO          | null           | null                     |
| game_key                   | text                     | NO          | null           | null                     |
| name                       | text                     | YES         | null           | null                     |
| code                       | text                     | YES         | null           | null                     |
| type                       | text                     | YES         | null           | null                     |
| url                        | text                     | YES         | null           | null                     |
| season                     | integer                  | YES         | null           | null                     |
| is_registration_over       | integer                  | YES         | null           | null                     |
| is_game_over               | integer                  | YES         | null           | null                     |
| is_offseason               | integer                  | YES         | null           | null                     |
| contest_group_id           | integer                  | YES         | null           | null                     |
| current_week               | integer                  | YES         | null           | null                     |
| editorial_season           | integer                  | YES         | null           | null                     |
| game_weeks                 | jsonb                    | YES         | null           | null                     |
| has_schedule               | integer                  | YES         | null           | null                     |
| is_contest_over            | integer                  | YES         | null           | null                     |
| is_contest_reg_active      | integer                  | YES         | null           | null                     |
| is_live_draft_lobby_active | integer                  | YES         | null           | null                     |
| leagues                    | jsonb                    | YES         | null           | null                     |
| picks_status               | text                     | YES         | null           | null                     |
| players                    | jsonb                    | YES         | null           | null                     |
| position_types             | jsonb                    | YES         | null           | null                     |
| roster_positions           | jsonb                    | YES         | null           | null                     |
| scenario_generator         | integer                  | YES         | null           | null                     |
| stat_categories            | jsonb                    | YES         | null           | null                     |
| teams                      | jsonb                    | YES         | null           | null                     |
| last_updated               | timestamp with time zone | YES         | now()          | null                     |



yahoo_players:
| column_name                 | data_type                   | is_nullable | column_default | character_maximum_length |
| --------------------------- | --------------------------- | ----------- | -------------- | ------------------------ |
| player_name                 | character varying           | YES         | null           | 255                      |
| player_id                   | character varying           | YES         | null           | 255                      |
| draft_analysis              | jsonb                       | YES         | null           | null                     |
| average_draft_pick          | double precision            | YES         | null           | null                     |
| average_draft_round         | double precision            | YES         | null           | null                     |
| average_draft_cost          | double precision            | YES         | null           | null                     |
| percent_drafted             | double precision            | YES         | null           | null                     |
| editorial_player_key        | character varying           | YES         | null           | 255                      |
| editorial_team_abbreviation | character varying           | YES         | null           | 10                       |
| editorial_team_full_name    | character varying           | YES         | null           | 255                      |
| eligible_positions          | jsonb                       | YES         | null           | null                     |
| display_position            | text                        | YES         | null           | null                     |
| headshot_url                | text                        | YES         | null           | null                     |
| injury_note                 | text                        | YES         | null           | null                     |
| full_name                   | character varying           | YES         | null           | 255                      |
| percent_ownership           | double precision            | YES         | null           | null                     |
| player_key                  | character varying           | NO          | null           | 255                      |
| position_type               | character varying           | YES         | null           | 50                       |
| status                      | character varying           | YES         | null           | 10                       |
| status_full                 | character varying           | YES         | null           | 255                      |
| last_updated                | timestamp without time zone | YES         | now()          | null                     |
| uniform_number              | smallint                    | YES         | null           | null                     |
| ownership_timeline          | jsonb                       | YES         | '[]'::jsonb    | null                     |


yahoo_api_credentials:
| column_name      | data_type                | is_nullable | column_default                                    | character_maximum_length |
| ---------------- | ------------------------ | ----------- | ------------------------------------------------- | ------------------------ |
| id               | integer                  | NO          | nextval('yahoo_api_credentials_id_seq'::regclass) | null                     |
| consumer_key     | text                     | NO          | null                                              | null                     |
| consumer_secret  | text                     | NO          | null                                              | null                     |
| access_token     | text                     | NO          | null                                              | null                     |
| refresh_token    | text                     | NO          | null                                              | null                     |
| token_expires_at | timestamp with time zone | YES         | null                                              | null                     |
| created_at       | timestamp with time zone | YES         | now()                                             | null                     |
| updated_at       | timestamp with time zone | YES         | now()                                             | null                     |


yahoo_matchup_weeks:
| column_name | data_type                | is_nullable | column_default                                  | character_maximum_length |
| ----------- | ------------------------ | ----------- | ----------------------------------------------- | ------------------------ |
| id          | integer                  | NO          | nextval('yahoo_matchup_weeks_id_seq'::regclass) | null                     |
| game_key    | text                     | NO          | null                                            | null                     |
| game_id     | text                     | YES         | null                                            | null                     |
| name        | text                     | YES         | null                                            | null                     |
| code        | text                     | YES         | null                                            | null                     |
| type        | text                     | YES         | null                                            | null                     |
| url         | text                     | YES         | null                                            | null                     |
| season      | text                     | NO          | null                                            | null                     |
| week        | integer                  | NO          | null                                            | null                     |
| start_date  | date                     | YES         | null                                            | null                     |
| end_date    | date                     | YES         | null                                            | null                     |
| inserted_at | timestamp with time zone | NO          | now()                                           | null                     |

yahoo_names:
| column_name | data_type         | is_nullable | column_default | character_maximum_length |
| ----------- | ----------------- | ----------- | -------------- | ------------------------ |
| player_id   | character varying | YES         | null           | 255                      |
| player_name | character varying | YES         | null           | 255                      |
| first_name  | text              | YES         | null           | null                     |
| last_name   | text              | YES         | null           | null                     |


_yahoo_nhl_player_map_mat:
| column_name       | data_type         | is_nullable | column_default | character_maximum_length |
| ----------------- | ----------------- | ----------- | -------------- | ------------------------ |
| nhl_player_id     | text              | YES         | null           | null                     |
| nhl_player_name   | text              | YES         | null           | null                     |
| yahoo_player_id   | character varying | YES         | null           | 255                      |
| yahoo_player_name | character varying | YES         | null           | 255                      |
| yahoo_team        | character varying | YES         | null           | 10                       |


yahoo_player_keys:
| column_name  | data_type                   | is_nullable | column_default | character_maximum_length |
| ------------ | --------------------------- | ----------- | -------------- | ------------------------ |
| player_key   | character varying           | NO          | null           | 255                      |
| player_id    | integer                     | YES         | null           | null                     |
| player_name  | character varying           | YES         | null           | 255                      |
| last_updated | timestamp without time zone | NO          | now()          | null                     |

yahoo_player_ownership_history:
| column_name    | data_type                | is_nullable | column_default | character_maximum_length |
| -------------- | ------------------------ | ----------- | -------------- | ------------------------ |
| player_key     | text                     | NO          | null           | null                     |
| ownership_date | date                     | NO          | null           | null                     |
| ownership_pct  | double precision         | YES         | null           | null                     |
| source         | text                     | YES         | 'yahoo'::text  | null                     |
| inserted_at    | timestamp with time zone | YES         | now()          | null                     |

yahoo_positions:
| column_name         | data_type | is_nullable | column_default | character_maximum_length |
| ------------------- | --------- | ----------- | -------------- | ------------------------ |
| player_key          | text      | NO          | null           | null                     |
| player_id           | bigint    | YES         | null           | null                     |
| full_name           | text      | YES         | null           | null                     |
| display_position    | text      | YES         | null           | null                     |
| editorial_team_abbr | text      | YES         | null           | null                     |
| team_full_name      | text      | YES         | null           | null                     |
| team_abbr           | text      | YES         | null           | null                     |
| position_type       | text      | YES         | null           | null                     |
| primary_position    | text      | YES         | null           | null                     |
| uniform_number      | text      | YES         | null           | null                     |
| status              | text      | YES         | null           | null                     |