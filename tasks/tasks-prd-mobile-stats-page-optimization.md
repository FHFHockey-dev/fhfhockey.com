# Task List: Mobile Stats Page Optimization

## Project Context for LLM Continuation

**Project Status:** We have completed Task 1.0 (Enhance SCSS Variables and Mobile Foundation) and Task 2.0 (Implement Mobile-First Layout Structure). We are currently working on Task 3.0 (Optimize Teams Grid for Mobile Touch Interactions).

**What Was Completed:**
- Added comprehensive mobile-specific variables to `web/styles/vars.scss`
- All 5 subtasks of Task 1.0 are complete and committed to git
- ✅ **Task 2.0 COMPLETED:** Full mobile-first layout implementation with single-column stack
- ✅ **Task 3.1 PARTIALLY COMPLETED:** Teams grid converted to 8-column layout, but visibility issues remain

**Current Issues Identified - Teams Grid Layout:**

### **Issue 1: Touch Target Size Conflicts**
- **Problem**: The current 8-column grid shows only ~6.5 logos per row instead of 8 full logos
- **Root Cause**: Touch target minimums (44px) combined with padding create width constraints
- **Impact**: Users cannot see all team logos in each row, causing horizontal scrolling

### **Issue 2: Padding/Spacing Overconsumption** 
- **Problem**: Multiple layers of padding between `.teamListItem` and `.teamLogoContainer` consume grid space
- **Root Cause**: 
  - `.teamListItem` has `padding: v.$mobile-space-xxs` (4px)
  - `.teamLogoContainer` has additional padding and borders
  - Combined padding reduces available space for actual logos
- **Impact**: Logo containers are smaller than necessary, logos appear cut off

### **Issue 3: Inefficient Space Utilization**
- **Problem**: Current grid doesn't maximize available screen width for logo display
- **Root Cause**: Conservative spacing approach prioritizes touch targets over content visibility
- **Impact**: Poor user experience with partial logo visibility

## **Structured Solutions for LLM Implementation:**

### **Solution A: Reduce Padding Hierarchy (Recommended)**
```scss
// Current problematic structure:
.teamListItem { padding: 4px; }
.teamLogoContainer { padding: additional; border: 1px; }

// Proposed optimized structure:
.teamListItem { padding: 1-2px; } // Minimal outer padding
.teamLogoContainer { padding: 2px; border: none or 1px; } // Reduced inner padding
```

### **Solution B: Optimize Touch Target Strategy**
- **Current**: Minimum 44px touch targets with padding
- **Proposed**: 44px total touch area INCLUDING padding (not additional to padding)
- **Implementation**: Calculate total touch area, then work backwards to determine optimal padding

### **Solution C: Responsive Grid Adjustments**
- **320px screens**: Ultra-compact spacing, prioritize visibility
- **375px+ screens**: Slightly more comfortable spacing
- **414px+ screens**: Enhanced spacing while maintaining 8-column layout

## **Implementation Priority Order:**
1. **First**: Reduce nested padding between `.teamListItem` and `.teamLogoContainer`
2. **Second**: Adjust touch target calculation to be inclusive of all padding
3. **Third**: Test on multiple screen sizes to ensure 8 full logos are visible
4. **Fourth**: Ensure logos are not cut off or partially hidden

**Key Variables to Adjust:**
- `v.$mobile-space-xxs` (currently 4px) - may need to reduce to 2-3px
- `v.$touch-target-min` (currently 44px) - should be total area, not minimum plus padding
- Grid gap values in `.teamList`
- Border and padding values in `.teamLogoContainer`

**Success Criteria:**
- All 8 team logos fully visible in each row on 320px+ screens
- No horizontal scrolling required for teams grid
- Touch targets remain accessible (minimum 40-44px total area)
- Logos are not cut off or partially obscured

## Relevant Files

- `web/styles/vars.scss` - ✅ COMPLETED: Added mobile-specific variables for touch targets, spacing, and breakpoints
- `web/styles/Stats.module.scss` - ✅ **UPDATED:** Implemented mobile-first single-column layout with progressive enhancement
- `web/pages/stats/index.tsx` - Add mobile-specific state management and component restructuring
- `web/components/StatsPage/PlayerSearchBar.tsx` - Optimize search bar for mobile interactions and sticky positioning
- `web/components/StatsPage/LeaderboardCategory.tsx` - Implement condensed mobile layout and touch interactions
- `web/components/StatsPage/LeaderboardCategoryGoalie.tsx` - Implement condensed mobile layout for goalie stats
- `web/components/StatsPage/LeaderboardCategoryBSH.tsx` - Implement condensed mobile layout for BSH stats
- `web/components/StatsPage/MobileTabInterface.tsx` - Create new tabbed interface component for mobile leaderboards (if tabs approach is chosen)

