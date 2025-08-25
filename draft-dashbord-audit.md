# Draft Dashboard Audit Inventory (Preparation)

Purpose
- Produce a comprehensive inventory of files tied to the Fantasy Hockey Draft Dashboard PRD and their direct imports/relationships. This is a preparatory list; the actual audit will be performed next.

Source PRD
- /Users/tim/Desktop/fhfhockey.com/tasks/prd-draft-dashboard.md

---

1) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/ProjectionsTable.tsx
- Role: Available Players table: filtering, sorting, VORP/VONA/VBD display, risk model, UI controls (baseline, need weighting), diagnostics space.
- Direct imports (expected/resolved):
  - React: react (useState, useEffect, useMemo)
  - Styles: ./ProjectionsTable.module.scss (implied by styles usage)
  - Types consumed via props: ProcessedPlayer, DraftedPlayer, PlayerVorpMetrics
  - Supabase client usage (supabase) inside helper calls (needs import from lib/supabase)
- Key relationships:
  - Receives VORP metrics and baselines from parent (DraftDashboard) and useVORPCalculations.
  - Displays risk vs next pick using nextPickNumber passed down.
  - Triggers onDraftPlayer back to parent.

2) /Users/tim/Desktop/fhfhockey.com/web/hooks/useProcessedProjectionsData.tsx
- Role: Core aggregation/blending pipeline for projections, actuals, fantasy points, Yahoo mapping; produces ProcessedPlayer rows and table columns.
- Direct imports:
  - react (useState, useEffect, useMemo, useRef, useCallback)
  - @supabase/supabase-js (SupabaseClient, PostgrestResponse)
  - @tanstack/react-table (ColumnDef, RowData, SortingFnOption, GroupColumnDef)
  - lib/projectionsConfig/statsMasterList.ts
  - lib/projectionsConfig/projectionSourcesConfig.ts
  - lib/projectionsConfig/yahooConfig.ts (referenced in code)
- Other internal dependencies used/defined:
  - generateTableColumns, deriveVisibleColumns (defined in file)
  - fetchAllSupabaseData (defined in file)
- External data (Supabase tables):
  - yahoo_nhl_player_map_mat
  - yahoo_players
  - wgo_skater_stats_totals
  - wgo_goalie_stats_totals
  - Various projections_* tables per PROJECTION_SOURCES_CONFIG
- Key relationships:
  - Consumed by DraftDashboard for processedPlayers and columns.
  - Exposes types ProcessedPlayer, TableDataRow, RoundSummaryRow.

3) /Users/tim/Desktop/fhfhockey.com/web/hooks/useProjectionSourceAnalysis.ts
- Role: Client-side controls for projection source enable/disable and weights; persists to localStorage (draft.sourceControls.v1).
- Direct imports:
  - react (useCallback, useEffect, useMemo, useState)
  - hooks/useProcessedProjectionsData (ProcessedPlayer type; not strictly required at runtime)
  - lib/projectionsConfig/projectionSourcesConfig.ts
- Key relationships:
  - Feeds source selection/weighting into useProcessedProjectionsData.
  - Will include “Custom CSV” source when present.

4) /Users/tim/Desktop/fhfhockey.com/web/pages/db/upsert-projections.tsx
- Role: Admin reference implementation for CSV parsing/mapping and DB upsert (server-backed). Used as reference only for client-side import.
- Direct imports:
  - next/router (useRouter)
  - next/link
  - @mui/material (Button, TextField, Typography, Checkbox, FormGroup, FormControlLabel, Paper, Box, CircularProgress, Select, MenuItem, InputLabel, FormControl, Card, CardContent, CardHeader)
  - react-dropzone (useDropzone)
  - papaparse (Papa)
  - lib/standardization/nameStandardization (standardizePlayerName, titleCase)
  - lib/standardization/columnStandardization (standardizeColumnName)
  - notistack (useSnackbar)
  - lib/supabase (doPOST helper)
  - components/Layout/Container
  - components/PageTitle
  - components/ClientOnly
  - contexts/AuthProviderContext (useUser)
- Key relationships:
  - Provides parsing and standardization patterns to mirror in client-side ImportCsvModal (session-only).

5) /Users/tim/Desktop/fhfhockey.com/web/pages/api/v1/db/upsert-csv.ts
- Role: API route for server-side CSV upsert (reference only; not used by client-side session import).
- Direct imports:
  - next (NextApiRequest, NextApiResponse)
  - utils/adminOnlyMiddleware (adminOnly)
  - @supabase/supabase-js (SupabaseClient)
  - lib/standardization/nameStandardization (standardizePlayerName)
- Key relationships:
  - Reference for disambiguating players when writing to DB; logic not used in session import.

6) /Users/tim/Desktop/fhfhockey.com/web/lib/standardization/nameStandardization.ts
- Role: Name normalization helpers and canonical mapping for player names; exports titleCase and standardizePlayerName (used by import flows).
- Consumed by:
  - upsert-projections.tsx (client parsing)
  - upsert-csv.ts (server API)

