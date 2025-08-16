# Fantasy Hockey Draft Dashboard - Product Requirements Document

## Overview
Create a cohesive Draft Dashboard that helps managers draft faster and smarter. The dashboard combines a visual Draft Graph, a sortable Team Standings leaderboard, a My Roster panel, Player Search/Autocomplete, and a Suggested Picks list. It supports snake drafts, dynamic roster sizes, inline team name editing, and live team/category totals.

## ✅ COMPLETED FEATURES (Phase 1)

### Core Infrastructure
- **✅ Dashboard Layout**: Three-panel bento box layout (40%-20%-40%)
- **✅ Settings Panel**: Full-width top section for draft configuration
- **✅ Responsive Design**: Mobile-optimized with collapsible panels

### Draft Management
- **✅ Team Configuration**: 12-team default with customizable team count
- **✅ Snake Draft Logic**: Proper round-by-round pick order calculation
- **✅ Current Turn Tracking**: Visual indicators and turn management
- **✅ Draft History**: Undo functionality with state management
- **✅ Player Search**: Autocomplete player search and selection
- **✅ Draft Progress**: Visual progress tracking per team

### Team Stats & Visualization
- **✅ GitHub-Style Contribution Graph**: Visual draft board with intensity mapping
- **✅ Team Leaderboard**: Sortable category-based standings
- **✅ Individual Stat Projections**: Goals, Assists, PPP, SOG, Hits, Blocks integration
- **✅ Fantasy Points Calculation**: Real-time projected fantasy points
- **✅ Team Progress Bubbles**: Visual roster completion indicators

### UI/UX Enhancements
- **✅ Editable Team Names**: Inline editing in both contribution graph and leaderboard
  - **Technical Implementation**: Fixed React event handling with manual focus management
  - **Event Prevention**: Added proper `preventDefault()` and `stopPropagation()` to prevent immediate blur
  - **Manual Focus**: Used `useRef` and `useEffect` for reliable input focus instead of `autoFocus`
  - **Dual Input Support**: Separate refs for contribution graph and leaderboard table inputs
  - **Text Selection**: Automatic text selection for improved UX
  - **Key Handlers**: Enter saves, Escape cancels, proper blur handling with timeout
- **✅ Fixed-Width Alignment**: Consistent column alignment in contribution graph
- **✅ Left-Aligned Stats**: Proper text alignment for readability
- **✅ Roster Slot Visualization**: Color-coded filled/empty roster positions

### Data Integration
- **✅ Projections Data Hook**: Integration with `useProcessedProjectionsData`
- **✅ Multi-Source Projections**: Support for multiple projection sources
- **✅ Player Stats Processing**: Combined stats from various sources
- **✅ Yahoo Integration**: Yahoo draft data and player rankings

### VORP Integration *(COMPLETED IN LATEST SESSION)*
- **✅ VORP Calculations Hook**: Complete implementation in `/hooks/useVORPCalculations.ts`
- **✅ Multi-Metric VORP System**: VORP, VONA (Value Over Next Available), VBD (Value Based Drafting)
- **✅ ProjectionsTable Integration**: VORP, VONA, VBD columns added to available players table
- **✅ Real-time Calculations**: Dynamic VORP updates based on drafted players and league settings
- **✅ Positional Analysis**: Best position detection for multi-position players
- **✅ Replacement Level Logic**: Configurable replacement player calculation per position

### ProjectionsTable Improvements *(JUST COMPLETED)*
- **✅ Zebra Striping**: Alternating row colors for better visual separation between players
  - **Technical Details**: Fixed CSS targeting to use `.playerRow` class instead of generic `tr` elements
  - **Color Implementation**: Subtle background variations (-2% vs -5% lightness) maintaining dark theme
  - **Hover Effects**: Enhanced hover states that override zebra stripes for clear interaction feedback
- **✅ Table Layout Optimization**: Fixed table layout with consistent column widths
  - **Column Proportions**: Player name column expanded to 40% width for better readability
  - **Fixed Widths**: Enforced consistent column sizing using `table-layout: fixed`
  - **Text Overflow**: Long player names truncate with ellipsis and show full name on hover