### Implementation Notes

- **Mobile-first approach:** Start with mobile styles and enhance for larger screens
- **Use new mobile variables:** Reference the mobile-specific variables added to `vars.scss`
- **Maintain existing functionality:** All current features must work on mobile
- **Touch targets:** Focus on 44px minimum touch targets throughout implementation
- **Teams grid priority:** Keep teams grid and search bar at top with sticky positioning
- **Leaderboards:** Condense into cards below main content, consider tabbed interface

## Tasks

- [x] 1.0 Enhance SCSS Variables and Mobile Foundation ✅ COMPLETED & COMMITTED
  - [x] 1.1 Add mobile-specific breakpoint variables to `vars.scss` for precise mobile targeting (320px-480px range)
  - [x] 1.2 Create touch target variables (minimum 44px) and mobile spacing scale variables
  - [x] 1.3 Add mobile typography variables for improved readability on small screens
  - [x] 1.4 Define mobile-specific z-index variables for sticky positioning and overlays
  - [x] 1.5 Create mobile animation duration variables optimized for touch devices
- [ ] 2.0 Implement Mobile-First Layout Structure ✅ COMPLETED
  - [x] 2.1 Convert main layout from 3-column grid to single-column mobile stack in `Stats.module.scss` ✅ COMPLETED
  - [x] 2.2 Implement sticky positioning for teams grid container at top of mobile layout ✅ COMPLETED (converted to normal flow)
  - [x] 2.3 Position search bar immediately below teams grid with persistent visibility ✅ COMPLETED (converted to normal flow)
  - [x] 2.4 Restructure leaderboard sections to appear below main content as condensed cards ✅ COMPLETED
  - [x] 2.5 Add mobile-specific container padding and margin adjustments for edge-to-edge design ✅ COMPLETED
  - [x] 2.6 Implement progressive enhancement media queries (mobile-first, then tablet, then desktop) ✅ COMPLETED
- [ ] 3.0 Optimize Teams Grid for Mobile Touch Interactions
  - [🔄] 3.1 Convert teams grid from 16-column to 8-column layout for mobile (4 rows × 8 teams) - **IN PROGRESS: Layout converted but visibility issues remain**
    - **Current Issue**: Only ~6.5 logos visible per row due to padding/touch target conflicts
    - **Required Fix**: Reduce nested padding between `.teamListItem` and `.teamLogoContainer`
    - **Expected Outcome**: All 8 logos fully visible per row without horizontal scroll
  - [ ] 3.2 Optimize padding hierarchy to maximize logo visibility while maintaining touch targets
    - **Focus**: Reduce combined padding from multiple container layers
    - **Target**: 44px total touch area (inclusive of all padding, not additional)
  - [ ] 3.3 Test logo visibility across screen sizes (320px, 375px, 414px)
    - **Validation**: Ensure no logos are cut off or require horizontal scrolling
  - [ ] 3.4 Implement touch-friendly hover states that work with touch devices
  - [ ] 3.5 Optimize team color gradient animations for mobile performance (reduce complexity)
  - [ ] 3.6 Ensure team selection remains accessible during page scroll on mobile
- [ ] 4.0 Create Mobile-Optimized Leaderboard Components
  - [ ] 4.1 Reduce height of leaderboard cards in `LeaderboardCategory.tsx` for mobile consumption
  - [ ] 4.2 Implement condensed player information display (name, key stat, team)
  - [ ] 4.3 Create expandable sections for detailed statistics with touch-friendly expand/collapse
  - [ ] 4.4 Optimize leaderboard typography and spacing for mobile readability
  - [ ] 4.5 Add touch-friendly player links with proper tap targets
  - [ ] 4.6 Consider implementing tabbed interface for Skater vs Goaltender statistics
  - [ ] 4.7 Ensure consistent mobile optimizations across all leaderboard component types
- [ ] 5.0 Implement Performance Optimizations and Touch Enhancements
  - [ ] 5.1 Add lazy loading for team logos and images below the fold
  - [ ] 5.2 Optimize CSS animations and transitions for 60fps performance on mobile
  - [ ] 5.3 Implement proper touch event handling for swipe gestures where appropriate
  - [ ] 5.4 Add loading states and skeleton screens for mobile network conditions
  - [ ] 5.5 Optimize search bar for mobile keyboards and autocomplete functionality
  - [ ] 5.6 Test and validate touch interactions across different mobile devices and screen sizes
  - [ ] 5.7 Implement accessibility improvements for mobile screen readers and touch navigation