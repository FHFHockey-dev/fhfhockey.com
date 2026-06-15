modularization of the game page

web/
├── pages/
│ ├── game/
│ │ └── [gameId].tsx # Main Page
├── components/ # Directory for all reusable components
│ ├── GameDetailsCard.tsx
│ ├── StatTable.tsx
│ ├── StatRow.tsx
│ ├── PlayerComparison.tsx
│ ├── GoalieComparison.tsx
│ └── PoissonDistributionChartWrapper.tsx
├── hooks/ # Custom React hooks for fetching data
│ ├── useFetchGameDetails.ts
│ ├── useFetchGameLandingDetails.ts
│ ├── useFetchTeamStats.ts
│ └── useFetchPowerPlayStats.ts
├── lib/ # Utility functions and possibly shared libraries
│ ├── formatTime.ts
│ ├── calculatePercentage.ts
│ ├── getAdvantage.ts
│ └── NHL/
│ └── teamsInfo.ts # Static data
└── styles/ # CSS Modules or styled-components
├── GameDetailsCard.module.css
├── StatTable.module.css
├── StatRow.module.css
├── PlayerComparison.module.css
├── GoalieComparison.module.css
└── PoissonDistributionChartWrapper.module.css
