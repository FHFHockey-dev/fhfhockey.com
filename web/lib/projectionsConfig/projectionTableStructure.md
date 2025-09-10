PROJECTIONS_20252026_AG_SKATERS
```
create table public."PROJECTIONS_20252026_AG_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Games_Played" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "PP_Points" numeric null,
  "Shots_on_Goal" numeric null,
  "Hits" numeric null,
  "Blocked_Shots" numeric null,
  "Penalty_Minutes" numeric null,
  "S" text null,
  "Time_on_Ice_Per_Game" numeric null,
  constraint PROJECTIONS_20252026_AG_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_CULLEN_GOALIES
```
create table public."PROJECTIONS_20252026_CULLEN_GOALIES" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Goalie" text null,
  "Team_Abbreviation" text null,
  "Games_Played" numeric null,
  "Wins_Goalie" numeric null,
  "Goals_Against_Average" numeric null,
  "Sv_Pct" numeric null,
  "Shutouts_Goalie" numeric null,
  constraint PROJECTIONS_20252026_CULLEN_GOALIES_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_CULLEN_SKATERS
```
create table public."PROJECTIONS_20252026_CULLEN_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Position" text null,
  "Games_Played" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "Plus_Minus" numeric null,
  "PP_Points" numeric null,
  "Penalty_Minutes" numeric null,
  "Hits" numeric null,
  "Blocked_Shots" numeric null,
  "Shots_on_Goal" numeric null,
  constraint PROJECTIONS_20252026_CULLEN_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_DFO_GOALIES
```
create table public."PROJECTIONS_20252026_DFO_GOALIES" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Position" text null,
  "Games_Started_Goalie" numeric null,
  "Wins_Goalie" numeric null,
  "Losses_Goalie" numeric null,
  "OTL" numeric null,
  "Shutouts_Goalie" numeric null,
  "Saves_Goalie" numeric null,
  "Save_Percentage" numeric null,
  "Ga" numeric null,
  "Goals_Against_Average" numeric null,
  "Sa" numeric null,
  constraint PROJECTIONS_20252026_DFO_GOALIES_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_DFO_SKATERS
```
create table public."PROJECTIONS_20252026_DFO_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Position" text null,
  "Games_Played" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "Plus_Minus" numeric null,
  "Penalty_Minutes" numeric null,
  "PP_Goals" numeric null,
  "PP_Assists" numeric null,
  "PP_Points" numeric null,
  "Shots_on_Goal" numeric null,
  "Time_on_Ice_Per_Game" numeric null,
  "Faceoffs_Won" numeric null,
  "Blocked_Shots" numeric null,
  "Hits" numeric null,
  constraint PROJECTIONS_20252026_DFO_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_DTZ_GOALIES
```
create table public."PROJECTIONS_20252026_DTZ_GOALIES" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Age" numeric null,
  "Position" text null,
  "Salary" text null,
  "Games_Played" numeric null,
  "Wins_Goalie" numeric null,
  "Losses_Goalie" numeric null,
  "Otl" numeric null,
  "Ga" numeric null,
  "Sa" numeric null,
  "Saves_Goalie" numeric null,
  "Save_Percentage" numeric null,
  "Goals_Against_Average" numeric null,
  "Shutouts_Goalie" numeric null,
  "Qs" numeric null,
  "Rbs" numeric null,
  "Vor" numeric null,
  "Rank" numeric null,
  "Gp_Org" numeric null,
  "Playerid" text null,
  constraint PROJECTIONS_20252026_DTZ_GOALIES_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_DTZ_Skaters
```
create table public."PROJECTIONS_20252026_DTZ_Skaters" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Age" numeric null,
  "Position" text null,
  "Team_Abbreviation" text null,
  "Salary" text null,
  "Toi_Org_Es" numeric null,
  "Toi_Org_Pp" numeric null,
  "Toi_Org_Pk" numeric null,
  "Gp_Org" numeric null,
  "Games_Played" numeric null,
  "Toi_Es" numeric null,
  "Toi_Pp" numeric null,
  "Toi_Pk" numeric null,
  "Total_Toi" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "PP_Goals" numeric null,
  "PP_Assists" numeric null,
  "Pp_Points" numeric null,
  "SH_Goals" numeric null,
  "SH_Assists" numeric null,
  "SH_Points" numeric null,
  "Hits" numeric null,
  "Blocked_Shots" numeric null,
  "Penalty_Minutes" numeric null,
  "Faceoffs_Won" numeric null,
  "Faceoffs_Lost" numeric null,
  "Shots_on_Goal" numeric null,
  "Plus_Minus" numeric null,
  "Vor" numeric null,
  "Rank" numeric null,
  "Unadj_Vor" numeric null,
  "Playerid" numeric null,
  constraint PROJECTIONS_20252026_DTZ_Skaters_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_FHFH_SKATERS
```
create table public."PROJECTIONS_20252026_FHFH_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Position" text null,
  "Games_Played" numeric null,
  "Time_on_Ice_Per_Game" numeric null,
  "PP_TOI" numeric null,
  "Adj" text null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "Ptsgp" text null,
  "Shots_on_Goal" numeric null,
  "S" numeric null,
  "PP_Goals" numeric null,
  "PP_Assists" numeric null,
  "PP_Points" numeric null,
  "SH_Goals" numeric null,
  "SH_Assists" numeric null,
  "SH_Points" numeric null,
  "Hits" numeric null,
  "Blocked_Shots" numeric null,
  "Penalty_Minutes" numeric null,
  "Faceoffs_Won" numeric null,
  "Faceoffs_Lost" numeric null,
  "Plus_Minus" numeric null,
  constraint PROJECTIONS_20252026_FHFH_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_KUBOTA_SKATERS
```
create table public."PROJECTIONS_20252026_KUBOTA_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Team_Abbreviation" text null,
  "Position" text null,
  "Games_Played" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "Shots_on_Goal" numeric null,
  "Penalty_Minutes" numeric null,
  "Plus_Minus" numeric null,
  "PP_Goals" numeric null,
  "PP_Assists" numeric null,
  "PP_Points" numeric null,
  "SH_Goals" numeric null,
  "SH_Assists" numeric null,
  "SH_Points" numeric null,
  "Blocked_Shots" numeric null,
  "Hits" numeric null,
  "Faceoffs_Lost" numeric null,
  "Faceoffs_Won" numeric null,
  constraint PROJECTIONS_20252026_KUBOTA_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```

PROJECTIONS_20252026_LAIDLAW_SKATERS
```
create table public."PROJECTIONS_20252026_LAIDLAW_SKATERS" (
  upload_batch_id uuid not null default gen_random_uuid (),
  player_id bigint null,
  "Player_Name" text null,
  "Games_Played" numeric null,
  "Goals" numeric null,
  "Assists" numeric null,
  "Points" numeric null,
  "PP_Points" numeric null,
  "Shots_on_Goal" numeric null,
  "Hits" numeric null,
  "Blocked_Shots" numeric null,
  constraint PROJECTIONS_20252026_LAIDLAW_SKATERS_pkey primary key (upload_batch_id),
  constraint fk_player foreign KEY (player_id) references players (id)
) TABLESPACE pg_default;
```
