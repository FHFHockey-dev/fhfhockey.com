# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: social-share.spec.ts >> returning to the tab keeps the week, days and card: the gate's re-check remounts the studio without a reset (ticket 15)
- Location: e2e/social-share.spec.ts:923:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "2026-10-26,2026-10-28,2026-10-29,2026-10-30,2026-10-31,2026-11-01"
Received: null
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
          - generic [ref=e38]: E
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
                - option "Streaming options · tier list" [selected]
                - option "Streaming options · widened tiers"
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
            - button "TUE Oct 27 OFF · 12 games" [ref=e59] [cursor=pointer]:
              - strong [ref=e60]: TUE
              - generic [ref=e61]: Oct 27
              - generic [ref=e62]: OFF · 12 games
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
        - paragraph [ref=e86]: NHL schedule checked Oct 24, 7:34 PM EDT · Provider update Not available · Remaining after Oct 24, 7:34 PM EDT
        - generic [ref=e87]:
          - region "Graphic preview" [ref=e88]:
            - generic [ref=e89]:
              - heading "1080 × 1080 preview" [level=2] [ref=e90]
              - generic [ref=e91]: Streaming options (strict)
            - img [ref=e93]:
              - generic [ref=e94]:
                - generic [ref=e95]:
                  - img "FHFH" [ref=e96]
                  - generic [ref=e97]: FHFHOCKEY.COM
                - generic [ref=e98]:
                  - paragraph [ref=e99]: Week ahead · Schedule-aware tier list
                  - heading "STREAMING OPTIONS" [level=2] [ref=e100]
                - generic [ref=e101]:
                  - generic [ref=e102]: COVERS MON, WED, THU, FRI, SAT, SUN
                  - strong [ref=e103]: Oct 26 – Nov 1
                  - generic [ref=e104]: "2026"
              - generic [ref=e105]:
                - generic [ref=e106]:
                  - generic [ref=e107]:
                    - strong [ref=e108]: TIER 1
                    - generic [ref=e110]:
                      - text: 4 GP · 3 OFF
                      - generic [ref=e111]: +3 more
                  - generic [ref=e112]:
                    - generic [ref=e113]: "1"
                    - generic [ref=e115]:
                      - strong [ref=e116]: Fixture MTL-4
                      - generic [ref=e117]:
                        - text: MTL · RW
                        - generic [ref=e118]:
                          - generic [ref=e119]: L3
                          - generic [ref=e120]: PP1
                    - generic [ref=e121]:
                      - strong [ref=e122]: 25%
                      - generic [ref=e123]: 20–29%
                    - generic [ref=e124]:
                      - generic [ref=e125]: L5 GP
                      - text: 2G 3A · 12 SOG · 0 PPP · 15:30 −0:16
                    - generic [ref=e126]: 4.65 SCORE
                  - generic [ref=e127]:
                    - generic [ref=e128]: "2"
                    - generic [ref=e130]:
                      - strong [ref=e131]: Fixture MTL-1
                      - generic [ref=e132]:
                        - text: MTL · C
                        - generic [ref=e133]:
                          - generic [ref=e134]: L4
                          - generic [ref=e135]: PP2
                    - generic [ref=e136]:
                      - strong [ref=e137]: 28%
                      - generic [ref=e138]: 20–29%
                    - generic [ref=e139]:
                      - generic [ref=e140]: L5 GP
                      - text: 3G 4A · 9 SOG · 0 PPP · 15:15 +0:02
                    - generic [ref=e141]: 4.57 SCORE
                  - generic [ref=e142]:
                    - generic [ref=e143]: "3"
                    - generic [ref=e145]:
                      - strong [ref=e146]: Fixture MTL-6
                      - generic [ref=e147]:
                        - text: MTL · D
                        - generic [ref=e148]:
                          - generic [ref=e149]: P3
                          - generic [ref=e150]: PP1
                    - generic [ref=e151]:
                      - strong [ref=e152]: 21%
                      - generic [ref=e153]: 20–29%
                    - generic [ref=e154]:
                      - generic [ref=e155]: L5 GP
                      - text: 0G 4A · 14 SOG · 2 PPP · 20:32 −0:04
                    - generic [ref=e156]: 3.90 SCORE
                  - generic [ref=e157]:
                    - generic [ref=e158]: "4"
                    - generic [ref=e160]:
                      - strong [ref=e161]: Fixture MTL-5
                      - generic [ref=e162]:
                        - text: MTL · RW,C
                        - generic [ref=e163]:
                          - generic [ref=e164]: L4
                          - generic [ref=e165]: PP2
                    - generic [ref=e166]:
                      - strong [ref=e167]: 20%
                      - generic [ref=e168]: 20–29%
                    - generic [ref=e169]:
                      - generic [ref=e170]: L5 GP
                      - text: 3G 1A · 13 SOG · 1 PPP · 15:35 −0:22
                    - generic [ref=e171]: 3.84 SCORE
                  - generic [ref=e172]:
                    - generic [ref=e173]: "5"
                    - generic [ref=e175]:
                      - strong [ref=e176]: Fixture MTL-3
                      - generic [ref=e177]:
                        - text: MTL · LW
                        - generic [ref=e178]:
                          - generic [ref=e179]: L2
                          - generic [ref=e180]: NO PP
                    - generic [ref=e181]:
                      - strong [ref=e182]: 9%
                      - generic [ref=e183]: <20%
                    - generic [ref=e184]:
                      - generic [ref=e185]: L5 GP
                      - text: 1G 0A · 11 SOG · 2 PPP · 15:25 −0:10
                    - generic [ref=e186]: 2.70 SCORE
                - generic [ref=e187]:
                  - generic [ref=e188]:
                    - strong [ref=e189]: TIER 2
                    - generic [ref=e191]:
                      - text: 4 GP · 2 OFF
                      - generic [ref=e192]: +8 more
                  - generic [ref=e193]:
                    - generic [ref=e194]: "1"
                    - generic [ref=e196]:
                      - strong [ref=e197]: Fixture FLA-1
                      - generic [ref=e198]:
                        - text: FLA · C
                        - generic [ref=e199]:
                          - generic [ref=e200]: L4
                          - generic [ref=e201]: PP2
                    - generic [ref=e202]:
                      - strong [ref=e203]: 35%
                      - generic [ref=e204]: 30–49%
                    - generic [ref=e205]:
                      - generic [ref=e206]: L5 GP
                      - text: 3G 4A · 17 SOG · 2 PPP · 21:55 +5:02
                    - generic [ref=e207]: 6.11 SCORE
                  - generic [ref=e208]:
                    - generic [ref=e209]: "2"
                    - generic [ref=e211]:
                      - strong [ref=e212]: Fixture VAN-1
                      - generic [ref=e213]:
                        - text: VAN · C
                        - generic [ref=e214]:
                          - generic [ref=e215]: L2
                          - generic [ref=e216]: PP2
                    - generic [ref=e217]:
                      - strong [ref=e218]: 45%
                      - generic [ref=e219]: 30–49%
                    - generic [ref=e220]:
                      - generic [ref=e221]: L5 GP
                      - text: 1G 2A · 11 SOG · 2 PPP · 22:25 +4:26
                    - generic [ref=e222]: 4.43 SCORE
                  - generic [ref=e223]:
                    - generic [ref=e224]: "3"
                    - generic [ref=e226]:
                      - strong [ref=e227]: Fixture VAN-7
                      - generic [ref=e228]:
                        - text: VAN · D
                        - generic [ref=e229]:
                          - generic [ref=e230]: P3
                          - generic [ref=e231]: NO PP
                    - generic [ref=e232]:
                      - strong [ref=e233]: 5%
                      - generic [ref=e234]: <20%
                    - generic [ref=e235]:
                      - generic [ref=e236]: L5 GP
                      - text: 3G 0A · 17 SOG · 2 PPP · 26:20 +6:15
                    - generic [ref=e237]: 4.20 SCORE
                  - generic [ref=e238]:
                    - generic [ref=e239]: "4"
                    - generic [ref=e241]:
                      - strong [ref=e242]: Fixture FLA-6
                      - generic [ref=e243]:
                        - text: FLA · D
                        - generic [ref=e244]:
                          - generic [ref=e245]: P2
                          - generic [ref=e246]: PP1
                    - generic [ref=e247]:
                      - strong [ref=e248]: 9%
                      - generic [ref=e249]: <20%
                    - generic [ref=e250]:
                      - generic [ref=e251]: L5 GP
                      - text: 0G 4A · 10 SOG · 1 PPP · 25:52 +3:56
                    - generic [ref=e252]: 4.15 SCORE
                  - generic [ref=e253]:
                    - generic [ref=e254]: "5"
                    - generic [ref=e256]:
                      - strong [ref=e257]: Fixture VAN-8
                      - generic [ref=e258]:
                        - text: VAN · D
                        - generic [ref=e259]:
                          - generic [ref=e260]: P1
                          - generic [ref=e261]: PP1
                    - generic [ref=e262]:
                      - strong [ref=e263]: 35%
                      - generic [ref=e264]: 30–49%
                    - generic [ref=e265]:
                      - generic [ref=e266]: L5 GP
                      - text: 0G 3A · 6 SOG · 0 PPP · 26:24 +6:12
                    - generic [ref=e267]: 3.33 SCORE
                - generic [ref=e268]:
                  - generic [ref=e269]:
                    - strong [ref=e270]: TIER 3
                    - generic [ref=e272]:
                      - text: 3 GP · 3 OFF
                      - generic [ref=e273]: +1 more
                  - generic [ref=e274]:
                    - generic [ref=e275]: "1"
                    - generic [ref=e277]:
                      - strong [ref=e278]: Fixture NYI-3
                      - generic [ref=e279]:
                        - text: NYI · LW
                        - generic [ref=e280]:
                          - generic [ref=e281]: L4
                          - generic [ref=e282]: PP2
                    - generic [ref=e283]:
                      - strong [ref=e284]: 33%
                      - generic [ref=e285]: 30–49%
                    - generic [ref=e286]:
                      - generic [ref=e287]: L5 GP
                      - text: 3G 2A · 13 SOG · 1 PPP · 21:35 +5:26
                    - generic [ref=e288]: 4.90 SCORE
                  - generic [ref=e289]:
                    - generic [ref=e290]: "2"
                    - generic [ref=e292]:
                      - strong [ref=e293]: Fixture NYI-6
                      - generic [ref=e294]:
                        - text: NYI · D
                        - generic [ref=e295]:
                          - generic [ref=e296]: P2
                          - generic [ref=e297]: PP1
                    - generic [ref=e298]:
                      - strong [ref=e299]: 8%
                      - generic [ref=e300]: <20%
                    - generic [ref=e301]:
                      - generic [ref=e302]: L5 GP
                      - text: 2G 1A · 16 SOG · 1 PPP · 25:28 +4:14
                    - generic [ref=e303]: 3.90 SCORE
                  - generic [ref=e304]:
                    - generic [ref=e305]: "3"
                    - generic [ref=e307]:
                      - strong [ref=e308]: Fixture NYI-1
                      - generic [ref=e309]:
                        - text: NYI · C
                        - generic [ref=e310]:
                          - generic [ref=e311]: L2
                          - generic [ref=e312]: PP2
                    - generic [ref=e313]:
                      - strong [ref=e314]: 13%
                      - generic [ref=e315]: <20%
                    - generic [ref=e316]:
                      - generic [ref=e317]: L5 GP
                      - text: 1G 1A · 11 SOG · 2 PPP · 21:25 +5:38
                    - generic [ref=e318]: 3.04 SCORE
                  - generic [ref=e319]:
                    - generic [ref=e320]: "4"
                    - generic [ref=e322]:
                      - strong [ref=e323]: Fixture NYI-4
                      - generic [ref=e324]:
                        - text: NYI · RW
                        - generic [ref=e325]:
                          - generic [ref=e326]: L1
                          - generic [ref=e327]: NO PP
                    - generic [ref=e328]:
                      - strong [ref=e329]: 23%
                      - generic [ref=e330]: 20–29%
                    - generic [ref=e331]:
                      - generic [ref=e332]: L5 GP
                      - text: 0G 0A · 14 SOG · 2 PPP · 21:40 +5:20
                    - generic [ref=e333]: 2.58 SCORE
                  - generic [ref=e334]:
                    - generic [ref=e335]: "5"
                    - generic [ref=e337]:
                      - strong [ref=e338]: Fixture NYI-9
                      - generic [ref=e339]: NYI · G
                    - generic [ref=e340]:
                      - strong [ref=e341]: 3%
                      - generic [ref=e342]: <20%
                    - generic [ref=e343]:
                      - generic [ref=e344]: L5 GP
                      - text: 4-1 · .952 SV% · 7 GA · 4 QS
                    - generic [ref=e345]: 8.00 SCORE
              - generic [ref=e346]:
                - generic [ref=e347]:
                  - generic [ref=e348]:
                    - generic [ref=e349]: Tier
                    - text: = exact GP · off-night pair, best Week Score first
                  - generic [ref=e350]:
                    - generic [ref=e351]: L5 GP
                    - text: last 5 games played
                  - generic [ref=e352]: Under 50% rostered · ranked by L5 score
                - paragraph [ref=e353]: Score = L5 fantasy pts/GP (G 3 · A 2 · PPP 1 · SOG 0.2 · HIT 0.2 · BLK 0.25; goalies W 4 · SV 0.2 · GA −1 · SO 3) × opportunity (L1 +15% · L2 +10% · L3 +5% · D P1 +10% · P2 +5% · PP1 +10% · PP2 +5% · ±2% per L5 TOI min vs 16:00 F / 20:00 D, max ±10%); season rate breaks ties
                - paragraph [ref=e354]:
                  - generic [ref=e355]: Strictly tier teams only · +N more = rows that did not fit · Yahoo rostered % as of Oct 24 · NHL.com season totals updated Oct 24, 3:34 PM EDT
                  - strong [ref=e356]: SCHEDULE + PLAYER RATES
            - generic [ref=e357]:
              - button "Download PNG" [ref=e358] [cursor=pointer]
              - button "Copy alt text" [ref=e359] [cursor=pointer]
            - status
            - group [ref=e360]:
              - generic "Suggested alt text" [ref=e361]
          - region "Complete ranked schedule" [ref=e362]:
            - generic [ref=e363]:
              - heading "All teams" [level=2] [ref=e364]
              - generic [ref=e365]: 32 teams
            - paragraph [ref=e366]: Schedule Score compares remaining selected games, off-night games and full-slate density. Odds and player projections are excluded. Zero-game teams have no score to publish. Matchups below include context; elapsed, live, postponed and nonregular games do not count as opportunities.
            - list [ref=e367]:
              - listitem [ref=e368]:
                - generic [ref=e369]:
                  - strong [ref=e370]: "#1 Montréal Canadiens"
                  - generic [ref=e371]: 4 left · 3 off-night · Score 18.4
                - paragraph [ref=e372]: Oct 26 @ LAK (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ LAK (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ SEA (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 vs FLA (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e373]:
                - generic [ref=e374]:
                  - strong [ref=e375]: "#2 Vancouver Canucks"
                  - generic [ref=e376]: 4 left · 2 off-night · Score 14.4
                - paragraph [ref=e377]: Oct 28 vs UTA (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 vs BOS (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ STL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ WSH (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e378]:
                - generic [ref=e379]:
                  - strong [ref=e380]: "#3 Washington Capitals"
                  - generic [ref=e381]: 4 left · 2 off-night · Score 14.3
                - paragraph [ref=e382]: Oct 29 vs PHI (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs BOS (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs COL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs VAN (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e383]:
                - generic [ref=e384]:
                  - strong [ref=e385]: "#4 Florida Panthers"
                  - generic [ref=e386]: 4 left · 2 off-night · Score 14.3
                - paragraph [ref=e387]: Oct 26 @ ANA (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ COL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs BUF (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ MTL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e388]:
                - generic [ref=e389]:
                  - strong [ref=e390]: "#5 New York Islanders"
                  - generic [ref=e391]: 3 left · 3 off-night · Score 12.5
                - paragraph [ref=e392]: Oct 28 @ NJD (scheduled; Oct 28, 7:00 PM EDT) · Oct 30 @ WPG (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 @ PHI (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e393]:
                - generic [ref=e394]:
                  - strong [ref=e395]: "#6 New Jersey Devils"
                  - generic [ref=e396]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e397]: Oct 26 @ CHI (scheduled; Oct 26, 7:00 PM EDT) · Oct 28 vs NYI (scheduled; Oct 28, 7:00 PM EDT) · Oct 31 @ OTT (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e398]:
                - generic [ref=e399]:
                  - strong [ref=e400]: "#7 Utah Mammoth"
                  - generic [ref=e401]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e402]: Oct 26 vs EDM (scheduled; Oct 26, 7:00 PM EDT) · Oct 28 @ VAN (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ NSH (scheduled; Oct 29, 7:00 PM EDT)
              - listitem [ref=e403]:
                - generic [ref=e404]:
                  - strong [ref=e405]: "#8 St. Louis Blues"
                  - generic [ref=e406]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e407]: Oct 30 vs DET (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs VAN (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 @ CBJ (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e408]:
                - generic [ref=e409]:
                  - strong [ref=e410]: "#9 Vegas Golden Knights"
                  - generic [ref=e411]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e412]: Oct 29 vs NYR (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs BUF (scheduled; Oct 30, 7:00 PM EDT) · Nov 1 vs EDM (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e413]:
                - generic [ref=e414]:
                  - strong [ref=e415]: "#10 Edmonton Oilers"
                  - generic [ref=e416]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e417]: Oct 26 @ UTA (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ PIT (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ VGK (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e418]:
                - generic [ref=e419]:
                  - strong [ref=e420]: "#11 Los Angeles Kings"
                  - generic [ref=e421]: 3 left · 2 off-night · Score 8.4
                - paragraph [ref=e422]: Oct 26 vs MTL (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs MTL (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ DAL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e423]:
                - generic [ref=e424]:
                  - strong [ref=e425]: "#12 New York Rangers"
                  - generic [ref=e426]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e427]: Oct 28 vs MIN (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ VGK (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ TOR (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e428]:
                - generic [ref=e429]:
                  - strong [ref=e430]: "#13 Pittsburgh Penguins"
                  - generic [ref=e431]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e432]: Oct 28 @ TOR (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 vs EDM (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ MIN (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e433]:
                - generic [ref=e434]:
                  - strong [ref=e435]: "#14 Toronto Maple Leafs"
                  - generic [ref=e436]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e437]: Oct 28 vs PIT (scheduled; Oct 28, 7:00 PM EDT) · Oct 29 @ DAL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs NYR (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e438]:
                - generic [ref=e439]:
                  - strong [ref=e440]: "#15 Boston Bruins"
                  - generic [ref=e441]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e442]: Oct 29 @ VAN (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ WSH (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ CHI (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e443]:
                - generic [ref=e444]:
                  - strong [ref=e445]: "#16 Buffalo Sabres"
                  - generic [ref=e446]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e447]: Oct 29 vs SEA (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ VGK (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ FLA (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e448]:
                - generic [ref=e449]:
                  - strong [ref=e450]: "#17 Detroit Red Wings"
                  - generic [ref=e451]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e452]: Oct 29 @ CHI (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 @ STL (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 vs SEA (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e453]:
                - generic [ref=e454]:
                  - strong [ref=e455]: "#18 Seattle Kraken"
                  - generic [ref=e456]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e457]: Oct 29 @ BUF (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs MTL (scheduled; Oct 30, 7:00 PM EDT) · Oct 31 @ DET (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e458]:
                - generic [ref=e459]:
                  - strong [ref=e460]: "#19 Chicago Blackhawks"
                  - generic [ref=e461]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e462]: Oct 26 vs NJD (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs DET (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs BOS (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e463]:
                - generic [ref=e464]:
                  - strong [ref=e465]: "#20 Colorado Avalanche"
                  - generic [ref=e466]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e467]: Oct 26 @ CAR (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs FLA (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ WSH (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e468]:
                - generic [ref=e469]:
                  - strong [ref=e470]: "#21 Ottawa Senators"
                  - generic [ref=e471]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e472]: Oct 26 vs TBL (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 @ TBL (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs NJD (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e473]:
                - generic [ref=e474]:
                  - strong [ref=e475]: "#22 Tampa Bay Lightning"
                  - generic [ref=e476]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e477]: Oct 26 @ OTT (scheduled; Oct 26, 7:00 PM EDT) · Oct 29 vs OTT (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ SJS (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e478]:
                - generic [ref=e479]:
                  - strong [ref=e480]: "#23 Columbus Blue Jackets"
                  - generic [ref=e481]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e482]: Oct 29 @ CGY (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs ANA (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs STL (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e483]:
                - generic [ref=e484]:
                  - strong [ref=e485]: "#24 Dallas Stars"
                  - generic [ref=e486]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e487]: Oct 29 vs TOR (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs PHI (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs LAK (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e488]:
                - generic [ref=e489]:
                  - strong [ref=e490]: "#25 Philadelphia Flyers"
                  - generic [ref=e491]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e492]: Oct 29 @ WSH (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ DAL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs NYI (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e493]:
                - generic [ref=e494]:
                  - strong [ref=e495]: "#26 San Jose Sharks"
                  - generic [ref=e496]: 3 left · 1 off-night · Score 4.3
                - paragraph [ref=e497]: Oct 29 vs WPG (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 vs TBL (scheduled; Oct 31, 7:00 PM EDT) · Nov 1 vs CGY (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e498]:
                - generic [ref=e499]:
                  - strong [ref=e500]: "#27 Minnesota Wild"
                  - generic [ref=e501]: 2 left · 1 off-night · Score -1.6
                - paragraph [ref=e502]: Oct 28 @ NYR (scheduled; Oct 28, 7:00 PM EDT) · Oct 31 vs PIT (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e503]:
                - generic [ref=e504]:
                  - strong [ref=e505]: "#28 Anaheim Ducks"
                  - generic [ref=e506]: 2 left · 1 off-night · Score -1.6
                - paragraph [ref=e507]: Oct 26 vs FLA (scheduled; Oct 26, 7:00 PM EDT) · Oct 31 @ CBJ (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e508]:
                - generic [ref=e509]:
                  - strong [ref=e510]: "#29 Carolina Hurricanes"
                  - generic [ref=e511]: 2 left · 1 off-night · Score -1.6
                - paragraph [ref=e512]: Oct 26 vs COL (scheduled; Oct 26, 7:00 PM EDT) · Oct 31 vs NSH (scheduled; Oct 31, 7:00 PM EDT)
              - listitem [ref=e513]:
                - generic [ref=e514]:
                  - strong [ref=e515]: "#30 Winnipeg Jets"
                  - generic [ref=e516]: 2 left · 1 off-night · Score -1.6
                - paragraph [ref=e517]: Oct 29 @ SJS (scheduled; Oct 29, 7:00 PM EDT) · Oct 30 vs NYI (scheduled; Oct 30, 7:00 PM EDT)
              - listitem [ref=e518]:
                - generic [ref=e519]:
                  - strong [ref=e520]: "#31 Calgary Flames"
                  - generic [ref=e521]: 2 left · 1 off-night · Score -1.7
                - paragraph [ref=e522]: Oct 29 vs CBJ (scheduled; Oct 29, 7:00 PM EDT) · Nov 1 @ SJS (scheduled; Nov 1, 6:00 PM EST)
              - listitem [ref=e523]:
                - generic [ref=e524]:
                  - strong [ref=e525]: "#32 Nashville Predators"
                  - generic [ref=e526]: 2 left · 0 off-night · Score -5.8
                - paragraph [ref=e527]: Oct 29 vs UTA (scheduled; Oct 29, 7:00 PM EDT) · Oct 31 @ CAR (scheduled; Oct 31, 7:00 PM EDT)
    - contentinfo [ref=e528]:
      - generic [ref=e529]:
        - generic [ref=e530]:
          - link "FHFH home" [ref=e531] [cursor=pointer]:
            - /url: /
            - img [ref=e532]
          - generic [ref=e538]: Five Hole Fantasy Hockey
          - generic [ref=e539]: © 2026 FHFHockey
        - navigation "Footer navigation" [ref=e540]:
          - link "Underlying Stats" [ref=e541] [cursor=pointer]:
            - /url: /underlying-stats
          - link "Game Grid" [ref=e542] [cursor=pointer]:
            - /url: /game-grid
          - link "Stats" [ref=e543] [cursor=pointer]:
            - /url: /stats
          - link "Blog" [ref=e544] [cursor=pointer]:
            - /url: /blog
          - link "Podcast" [ref=e545] [cursor=pointer]:
            - /url: /podfeed
          - link "Privacy" [ref=e546] [cursor=pointer]:
            - /url: /privacy
        - generic [ref=e547]:
          - link "Support FHFH" [ref=e548] [cursor=pointer]:
            - /url: https://www.buymeacoffee.com/tjsusername
          - generic [ref=e549]:
            - link "Twitter" [ref=e550] [cursor=pointer]:
              - /url: https://www.twitter.com/fhfhockey
              - img "Twitter" [ref=e551]
            - link "Discord" [ref=e552] [cursor=pointer]:
              - /url: https://discord.gg/kfnyrn7
              - img "Discord" [ref=e553]
            - link "Patreon" [ref=e554] [cursor=pointer]:
              - /url: https://www.patreon.com/FHFHRadio
              - img "Patreon" [ref=e555]
            - link "Youtube" [ref=e556] [cursor=pointer]:
              - /url: https://www.youtube.com/fiveholefantasyhockey
              - img "Youtube" [ref=e557]
            - link "Spotify" [ref=e558] [cursor=pointer]:
              - /url: https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g
              - img "Spotify" [ref=e559]
  - alert [ref=e560]: Schedule share studio | FHFH
```

# Test source

```ts
  849 |     await open(page, format);
  850 |     const square = page.getByTestId("share-square"), graphic = page.getByRole("combobox", { name: /^Graphic/ });
  851 |     await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  852 |     const edition = source.latest!;
  853 |     expect(edition.format).toBe(format);
  854 |     const gp = countTiers(edition.rows.map(row => row.remainingGames)), off = countTiers(edition.rows.map(row => row.offNightGames));
  855 |     const rows = await square.locator("[data-team][data-tier]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-team"), node.getAttribute("data-gp-tier"), node.getAttribute("data-off-tier")]));
  856 |     expect(rows).toEqual(edition.rows.map(row => [row.team.abbreviation, gp.get(row.remainingGames), off.get(row.offNightGames)]));
  857 |     expect(rows.some(([, gpTier, offTier]) => gpTier !== offTier)).toBe(true);
  858 |     expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("high");
  859 |     expect(new Set(rows.map(([, gpTier]) => gpTier))).toContain("low");
  860 |     await expect(square).toContainText("GP · OFF");
  861 |     await downloadedPng(page, `counts-${format}-grid`);
  862 |     for (const card of ["pickups-20", "easiest", "leaders"]) {
  863 |       await graphic.selectOption(card);
  864 |       const counts = await square.locator("[data-count-tier]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-count-tier")));
  865 |       expect(counts.length).toBeGreaterThan(0);
  866 |       expect(counts.every(tier => ["high", "second", "between", "low"].includes(tier!))).toBe(true);
  867 |     }
  868 |   }
  869 | });
  870 | 
  871 | test("schedule-aware tier list shows only tier teams' players as list rows, strict and widened", async ({ page }) => {
  872 |   const source = await install(page), expected: Record<string, string[]> = {};
  873 |   source.mode = "league";
  874 |   await open(page);
  875 |   const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square"), download = page.getByRole("button", { name: "Download PNG", exact: true });
  876 |   await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  877 |   for (const [card, mode] of [["tiers", "strict"], ["tiers-wide", "widened"]] as const) {
  878 |     await graphic.selectOption(card);
  879 |     await expect(square).toContainText("STREAMING OPTIONS");
  880 |     const tiers = streamingTiers(source.latest!, true, mode);
  881 |     expect(tiers).toHaveLength(3);
  882 |     await expect(square.locator("[data-tier-index]")).toHaveCount(3);
  883 |     expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(tiers.flatMap(tier => tier.shown.map(player => String(player.nhlId))));
  884 |     for (const tier of tiers) {
  885 |       const block = square.locator(`[data-tier-index="${tier.index}"]`);
  886 |       for (const player of tier.shown) expect(tier.teams.map(team => team.abbreviation)).toContain(player.team);
  887 |       if (tier.more) await expect(block).toContainText(`+${tier.more} more`);
  888 |       await expect(block.locator("[data-player]").first()).toContainText("L5 GP");
  889 |     }
  890 |     expect(await matchupGeometry(page)).toEqual({ fits: true, rowsInside: true, brokenImages: 0 });
  891 |     await expect(download).toBeEnabled();
  892 |     await downloadedPng(page, `streaming-tiers-${mode}`);
  893 |     expected[mode] = tiers.flatMap(tier => tier.shown.map(player => String(player.nhlId)));
  894 |   }
  895 |   // Live-shaped edition (SS1-14): the server trims the layer to the cards' players and records tier counts;
  896 |   // the tier list still renders the same rows instead of "Ranking unavailable".
  897 |   source.liveTrim = true;
  898 |   await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
  899 |   for (const [card, mode] of [["tiers", "strict"], ["tiers-wide", "widened"]] as const) {
  900 |     await graphic.selectOption(card);
  901 |     await expect(square.locator("[data-tier-index]")).toHaveCount(3);
  902 |     expect(source.latest!.players!.tierCounts).toBeTruthy();
  903 |     expect(await square.locator("[data-player]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-player")))).toEqual(expected[mode]);
  904 |     await expect(square).not.toContainText("Ranking unavailable");
  905 |     await expect(download).toBeEnabled();
  906 |   }
  907 | });
  908 | 
  909 | test("share studio stays closed without a social editor role, and the edition is never requested", async ({ page }) => {
  910 |   // Negative control for the fictional sign-in fixture: signed out, then signed in with no role.
  911 |   for (const access of [{ role: null, signedIn: false, roleReads: 0, writes: [] as string[] }, { role: null, signedIn: true, roleReads: 0, writes: [] as string[] }] satisfies Access[]) {
  912 |     const source = await install(page, access);
  913 |     await page.goto("/social-share/game-grid");
  914 |     await expect(page.locator("section[aria-labelledby=\"share-access-title\"] [role=\"alert\"]")).toHaveText(access.signedIn ? "Social editor access is required to use this studio." : "Sign in with your FHFH social editor account to continue.");
  915 |     await expect(page.getByTestId("share-square")).toHaveCount(0);
  916 |     expect(source.requests).toBe(0);
  917 |     expect(access.roleReads > 0).toBe(access.signedIn);
  918 |     expect(access.writes).toEqual([]);
  919 |     await page.unrouteAll({ behavior: "ignoreErrors" }); await page.context().unrouteAll({ behavior: "ignoreErrors" });
  920 |   }
  921 | });
  922 | 
  923 | test("returning to the tab keeps the week, days and card: the gate's re-check remounts the studio without a reset (ticket 15)", async ({ page }) => {
  924 |   const access: Access = { role: "social_editor", signedIn: true, roleReads: 0, writes: [] };
  925 |   const source = await install(page, access);
  926 |   source.mode = "league";
  927 |   await open(page);
  928 |   const graphic = page.getByRole("combobox", { name: /^Graphic/ }), square = page.getByTestId("share-square");
  929 |   await expect(square.locator("[data-team][data-tier]")).toHaveCount(32);
  930 |   await page.getByRole("button", { name: /^Tue /i }).click();
  931 |   await graphic.selectOption("tiers");
  932 |   await expect(square).toContainText("STREAMING OPTIONS");
  933 |   await expect(page).toHaveURL(/[?&]card=tiers/);
  934 |   const url = new URL(page.url()), requests = source.requests, reads = access.roleReads;
  935 |   expect(url.searchParams.get("week")).toBe(upcomingWeek);
  936 |   expect(url.searchParams.get("dates")!.split(",").length).toBe(6);
  937 |   // Supabase re-announces the session when the tab becomes visible again; the gate re-reads the role.
  938 |   await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));
  939 |   await expect.poll(() => access.roleReads).toBeGreaterThan(reads);
  940 |   await expect(square).toContainText("STREAMING OPTIONS");
  941 |   await expect(graphic).toHaveValue("tiers");
  942 |   await expect(page.getByLabel("Week of (Monday)")).toHaveValue(upcomingWeek);
  943 |   expect(new URL(page.url()).searchParams.get("dates")).toBe(url.searchParams.get("dates"));
  944 |   expect(source.requests).toBe(requests);
  945 |   // A full reload restores the same selection from the URL (one fresh edition read).
  946 |   await page.reload();
  947 |   await expect(graphic).toHaveValue("tiers");
  948 |   await expect(page.getByLabel("Week of (Monday)")).toHaveValue(upcomingWeek);
> 949 |   expect(new URL(page.url()).searchParams.get("dates")).toBe(url.searchParams.get("dates"));
      |                                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  950 |   expect(access.writes).toEqual([]);
  951 | });
  952 | 
  953 | 
```