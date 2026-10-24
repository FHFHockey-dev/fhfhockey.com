# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: social-share.spec.ts >> schedule-aware tier list shows only tier teams' players as list rows, strict and widened
- Location: e2e/social-share.spec.ts:823:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Object {
    "brokenImages": 0,
-   "fits": true,
-   "rowsInside": true,
+   "fits": false,
+   "rowsInside": false,
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "FHFH home" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "FHFH" [ref=e6]
        - generic [ref=e7]: Hockey Analytics
      - navigation "Primary navigation" [ref=e8]:
        - list [ref=e9]:
          - listitem [ref=e10]:
            - link "Home" [ref=e11] [cursor=pointer]:
              - /url: /
          - listitem [ref=e12]:
            - link "Game Grid" [ref=e13] [cursor=pointer]:
              - /url: /game-grid
          - listitem [ref=e14]:
            - link "Underlying Stats" [ref=e15] [cursor=pointer]:
              - /url: /underlying-stats
          - listitem [ref=e16]:
            - button "Analytics" [ref=e17] [cursor=pointer]:
              - text: Analytics
              - img [ref=e18]
          - listitem [ref=e20]:
            - button "Tools" [ref=e21] [cursor=pointer]:
              - text: Tools
              - img [ref=e22]
          - listitem [ref=e24]:
            - link "Blog" [ref=e25] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e26]:
            - button "Community" [ref=e27] [cursor=pointer]:
              - text: Community
              - img [ref=e28]
      - generic [ref=e30]:
        - button "Search players" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
        - link "Buy me a coffee" [ref=e34] [cursor=pointer]:
          - /url: https://www.buymeacoffee.com/tjsusername
          - img "Buy me a coffee" [ref=e35]
        - button "Open account menu" [ref=e37] [cursor=pointer]:
          - generic [ref=e38]: SS
    - main [ref=e39]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - paragraph [ref=e43]: FHFH / Share studio
            - heading "Weekly schedule" [level=1] [ref=e44]
          - generic [ref=e45]: Schedule only · NHL schedule source
        - region "Schedule settings" [ref=e46]:
          - generic [ref=e47]:
            - generic [ref=e48]:
              - text: Week of (Monday)
              - textbox "Week of (Monday)" [ref=e49]: 2026-10-26
            - button "Refresh schedule" [ref=e50] [cursor=pointer]
            - generic [ref=e51]:
              - text: Graphic
              - combobox "Graphic" [ref=e52]:
                - option "Best schedules grid (Monday default)"
                - option "Easiest schedules (opponent defense)"
                - option "Streaming matchups (soft defenses)"
                - option "Pickups · 30–49% rostered"
                - option "Pickups · 20–29% rostered"
                - option "Pickups · under 20% rostered"
                - option "Specialists · hits, shots, blocks"
                - option "Streaming options · tier list"
                - option "Streaming options · widened tiers" [selected]
                - option "Top three schedule leaders"
                - option "New Jersey Devils"
                - option "New York Islanders"
                - option "New York Rangers"
                - option "Philadelphia Flyers"
                - option "Pittsburgh Penguins"
                - option "Boston Bruins"
                - option "Buffalo Sabres"
                - option "Montréal Canadiens"
                - option "Ottawa Senators"
                - option "Toronto Maple Leafs"
                - option "Carolina Hurricanes"
                - option "Florida Panthers"
                - option "Tampa Bay Lightning"
                - option "Washington Capitals"
                - option "Chicago Blackhawks"
                - option "Detroit Red Wings"
                - option "Nashville Predators"
                - option "St. Louis Blues"
                - option "Calgary Flames"
                - option "Colorado Avalanche"
                - option "Edmonton Oilers"
                - option "Vancouver Canucks"
                - option "Anaheim Ducks"
                - option "Dallas Stars"
                - option "Los Angeles Kings"
                - option "San Jose Sharks"
                - option "Columbus Blue Jackets"
                - option "Minnesota Wild"
                - option "Winnipeg Jets"
                - option "Vegas Golden Knights"
                - option "Seattle Kraken"
                - option "Utah Mammoth"
          - group "Selected days · America/New_York" [ref=e53]:
            - generic [ref=e54]: Selected days · America/New_York
            - button "MON Oct 26 ON · 6 games" [pressed] [ref=e55] [cursor=pointer]:
              - strong [ref=e56]: MON
              - generic [ref=e57]: Oct 26
              - generic [ref=e58]: ON · 6 games
            - button "TUE Oct 27 ON · 12 games" [pressed] [ref=e59] [cursor=pointer]:
              - strong [ref=e60]: TUE
              - generic [ref=e61]: Oct 27
              - generic [ref=e62]: ON · 12 games
            - button "WED Oct 28 ON · 4 games" [pressed] [ref=e63] [cursor=pointer]:
              - strong [ref=e64]: WED
              - generic [ref=e65]: Oct 28
              - generic [ref=e66]: ON · 4 games
            - button "THU Oct 29 ON · 13 games" [pressed] [ref=e67] [cursor=pointer]:
              - strong [ref=e68]: THU
              - generic [ref=e69]: Oct 29
              - generic [ref=e70]: ON · 13 games
            - button "FRI Oct 30 ON · 5 games" [pressed] [ref=e71] [cursor=pointer]:
              - strong [ref=e72]: FRI
              - generic [ref=e73]: Oct 30
              - generic [ref=e74]: ON · 5 games
            - button "SAT Oct 31 ON · 12 games" [pressed] [ref=e75] [cursor=pointer]:
              - strong [ref=e76]: SAT
              - generic [ref=e77]: Oct 31
              - generic [ref=e78]: ON · 12 games
            - button "SUN Nov 1 ON · 7 games" [pressed] [ref=e79] [cursor=pointer]:
              - strong [ref=e80]: SUN
              - generic [ref=e81]: Nov 1
              - generic [ref=e82]: ON · 7 games
            - button "All days" [ref=e83] [cursor=pointer]
            - button "None" [ref=e84] [cursor=pointer]
        - paragraph [ref=e86]: NHL schedule checked Oct 24, 6:12 PM EDT · Provider update Not available · Remaining after Oct 24, 6:12 PM EDT
        - generic [ref=e87]:
          - region "Graphic preview" [ref=e88]:
            - generic [ref=e89]:
              - heading "1080 × 1080 preview" [level=2] [ref=e90]
              - generic [ref=e91]: Streaming options (widened)
            - img [ref=e93]:
              - generic [ref=e94]:
                - generic [ref=e95]:
                  - img "FHFH" [ref=e96]
                  - generic [ref=e97]: FHFHOCKEY.COM
                - generic [ref=e98]:
                  - paragraph [ref=e99]: Week ahead · Schedule-aware tier list · widened
                  - heading "STREAMING OPTIONS" [level=2] [ref=e100]
                - generic [ref=e101]:
                  - generic [ref=e102]: WEEK OF
                  - strong [ref=e103]: Oct 26 – Nov 1
                  - generic [ref=e104]: "2026"
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - generic [ref=e107]:
                    - strong [ref=e108]: TIER 1
                    - generic [ref=e110]: 5 GP · 2 OFF
                  - generic [ref=e111]:
                    - generic [ref=e112]: "1"
                    - generic [ref=e114]:
                      - strong [ref=e115]: Fixture WSH-4
                      - generic [ref=e116]: WSH · RW
                    - generic [ref=e117]:
                      - strong [ref=e118]: 49%
                      - generic [ref=e119]: 30–49%
                    - generic [ref=e120]:
                      - generic [ref=e121]: L5 GP
                      - text: 1G 2A 3P · 11 SOG · 2 PPP · 17:25
                    - generic [ref=e122]: 0.45 PTS/GP
                  - generic [ref=e123]:
                    - generic [ref=e124]: "2"
                    - generic [ref=e126]:
                      - strong [ref=e127]: Fixture WSH-10
                      - generic [ref=e128]: WSH · G
                    - generic [ref=e129]:
                      - strong [ref=e130]: 32%
                      - generic [ref=e131]: 30–49%
                    - generic [ref=e132]:
                      - generic [ref=e133]: L5 GP
                      - text: 3-2 · .940 SV% · 9 GA · 3 QS
                    - generic [ref=e134]: 44% QS
                - generic [ref=e135]:
                  - generic [ref=e136]:
                    - strong [ref=e137]: TIER 2
                    - generic [ref=e139]:
                      - text: 4 GP · 3 OFF / 4 GP · 2 OFF
                      - generic [ref=e140]: +39 more
                  - generic [ref=e141]:
                    - generic [ref=e142]: "1"
                    - generic [ref=e144]:
                      - strong [ref=e145]: Fixture VGK-4
                      - generic [ref=e146]: VGK · RW
                    - generic [ref=e147]:
                      - strong [ref=e148]: 32%
                      - generic [ref=e149]: 30–49%
                    - generic [ref=e150]:
                      - generic [ref=e151]: L5 GP
                      - text: 2G 4A 6P · 16 SOG · 1 PPP · 19:50
                    - generic [ref=e152]: 1.14 PTS/GP
                  - generic [ref=e153]:
                    - generic [ref=e154]: "2"
                    - generic [ref=e156]:
                      - strong [ref=e157]: Fixture FLA-2
                      - generic [ref=e158]: FLA · C,LW
                    - generic [ref=e159]:
                      - strong [ref=e160]: 40%
                      - generic [ref=e161]: 30–49%
                    - generic [ref=e162]:
                      - generic [ref=e163]: L5 GP
                      - text: 0G 2A 2P · 6 SOG · 0 PPP · 22:00
                    - generic [ref=e164]: 1.14 PTS/GP
                  - generic [ref=e165]:
                    - generic [ref=e166]: "3"
                    - generic [ref=e168]:
                      - strong [ref=e169]: Fixture FLA-1
                      - generic [ref=e170]: FLA · C
                    - generic [ref=e171]:
                      - strong [ref=e172]: 35%
                      - generic [ref=e173]: 30–49%
                    - generic [ref=e174]:
                      - generic [ref=e175]: L5 GP
                      - text: 3G 4A 7P · 17 SOG · 2 PPP · 21:55
                    - generic [ref=e176]: 1.03 PTS/GP
                  - generic [ref=e177]:
                    - generic [ref=e178]: "4"
                    - generic [ref=e180]:
                      - strong [ref=e181]: Fixture MTL-5
                      - generic [ref=e182]: MTL · RW,C
                    - generic [ref=e183]:
                      - strong [ref=e184]: 20%
                      - generic [ref=e185]: 20–29%
                    - generic [ref=e186]:
                      - generic [ref=e187]: L5 GP
                      - text: 3G 1A 4P · 13 SOG · 1 PPP · 15:35
                    - generic [ref=e188]: 1.01 PTS/GP
                  - generic [ref=e189]:
                    - generic [ref=e190]: "5"
                    - generic [ref=e192]:
                      - strong [ref=e193]: Fixture MTL-1
                      - generic [ref=e194]: MTL · C
                    - generic [ref=e195]:
                      - strong [ref=e196]: 28%
                      - generic [ref=e197]: 20–29%
                    - generic [ref=e198]:
                      - generic [ref=e199]: L5 GP
                      - text: 3G 4A 7P · 9 SOG · 0 PPP · 15:15
                    - generic [ref=e200]: 0.98 PTS/GP
                  - generic [ref=e201]:
                    - generic [ref=e202]: "6"
                    - generic [ref=e204]:
                      - strong [ref=e205]: Fixture STL-3
                      - generic [ref=e206]: STL · LW
                    - generic [ref=e207]:
                      - strong [ref=e208]: 33%
                      - generic [ref=e209]: 30–49%
                    - generic [ref=e210]:
                      - generic [ref=e211]: L5 GP
                      - text: 3G 3A 6P · 17 SOG · 2 PPP · 15:55
                    - generic [ref=e212]: 0.87 PTS/GP
                  - generic [ref=e213]:
                    - generic [ref=e214]: "7"
                    - generic [ref=e216]:
                      - strong [ref=e217]: Fixture EDM-3
                      - generic [ref=e218]: EDM · LW
                    - generic [ref=e219]:
                      - strong [ref=e220]: 14%
                      - generic [ref=e221]: <20%
                    - generic [ref=e222]:
                      - generic [ref=e223]: L5 GP
                      - text: 3G 3A 6P · 17 SOG · 2 PPP · 20:55
                    - generic [ref=e224]: 0.82 PTS/GP
                  - generic [ref=e225]:
                    - generic [ref=e226]: "8"
                    - generic [ref=e228]:
                      - strong [ref=e229]: Fixture VGK-2
                      - generic [ref=e230]: VGK · C,LW
                    - generic [ref=e231]:
                      - strong [ref=e232]: 26%
                      - generic [ref=e233]: 20–29%
                    - generic [ref=e234]:
                      - generic [ref=e235]: L5 GP
                      - text: 0G 3A 3P · 14 SOG · 2 PPP · 19:40
                    - generic [ref=e236]: 0.78 PTS/GP
                - generic [ref=e237]:
                  - generic [ref=e238]:
                    - strong [ref=e239]: TIER 3
                    - generic [ref=e241]:
                      - text: 4 GP · 1 OFF / 3 GP · 2 OFF
                      - generic [ref=e242]: +91 more
                  - generic [ref=e243]:
                    - generic [ref=e244]: "1"
                    - generic [ref=e246]:
                      - strong [ref=e247]: Fixture UTA-5
                      - generic [ref=e248]: UTA · RW,C
                    - generic [ref=e249]:
                      - strong [ref=e250]: 49%
                      - generic [ref=e251]: 30–49%
                    - generic [ref=e252]:
                      - generic [ref=e253]: L5 GP
                      - text: 2G 1A 3P · 8 SOG · 2 PPP · 15:10
                    - generic [ref=e254]: 1.15 PTS/GP
                  - generic [ref=e255]:
                    - generic [ref=e256]: "2"
                    - generic [ref=e258]:
                      - strong [ref=e259]: Fixture UTA-2
                      - generic [ref=e260]: UTA · C,LW
                    - generic [ref=e261]:
                      - strong [ref=e262]: 43%
                      - generic [ref=e263]: 30–49%
                    - generic [ref=e264]:
                      - generic [ref=e265]: L5 GP
                      - text: 0G 3A 3P · 6 SOG · 0 PPP · 23:00
                    - generic [ref=e266]: 1.13 PTS/GP
                  - generic [ref=e267]:
                    - generic [ref=e268]: "3"
                    - generic [ref=e270]:
                      - strong [ref=e271]: Fixture DET-1
                      - generic [ref=e272]: DET · C
                    - generic [ref=e273]:
                      - strong [ref=e274]: 30%
                      - generic [ref=e275]: 30–49%
                    - generic [ref=e276]:
                      - generic [ref=e277]: L5 GP
                      - text: 2G 3A 5P · 12 SOG · 0 PPP · 20:30
                    - generic [ref=e278]: 1.08 PTS/GP
                  - generic [ref=e279]:
                    - generic [ref=e280]: "4"
                    - generic [ref=e282]:
                      - strong [ref=e283]: Fixture PIT-2
                      - generic [ref=e284]: PIT · C,LW
                    - generic [ref=e285]:
                      - strong [ref=e286]: 29%
                      - generic [ref=e287]: 20–29%
                    - generic [ref=e288]:
                      - generic [ref=e289]: L5 GP
                      - text: 1G 3A 4P · 11 SOG · 2 PPP · 18:25
                    - generic [ref=e290]: 1.06 PTS/GP
                  - generic [ref=e291]:
                    - generic [ref=e292]: "5"
                    - generic [ref=e294]:
                      - strong [ref=e295]: Fixture COL-2
                      - generic [ref=e296]: COL · C,LW
                    - generic [ref=e297]:
                      - strong [ref=e298]: 12%
                      - generic [ref=e299]: <20%
                    - generic [ref=e300]:
                      - generic [ref=e301]: L5 GP
                      - text: 2G 0A 2P · 8 SOG · 2 PPP · 19:10
                    - generic [ref=e302]: 1.06 PTS/GP
              - generic [ref=e303]:
                - generic [ref=e304]:
                  - generic [ref=e305]:
                    - generic [ref=e306]: Tier
                    - text: = exact GP · off-night pair, best Week Score first
                  - generic [ref=e307]: "Widened: tiers 2–3 fold in the next pair"
                  - generic [ref=e308]:
                    - generic [ref=e309]: L5 GP
                    - text: last 5 games played
                  - generic [ref=e310]: Under 50% rostered · PTS/GP, goalies QS%
                - paragraph [ref=e311]:
                  - generic [ref=e312]: Strictly tier teams only · +N more = rows that did not fit · Yahoo rostered % as of Oct 24 · NHL.com season totals updated Oct 24, 2:12 PM EDT
                  - strong [ref=e313]: SCHEDULE + PLAYER RATES
            - generic [ref=e314]:
              - button "Download PNG" [ref=e315] [cursor=pointer]
              - button "Copy alt text" [ref=e316] [cursor=pointer]
            - status
            - group [ref=e317]:
              - generic "Suggested alt text" [ref=e318]
          - region "Complete ranked schedule" [ref=e319]:
            - generic [ref=e320]:
              - heading "All teams" [level=2] [ref=e321]
              - generic [ref=e322]: 32 teams
            - paragraph [ref=e323]: Schedule Score compares remaining selected games, off-night games and full-slate density. Odds and player projections are excluded. Zero-game teams have no score to publish. Matchups below include context; elapsed, live, postponed and nonregular games do not count as opportunities.
            - list [ref=e324]:
              - listitem [ref=e325]:
                - generic [ref=e326]:
                  - strong [ref=e327]: "#1 Washington Capitals"
                  - generic [ref=e328]: 5 left · 2 off-night · Score 15.8
                - paragraph [ref=e329]: Oct 27 vs DAL (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs PHI (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs BOS (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs COL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs VAN (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e330]:
                - generic [ref=e331]:
                  - strong [ref=e332]: "#2 New York Islanders"
                  - generic [ref=e333]: 4 left · 3 off-night · Score 13.9
                - paragraph [ref=e334]: Oct 27 @ PIT (scheduled; Oct 27, 7:00 PM EDT) · Oct 28 @ NJD (scheduled; Oct 28, 7:00 PM EDT) · Oct 30 @ WPG (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 @ PHI (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e335]:
                - generic [ref=e336]:
                  - strong [ref=e337]: "#3 Montréal Canadiens"
                  - generic [ref=e338]: 4 left · 3 off-night · Score 13.9
                - paragraph [ref=e339]: Oct 26 @ LAK (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ LAK (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ SEA (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 vs FLA (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e340]:
                - generic [ref=e341]:
                  - strong [ref=e342]: "#4 St. Louis Blues"
                  - generic [ref=e343]: 4 left · 2 off-night · Score 9.9
                - paragraph [ref=e344]: Oct 27 @ ANA (scheduled; Oct 27, 7:00 PM EDT) · Oct 30 vs DET (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs VAN (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ CBJ (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e345]:
                - generic [ref=e346]:
                  - strong [ref=e347]: "#5 Vancouver Canucks"
                  - generic [ref=e348]: 4 left · 2 off-night · Score 9.9
                - paragraph [ref=e349]: Oct 28 vs UTA (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 vs BOS (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ STL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ WSH (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e350]:
                - generic [ref=e351]:
                  - strong [ref=e352]: "#6 Vegas Golden Knights"
                  - generic [ref=e353]: 4 left · 2 off-night · Score 9.8
                - paragraph [ref=e354]: Oct 27 vs TOR (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs NYR (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs BUF (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 vs EDM (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e355]:
                - generic [ref=e356]:
                  - strong [ref=e357]: "#7 Edmonton Oilers"
                  - generic [ref=e358]: 4 left · 2 off-night · Score 9.8
                - paragraph [ref=e359]: Oct 26 @ UTA (scheduled; Oct 26, 7:00 PM EDT) · Oct 27 vs CAR (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ PIT (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ VGK (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e360]:
                - generic [ref=e361]:
                  - strong [ref=e362]: "#8 Florida Panthers"
                  - generic [ref=e363]: 4 left · 2 off-night · Score 9.8
                - paragraph [ref=e364]: Oct 26 @ ANA (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ COL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs BUF (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ MTL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e365]:
                - generic [ref=e366]:
                  - strong [ref=e367]: "#9 New York Rangers"
                  - generic [ref=e368]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e369]: Oct 27 @ CBJ (scheduled; Oct 27, 7:00 PM EDT) · Oct 28 vs MIN (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ VGK (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ TOR (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e370]:
                - generic [ref=e371]:
                  - strong [ref=e372]: "#10 Pittsburgh Penguins"
                  - generic [ref=e373]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e374]: Oct 27 vs NYI (scheduled; Oct 27, 7:00 PM EDT) · Oct 28 @ TOR (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 vs EDM (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ MIN (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e375]:
                - generic [ref=e376]:
                  - strong [ref=e377]: "#11 Toronto Maple Leafs"
                  - generic [ref=e378]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e379]: Oct 27 @ VGK (scheduled; Oct 27, 7:00 PM EDT) · Oct 28 vs PIT (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ DAL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs NYR (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e380]:
                - generic [ref=e381]:
                  - strong [ref=e382]: "#12 Boston Bruins"
                  - generic [ref=e383]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e384]: Oct 27 @ MIN (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ VAN (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ WSH (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ CHI (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e385]:
                - generic [ref=e386]:
                  - strong [ref=e387]: "#13 Buffalo Sabres"
                  - generic [ref=e388]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e389]: Oct 27 vs WPG (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs SEA (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ VGK (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ FLA (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e390]:
                - generic [ref=e391]:
                  - strong [ref=e392]: "#14 Detroit Red Wings"
                  - generic [ref=e393]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e394]: Oct 27 vs COL (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ CHI (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ STL (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs SEA (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e395]:
                - generic [ref=e396]:
                  - strong [ref=e397]: "#15 Seattle Kraken"
                  - generic [ref=e398]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e399]: Oct 27 vs CGY (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ BUF (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs MTL (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ DET (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e400]:
                - generic [ref=e401]:
                  - strong [ref=e402]: "#16 Colorado Avalanche"
                  - generic [ref=e403]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e404]: Oct 26 @ CAR (scheduled; Oct 26, 7:00 PM EDT) · Oct 27 @ DET (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs FLA (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ WSH (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e405]:
                - generic [ref=e406]:
                  - strong [ref=e407]: "#17 Ottawa Senators"
                  - generic [ref=e408]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e409]: Oct 26 vs TBL (scheduled; Oct 26, 7:00 PM EDT) · Oct 27 vs NSH (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ TBL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs NJD (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e410]:
                - generic [ref=e411]:
                  - strong [ref=e412]: "#18 Columbus Blue Jackets"
                  - generic [ref=e413]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e414]: Oct 27 vs NYR (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ CGY (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs ANA (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs STL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e415]:
                - generic [ref=e416]:
                  - strong [ref=e417]: "#19 Dallas Stars"
                  - generic [ref=e418]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e419]: Oct 27 @ WSH (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs TOR (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs PHI (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs LAK (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e420]:
                - generic [ref=e421]:
                  - strong [ref=e422]: "#20 Philadelphia Flyers"
                  - generic [ref=e423]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e424]: Oct 27 @ SJS (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ WSH (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ DAL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs NYI (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e425]:
                - generic [ref=e426]:
                  - strong [ref=e427]: "#21 San Jose Sharks"
                  - generic [ref=e428]: 4 left · 1 off-night · Score 5.8
                - paragraph [ref=e429]: Oct 27 vs PHI (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs WPG (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs TBL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs CGY (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e430]:
                - generic [ref=e431]:
                  - strong [ref=e432]: "#22 New Jersey Devils"
                  - generic [ref=e433]: 3 left · 2 off-night · Score 3.9
                - paragraph [ref=e434]: Oct 26 @ CHI (scheduled; Oct 26, 7:00 PM EDT) · Oct 28 vs NYI (scheduled; Oct 28, 7:00 PM EDT) · Oct 31 @ OTT (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e435]:
                - generic [ref=e436]:
                  - strong [ref=e437]: "#23 Utah Mammoth"
                  - generic [ref=e438]: 3 left · 2 off-night · Score 3.9
                - paragraph [ref=e439]: Oct 26 vs EDM (scheduled; Oct 26, 7:00 PM EDT) · Oct 28 @ VAN (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ NSH (scheduled; Oct 29, 7:00 PM EDT)
              - listitem [ref=e440]:
                - generic [ref=e441]:
                  - strong [ref=e442]: "#24 Los Angeles Kings"
                  - generic [ref=e443]: 3 left · 2 off-night · Score 3.9
                - paragraph [ref=e444]: Oct 26 vs MTL (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs MTL (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ DAL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e445]:
                - generic [ref=e446]:
                  - strong [ref=e447]: "#25 Minnesota Wild"
                  - generic [ref=e448]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e449]: Oct 27 vs BOS (scheduled; Oct 27, 7:00 PM EDT) · Oct 28 @ NYR (scheduled; Oct 28, 7:00 PM EDT) · Oct 31 vs PIT (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e450]:
                - generic [ref=e451]:
                  - strong [ref=e452]: "#26 Anaheim Ducks"
                  - generic [ref=e453]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e454]: Oct 26 vs FLA (scheduled; Oct 26, 7:00 PM EDT) · Oct 27 vs STL (scheduled; Oct 27, 7:00 PM EDT) · Oct 31 @ CBJ (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e455]:
                - generic [ref=e456]:
                  - strong [ref=e457]: "#27 Carolina Hurricanes"
                  - generic [ref=e458]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e459]: Oct 26 vs COL (scheduled; Oct 26, 7:00 PM EDT) · Oct 27 @ EDM (scheduled; Oct 27, 7:00 PM EDT) · Oct 31 vs NSH (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e460]:
                - generic [ref=e461]:
                  - strong [ref=e462]: "#28 Winnipeg Jets"
                  - generic [ref=e463]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e464]: Oct 27 @ BUF (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 @ SJS (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs NYI (scheduled; Oct 30, 7:00 PM EDT)
              - listitem [ref=e465]:
                - generic [ref=e466]:
                  - strong [ref=e467]: "#29 Chicago Blackhawks"
                  - generic [ref=e468]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e469]: Oct 26 vs NJD (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs DET (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs BOS (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e470]:
                - generic [ref=e471]:
                  - strong [ref=e472]: "#30 Tampa Bay Lightning"
                  - generic [ref=e473]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e474]: Oct 26 @ OTT (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs OTT (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ SJS (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e475]:
                - generic [ref=e476]:
                  - strong [ref=e477]: "#31 Calgary Flames"
                  - generic [ref=e478]: 3 left · 1 off-night · Score -0.2
                - paragraph [ref=e479]: Oct 27 @ SEA (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs CBJ (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ SJS (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e480]:
                - generic [ref=e481]:
                  - strong [ref=e482]: "#32 Nashville Predators"
                  - generic [ref=e483]: 3 left · 0 off-night · Score -4.3
                - paragraph [ref=e484]: Oct 27 @ OTT (scheduled; Oct 27, 7:00 PM EDT) · Oct 29 vs UTA (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ CAR (scheduled; Oct 31, 7:00 PM EDT)
    - contentinfo [ref=e485]:
      - generic [ref=e486]:
        - generic [ref=e487]:
          - link "FHFH home" [ref=e488] [cursor=pointer]:
            - /url: /
            - img [ref=e489]
          - generic [ref=e495]: Five Hole Fantasy Hockey
          - generic [ref=e496]: © 2026 FHFHockey
        - navigation "Footer navigation" [ref=e497]:
          - link "Underlying Stats" [ref=e498] [cursor=pointer]:
            - /url: /underlying-stats
          - link "Game Grid" [ref=e499] [cursor=pointer]:
            - /url: /game-grid
          - link "Stats" [ref=e500] [cursor=pointer]:
            - /url: /stats
          - link "Blog" [ref=e501] [cursor=pointer]:
            - /url: /blog
          - link "Podcast" [ref=e502] [cursor=pointer]:
            - /url: /podfeed
          - link "Privacy" [ref=e503] [cursor=pointer]:
            - /url: /privacy
        - generic [ref=e504]:
          - link "Support FHFH" [ref=e505] [cursor=pointer]:
            - /url: https://www.buymeacoffee.com/tjsusername
          - generic [ref=e506]:
            - link "Twitter" [ref=e507] [cursor=pointer]:
              - /url: https://www.twitter.com/fhfhockey
              - img "Twitter" [ref=e508]
            - link "Discord" [ref=e509] [cursor=pointer]:
              - /url: https://discord.gg/kfnyrn7
              - img "Discord" [ref=e510]
            - link "Patreon" [ref=e511] [cursor=pointer]:
              - /url: https://www.patreon.com/FHFHRadio
              - img "Patreon" [ref=e512]
            - link "Youtube" [ref=e513] [cursor=pointer]:
              - /url: https://www.youtube.com/fiveholefantasyhockey
              - img "Youtube" [ref=e514]
            - link "Spotify" [ref=e515] [cursor=pointer]:
              - /url: https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g
              - img "Spotify" [ref=e516]
  - alert [ref=e517]
```

# Test source

```ts
  742 |   expect(tiers).toHaveLength(32);
  743 |   expect(new Set(tiers)).toEqual(new Set(["tierBest", "tierGood", "tierAverage", "tierBelow", "tierWorst"]));
  744 |   await expect(square.locator('[data-team="' + edition.rows[0].team.abbreviation + '"]')).toContainText(edition.rows[0].score.toFixed(1));
  745 |   await expect(square.locator("[data-cherry]")).toHaveCount(streamingNights(edition, true).length);
  746 |   await downloadedPng(page, "flair-grid");
  747 |   // Every pickup band fills three per position; fill players are marked; every tile shows L5 evidence.
  748 |   let widened = 0;
  749 |   for (const tier of pickupTiers(edition, true)) {
  750 |     await graphic.selectOption(`pickups-${tier.max}`);
  751 |     const tiles = square.locator("[data-player]");
  752 |     await expect(tiles).toHaveCount(9);
  753 |     for (let i = 0; i < 9; i++) await expect(tiles.nth(i)).toContainText("L5 GP");
  754 |     const fills = await square.locator("[data-widened]").count();
  755 |     if (fills) await expect(square.locator("[data-widened]").first()).toContainText("WIDER POOL");
  756 |     widened += fills;
  757 |     const first = tier.groups.F[0];
  758 |     await expect(tiles.first()).toContainText(first.name);
  759 |     await expect(tiles.first()).toContainText(`${Math.floor(first.ownership)}%`);
  760 |     expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  761 |     await downloadedPng(page, `flair-pickups-${tier.max}`);
  762 |   }
  763 |   expect(widened).toBeGreaterThan(0);
  764 |   await graphic.selectOption("specialists");
  765 |   await downloadedPng(page, "flair-specialists");
  766 |   for (const card of ["easiest", "stream"]) {
  767 |     await graphic.selectOption(card);
  768 |     expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  769 |     await downloadedPng(page, `flair-${card}`);
  770 |   }
  771 |   await expect(square).toContainText("TILT →");
  772 |   await graphic.selectOption("leaders");
  773 |   await expect(square.locator("[data-team]")).toHaveCount(3);
  774 |   for (let i = 0; i < 3; i++) await expect(square.locator("[data-team]").nth(i).locator("[data-date]")).toHaveCount(7);
  775 |   expect(await square.evaluate(node => node.scrollHeight <= (node as HTMLElement).offsetHeight)).toBe(true);
  776 |   await downloadedPng(page, "flair-leaders");
  777 |   expect(errors).toEqual([]);
  778 | });
  779 | 
  780 | test("player tiles never claim 'no recent game' when the last-five-games read failed", async ({ page }) => {
  781 |   const source = await install(page);
  782 |   source.mode = "league"; source.recentRead = "failed";
  783 |   await open(page);
  784 |   const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  785 |   await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  786 |   await graphic.selectOption("pickups-20");
  787 |   const tiles = square.locator("[data-player]");
  788 |   await expect(tiles).toHaveCount(9);
  789 |   for (let i = 0; i < 9; i++) await expect(tiles.nth(i)).toContainText("Recent form unavailable");
  790 |   await expect(square).not.toContainText("No game in the last two weeks");
  791 |   source.recentRead = "empty";
  792 |   await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  793 |   await expect(tiles.first()).toContainText("No game in the last two weeks");
  794 |   await expect(square).not.toContainText("Recent form unavailable");
  795 | });
  796 | 
  797 | test("GP and off-night counts are coloured per column on Monday and Wednesday editions", async ({ page }) => {
  798 |   const source = await install(page);
  799 |   source.mode = "league";
  800 |   for (const format of ["game-grid", "remaining-week"]) {
  801 |     await open(page, format);
  802 |     const square = page.getByTestId("share-square"), graphic = page.getByRole("combobox", { name: /^Graphic/ });
  803 |     await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  804 |     const edition = source.latest!;
  805 |     expect(edition.format).toBe(format);
  806 |     const gp = countTiers(edition.rows.map(row => row.remainingGames)), off = countTiers(edition.rows.map(row => row.offNightGames));
  807 |     const rows = await square.locator("[data-team][data-tier]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-team"), node.getAttribute("data-gp-tier"), node.getAttribute("data-off-tier")]));
  808 |     expect(rows).toEqual(edition.rows.map(row => [row.team.abbreviation, gp.get(row.remainingGames), off.get(row.offNightGames)]));
  809 |     expect(rows.some(([, gpTier, offTier]) => gpTier !== offTier)).toBe(true);
  810 |     expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("high");
  811 |     expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("low");
  812 |     await expect(square).toContainText("GP · OFF");
  813 |     await downloadedPng(page, `counts-${format}-grid`);
  814 |     for (const card of ["pickups-20", "easiest", "leaders"]) {
  815 |       await graphic.selectOption(card);
  816 |       const counts = await square.locator("[data-count-tier]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-count-tier")));
  817 |       expect(counts.length).toBeGreaterThan(0);
  818 |       expect(counts.every(tier => ["high", "second", "between", "low"].includes(tier!))).toBe(true);
  819 |     }
  820 |   }
  821 | });
  822 | 
  823 | test("schedule-aware tier list shows only tier teams' players as list rows, strict and widened", async ({ page }) => {
  824 |   const source = await install(page);
  825 |   source.mode = "league";
  826 |   await open(page);
  827 |   const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  828 |   await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  829 |   for (const [card, mode] of [["tiers", "strict"], ["tiers-wide", "widened"]] as const) {
  830 |     await graphic.selectOption(card);
  831 |     await expect(square).toContainText("STREAMING OPTIONS");
  832 |     const tiers = streamingTiers(source.latest!, true, mode);
  833 |     expect(tiers).toHaveLength(3);
  834 |     await expect(square.locator("[data-tier-index]")).toHaveCount(3);
  835 |     expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(tiers.flatMap(tier => tier.shown.map(player => String(player.nhlId))));
  836 |     for (const tier of tiers) {
  837 |       const block = square.locator(`[data-tier-index="${tier.index}"]`);
  838 |       for (const player of tier.shown) expect(tier.teams.map(team => team.abbreviation)).toContain(player.team);
  839 |       if (tier.more) await expect(block).toContainText(`+${tier.more} more`);
  840 |       await expect(block.locator("[data-player]").first()).toContainText("L5 GP");
  841 |     }
> 842 |     expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
      |                                         ^ Error: expect(received).toEqual(expected) // deep equality
  843 |     await expect(download).toBeEnabled();
  844 |     await downloadedPng(page, `streaming-tiers-${mode}`);
  845 |   }
  846 |   expect(source.sessionFixture.roleReads).toBeGreaterThan(0);
  847 |   expect(source.sessionFixture.syntheticWriteAttempts).toEqual([]);
  848 | });
  849 | 
  850 | 
  851 | test("social access fixture denies a signed-out page without workspace or edition reads", async ({ page }) => {
  852 |   const auth = await installSocialEditorSession(page, "signed-out");
  853 |   const response = await page.goto("/social-share/game-grid");
  854 |   expect(response?.headers()["cache-control"]).toContain("no-store");
  855 |   await expect(page.getByRole("alert").filter({ hasText: "Sign in with your FHFH social editor account" })).toBeVisible();
  856 |   await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toHaveCount(0);
  857 |   expect(auth.editionRequests).toEqual([]);
  858 |   expect(auth.syntheticWriteAttempts).toEqual([]);
  859 | });
  860 | 
  861 | test("social access fixture denies a basic role without workspace or edition reads", async ({ page }) => {
  862 |   const auth = await installSocialEditorSession(page, "basic");
  863 |   await page.goto("/social-share/game-grid");
  864 |   await expect(page.getByRole("alert").filter({ hasText: "Social editor access is required" })).toBeVisible();
  865 |   expect(auth.roleReads).toBeGreaterThan(0);
  866 |   await expect(page.getByRole("button", { name: "Refresh schedule", exact: true })).toHaveCount(0);
  867 |   expect(auth.editionRequests).toEqual([]);
  868 |   expect(auth.syntheticWriteAttempts).toEqual([]);
  869 | });
  870 | 
  871 | test("actual credential-free edition API denies before source work and stays private no-store", async ({ request }) => {
  872 |   expect(process.env.PLAYWRIGHT_BASE_URL).toBe("http://127.0.0.1:3140");
  873 |   const response = await request.get("/api/v1/social-share/game-grid");
  874 |   expect(response.status()).toBe(401);
  875 |   expect(response.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  876 |   expect(response.headers().vary).toContain("Authorization");
  877 |   expect(await response.json()).toEqual({ error: "Sign in to use the share studio." });
  878 | });
  879 | 
```