# NHL Database

## Tables

### games

- id
- date
- season
- startTime
- gameType
- homeTeamId
- awayTeamId

### teamGameStats

https://api-web.nhle.com/v1/gamecenter/2023020204/landing

https://api-web.nhle.com/v1/gamecenter/2023020204/boxscore

```json
{
"teamGameStats": [
      {
        "category": "sog",
        "awayValue": "35",
        "homeValue": "25"
      },
      {
        "category": "faceoffPctg",
        "awayValue": "72.7",
        "homeValue": "27.3"
      },
      {
        "category": "powerPlay",
        "awayValue": "2/5",
        "homeValue": "0/4"
      },
      {
        "category": "pim",
        "awayValue": "8",
        "homeValue": "10"
      },
      {
        "category": "hits",
        "awayValue": "26",
        "homeValue": "15"
      },
      {
        "category": "blockedShots",
        "awayValue": "18",
        "homeValue": "22"
      },
      {
        "category": "giveaways",
        "awayValue": "6",
        "homeValue": "6"
      },
      {
        "category": "takeaways",
        "awayValue": "6",
        "homeValue": "2"
      }
    ]
}
```

- gameId
- teamId
- score
- sog
- faceoffPctg
- pim
- powerPlayConversion (fetched from boxscore)
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
- shorthandedGoals
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
