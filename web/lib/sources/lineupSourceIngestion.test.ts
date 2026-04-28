import { describe, expect, it } from "vitest";

import {
  buildGameDayTweetsLineupSourceFromTweet,
  buildGoalieStartSourceFromModel,
  buildGoalieStartSourceFromOfficialLineup,
  buildTeamDirectory,
  classifyGameDayTweet,
  extractStructuredNameGroupsFromTweet,
  findGameDayTweetKeywordHits,
  matchRosterNamesInTweet,
  parseDailyFaceoffStartingGoaliesPage,
  parseDailyFaceoffLineCombinationsPage,
  parseGameDayTweetsGoaliesPage,
  parseGameDayTweetsLinesPage,
  parseNhlLineupProjectionsPage,
  selectBestGoalieStartSource,
  selectBestPregameLineupSource,
  toHistoricalLineSourceRow,
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
const wildRoster = [
  { playerId: 101, fullName: "Kirill Kaprizov", lastName: "Kaprizov" },
  { playerId: 102, fullName: "Joel Eriksson Ek", lastName: "Eriksson Ek" },
  { playerId: 103, fullName: "Mats Zuccarello", lastName: "Zuccarello" },
  { playerId: 104, fullName: "Marcus Johansson", lastName: "Johansson" },
  { playerId: 105, fullName: "Matt Boldy", lastName: "Boldy" },
  { playerId: 106, fullName: "Ryan Hartman", lastName: "Hartman" },
  { playerId: 107, fullName: "Vladimir Tarasenko", lastName: "Tarasenko" },
  { playerId: 108, fullName: "Nick Foligno", lastName: "Foligno" },
  { playerId: 109, fullName: "Marcus Foligno", lastName: "Foligno" },
  { playerId: 110, fullName: "Danila Yurov", lastName: "Yurov" },
  { playerId: 111, fullName: "Bobby Brink", lastName: "Brink" },
  { playerId: 112, fullName: "Michael McCarron", lastName: "McCarron" },
  { playerId: 113, fullName: "Yakov Trenin", lastName: "Trenin" },
  { playerId: 114, fullName: "Quinn Hughes", lastName: "Hughes" },
  { playerId: 115, fullName: "Brock Faber", lastName: "Faber" },
  { playerId: 116, fullName: "Jonas Brodin", lastName: "Brodin" },
  { playerId: 117, fullName: "Jared Spurgeon", lastName: "Spurgeon" },
  { playerId: 118, fullName: "Jake Middleton", lastName: "Middleton" },
  { playerId: 119, fullName: "Zach Bogosian", lastName: "Bogosian" },
  { playerId: 120, fullName: "Jesper Wallstedt", lastName: "Wallstedt" }
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

  it("parses NHL.com projected lineups when the live article mixes bolded and plain headers", () => {
    const parsed = parseNhlLineupProjectionsPage({
      html: `
        <body>
          Penguins projected lineup

          Rickard Rakell -- Sidney Crosby -- Bryan Rust

          **Wild projected lineup**

          Kirill Kaprizov -- Joel Eriksson Ek -- Matt Boldy

          Marcus Johansson -- Ryan Hartman -- Vladimir Tarasenko

          Marcus Foligno -- Danila Yurov -- Bobby Brink

          Nick Foligno -- Nico Sturm -- Michael McCarron

          Quinn Hughes -- Brock Faber

          Jonas Brodin -- Jared Spurgeon

          Jake Middleton -- Zach Bogosian

          Jesper Wallstedt
        </body>
      `,
      teams: buildTeamDirectory([
        ...teams,
        {
          id: 30,
          name: "Minnesota Wild",
          abbreviation: "MIN",
          logo: "/teamLogos/MIN.png"
        }
      ]),
      sourceUrl: "https://www.nhl.com/news/nhl-lineup-projections-2025-26-season",
      rosterByTeam: new Map([[30, wildRoster]])
    });

    expect(parsed.map((row) => row.team.abbreviation)).toContain("MIN");
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
    expect(parsed.tweets[0]?.structureSignals).toMatchObject({
      forwardLineCount: 1
    });
    expect(parsed.selectedLineup?.sourceName).toBe("gamedaytweets");
    expect(parsed.selectedLineup?.metadata).toMatchObject({
      candidateClassification: "lineup",
      structureSignals: {
        keywordHits: expect.arrayContaining(["warmups"])
      }
    });
  });

  it("exposes reusable tweet classification, keyword, alias, initials, and structure helpers", () => {
    const text = `#mnwild practice lines
Kaprizov - JEEk - Zuccarello
Johansson - Hartman - N. Foligno`;

    expect(classifyGameDayTweet(text)).toBe("practice_lines");
    expect(findGameDayTweetKeywordHits(text)).toEqual(
      expect.arrayContaining(["practice lines", "lines"])
    );
    expect(extractStructuredNameGroupsFromTweet(text)).toMatchObject({
      forwardLineCount: 1
    });
    expect(matchRosterNamesInTweet("JEEk and N. Foligno are skating", wildRoster)).toEqual({
      matchedPlayerIds: [102],
      matchedNames: ["Joel Eriksson Ek"],
      unmatchedNames: ["Foligno"]
    });
  });

  it("prefers the more structured GDT lineup tweet when multiple tweets match", () => {
    const parsed = parseGameDayTweetsLinesPage({
      html: `
        <body>
          <blockquote class="tweet">
            <a href="https://twitter.com/BeatWriter">@BeatWriter</a>
            Line rushes for Tampa Bay: Point, Kucherov, Hagel, Cirelli, Guentzel, Goncalves.
            <a href="https://twitter.com/GameDayLines/status/111">tweet</a>
          </blockquote>
          <blockquote class="tweet">
            <a href="https://twitter.com/BeatWriter">@BeatWriter</a>
            Tampa Bay line combinations:
            Goncalves-Point-Kucherov
            Hagel-Cirelli-Guentzel
            <a href="https://twitter.com/GameDayLines/status/222">tweet</a>
          </blockquote>
        </body>
      `,
      team: teams[1],
      rosterEntries: tampaRoster,
      sourceUrl: "https://www.gamedaytweets.com/lines?team=TBL"
    });

    expect(parsed.selectedLineup?.sourceUrl).toBe("https://twitter.com/GameDayLines/status/222");
    expect(parsed.selectedLineup?.metadata).toMatchObject({
      structureSignals: {
        forwardLineCount: 1,
        keywordHits: expect.arrayContaining(["line combinations"])
      }
    });
  });

  it("rebuilds a full GDT lineup from enriched tweet text with initials and aliases", () => {
    const tweet = {
      classification: "lineup",
      sourceHandle: "https://twitter.com/JoeSmithNHL",
      sourceUrl: "https://www.gamedaytweets.com/lines?team=MIN",
      tweetUrl: "https://twitter.com/GameDayLines/status/2028892043054072251",
      postedLabel: "Mar 3, 2026",
      postedAt: "2026-03-03T00:00:00.000Z",
      text: "#mnwild lines Kaprizov - Hartman - Zuccarello Johansson - JEEk - Boldy",
      structureSignals: {
        forwardLineCount: 1,
        defensePairCount: 0,
        keywordHits: ["lines"]
      },
      matchedPlayerIds: [101, 103, 104, 105],
      matchedNames: ["Kirill Kaprizov", "Mats Zuccarello", "Marcus Johansson", "Matt Boldy"],
      unmatchedNames: []
    } as const;

    const parsed = buildGameDayTweetsLineupSourceFromTweet({
      team: buildTeamDirectory([
        {
          id: 30,
          name: "Minnesota Wild",
          abbreviation: "MIN",
          logo: "/teamLogos/MIN.png"
        }
      ])[0]!,
      rosterEntries: wildRoster,
      sourceUrl: "https://www.gamedaytweets.com/lines?team=MIN",
      tweet,
      enrichedText:
        "#mnwild lines for Game 2: Zuccarello out with upper body injury\nKaprizov-Hartman-Tarasenko\nJohansson-Eriksson Ek-Boldy\nN. Foligno-Yurov-Brink\nM. Foligno-McCarron-Trenin\nHughes-Faber\nBrodin-Spurgeon\nMiddleton-Bogosian\nWallstedt"
    });

    expect(parsed).toMatchObject({
      forwards: [
        ["Kirill Kaprizov", "Ryan Hartman", "Vladimir Tarasenko"],
        ["Marcus Johansson", "Joel Eriksson Ek", "Matt Boldy"],
        ["Nick Foligno", "Danila Yurov", "Bobby Brink"],
        ["Marcus Foligno", "Michael McCarron", "Yakov Trenin"]
      ],
      defensePairs: [
        ["Quinn Hughes", "Brock Faber"],
        ["Jonas Brodin", "Jared Spurgeon"],
        ["Jake Middleton", "Zach Bogosian"]
      ],
      goalies: ["Jesper Wallstedt"]
    });
    expect(parsed?.metadata).toMatchObject({
      tweetPostedAt: "2026-03-03T00:00:00.000Z",
      tweetPostedLabel: "Mar 3, 2026",
      tweetPostedPrecision: "day"
    });
  });

  it("writes tweet_posted_at into historical GDT rows", () => {
    const parsed = buildGameDayTweetsLineupSourceFromTweet({
      team: buildTeamDirectory([
        {
          id: 30,
          name: "Minnesota Wild",
          abbreviation: "MIN",
          logo: "/teamLogos/MIN.png"
        }
      ])[0]!,
      rosterEntries: wildRoster,
      sourceUrl: "https://www.gamedaytweets.com/lines?team=MIN",
      tweet: {
        classification: "lineup",
        sourceHandle: "https://twitter.com/JoeSmithNHL",
        sourceUrl: "https://www.gamedaytweets.com/lines?team=MIN",
        tweetUrl: "https://twitter.com/GameDayLines/status/2028892043054072251",
        postedLabel: "Mar 3, 2026",
        postedAt: "2026-03-03T00:00:00.000Z",
        text: "#mnwild lines Kaprizov - Hartman - Zuccarello",
        structureSignals: {
          forwardLineCount: 1,
          defensePairCount: 0,
          keywordHits: ["lines"]
        },
        matchedPlayerIds: [101, 102, 103, 104, 105, 106],
        matchedNames: [
          "Kirill Kaprizov",
          "Joel Eriksson Ek",
          "Mats Zuccarello",
          "Marcus Johansson",
          "Matt Boldy",
          "Ryan Hartman"
        ],
        unmatchedNames: []
      },
      enrichedText:
        "Kaprizov-Hartman-Zuccarello\nJohansson-Eriksson Ek-Boldy\nWallstedt",
      enrichedPostedAt: "2026-03-03T00:00:00.000Z",
      enrichedPostedLabel: "March 3, 2026"
    });

    const row = toHistoricalLineSourceRow({
      snapshotDate: "2026-04-22",
      gameId: 2025030163,
      source: parsed!,
      rosterEntries: wildRoster
    });

    expect(row.tweet_posted_at).toBe("2026-03-03T00:00:00.000Z");
  });

  it("parses GameDayTweets goalie page into team-specific starter records", () => {
    const parsed = parseGameDayTweetsGoaliesPage({
      html: `
        <body>
          <h1 class="text-3xl">
            <div class="flex flex-row"><span>Montréal Canadiens</span></div>
            <div class="flex flex-row"><span>Tampa Bay Lightning</span></div>
          </h1>
          <div class="text-2xl">
            <div class="flex flex-col">
              <blockquote class="tweet">
                <a class="handle" href="https://twitter.com/HabsSource">@HabsSource</a>
                Samuel Montembeault and Andrei Vasilevskiy lead the Canadiens and Lightning out for warmup.
                <a href="https://twitter.com/GameDayGoalies/status/123">tweet</a>
              </blockquote>
            </div>
            <div class="flex flex-col">
              <blockquote class="tweet">
                <a class="handle" href="https://twitter.com/HabsSource">@HabsSource</a>
                Samuel Montembeault and Andrei Vasilevskiy lead the Canadiens and Lightning out for warmup.
                <a href="https://twitter.com/GameDayGoalies/status/123">tweet</a>
              </blockquote>
            </div>
          </div>
        </body>
      `,
      teams,
      rosterByTeam: new Map([
        [
          8,
          [
            { playerId: 20, fullName: "Samuel Montembeault", lastName: "Montembeault" }
          ]
        ],
        [14, tampaRoster]
      ]),
      sourceUrl: "https://www.gamedaytweets.com/goalies"
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      sourceName: "gamedaytweets",
      team: { id: 8 },
      goalieName: "Samuel Montembeault",
      startStatus: "confirmed"
    });
    expect(parsed[1]).toMatchObject({
      team: { id: 14 },
      goalieName: "Andrei Vasilevskiy",
      startStatus: "confirmed"
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
    const gdtGoalie = parseGameDayTweetsGoaliesPage({
      html: `
        <body>
          <h1 class="text-3xl">
            <div class="flex flex-row"><span>Montréal Canadiens</span></div>
            <div class="flex flex-row"><span>Tampa Bay Lightning</span></div>
          </h1>
          <div class="text-2xl">
            <div class="flex flex-col">
              <span>Our <i>Guess</i>: <strong>Jakub Dobes</strong> (starter)</span>
            </div>
            <div class="flex flex-col">
              <span>Our <i>Guess</i>: <strong>Andrei Vasilevskiy</strong> (starter)</span>
            </div>
          </div>
        </body>
      `,
      teams,
      rosterByTeam: new Map([
        [8, [{ playerId: 20, fullName: "Jakub Dobes", lastName: "Dobes" }]],
        [14, tampaRoster]
      ]),
      sourceUrl: "https://www.gamedaytweets.com/goalies"
    }).find((goalie) => goalie.team.id === 14);

    expect(
      selectBestGoalieStartSource([
        modelGoalie,
        officialGoalie,
        gdtGoalie,
        dfoGoalies.find((goalie) => goalie.team.id === 14)
      ], "2026-04-21T18:00:00.000Z")?.sourceName
    ).toBe("dailyfaceoff");

    expect(
      selectBestGoalieStartSource(
        [modelGoalie, officialGoalie, gdtGoalie],
        "2026-04-21T18:00:00.000Z"
      )?.sourceName
    ).toBe("gamedaytweets");
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