- **✅ Enhanced Typography**: Improved text readability and numeric alignment
  - **Tabular Numerals**: Consistent vertical alignment for all numeric columns (Fantasy Points, VORP, ADP)
  - **Right-Aligned Numbers**: Proper alignment for numeric headers and cells
  - **Increased Padding**: Better cell spacing for improved legibility
  - **Color Enforcement**: Added `!important` to player name colors to ensure visibility
- **✅ Accessibility Improvements**: Better tooltips and title attributes for truncated content
- **✅ Team Column Width**: Increased team abbreviation column from 30px to 40px for better readability
- **✅ Value Bands (NEW)**: VBD and Proj FP cells tinted by percentile among remaining players
  - **Scope Toggle**: Per-position vs overall (default per-position); only players with ADP included
  - **Visuals**: Success/Warning/Danger with 50% tint, solid border, dark text; zebra-stripe friendly
  - **Persistence**: Scope preference persisted to localStorage
- **✅ VORP Baseline Toggle (NEW)**: Remaining vs Full Pool baselines
  - **Default**: Remaining players (dynamic baselines as draft progresses)
  - **Controls**: Header select; affects VORP/VOLS and thus VBD
  - **Persistence**: Baseline mode saved in localStorage
- **✅ Default Sort**: ADP (yahooAvgPick) remains the default initial sort

## 🚧 CURRENT ARCHITECTURE

### Page Structure & Layout
```
/draft-dashboard
├── DraftDashboard.tsx (Main container)
├── DraftSettings.tsx (Top settings bar)
├── DraftBoard.tsx (Left panel - contribution graph + leaderboard)
├── MyRoster.tsx (Center panel - roster management)
└── ProjectionsTable.tsx (Right panel - available players)
```

### Key Data Flows
1. **Draft Settings** → Team count, roster config, scoring categories
2. **Player Projections** → Multi-source weighted projections
3. **Draft State** → Current pick, drafted players, team rosters
4. **Team Stats** → Real-time category totals and fantasy points
5. **VORP Calculations** → Dynamic value calculations based on league state

### State Management
- **Team Names**: Custom team names with fallback to defaults
- **Drafted Players**: Player ID, team assignment, pick metadata
- **Current Turn**: Round, pick position, team identification
- **Roster Progress**: Position-based slot tracking
- **VORP Metrics**: Real-time value calculations per player

## 📁 RELATED FILES & COMPONENTS

### Core Draft Dashboard Files
- **Main Page**: `/pages/draft-dashboard.tsx` - Entry point and page wrapper
- **Main Component**: `/components/DraftDashboard/DraftDashboard.tsx` - Core state management and layout
- **Main Styles**: `/components/DraftDashboard/DraftDashboard.module.scss` - Three-panel layout styling

### Panel Components
- **Left Panel**: `/components/DraftDashboard/DraftBoard.tsx` - Contribution graph + leaderboard
- **Left Panel Styles**: `/components/DraftDashboard/DraftBoard.module.scss` - Visual styling for draft board
- **Center Panel**: `/components/DraftDashboard/MyRoster.tsx` - Team roster management
- **Center Panel Styles**: `/components/DraftDashboard/MyRoster.module.scss` - Roster visualization styling
- **Right Panel**: `/components/DraftDashboard/ProjectionsTable.tsx` - Available players table *(RECENTLY ENHANCED)*
- **Right Panel Styles**: `/components/DraftDashboard/ProjectionsTable.module.scss` - Enhanced table styling with zebra stripes *(RECENTLY UPDATED)*
- **Settings Panel**: `/components/DraftDashboard/DraftSettings.tsx` - Draft configuration controls

### Data & Analysis Hooks *(RECENTLY COMPLETED)*
- **VORP Calculations**: `/hooks/useVORPCalculations.ts` - Complete VORP/VONA/VBD calculation system *(NEW)*
- **Projections Hook**: `/hooks/useProcessedProjectionsData.tsx` - Main data processing hook
- **Current Season Hook**: `/hooks/useCurrentSeason.ts` - Season data management

