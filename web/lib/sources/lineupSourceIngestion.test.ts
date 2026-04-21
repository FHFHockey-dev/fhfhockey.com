import { describe, expect, it } from "vitest";

import {
  buildGoalieStartSourceFromModel,
  buildGoalieStartSourceFromOfficialLineup,
  buildTeamDirectory,
  parseDailyFaceoffStartingGoaliesPage,
  parseDailyFaceoffLineCombinationsPage,
  parseGameDayTweetsLinesPage,
  parseNhlLineupProjectionsPage,
  selectBestGoalieStartSource,
  selectBestPregameLineupSource,
  validateLineupNames
} from "./lineupSourceIngestion";

const teams = buildTeamDirectory([
  {
    id: 8,
    name: "Montréal Canadiens",
    abbreviation: "MTL",
    logo: "/teamLogos/MTL.png"
  },
  {
    id: 14,
    name: "Tampa Bay Lightning",
    abbreviation: "TBL",
    logo: "/teamLogos/TBL.png"
  }
]);

const tampaRoster = [
  { playerId: 1, fullName: "Gage Goncalves", lastName: "Goncalves" },
  { playerId: 2, fullName: "Brayden Point", lastName: "Point" },
  { playerId: 3, fullName: "Nikita Kucherov", lastName: "Kucherov" },
  { playerId: 4, fullName: "Brandon Hagel", lastName: "Hagel" },
  { playerId: 5, fullName: "Anthony Cirelli", lastName: "Cirelli" },
  { playerId: 6, fullName: "Jake Guentzel", lastName: "Guentzel" },
  { playerId: 7, fullName: "Andrei Vasilevskiy", lastName: "Vasilevskiy" },
  { playerId: 8, fullName: "Jonas Johansson", lastName: "Johansson" }
];

