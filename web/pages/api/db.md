# NHL Database

## Tables

### games

- id
- date
- season
- startTimeUTC
- gameType
- homeTeamId
- awayTeamId

### teamGameStats

- gameId
- teamId
- score
- sog
- faceoffPctg
- pim
- powerPlayConversion
- hits
- blockedShots
- giveaways
- takeaways
- powerPlay

### players

- id
- currentTeamId
- firstName
- lastName
- fullName
- position
- sweaterNumber
- birthDate
- birthCity
- birthCountry
- heightInCentimeters
- weightInKilograms

### playerGameStats

1. [https://api-web.nhle.com/v1/player/8478402/landing](https://api-web.nhle.com/v1/player/8478402/landing)
1. [https://api-web.nhle.com/v1/gamecenter/2023020204/boxscore](https://api-web.nhle.com/v1/gamecenter/2023020204/boxscore)

### forwardsGameStats

- playerId
- gameId
- position
- goals
- assists
- points
- plusMinus
- pim
- hits
- blockedShots
- powerPlayGoals
- powerPlayPoints
- shPoints
- shots
- faceoffs
- faceoffWinningPctg
- toi
- powerPlayToi
- shorthandedToi

### defenseGameStats

- playerId
- gameId
- position
- goals
- assists
- points
- plusMinus
- pim
- hits
- blockedShots
- powerPlayGoals
- powerPlayPoints
- shorthandedGoals
- shPoints
- shots
- faceoffs
- faceoffWinningpctg
- toi
- powerPlayToi
- shorthandedToi

### goaliesGameStats

- playerId
- gameId
- position
- evenStrengthShotsAgainst
- powerPlayShotsAgainst
- shorthandedShotsAgainst
- saveShotsAgainst
- savePctg
- evenStrengthGoalsAgainst
- powerPlayGoalsAgainst
- shorthandedGoalsAgainst
- pim
- goalsAgainst
- toi

### teams

- id
- franchisedId
- fullName
- leagueId
- triCode

### seasons

- id
- startDate
- endDate
- regularSeasonEndDate
- numberOfGames