### Configuration Files
- **Projection Sources**: `/lib/projectionsConfig/projectionSourcesConfig.ts` - Source configuration
- **Stats Master List**: `/lib/projectionsConfig/statsMasterList.ts` - Stat definitions
- **Fantasy Points Config**: `/lib/projectionsConfig/fantasyPointsConfig.ts` - Scoring configurations
- **Global Styles**: `/styles/vars.scss` - Color scheme, spacing, typography, breakpoints *(REFERENCE FOR STYLING)*

### Integration Points
- **Player Autocomplete**: `/components/PlayerAutocomplete/` - Player search component
- **Team Colors**: `/contexts/TeamColorContext/` - Team color management
- **Supabase Integration**: `/lib/supabase.ts` - Database connection

## 📋 IMMEDIATE NEXT PRIORITIES (UPDATED)

### 1) Suggested Picks Module (NEW)
...existing code...

## What was accomplished
...existing code...

## Files touched
...existing code...

## Completed tasks (✓)
...existing code...

## Next tasks
1. Refactor team label width into a shared SCSS token
   - Define a single variable (e.g., $team-label-width) in styles/vars.scss and use it for .teamLabel, .teamLabelInput, and .teamLabelSpacer to avoid drift.
2. Improve heatmap intensity scaling
   - Current max uses draftedPlayers only; consider using max across allPlayers.fantasyPoints.projected for more stable color scaling early in drafts.
3. MyRoster component improvements (component exists and is implemented)
   - Audit web/components/DraftDashboard/MyRoster.tsx for prop alignment with DraftDashboard (teamStatsList, draftSettings, availablePlayers, allPlayers, onDraftPlayer, etc.).
   - Verify roster slot counts vs draftSettings.rosterConfig; ensure UTIL handling and bench counts match.
   - Optional: add drag-and-drop for reordering within slots/bench. If adopted, use dnd-kit and persist order in state.
   - Add tests for roster progress and slot rendering.
4. Persist team name edits
   - Wire onUpdateTeamName to backend (Supabase or app state) so edits persist across reloads.
5. Round labels UX
   - Ensure .roundLabelsGrid columns exactly match team grid and remain sticky on horizontal scroll if needed.
6. Performance
   - If teamCount*roundsToShow is large, consider virtualizing rows/columns or simplifying DOM (e.g., windowed grid).
7. Testing
   - Add visual/regression tests for grid alignment and sorting. Include unit tests for categoryTotals computed from allPlayers.combinedStats.

## Implementation recommendations
- SCSS tokenization
  - Add $team-label-width: 60px in styles/vars.scss and replace hardcoded 60px in DraftBoard.module.scss selectors (.teamLabel, .teamLabelInput, .teamLabelSpacer).
- Heatmap scaling
  - Compute maxFantasyPoints from allPlayers first; fallback to a sane default if null. Keep getHeatMapIntensity thresholds as percentages.
- MyRoster
  - The component at web/components/DraftDashboard/MyRoster.tsx is present and used by DraftDashboard. Focus on QA and enhancements (prop types, slot correctness, optional DnD) rather than initial implementation.
- Team name persistence
  - If using Supabase, add a table (e.g., draft_teams) with id/name; update via RPC or simple upsert on edit. Debounce saves on blur/enter.
- Accessibility
  - Add aria-labels/titles to cells and inputs. Ensure keyboard focus styling on editable team labels and inputs.

## Key context for next session
...existing code...

## Notes
- Remove outdated references stating MyRoster.tsx is empty; it is already implemented and imported in DraftDashboard.

PROMPT

You are joining mid-project to continue work on a Fantasy Hockey Draft Dashboard (Next.js + React + TypeScript + SCSS Modules + Supabase). Keep changes minimal, type-safe, and aligned with existing patterns.

