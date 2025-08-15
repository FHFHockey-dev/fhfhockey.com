# Fantasy Hockey Draft Dashboard - Product Requirements Document

## Overview
A comprehensive draft dashboard that transforms the projections data into an interactive drafting experience, featuring real-time team building, VORP calculations, and live leaderboards.

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
- **✅ Editable Team Names**: Inline editing in both contribution graph and leaderboard *(JUST COMPLETED)*
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

### State Management
- **Team Names**: Custom team names with fallback to defaults
- **Drafted Players**: Player ID, team assignment, pick metadata
- **Current Turn**: Round, pick position, team identification
- **Roster Progress**: Position-based slot tracking

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
- **Right Panel**: `/components/DraftDashboard/ProjectionsTable.tsx` - Available players table
- **Settings Panel**: `/components/DraftDashboard/DraftSettings.tsx` - Draft configuration controls

### Data & Configuration Files
- **Projections Hook**: `/hooks/useProcessedProjectionsData.tsx` - Main data processing hook
- **Projection Sources**: `/lib/projectionsConfig/projectionSourcesConfig.ts` - Source configuration
- **Stats Master List**: `/lib/projectionsConfig/statsMasterList.ts` - Stat definitions
- **Fantasy Points Config**: `/lib/projectionsConfig/fantasyPointsConfig.ts` - Scoring configurations
- **Global Styles**: `/styles/vars.scss` - Color scheme, spacing, typography, breakpoints

### Integration Points
- **Player Autocomplete**: `/components/PlayerAutocomplete/` - Player search component
- **Team Colors**: `/contexts/TeamColorContext/` - Team color management
- **Supabase Integration**: `/lib/supabase.ts` - Database connection

### Analysis & Utility Components
- **Projection Analysis**: `/components/Projections/ProjectionSourceAnalysis.tsx` - Source accuracy comparison
- **Current Season Hook**: `/hooks/useCurrentSeason.ts` - Season data management
- **Projection Analysis Hook**: `/hooks/useProjectionSourceAnalysis.ts` - Analysis calculations

### CSV Import Reference Files (for future CSV import feature)
- **Upload Page**: `/pages/db/upsert-projections.tsx` - Reference for CSV upload UI
- **API Endpoint**: `/pages/api/v1/db/upsert-csv.ts` - Reference for CSV processing logic
- **Projections Index**: `/pages/projections/index.tsx` - Main projections page

## 📋 NEXT PHASE PRIORITIES

### 1. Team Roster Viewer Dropdown *(NEW PRIORITY)*
**Priority: HIGH**
- **Team Selection Dropdown**: Convert `.teamBadge` in `MyRoster.tsx` to interactive dropdown
- **Dynamic Roster Display**: Show any team's roster by selecting from dropdown
- **Team Name Sync**: Dropdown options reflect custom team names from contribution graph/leaderboard
- **Roster Visualization**: Maintain current roster slot layout but populate with selected team's players
- **Player Name Display**: Show full player names instead of initials when viewing other teams
- **Implementation Points**:
  - Replace static `.teamBadge` with `<TeamSelect>` or similar dropdown component
  - Add state management for `selectedViewTeamId` (separate from `myTeamId`)
  - Update roster data to show selected team's players in all sections
  - Ensure team name changes propagate to dropdown options
  - Add visual indicator to distinguish between "My Team" and "Viewing Team"
- **Files to Modify**:
  - `/components/DraftDashboard/MyRoster.tsx` - Add dropdown and viewing logic
  - `/components/DraftDashboard/MyRoster.module.scss` - Style dropdown and viewing states
  - `/components/DraftDashboard/DraftDashboard.tsx` - Pass team list and names to MyRoster
- **New Components Needed**:
  - Team dropdown component (could reuse existing `TeamSelect` or create new)
  - "Viewing vs My Team" indicator component
- **User Experience**:
  - Default view shows user's own team roster
  - Dropdown shows all teams with current custom names
  - Clear visual distinction between viewing mode and my team mode
  - Quick toggle back to "My Team" view