describe("lineupSourceIngestion", () => {
  it("parses NHL.com projected lineups into normalized team records", () => {
    const parsed = parseNhlLineupProjectionsPage({
      html: `
        <body>
          **Lightning projected lineup**

          Gage Goncalves -- Brayden Point -- Nikita Kucherov

          Brandon Hagel -- Anthony Cirelli -- Jake Guentzel

          Zemgus Girgensons -- Yanni Gourde -- Nick Paul

          Corey Perry -- Dominic James -- Scott Sabourin

          J.J. Moser -- Darren Raddysh

          Ryan McDonagh -- Erik Cernak

          Declan Carlile -- Emil Lilleberg

          Andrei Vasilevskiy

          Jonas Johansson

          **Scratched:** Oliver Bjorkstrand, Conor Geekie

          **Injured:** Victor Hedman (personal leave)
        </body>
      `,
      teams,
      sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
      rosterByTeam: new Map([[14, tampaRoster]])
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      sourceName: "nhl.com",
      isOfficial: true,
      forwards: [
        ["Gage Goncalves", "Brayden Point", "Nikita Kucherov"],
        ["Brandon Hagel", "Anthony Cirelli", "Jake Guentzel"],
        ["Zemgus Girgensons", "Yanni Gourde", "Nick Paul"],
        ["Corey Perry", "Dominic James", "Scott Sabourin"]
      ],
      goalies: ["Andrei Vasilevskiy", "Jonas Johansson"],
      scratches: ["Oliver Bjorkstrand", "Conor Geekie"]
    });
    expect(parsed[0]?.injuries).toEqual([
      { playerName: "Victor Hedman", note: "personal leave" }
    ]);
  });

  it("rejects DailyFaceoff pages when the source is Last Game", () => {
    const parsed = parseDailyFaceoffLineCombinationsPage({
      html: `
        <body>
          <div>Last updated: 2026-04-21T14:43:32.212Z</div>
          <div>Source: Last Game</div>
          <section id="line_combos">
            <span id="forwards">Forwards</span>
            <a href="/players/news/gage-goncalves/1"><span>Gage Goncalves</span></a>
            <a href="/players/news/brayden-point/2"><span>Brayden Point</span></a>
            <a href="/players/news/nikita-kucherov/3"><span>Nikita Kucherov</span></a>
            <span id="defense">Defensive Pairings</span>
            <a href="/players/news/jj-moser/4"><span>J.J. Moser</span></a>
            <a href="/players/news/darren-raddysh/5"><span>Darren Raddysh</span></a>
            <span id="powerplay">1st Powerplay Unit</span>
            <span id="goalies">Goalies</span>
            <a href="/players/news/andrei-vasilevskiy/6"><span>Andrei Vasilevskiy</span></a>
            <a href="/players/news/jonas-johansson/7"><span>Jonas Johansson</span></a>
          </section>
        </body>
      `,
      team: teams[1],
      rosterEntries: tampaRoster,
      sourceUrl: "https://www.dailyfaceoff.com/teams/tampa-bay-lightning/line-combinations"
    });

    expect(parsed.status).toBe("rejected");
    expect(parsed.metadata).toMatchObject({
      pageState: "last_game"
    });
  });

  it("classifies GameDayTweets lineup tweets and validates roster hits", () => {
    const parsed = parseGameDayTweetsLinesPage({
      html: `
        <body>
          <blockquote class="tweet">
            <a href="https://twitter.com/EddieInTheYard">@EddieInTheYard</a>
            #GoBolts pregame warmups:
            Goncalves-Point-Kucherov
            Hagel-Cirelli-Guentzel
            <a href="https://twitter.com/GameDayLines/status/123">tweet</a>
          </blockquote>
        </body>
      `,
      team: teams[1],
      rosterEntries: tampaRoster,
      sourceUrl: "https://www.gamedaytweets.com/lines?team=TBL"
    });

    expect(parsed.tweets).toHaveLength(1);
    expect(parsed.tweets[0]).toMatchObject({
      classification: "lineup"
    });
    expect(parsed.selectedLineup?.sourceName).toBe("gamedaytweets");
    expect(parsed.selectedLineup?.metadata).toMatchObject({
      candidateClassification: "lineup"
    });
  });

  it("prefers official NHL lineups over fallback sources", () => {
    const nhl = {
      ...parseNhlLineupProjectionsPage({
        html: `
          <body>
            **Lightning projected lineup**
            Gage Goncalves -- Brayden Point -- Nikita Kucherov
            Brandon Hagel -- Anthony Cirelli -- Jake Guentzel
            Zemgus Girgensons -- Yanni Gourde -- Nick Paul
            Corey Perry -- Dominic James -- Scott Sabourin
            J.J. Moser -- Darren Raddysh
            Ryan McDonagh -- Erik Cernak
            Declan Carlile -- Emil Lilleberg
            Andrei Vasilevskiy
            Jonas Johansson
          </body>
        `,
        teams,
        sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
        rosterByTeam: new Map([[14, tampaRoster]])
      })[0]
    };

    const dfo = parseDailyFaceoffLineCombinationsPage({
      html: `
        <body>
          <div>Last updated: 2026-04-21T14:43:32.212Z</div>
          <div>Source: Gabby Shirley</div>
          <section id="line_combos">
            <span id="forwards">Forwards</span>
            <a href="/players/news/gage-goncalves/1"><span>Gage Goncalves</span></a>
            <a href="/players/news/brayden-point/2"><span>Brayden Point</span></a>
            <a href="/players/news/nikita-kucherov/3"><span>Nikita Kucherov</span></a>
            <a href="/players/news/brandon-hagel/4"><span>Brandon Hagel</span></a>
            <a href="/players/news/anthony-cirelli/5"><span>Anthony Cirelli</span></a>
            <a href="/players/news/jake-guentzel/6"><span>Jake Guentzel</span></a>
            <a href="/players/news/zemgus-girgensons/7"><span>Zemgus Girgensons</span></a>
            <a href="/players/news/yanni-gourde/8"><span>Yanni Gourde</span></a>
            <a href="/players/news/nick-paul/9"><span>Nick Paul</span></a>
            <span id="defense">Defensive Pairings</span>
            <a href="/players/news/jj-moser/10"><span>J.J. Moser</span></a>
            <a href="/players/news/darren-raddysh/11"><span>Darren Raddysh</span></a>
            <a href="/players/news/ryan-mcdonagh/12"><span>Ryan McDonagh</span></a>
            <a href="/players/news/erik-cernak/13"><span>Erik Cernak</span></a>
            <span id="powerplay">1st Powerplay Unit</span>
            <span id="goalies">Goalies</span>
            <a href="/players/news/andrei-vasilevskiy/6"><span>Andrei Vasilevskiy</span></a>
            <a href="/players/news/jonas-johansson/7"><span>Jonas Johansson</span></a>
          </section>
        </body>
      `,
      team: teams[1],
      rosterEntries: tampaRoster,
      sourceUrl: "https://www.dailyfaceoff.com/teams/tampa-bay-lightning/line-combinations"
    });

    expect(selectBestPregameLineupSource([dfo, nhl])?.sourceName).toBe("nhl.com");
  });

  it("drops stale lineup sources before ranking the remaining options", () => {
    const nhl = parseNhlLineupProjectionsPage({
      html: `
        <body>
          **Lightning projected lineup**
          Gage Goncalves -- Brayden Point -- Nikita Kucherov
          Brandon Hagel -- Anthony Cirelli -- Jake Guentzel
          Zemgus Girgensons -- Yanni Gourde -- Nick Paul
          Corey Perry -- Dominic James -- Scott Sabourin
          J.J. Moser -- Darren Raddysh
          Ryan McDonagh -- Erik Cernak
          Declan Carlile -- Emil Lilleberg
          Andrei Vasilevskiy
          Jonas Johansson
        </body>
      `,
      teams,
      sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
      observedAt: "2026-04-20T00:00:00.000Z",
      rosterByTeam: new Map([[14, tampaRoster]])
    })[0];

    const dfo = parseDailyFaceoffLineCombinationsPage({
      html: `
        <body>
          <div>Last updated: 2026-04-21T14:43:32.212Z</div>
          <div>Source: Gabby Shirley</div>
          <section id="line_combos">
            <span id="forwards">Forwards</span>
            <a href="/players/news/gage-goncalves/1"><span>Gage Goncalves</span></a>
            <a href="/players/news/brayden-point/2"><span>Brayden Point</span></a>
            <a href="/players/news/nikita-kucherov/3"><span>Nikita Kucherov</span></a>
            <a href="/players/news/brandon-hagel/4"><span>Brandon Hagel</span></a>
            <a href="/players/news/anthony-cirelli/5"><span>Anthony Cirelli</span></a>
            <a href="/players/news/jake-guentzel/6"><span>Jake Guentzel</span></a>
            <a href="/players/news/zemgus-girgensons/7"><span>Zemgus Girgensons</span></a>
            <a href="/players/news/yanni-gourde/8"><span>Yanni Gourde</span></a>
            <a href="/players/news/nick-paul/9"><span>Nick Paul</span></a>
            <span id="defense">Defensive Pairings</span>
            <a href="/players/news/jj-moser/10"><span>J.J. Moser</span></a>
            <a href="/players/news/darren-raddysh/11"><span>Darren Raddysh</span></a>
            <a href="/players/news/ryan-mcdonagh/12"><span>Ryan McDonagh</span></a>
            <a href="/players/news/erik-cernak/13"><span>Erik Cernak</span></a>
            <span id="powerplay">1st Powerplay Unit</span>
            <span id="goalies">Goalies</span>
            <a href="/players/news/andrei-vasilevskiy/6"><span>Andrei Vasilevskiy</span></a>
            <a href="/players/news/jonas-johansson/7"><span>Jonas Johansson</span></a>
          </section>
        </body>
      `,
      team: teams[1],
      rosterEntries: tampaRoster,
      sourceUrl: "https://www.dailyfaceoff.com/teams/tampa-bay-lightning/line-combinations"
    });

    expect(
      selectBestPregameLineupSource([nhl, dfo], "2026-04-21T15:00:00.000Z")?.sourceName
    ).toBe("dailyfaceoff");
  });

  it("matches last names against the active roster when full names are missing", () => {
    expect(validateLineupNames(["Point", "Kucherov"], tampaRoster)).toMatchObject({
      matchedPlayerIds: [2, 3],
      unmatchedNames: []
    });
  });

  it("parses DailyFaceoff starting goalies and reconciles them against fallback sources", () => {
    const dfoGoalies = parseDailyFaceoffStartingGoaliesPage({
      html: `
        <body>
          NHL Starting Goalies: Tuesday, April 21
          Montreal Canadiens at Tampa Bay Lightning2026-04-21T23:00:00.000Z
          Jakub DobesUnconfirmed Show More50W-L-OTL:29-10-4GAA:2.78SV%:0.901SO:0Line Combos|News|Stats|Schedule
          Andrei VasilevskiyConfirmed2026-04-21T16:26:33.693ZShow More87W-L-OTL:38-15-4GAA:2.35SV%:0.909SO:1
          Vasilevskiy starts tonight. Source: Gabby ShirleyLine Combos|News|Stats|Schedule
          The Daily Fantasy Hockey Goalie Rankings
        </body>
      `,
      teams,
      rosterByTeam: new Map([
        [8, [{ playerId: 20, fullName: "Jakub Dobes", lastName: "Dobes" }]],
        [14, tampaRoster]
      ]),
      sourceUrl: "https://www.dailyfaceoff.com/starting-goalies"
    });

    expect(dfoGoalies).toHaveLength(2);
    expect(dfoGoalies[1]).toMatchObject({
      team: { abbreviation: "TBL" },
      goalieName: "Andrei Vasilevskiy",
      startStatus: "confirmed"
    });

    const officialLineup = parseNhlLineupProjectionsPage({
      html: `
        <body>
          **Lightning projected lineup**
          Gage Goncalves -- Brayden Point -- Nikita Kucherov
          Brandon Hagel -- Anthony Cirelli -- Jake Guentzel
          Zemgus Girgensons -- Yanni Gourde -- Nick Paul
          Corey Perry -- Dominic James -- Scott Sabourin
          J.J. Moser -- Darren Raddysh
          Ryan McDonagh -- Erik Cernak
          Declan Carlile -- Emil Lilleberg
          Andrei Vasilevskiy
          Jonas Johansson
        </body>
      `,
      teams,
      sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
      rosterByTeam: new Map([[14, tampaRoster]])
    })[0];

    const officialGoalie = buildGoalieStartSourceFromOfficialLineup({
      lineupSource: officialLineup,
      rosterEntries: tampaRoster
    });

    const modelGoalie = buildGoalieStartSourceFromModel({
      team: teams[1],
      sourceUrl: "/api/v1/db/update-goalie-projections-v2",
      goalieName: "Andrei Vasilevskiy",
      goaliePlayerId: 7,
      startProbability: 0.73
    });

    expect(
      selectBestGoalieStartSource([
        modelGoalie,
        officialGoalie,
        dfoGoalies.find((goalie) => goalie.team.id === 14)
      ])?.sourceName
    ).toBe("dailyfaceoff");
  });

  it("drops stale goalie sources before ranking the remaining options", () => {
    const staleOfficialGoalie = buildGoalieStartSourceFromOfficialLineup({
      lineupSource: {
        ...parseNhlLineupProjectionsPage({
          html: `
            <body>
              **Lightning projected lineup**
              Gage Goncalves -- Brayden Point -- Nikita Kucherov
              Brandon Hagel -- Anthony Cirelli -- Jake Guentzel
              Zemgus Girgensons -- Yanni Gourde -- Nick Paul
              Corey Perry -- Dominic James -- Scott Sabourin
              J.J. Moser -- Darren Raddysh
              Ryan McDonagh -- Erik Cernak
              Declan Carlile -- Emil Lilleberg
              Andrei Vasilevskiy
              Jonas Johansson
            </body>
          `,
          teams,
          sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
          observedAt: "2026-04-20T00:00:00.000Z",
          rosterByTeam: new Map([[14, tampaRoster]])
        })[0]
      },
      rosterEntries: tampaRoster
    });

    const modelGoalie = buildGoalieStartSourceFromModel({
      team: teams[1],
      sourceUrl: "/api/v1/db/update-goalie-projections-v2",
      goalieName: "Andrei Vasilevskiy",
      goaliePlayerId: 7,
      startProbability: 0.73,
      observedAt: "2026-04-21T12:00:00.000Z"
    });

    expect(
      selectBestGoalieStartSource(
        [staleOfficialGoalie, modelGoalie],
        "2026-04-21T15:00:00.000Z"
      )?.sourceName
    ).toBe("goalie_start_projections");
  });
});