Context
- Repo root: /Users/tim/Desktop/fhfhockey.com
- App root: /Users/tim/Desktop/fhfhockey.com/web
- Tech: Next.js, TypeScript (strict), CSS Modules (SCSS), Supabase
- Key features already done:
  - VORP/VONA/VBD integrated (hooks/useVORPCalculations.ts)
  - ProjectionsTable enhanced (zebra striping, value bands, baseline toggle)
  - MyRoster exists and is implemented; it uses usePlayerRecommendations and consumes VORP metrics
  - PRD updated: tasks/prd-draft-dashboard.md (reflects MyRoster presence)
- Important types/hooks to be aware of:
  - hooks/useProcessedProjectionsData.tsx (ProcessedPlayer, TableDataRow union, fantasyPoints projected/actual, ADP fields)
  - lib/projectionsConfig/fantasyPointsConfig.ts (defaults)
  - styles/vars.scss (centralized tokens; contains many existing variables)

Primary Targets for this session
1) SCSS tokenization for team label width
   - Add a shared token: $team-label-width: 60px in web/styles/vars.scss.
   - Refactor any hardcoded widths in Draft Board styles to use this token (likely in web/components/DraftDashboard/DraftBoard.module.scss):
     - .teamLabel
     - .teamLabelInput
     - .teamLabelSpacer
   - Acceptance:
     - All three selectors use $team-label-width.
     - Visual alignment unchanged vs current UI.

2) Heatmap intensity scaling improvement
   - Current intensity uses draftedPlayers-only max; change to a more stable early-draft baseline:
     - Compute max from allPlayers.fantasyPoints.projected if available, else fall back to previous behavior or a sane default.
   - Likely files: web/components/DraftDashboard/DraftBoard.tsx and/or a local helper it uses for getHeatMapIntensity.
   - Acceptance:
     - Early rounds no longer over-saturate or under-saturate drastically.
     - No runtime errors if fantasyPoints.projected is null; uses fallback.

3) MyRoster QA pass (component exists; enhance and validate)
   - Path: web/components/DraftDashboard/MyRoster.tsx
   - Ensure prop alignment with DraftDashboard:
     - teamStatsList, draftSettings, availablePlayers, allPlayers, onDraftPlayer, canDraft, currentPick, currentTurn, teamOptions
     - VORP props: vorpMetrics?: Map<string, PlayerVorpMetrics>, needWeightEnabled?: boolean, needAlpha?: number, posNeeds?: Record<string, number>
   - Validate suggested picks sorting and localStorage persistence keys:
     - suggested.sortField, suggested.sortDir
   - Confirm recommendation fields cover: rank, name, pos, projFp, vorp, vbd, adp, avail, fit
   - Acceptance:
     - No TypeScript errors.
     - Sorting/persistence works across reloads.
     - No API changes required upstream.

Nice-to-have (only if time remains)
- Persist team name edits to backend or app state (wire through existing edit flow).
- Add unit tests for heatmap scaling and MyRoster sorting persistence (web/__tests__/).

Constraints
- Maintain TypeScript strictness and existing patterns.
- Keep CSS Modules scoping intact.
- Avoid regressions in layout/alignment.
- Keep changes focused to the files listed; do not refactor unrelated modules.

Paths to inspect and modify
- web/components/DraftDashboard/DraftBoard.module.scss (team label widths)
- web/components/DraftDashboard/DraftBoard.tsx (heatmap intensity logic)
- web/components/DraftDashboard/MyRoster.tsx (QA and minor fixes)
- web/styles/vars.scss (add $team-label-width)

Acceptance checklist
- Builds and typechecks cleanly.
- UI alignment unchanged for team labels after tokenization.
- Heatmap intensity behaves more consistently early in drafts.
- MyRoster recommendations sort and persist settings correctly.

Please:
- Identify exact selectors/usages for team label width and replace with the new token.
- Implement the heatmap max detection with safe fallbacks.
- Audit MyRoster props and sorting/persistence with minimal code changes.
- Summarize the changes and any follow-ups needed.