### 2. VORP (Value Over Replacement Player) System
**Priority: HIGH**
- **Overall VORP**: Calculate league-wide replacement level thresholds
- **Positional VORP**: Position-specific replacement player calculations
- **Integration Points**:
  - Add VORP columns to leaderboard table in `DraftBoard.tsx`
  - Include VORP in player recommendations in `MyRoster.tsx`
  - Display VORP in player details expansion in `ProjectionsTable.tsx`
- **New Files Needed**:
  - `/hooks/useVORPCalculations.ts` - VORP calculation logic
  - `/lib/vorp/` - VORP configuration and utilities

### 3. Best Player Available (BPA) Recommendations
**Priority: HIGH**
- **Smart Recommendations**: Consider current roster construction
- **Positional Needs**: Weight recommendations by roster gaps
- **VORP Integration**: Use VORP values for ranking recommendations
- **UI Components**:
  - Recommendation panel in `MyRoster.tsx`
  - "Recommended" badges in `ProjectionsTable.tsx`
  - Recommendation reasoning tooltips
- **New Files Needed**:
  - `/hooks/usePlayerRecommendations.ts` - Recommendation engine
  - `/components/DraftDashboard/PlayerRecommendations.tsx` - Recommendation UI
  - `/lib/recommendations/` - Recommendation algorithms

### 4. CSV Import System for Custom Projections
**Priority: MEDIUM**
- **Client-Side Import**: Similar to `upsert-projections.tsx` without Supabase
- **Data Processing**: CSV parsing and column mapping
- **Projection Integration**: Merge with existing projection sources
- **Features**:
  - Drag-and-drop CSV upload
  - Column mapping interface
  - Preview and validation
  - Weight assignment for blended projections
- **New Files Needed**:
  - `/components/DraftDashboard/CSVImport.tsx` - Import interface
  - `/hooks/useCustomProjections.ts` - Client-side projection management
  - `/lib/csv/` - CSV parsing utilities
- **Reference Files**: Use existing `upsert-projections.tsx` and `upsert-csv.ts` as templates

### 5. Expandable Player Rows
**Priority: MEDIUM**
- **Row Expansion**: "+" button in `ProjectionsTable.tsx`
- **Detailed Stats**: Show all projected stats (goals, assists, etc.)
- **Comparison View**: Compare multiple players side-by-side
- **Implementation**:
  - Modify existing `ProjectionsTable.tsx`
  - Add collapsible row components
  - Stat breakdown tables
  - Mobile-optimized expansion

### 6. Dynamic Scoring Categories
**Priority: MEDIUM**
- **Category Management**: Add/remove scoring categories
- **Custom Weights**: User-defined point values
- **Real-time Updates**: Recalculate all projections on changes
- **Settings Integration**:
  - Extend existing `DraftSettings.tsx`
  - Category configuration panel
  - Point value inputs
  - Save/load preset configurations
- **Files to Modify**:
  - `/components/DraftDashboard/DraftSettings.tsx` - Add category management
  - `/lib/projectionsConfig/fantasyPointsConfig.ts` - Dynamic configuration
  - `/hooks/useProcessedProjectionsData.tsx` - Support dynamic categories

### 7. Projection Source Selection & Weighting
**Priority: LOW**
- **Source Selection**: Choose active projection sources
- **Weight Configuration**: Custom weight assignments
- **Blended Projections**: Weighted average calculations
- **Features**:
  - Source toggle checkboxes
  - Weight sliders/inputs
  - Preview of blended results
- **Files to Modify**:
  - `/components/DraftDashboard/DraftSettings.tsx` - Add source controls
  - `/hooks/useProcessedProjectionsData.tsx` - Support dynamic weighting
  - `/lib/projectionsConfig/projectionSourcesConfig.ts` - Enhanced source config

## 🛠 TECHNICAL SPECIFICATIONS