7) /Users/tim/Desktop/fhfhockey.com/web/lib/standardization/columnStandardization.ts
- Role: Header normalization for CSV → internal canonical stat keys; exports standardizeColumnName and default mapping.
- Direct imports:
  - ./nameStandardization (titleCase)
- Consumed by:
  - upsert-projections.tsx (client parsing)

8) /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/statsMasterList.ts
- Role: Master stat definitions (keys, display names, types, formatting) for skaters/goalies.
- Direct imports:
  - ./formatToMMSS.ts
- Consumed by:
  - useProcessedProjectionsData.tsx (drives stat processing and column generation)

9) /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/projectionSourcesConfig.ts
- Role: Configuration of projection sources (tables, mappings, parsers, formatters) for skater/goalie projections.
- Direct imports:
  - ./statsMasterList.ts (StatDefinition)
  - ./formatToMMSS.ts
- Consumed by:
  - useProcessedProjectionsData.tsx

10) /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/fantasyPointsConfig.ts
- Role: Default fantasy points settings and helper getDefaultFantasyPointsConfig.
- Consumed by:
  - DraftDashboard.tsx (DEFAULT_DRAFT_SETTINGS)
  - useProcessedProjectionsData.tsx (FP computation)

11) /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/formatToMMSS.ts
- Role: Utility to display seconds as MM:SS; used in stat formatting and source config.
- Consumed by:
  - statsMasterList.ts
  - projectionSourcesConfig.ts

12) /Users/tim/Desktop/fhfhockey.com/web/hooks/useVORPCalculations.ts
- Role: VORP/VONA/VBD calculations hook scaffold with types and parameters; computes replacement baselines and metrics (to be implemented/extended).
- Consumed by:
  - DraftDashboard.tsx (to derive vorpMetrics and replacement baselines)

13) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.tsx
- Role: Orchestrates the dashboard: manages draft state, integrates processed projections, VORP, suggested picks, CSV import modal, and passes props to child panels.
- Direct imports:
  - hooks/useProcessedProjectionsData
  - lib/projectionsConfig/fantasyPointsConfig.ts
  - lib/projectionsConfig/projectionSourcesConfig.ts
  - hooks/useCurrentSeason.ts
  - lib/supabase
  - ./DraftSettings
  - ./DraftBoard
  - ./MyRoster
  - ./ProjectionsTable
  - hooks/useVORPCalculations
  - ./SuggestedPicks
  - ./DraftSummaryModal
  - ./ImportCsvModal
  - ./DraftDashboard.module.scss
- Key relationships:
  - Central hub passing processedPlayers to ProjectionsTable and feeding useVORPCalculations.
  - Holds baselineMode, needWeightEnabled, needAlpha and persists preferences.

14) /Users/tim/Desktop/fhfhockey.com/web/hooks/useCurrentSeason.ts
- Role: Provides current season metadata (seasonId) used by processing hook and UI.
- Consumed by:
  - DraftDashboard.tsx

15) /Users/tim/Desktop/fhfhockey.com/web/lib/supabase (module)
- Role: Supabase client and helpers (e.g., doPOST). Referenced across UI and hooks.
- Consumed by:
  - DraftDashboard.tsx, ProjectionsTable.tsx, upsert-projections.tsx, useProcessedProjectionsData.tsx

16) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/ImportCsvModal.tsx
- Role: Client-side CSV import modal (session-only) per PRD; integrates parsing and mapping; registers custom_csv source.
- Relationships:
  - Uses standardization helpers; updates source controls and processing pipeline.

17) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/SuggestedPicks.tsx
- Role: Suggested picks module (backlog/next steps); consumes VBD/VONA/risk composites.

18) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftSettings.tsx
- Role: Draft settings panel; exposes team count, roster config, snake order, etc.

19) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftBoard.tsx
- Role: Visual draft board and progress tracking.

20) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/MyRoster.tsx
- Role: Displays current team roster and slot allocation, with contributions.

21) /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftSummaryModal.tsx
- Role: End-of-draft or on-demand summary modal; team-level aggregates.

22) Styles referenced (co-located .module.scss files)
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.module.scss
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/ProjectionsTable.module.scss (implied)
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/SuggestedPicks.module.scss
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftSettings.module.scss
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftBoard.module.scss
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/MyRoster.module.scss
- /Users/tim/Desktop/fhfhockey.com/web/components/DraftDashboard/DraftSummaryModal.module.scss

23) Additional config referenced by processing
- /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/yahooConfig.ts (keys for yahoo_* mappings)

Notes
- Database tables used by processing (external dependencies): yahoo_nhl_player_map_mat, yahoo_players, wgo_skater_stats_totals, wgo_goalie_stats_totals, and projections_* tables defined in projectionSourcesConfig.
- This inventory focuses on files to be audited next. No optimizations or code changes performed here.