### Data Models (Current)
```typescript
// Defined in /components/DraftDashboard/DraftDashboard.tsx
interface DraftSettings {
  teamCount: number;
  scoringCategories: Record<string, number>;
  rosterConfig: { [position: string]: number; bench: number; utility: number };
  draftOrder: string[];
}

interface DraftedPlayer {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
}

interface TeamDraftStats {
  teamId: string;
  teamName: string;
  owner: string;
  projectedPoints: number;
  categoryTotals: Record<string, number>;
  rosterSlots: { [position: string]: DraftedPlayer[] };
  bench: DraftedPlayer[];
}

// Defined in /hooks/useProcessedProjectionsData.tsx
interface ProcessedPlayer {
  playerId: number;
  fullName: string;
  displayPosition: string;
  combinedStats: Record<string, AggregatedStatValue>;
  fantasyPoints: { projected: number };
  // ... additional properties
}
```

### Required Extensions for Next Phase
```typescript
// VORP Calculations - New file: /hooks/useVORPCalculations.ts
interface VORPCalculation {
  playerId: string;
  playerName: string;
  position: string;
  projectedPoints: number;
  replacementPlayerPoints: number;
  vorp: number;
  positionalRank: number;
  overallRank: number;
}

// Player Recommendations - New file: /hooks/usePlayerRecommendations.ts
interface PlayerRecommendation {
  playerId: string;
  reason: 'BPA' | 'POSITIONAL_NEED' | 'VALUE' | 'UPSIDE';
  score: number;
  explanation: string;
}

// Custom Projections - New file: /hooks/useCustomProjections.ts
interface CustomProjectionSource {
  id: string;
  name: string;
  data: ProcessedPlayer[];
  weight: number;
  isActive: boolean;
  uploadDate: Date;
}
```

### Key Integration Points
1. **VORP Hook**: `useVORPCalculations(players, draftSettings)`
2. **Recommendation Engine**: `usePlayerRecommendations(teamStats, availablePlayers)`
3. **CSV Import**: `useCustomProjections()` for client-side data management
4. **Dynamic Scoring**: `useDynamicScoring(categories, players)`

### File Dependencies Map
```
DraftDashboard.tsx
├── hooks/useProcessedProjectionsData.tsx
├── lib/projectionsConfig/fantasyPointsConfig.ts
├── lib/projectionsConfig/projectionSourcesConfig.ts
├── hooks/useCurrentSeason.ts
├── lib/supabase.ts
├── DraftSettings.tsx
├── DraftBoard.tsx
│   ├── DraftBoard.module.scss
│   └── styles/vars.scss
├── MyRoster.tsx
│   ├── MyRoster.module.scss
│   ├── components/PlayerAutocomplete/
│   └── styles/vars.scss
└── ProjectionsTable.tsx
```

## 🎯 SUCCESS METRICS
- **User Engagement**: Time spent in draft dashboard
- **Feature Adoption**: Usage of VORP and recommendations
- **Data Quality**: Accuracy of custom projection imports
- **Performance**: Response time for real-time calculations
- **Mobile Usage**: Mobile device adoption and usability

## 📝 DEVELOPMENT NOTES

### Completed Technical Decisions
- Used GitHub-style contribution graph for visual appeal
- Implemented inline editing for team names with Enter/Escape handling
- Fixed-width team labels (60px) for consistent alignment
- Left-aligned stat columns for better readability
- Green bubble system for roster progress visualization

### Architecture Patterns Established
- **Hook-based data management**: `useProcessedProjectionsData` pattern
- **Component composition**: Modular panel-based design
- **State lifting**: Draft state managed in main component
- **Real-time calculations**: useMemo for performance optimization

### Performance Considerations
- Optimized team stats calculations with proper dependency arrays
- Efficient player lookup using complete dataset (`allPlayers` prop)
- Minimized re-renders with strategic state management

### Mobile Optimization
- Responsive grid layout with mobile-first approach
- Touch-friendly interaction targets
- Optimized contribution graph for mobile viewing
- Collapsible panels for mobile navigation

### CSS Architecture
- **SCSS Modules**: Component-scoped styling
- **Global Variables**: Centralized in `/styles/vars.scss`
- **Responsive Design**: Mobile-first breakpoints
- **Color Theming**: Consistent dark theme throughout

This PRD serves as the foundation for the next development phase, with clear priorities and technical specifications for implementing advanced draft assistance features.