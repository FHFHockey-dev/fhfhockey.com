// lib/standardization/nameStandardization.ts

/**
 * This map is CRUCIAL.
 * Keys: A normalized, lowercase version of a potential name from a CSV
 * (after processing by `normalizeForLookup`).
 * Values: The EXACT "fullName" string as it exists in `players` database table.
 *
 * Populate this extensively based on your CSV data and the output from
 * `SELECT DISTINCT "fullName" FROM public.players;`
 */
export const canonicalNameMap: Record<string, string> = {
  // --- Direct Matches & Common Variations from your lists ---
  connormcdavid: "Connor McDavid",
  nikitakucherov: "Nikita Kucherov",
  nathanmackinnon: "Nathan MacKinnon",
  leondraisaitl: "Leon Draisaitl",
  artemipanarin: "Artemi Panarin",
  davidpastrnak: "David Pastrnak",
  mikkoraattann: "Mikko Rantanen", // Corrected based on typical spelling; verify if DB has "Rantanen"
  austonmatthews: "Auston Matthews",
  matthewtkachuk: "Matthew Tkachuk",
  jtmiller: "J.T. Miller", // CSV: J.T. Miller -> DB: J.T. Miller
  kirillkaprizov: "Kirill Kaprizov",
  williamnylander: "William Nylander",
  sidneycrosby: "Sidney Crosby",
  mitchmarner: "Mitch Marner", // CSV: Mitch Marner -> DB: Mitch Marner
  jasonrobertson: "Jason Robertson",
  stevenstamkos: "Steven Stamkos",
  jackhughes: "Jack Hughes",
  eliaspettersson: "Elias Pettersson", // Note: Ambiguous in your DB, this map helps find *a* match
  calemakar: "Cale Makar",
  braydenpoint: "Brayden Point",
  sebastianaho: "Sebastian Aho", // Note: Ambiguous in your DB
  aleksanderbarkov: "Aleksander Barkov",
  robertthomas: "Robert Thomas",
  romanjosi: "Roman Josi",
  samreinhart: "Sam Reinhart",
  timstutzle: "Tim Stützle", // CSV: Tim Stutzle -> DB: Tim Stützle (with accent)
  jesperbratt: "Jesper Bratt",
  filipforsberg: "Filip Forsberg",
  mikazibanejad: "Mika Zibanejad",
  quinnhughes: "Quinn Hughes",
  jakeguentzel: "Jake Guentzel",
  kevinfiala: "Kevin Fiala",
  bradytkachuk: "Brady Tkachuk",
  claytonkeller: "Clayton Keller",
  mathewbarzal: "Mathew Barzal", // Check DB spelling (Mathew vs Matthew)
  kyleconnor: "Kyle Connor",
  adamfox: "Adam Fox",
  zachhyman: "Zach Hyman", // CSV: Zach Hyman -> DB: Zach Hyman
  jordankyrou: "Jordan Kyrou",
  matthewboldy: "Matt Boldy", // CSV: Matthew Boldy -> DB: Matt Boldy
  mattboldy: "Matt Boldy", // For completeness
  johntavares: "John Tavares",
  ryannugenthopkins: "Ryan Nugent-Hopkins",
  evanbouchard: "Evan Bouchard",
  victorhedman: "Victor Hedman",
  dylanlarkin: "Dylan Larkin",
  markscheifele: "Mark Scheifele",
  nazemkadri: "Nazem Kadri",
  roopehintz: "Roope Hintz",
  bradmarchand: "Brad Marchand",
  connorbedard: "Connor Bedard",
  nicksuzuki: "Nick Suzuki",
  anzekopitar: "Anze Kopitar",
  tagethompson: "Tage Thompson",
  alexanderovechkin: "Alex Ovechkin", // CSV "Alexander Ovechkin" -> DB "Alex Ovechkin"
  alexovechkin: "Alex Ovechkin", // For completeness
  carterverhaeghe: "Carter Verhaeghe",
  alexdebrincat: "Alex DeBrincat", // CSV "Alex DeBrincat" -> DB "Alex DeBrincat"
  nicohischier: "Nico Hischier",
  chriskreider: "Chris Kreider",
  brocknelson: "Brock Nelson",
  adriankempe: "Adrian Kempe",
  pavelbuchnevich: "Pavel Buchnevich",
  jonathanhuberdeau: "Jonathan Huberdeau",
  bohorvat: "Bo Horvat",
  claudegiroux: "Claude Giroux",
  matszuccarello: "Mats Zuccarello",
  vincenttrocheck: "Vincent Trocheck",
  jackeichel: "Jack Eichel",
  traviskonecny: "Travis Konecny",
  evgenimalkin: "Evgeni Malkin",
  patrickkane: "Patrick Kane",
  rasmusdahlin: "Rasmus Dahlin",
  sethjarvis: "Seth Jarvis",
  drakebatherson: "Drake Batherson",
  jonathanmarchessault: "Jonathan Marchessault",
  brockboeser: "Brock Boeser",
  brandonhagel: "Brandon Hagel",
  joshmorrissey: "Josh Morrissey",
  timomeier: "Timo Meier",
  wyattjohnston: "Wyatt Johnston",
  jaredmccann: "Jared McCann",
  alexislafreniere: "Alexis Lafrenière", // CSV "Alexis Lafreniere" -> DB "Alexis Lafrenière"
  troyterry: "Troy Terry",
  lucasraymond: "Lucas Raymond",
  andreisvechnikov: "Andrei Svechnikov",
  dylanstrome: "Dylan Strome",
  erikkarlsson: "Erik Karlsson",
  joelerikssonek: "Joel Eriksson Ek",
  alextuch: "Alex Tuch",
  quintonbyfield: "Quinton Byfield",
  caseymittelstadt: "Casey Mittelstadt",
  noahdobson: "Noah Dobson",
  mattduchene: "Matt Duchene",
  martinnecas: "Martin Necas",
  eliaslindholm: "Elias Lindholm",
  ryanoreilly: "Ryan O'Reilly", // CSV "Ryan OReilly" or "Ryan O'Reilly" -> DB "Ryan O'Reilly"
  nickschmaltz: "Nick Schmaltz",
  tylertoffoli: "Tyler Toffoli",
  vladimirtarasenko: "Vladimir Tarasenko",
  gustavnyquist: "Gustav Nyquist",
  chandlerstephenson: "Chandler Stephenson",
  colecaufield: "Cole Caufield",
  tomashertl: "Tomas Hertl",
  jamiebenn: "Jamie Benn",
  pierrelucdubois: "Pierre-Luc Dubois",
  jurajslafkovsky: "Juraj Slafkovský", // CSV "Juraj Slafkovsky" -> DB "Juraj Slafkovský"
  mikaelgranlund: "Mikael Granlund",
  morganrielly: "Morgan Rielly",
  jjpeterka: "JJ Peterka", // CSV "J.J. Peterka" -> DB "JJ Peterka"
  andreikuzmenko: "Andrei Kuzmenko",
  jeffskinner: "Jeff Skinner",
  oliverbjorkstrand: "Oliver Bjorkstrand",
  michaelbunting: "Michael Bunting",
  miroheiskanen: "Miro Heiskanen",
  owentippett: "Owen Tippett",
  yegorsharangovich: "Yegor Sharangovich",
  bryanrust: "Bryan Rust",
  matveimichkov: "Matvei Michkov", // Ensure this player exists in your DB; if new, add to DB first.
  nikolajehlers: "Nikolaj Ehlers",
  viktorarvidsson: "Viktor Arvidsson",
  braydenschenn: "Brayden Schenn",
  tommynovak: "Tommy Novak", // CSV "Tommy Novak" -> DB "Tommy Novak"
  thomasnovak: "Tommy Novak", // CSV "Thomas Novak" -> DB "Tommy Novak"
  matiasmaccelli: "Matias Maccelli", // CSV "Matias Maccelli" -> DB "Matias Maccelli"
  vincedunn: "Vince Dunn",
  sheatheodore: "Shea Theodore",
  williamkarlsson: "William Karlsson",
  dylancozens: "Dylan Cozens",
  teuvoteravainen: "Teuvo Teravainen",
  pavelzacha: "Pavel Zacha",
  johncarlson: "John Carlson",
  drewdoughty: "Drew Doughty",
  devontoews: "Devon Toews",
  charliemcavoy: "Charlie McAvoy",
  tylerseguin: "Tyler Seguin",
  logancooley: "Logan Cooley",
  matthewbeniers: "Matty Beniers", // CSV "Matthew Beniers" -> DB "Matty Beniers"
  mattybeniers: "Matty Beniers", // For completeness
  trevorzegras: "Trevor Zegras",
  frankvatrano: "Frank Vatrano",
  dylanguenther: "Dylan Guenther",
  trevormoore: "Trevor Moore",
  phillipdanault: "Phillip Danault",
  williameklund: "William Eklund",
  dougiehamilton: "Dougie Hamilton",
  davidperron: "David Perron",
  ivanbarbashev: "Ivan Barbashev",
  jordaneberle: "Jordan Eberle",
  charliecoyle: "Charlie Coyle",
  krisletang: "Kris Letang",
  brockfaber: "Brock Faber",
  seanmonahan: "Sean Monahan",
  connorgarland: "Conor Garland", // CSV "Connor Garland" (2 n's) -> DB "Conor Garland" (1 n)
  conorgarland: "Conor Garland", // For completeness
  maxdomi: "Max Domi",
  shaynegostisbehere: "Shayne Gostisbehere",
  valerinichushkin: "Valeri Nichushkin", // Check spelling in DB: Nichushkin vs Nichuskin
  mikaelbacklund: "Mikael Backlund",
  michaelmatheson: "Mike Matheson", // CSV "Michael Matheson" -> DB "Mike Matheson"
  mikematheson: "Mike Matheson", // For completeness
  thomasharley: "Thomas Harley",
  jakedbrusk: "Jake DeBrusk", // CSV "Jake Debrusk" -> DB "Jake DeBrusk"
  jacobdebrusk: "Jake DeBrusk", // If CSV might have "Jacob"
  marcorossi: "Marco Rossi",
  alexkillorn: "Alex Killorn",
  jonathandrouin: "Jonathan Drouin",
  brentburns: "Brent Burns",
  patriklaine: "Patrik Laine",
  anthonyduclair: "Anthony Duclair",
  blakecoleman: "Blake Coleman",
  masonmctavish: "Mason McTavish",
  jtcompher: "J.T. Compher", // CSV "J.T. Compher" (or J.t.) -> DB "J.T. Compher"
  coleperfetti: "Cole Perfetti",
  mackenzieweegar: "MacKenzie Weegar",
  alexanderkerfoot: "Alexander Kerfoot",
  brandonmontour: "Brandon Montour",
  noahhanifin: "Noah Hanifin",
  lanehutson: "Lane Hutson",
  moritzseider: "Moritz Seider",
  filiphronek: "Filip Hronek",
  fiiphronek: "Filip Hronek", // Typo from previous log: CSV "Fiip Hronek" -> DB "Filip Hronek"
  boonejenner: "Boone Jenner",
  kylepalmieri: "Kyle Palmieri",
  tylerbertuzzi: "Tyler Bertuzzi",
  andrewmangiapane: "Andrew Mangiapane",
  antonlundell: "Anton Lundell",
  jackquinn: "Jack Quinn",
  leocarlsson: "Leo Carlsson",
  reillysmith: "Reilly Smith",
  willsmith: "Will Smith", // Ensure this isn't ambiguous with other Will Smiths if they exist
  ryanstrome: "Ryan Strome",
  markstone: "Mark Stone",
  alexpietrangelo: "Alex Pietrangelo",
  rasmusandersson: "Rasmus Andersson",
  mikhailsergachev: "Mikhail Sergachev",
  gabrielvilardi: "Gabriel Vilardi",
  joshdoan: "Josh Doan",
  brandonsaad: "Brandon Saad",
  cuttergauthier: "Cutter Gauthier",
  sambennett: "Sam Bennett",
  macklincelebrini: "Macklin Celebrini", // CSV "Macklin Celebrini" (or MacKlin) -> DB "Macklin Celebrini"
  ryanhartman: "Ryan Hartman",
  joelfarabee: "Joel Farabee",
  morganfrost: "Morgan Frost",
  bradyskjei: "Brady Skjei",
  adamfantilli: "Adam Fantilli",
  shanepinto: "Shane Pinto",
  masonmarchment: "Mason Marchment",
  philippkurashev: "Philipp Kurashev",
  zachwerenski: "Zach Werenski",
  lawsoncrouse: "Lawson Crouse",
  dawsonmercer: "Dawson Mercer",
  adamhenrique: "Adam Henrique",
  lukeevaangelista: "Luke Evangelista",
  fabianzetterlund: "Fabian Zetterlund",
  anthonycirelli: "Anthony Cirelli",
  yannigourde: "Yanni Gourde",
  rickardrakell: "Rickard Rakell",
  connorzary: "Connor Zary",
  loganstankoven: "Logan Stankoven",
  taylorhall: "Taylor Hall",
  nikolaikovalenko: "Nikolai Kovalenko",
  aaronekblad: "Aaron Ekblad",
  gustavforsling: "Gustav Forsling",
  jakesanderson: "Jake Sanderson",
  camfowler: "Cam Fowler",
  tysonfoerster: "Tyson Foerster",
  anderslee: "Anders Lee",
  nickpaul: "Nick Paul", // CSV: Nick Paul -> DB: Nick Paul
  nicholaspaul: "Nick Paul", // CSV: Nicholas Paul -> DB: Nick Paul
  danielsprong: "Daniel Sprong",
  rosscolton: "Ross Colton",
  morgangeekie: "Morgan Geekie",
  erikhaula: "Erik Haula",
  andreburakovsky: "Andre Burakovsky",
  seancouturier: "Sean Couturier",
  travissanheim: "Travis Sanheim",
  justinfaulk: "Justin Faulk",
  evanderkane: "Evander Kane",
  dmitrivoronkov: "Dmitri Voronkov",
  ninoniederreiter: "Nino Niederreiter",
  artturilehkonen: "Artturi Lehkonen",
  matthewknies: "Matthew Knies",
  nicolasroy: "Nicolas Roy",
  evanrodrigues: "Evan Rodrigues",
  scottlaughton: "Scott Laughton",
  stefannoesen: "Stefan Noesen",
  jackroslovic: "Jack Roslovic",
  thomaschabot: "Thomas Chabot",
  mattiasekholm: "Mattias Ekholm",
  seandurzi: "Sean Durzi",
  pavelmintyukov: "Pavel Mintyukov",
  jakeneighbours: "Jake Neighbours",
  paveldorofeyev: "Pavel Dorofeyev",
  jasonzucker: "Jason Zucker",
  jakobchychrun: "Jakob Chychrun",
  sethjones: "Seth Jones",
  kirillmarchenko: "Kirill Marchenko",
  warrenfoegele: "Warren Foegele",
  gabriellandeskog: "Gabriel Landeskog",
  eelitolvanen: "Eeli Tolvanen",
  kirbydach: "Kirby Dach",
  andrewcopp: "Andrew Copp",
  jeangabrielpageau: "Jean-Gabriel Pageau",
  jaccobslavin: "Jaccob Slavin",
  tomwilson: "Tom Wilson",
  filipchytil: "Filip Chytil",
  colesillinger: "Cole Sillinger",
  kevinhayes: "Kevin Hayes",
  zachbenson: "Zach Benson",
  darnellnurse: "Darnell Nurse",
  joshnorris: "Josh Norris",
  anthonymantha: "Anthony Mantha",
  pierreengvall: "Pierre Engvall",
  jesperikotkaniemi: "Jesperi Kotkaniemi",
  alexnewhook: "Alex Newhook",
  ondrejpalat: "Ondrej Palat",
  alexanderwennberg: "Alexander Wennberg",
  camyork: "Cam York",
  nickbjugstad: "Nick Bjugstad",
  trentfrederic: "Trent Frederic",
  ilyamikheyev: "Ilya Mikheyev",
  anthonybeauvillier: "Anthony Beauvillier",
  jordanstaal: "Jordan Staal",
  eetuluostarinen: "Eetu Luostarinen",
  barretthayton: "Barrett Hayton",
  jamesvanriemsdyk: "James van Riemsdyk",
  marcusjohansson: "Marcus Johansson",
  vladislavnamestnikov: "Vladislav Namestnikov",
  mavrikbourque: "Mavrik Bourque",
  damonseverson: "Damon Severson",
  nealpionk: "Neal Pionk",
  nilshoglander: "Nils Hoglander",
  dantonheinen: "Danton Heinen",
  yegorchinakhov: "Yegor Chinakhov",
  jadenschwartz: "Jaden Schwartz",
  tomastatar: "Tomas Tatar",
  adamlowry: "Adam Lowry",
  maxpacioretty: "Max Pacioretty",
  kentjohnson: "Kent Johnson",
  coltonsissons: "Colton Sissons",
  rutgermcgroarty: "Rutger McGroarty",
  matthewpoitras: "Matthew Poitras",
  brandtclarke: "Brandt Clarke",
  kandremiller: "K'Andre Miller", // CSV "KAndre Miller" or "K'Andre Miller" -> DB "K'Andre Miller"
  hampuslindholm: "Hampus Lindholm",
  owenpower: "Owen Power",
  alexlaferriere: "Alex Laferriere",
  camatkinson: "Cam Atkinson",
  callejarnkrok: "Calle Jarnkrok",
  jonatanberggren: "Jonatan Berggren",
  michaelrasmussen: "Michael Rasmussen",
  alexiafallo: "Alex Iafallo",
  brendanbrisson: "Brendan Brisson",
  dmitryorlov: "Dmitry Orlov",
  erikgustafsson: "Erik Gustafsson",
  robbyfabbri: "Robby Fabbri",
  ridlygreig: "Ridly Greig",
  bobbybrink: "Bobby Brink",
  bradlynadeau: "Bradly Nadeau",
  hendrixlapierre: "Hendrix Lapierre",
  justinbrazeau: "Justin Brazeau",
  kaapokakko: "Kaapo Kakko",
  coreyperry: "Corey Perry",
  maximtsyplakov: "Maxim Tsyplakov", // Ensure this player is in DB
  connormcmichael: "Connor McMichael",
  piussuter: "Pius Suter",
  ryandonato: "Ryan Donato",
  larseller: "Lars Eller",
  codyglass: "Cody Glass",
  noahcates: "Noah Cates",
  juusoparssinen: "Juuso Parssinen",
  kasperikapanen: "Kasperi Kapanen",
  martinpospisil: "Martin Pospisil",
  jackdrury: "Jack Drury",
  mathieujoseph: "Mathieu Joseph",
  lukehughes: "Luke Hughes",
  jaredspurgeon: "Jared Spurgeon",
  ivanprovorov: "Ivan Provorov",
  bobbymcmann: "Bobby McMann",
  sonnymilano: "Sonny Milano",
  jasondickinson: "Jason Dickinson",
  nickfoligno: "Nick Foligno",
  ryanmcleod: "Ryan McLeod",
  jordanmartinook: "Jordan Martinook",
  conorsheary: "Conor Sheary",
  masonappleton: "Mason Appleton",
  evgeniidadonov: "Evgenii Dadonov", // Check spelling in DB: Evgenii vs Evgeny
  frederickgaudreau: "Frederick Gaudreau",
  kaidenguhle: "Kaiden Guhle",
  olenzellweger: "Olen Zellweger",
  coltonparayko: "Colton Parayko",
  oliverekmanlarsson: "Oliver Ekman-Larsson",
  jjmoser: "J.J. Moser", // CSV "J.J. Moser" -> DB "J.J. Moser"
  janismoser: "J.J. Moser", // CSV "Janis Moser" -> DB "J.J. Moser"
  marcuspettersson: "Marcus Pettersson",
  shanewright: "Shane Wright",
  tylerjohnson: "Tyler Johnson",
  arthurkaliyev: "Arthur Kaliyev",
  victorolofsson: "Victor Olofsson",
  philiptomasino: "Philip Tomasino",
  jakeevans: "Jake Evans",
  bowenbyram: "Bowen Byram",
  jacobtrouba: "Jacob Trouba",
  tysonbarrie: "Tyson Barrie",
  ryanmcdonagh: "Ryan McDonagh",
  scottperunovich: "Scott Perunovich",
  michaelamadio: "Michael Amadio",
  joshanderson: "Josh Anderson",
  alexanderholtz: "Alexander Holtz",
  willcuylle: "Will Cuylle",
  alexandretexier: "Alexandre Texier",
  mileswood: "Miles Wood",
  daniilmiromanov: "Daniil Miromanov",
  aliakseiprotas: "Aliaksei Protas",
  jakemccabe: "Jake McCabe",
  simonnemec: "Simon Nemec",
  darrenraddysh: "Darren Raddysh",
  dylandemelo: "Dylan DeMelo", // CSV "Dylan Demelo" -> DB "Dylan DeMelo"
  nickleddy: "Nick Leddy",
  marcusfoligno: "Marcus Foligno",
  brendangallagher: "Brendan Gallagher",
  loganoconnor: "Logan O'Connor",
  joshuaroy: "Joshua Roy",
  jackmcbain: "Jack McBain",
  teddyblueger: "Teddy Blueger",
  esalindell: "Esa Lindell",
  mattroy: "Matt Roy",
  samuelgirard: "Samuel Girard",
  juusovalimaki: "Juuso Valimaki",
  alexnylander: "Alex Nylander",
  paulcotter: "Paul Cotter",
  mackiesamoskevich: "Mackie Samoskevich",
  jakewalman: "Jake Walman",
  jordangreenway: "Jordan Greenway",
  lukasreichel: "Lukas Reichel",
  travisboyd: "Travis Boyd",
  masonlohrei: "Mason Lohrei",
  adamlarsson: "Adam Larsson",
  jonasbrodin: "Jonas Brodin",
  rasmussandin: "Rasmus Sandin",
  jeffpetry: "Jeff Petry",
  nickperbix: "Nick Perbix", // CSV: Nicklaus Perbix -> DB: Nick Perbix (assumption, verify)
  nicklausperbix: "Nick Perbix", // To map the CSV version
  tjbrodie: "TJ Brodie", // CSV "T.J. Brodie" -> DB "TJ Brodie"
  michaelcarcone: "Michael Carcone",
  nicdowd: "Nic Dowd",
  tyekartye: "Tye Kartye",
  tannerjeannot: "Tanner Jeannot",
  christiandvorak: "Christian Dvorak",
  ryanpoehling: "Ryan Poehling",
  davidkampf: "David Kampf",
  seanwalker: "Sean Walker",
  vladislavgavrikov: "Vladislav Gavrikov",
  briandumoulin: "Brian Dumoulin",
  codyceci: "Cody Ceci",
  ryansuter: "Ryan Suter",
  jordanspence: "Jordan Spence",
  johnmarino: "John Marino",
  tyemberson: "Ty Emberson",
  jacksonlacombe: "Jackson LaCombe",
  mattdumba: "Mathew Dumba",
  //   martinfehervary: "Martin Fehervary",
  martinfehervary: "Martin Fehérváry", // with accents?
  williamborgen: "William Borgen",
  evgenydadonov: "Evgenii Dadonov", // CSV: Evgeny Dadonov
  alextexier: "Alexandre Texier", // CSV: Alex Texier
  // alexandretexier is already in your map and correct
  alexcarrier: "Alexandre Carrier", // CSV: Alex Carrier
  alexandrecarrier: "Alexandre Carrier", // DB form
  // jjmoser is already in your map and correct
  alexromanov: "Alexander Romanov", // CSV: Alex Romanov
  alexanderromanov: "Alexander Romanov", // DB form
  willborgen: "Will Borgen", // DB form / CSV: Will Borgen
  zacharybolduc: "Zack Bolduc", // CSV: Zachary Bolduc
  zackbolduc: "Zack Bolduc", // DB form / CSV: Zack Bolduc
  jacobmiddleton: "Jake Middleton", // CSV: Jacob Middleton
  jakemiddleton: "Jake Middleton", // DB form / CSV: Jake Middleton
  mathewdumba: "Mathew Dumba", // DB form: Mathew Dumba
  matthewdumba: "Mathew Dumba", // CSV: Matthew Dumba (maps to DB's "Mathew")
  ollimaatta: "Olli Määttä", // CSV: Olli Maatta (handles accent)
  trevorvanriemsdyk: "Trevor van Riemsdyk", // Handles 'Van' vs 'van'
  "pierre-olivierjoseph": "P.O Joseph", // CSV: Pierre-Olivier Joseph (with hyphen)
  pierreolivierjoseph: "P.O Joseph", // CSV: PierreOlivier Joseph (no hyphen)
  pojoseph: "P.O Joseph", // CSV: P.O Joseph or P.O. Joseph
  // Player not found in 'players' table with fullName: 'MacKenzie Blackwood'
  mackenzieblackwood: "Mackenzie Blackwood", // CSV: MacKenzie Blackwood
  patrickmaroon: "Patrick Maroon", // CSV: Patrick Maroon
  patmaroon: "Patrick Maroon", // CSV: Pat Maroon
  christophertanev: "Chris Tanev", // CSV: Chris Tanev
  janihakanpaa: "Jani Hakanpää", // CSV: Jani Hakanpaa
  nickdesimone: "Nick DeSimone", // CSV: Nick DeSimone
  calvindehaan: "Calvin de Haan", // CSV: Calvin DeHaan
  vitekvanacek: "Vitek Vanecek", // CSV: Vitek Vanacek
  danielvladar: "Dan Vladar", // CSV: Daniel Vladar
  caseydesmith: "Casey DeSmith", // CSV: Casey DeSmith
  calvinpetersen: "Cal Petersen", // CSV: Calvin Petersen
  ivanfedetov: "Ivan Fedotov", // CSV: Ivan Fedetov
  samuelmontembeault: "Sam Montembeault", // CSV: Samuel Montembault
  mitchellmarner: "Mitch Marner", // CSV: Mitchell Marner
  tjoshie: "T.J. Oshie", // CSV: T.J. Oshie
  alexeitoropchenko: "Alexey Toropchenko", // CSV: Alexei Toropchenko
  connormackey: "Connor Mackey", // CSV: Connor Mackey
  emilmartinsenlilleberg: "Emil Lilleberg", // CSV: Emil Martinsen-Lilleberg
  "alexbarre-boulet": "Alex Barré-Boulet", // CSV: Alex Barre-Boulet
  jesseylonen: "Jesse Ylönen", // CSV: Jesse Ylonen
  joshmahura: "Joshua Mahura", // CSV: Josh Mahura
  joshbrown: "Joshua Brown", // CSV: Josh Brown
  jacoblucchini: "Jake Lucchini", // CSV: Jacob Lucchini
  zachsanford: "Zachary Sanford", // CSV: Zach Sanford
  "zachaston-reese": "Zachary Aston-Reese", // CSV: Zach Aston-Reese

  // Default entries for all DB names (Key: normalized(DB name), Value: DB name)
  // These ensure that if a CSV name, after normalization, perfectly matches a normalized DB name, it maps correctly.
  // This is a selection; you'd generate this for your entire DB list.
  ajgreer: "A.J. Greer"
  // aaronekblad: "Aaron Ekblad",
  // adamfantilli: "Adam Fantilli",
  // adamfox: "Adam Fox",
  // adamlarsson: "Adam Larsson",
  // adamlowry: "Adam Lowry",
  // adrianakempe: "Adrian Kempe", // check if db has adrianakempe or adriankempe
  // aleksanderbarkov: "Aleksander Barkov", // Already listed, good
  // alexdebrincat: "Alex DeBrincat", // Already listed
  // alexiafallo: "Alex Iafallo", // Already listed
  // alexkillorn: "Alex Killorn", // Already listed
  // alexlaferriere: "Alex Laferriere", // Already listed
  // alexnewhook: "Alex Newhook", // Already listed
  // alexnylander: "Alex Nylander", // Already listed
  // alexovechkin: "Alex Ovechkin", // Already listed
  // alexpietrangelo: "Alex Pietrangelo", // Already listed
  // alextuch: "Alex Tuch", // Already listed
  // alexanderkerfoot: "Alexander Kerfoot", // Already listed
  // alexanderwennberg: "Alexander Wennberg", // Already listed
  // alexandretexier: "Alexandre Texier", // Already listed
  // alexislafreniere: "Alexis Lafrenière", // Already listed
  // aliakseiprotas: "Aliaksei Protas", // Already listed
  // anderslee: "Anders Lee", // Already listed
  // andreburakovsky: "Andre Burakovsky", // Already listed
  // andreikuzmenko: "Andrei Kuzmenko", // Already listed
  // andreisvechnikov: "Andrei Svechnikov", // Already listed
  // andrewcopp: "Andrew Copp", // Already listed
  // andrewmangiapane: "Andrew Mangiapane", // Already listed
  // anthonydclair: "Anthony Duclair", // Check key: anthonydclair vs anthonyduclair
  // anthonyduclair: "Anthony Duclair",
  // anthonymantha: "Anthony Mantha", // Already listed
  // anthonycirelli: "Anthony Cirelli", // Already listed
  // anthonybeauvillier: "Anthony Beauvillier", // Already listed
  // antonlundell: "Anton Lundell", // Already listed
  // anzekopitar: "Anze Kopitar", // Already listed
  // artturilehkonen: "Artturi Lehkonen", // Already listed
  // austonmatthews: "Auston Matthews", // Already listed
  // barretthayton: "Barrett Hayton", // Already listed
  // blakecoleman: "Blake Coleman", // Already listed
  // bohorvat: "Bo Horvat", // Already listed
  // boonejenner: "Boone Jenner", // Already listed
  // bobbybrink: "Bobby Brink", // Already listed
  // bobbymcmann: "Bobby McMann", // Already listed
  // bowenbyram: "Bowen Byram", // Already listed
  // bradenpoint: "Brayden Point", // Already listed
  // bradenschenn: "Brayden Schenn", // Already listed
  // bradmarchand: "Brad Marchand", // Already listed
  // bradlynadeau: "Bradly Nadeau", // Already listed
  // brandonhagel: "Brandon Hagel", // Already listed
  // brandonmontour: "Brandon Montour", // Already listed
  // brandonsaad: "Brandon Saad", // Already listed
  // brandtclarke: "Brandt Clarke", // Already listed
  // brendanbrisson: "Brendan Brisson", // Already listed
  // brendangallagher: "Brendan Gallagher", // Already listed
  // brentburns: "Brent Burns", // Already listed
  // briandumoulin: "Brian Dumoulin", // Already listed
  // brockboeser: "Brock Boeser", // Already listed
  // brockfaber: "Brock Faber", // Already listed
  // brocknelson: "Brock Nelson", // Already listed
  // bryanrust: "Bryan Rust", // Already listed
  // calemakar: "Cale Makar", // Already listed
  // callejarnkrok: "Calle Jarnkrok", // Already listed
  // camatkinson: "Cam Atkinson", // Already listed
  // camfowler: "Cam Fowler", // Already listed
  // camyork: "Cam York", // Already listed
  // carterverhaeghe: "Carter Verhaeghe", // Already listed
  // caseymittelstadt: "Casey Mittelstadt", // Already listed
  // chandlerstephenson: "Chandler Stephenson", // Already listed
  // charliemcavoy: "Charlie McAvoy", // Already listed
  // charlescoyle: "Charlie Coyle", // key vs charliecoyle
  // chriskreider: "Chris Kreider", // Already listed
  // christanev: "Chris Tanev" // CSV: Chris Tanev -> DB: Chris Tanev
  // christiandvorak: "Christian Dvorak", // Already listed
  // claudegiroux: "Claude Giroux", // Already listed
  // claytonkeller: "Clayton Keller", // Already listed
  // codyceci: "Cody Ceci", // Already listed
  // codyglass: "Cody Glass", // Already listed
  // colecaufield: "Cole Caufield", // Already listed
  // coleperfetti: "Cole Perfetti", // Already listed
  // colesillinger: "Cole Sillinger", // Already listed
  // coltonparayko: "Colton Parayko", // Already listed
  // coltonsissons: "Colton Sissons", // Already listed
  // connorbedard: "Connor Bedard", // Already listed
  // connorgarland: "Conor Garland", // Already listed
  // connormcmichael: "Connor McMichael", // Already listed
  // connorzary: "Connor Zary", // Already listed
  // conorsheary: "Conor Sheary", // Already listed
  // coreyperry: "Corey Perry", // Already listed
  // cuttergauthier: "Cutter Gauthier", // Already listed
  // damonseverson: "Damon Severson", // Already listed
  // danielsprong: "Daniel Sprong", // Already listed
  // daniilmiromanov: "Daniil Miromanov", // Already listed
  // dantonheinen: "Danton Heinen", // Already listed
  // darnellnurse: "Darnell Nurse", // Already listed
  // darrenraddysh: "Darren Raddysh", // Already listed
  // davidperron: "David Perron", // Already listed
  // davidkampf: "David Kampf", // Already listed
  // dawsonmercer: "Dawson Mercer", // Already listed
  // devontoews: "Devon Toews", // Already listed
  // dmitryorlov: "Dmitry Orlov", // Already listed
  // dmitrivoronkov: "Dmitri Voronkov", // Already listed
  // dougiehamilton: "Dougie Hamilton", // Already listed
  // drakebatherson: "Drake Batherson", // Already listed
  // drewdoughty: "Drew Doughty", // Already listed
  // dylancozens: "Dylan Cozens", // Already listed
  // dylandemelo: "Dylan DeMelo", // Already listed
  // dylanguenther: "Dylan Guenther", // Already listed
  // dylanstrome: "Dylan Strome", // Already listed
  // eelitolvanen: "Eeli Tolvanen", // Already listed
  // eetuluostarinen: "Eetu Luostarinen", // Already listed
  // eliaslindholm: "Elias Lindholm", // Already listed
  // eliaspettersson: "Elias Pettersson", // Already listed
  // erikgustafsson: "Erik Gustafsson", // Already listed
  // erikhaula: "Erik Haula", // Already listed
  // erikkarlsson: "Erik Karlsson", // Already listed
  // esalindell: "Esa Lindell", // Already listed
  // evanbouchard: "Evan Bouchard", // Already listed
  // evanderkane: "Evander Kane", // Already listed
  // evanrodrigues: "Evan Rodrigues", // Already listed
  // evgeniidadonov: "Evgenii Dadonov", // Already listed
  // evgenimalkin: "Evgeni Malkin", // Already listed
  // fabianzetterlund: "Fabian Zetterlund", // Already listed
  // filipforsberg: "Filip Forsberg", // Already listed
  // filiphronek: "Filip Hronek", // Already listed
  // filipchytil: "Filip Chytil", // Already listed
  // frankvatrano: "Frank Vatrano", // Already listed
  // frederickgaudreau: "Frederick Gaudreau", // Already listed
  // gabriellandeskog: "Gabriel Landeskog", // Already listed
  // gabrielvilardi: "Gabriel Vilardi", // Already listed
  // gustavforsling: "Gustav Forsling", // Already listed
  // gustavnyquist: "Gustav Nyquist", // Already listed
  // hampuslindholm: "Hampus Lindholm", // Already listed
  // hendrixlapierre: "Hendrix Lapierre", // Already listed
  // ilyamikheyev: "Ilya Mikheyev", // Already listed
  // ivanbarbashev: "Ivan Barbashev", // Already listed
  // ivanprovorov: "Ivan Provorov", // Already listed
  // jtmiller: "J.T. Miller", // Already listed
  // jtcompher: "J.T. Compher", // Already listed
  // jjpeterka: "JJ Peterka", // Already listed
  // jaccobslavin: "Jaccob Slavin", // Already listed
  // jackdrury: "Jack Drury", // Already listed
  // jackeichel: "Jack Eichel", // Already listed
  // jackhughes: "Jack Hughes", // Already listed
  // jackquinn: "Jack Quinn", // Already listed
  // jackroslovic: "Jack Roslovic", // Already listed
  // jadenschwartz: "Jaden Schwartz", // Already listed
  // jakebrusk: "Jake DeBrusk", // Already listed
  // jakeguentzel: "Jake Guentzel", // Already listed
  // jakemccabe: "Jake McCabe", // Already listed
  // jakeneighbours: "Jake Neighbours", // Already listed
  // jakesanderson: "Jake Sanderson", // Already listed
  // jakewalman: "Jake Walman", // Already listed
  // jakobchychrun: "Jakob Chychrun", // Already listed
  // jamiebenn: "Jamie Benn", // Already listed
  // jaredmccann: "Jared McCann", // Already listed
  // jaredspurgeon: "Jared Spurgeon", // Already listed
  // jasonrobertson: "Jason Robertson", // Already listed
  // jasondickinson: "Jason Dickinson", // Already listed
  // jasonzucker: "Jason Zucker", // Already listed
  // jeangabrielpageau: "Jean-Gabriel Pageau", // Already listed
  // jeffskinner: "Jeff Skinner", // Already listed
  // jeffpetry: "Jeff Petry", // Already listed
  // jesperbratt: "Jesper Bratt", // Already listed
  // jesperikotkaniemi: "Jesperi Kotkaniemi", // Already listed
  // joelerikssonek: "Joel Eriksson Ek", // Already listed
  // joelfarabee: "Joel Farabee", // Already listed
  // johngaudreau: "Johnny Gaudreau", // CSV: Johnny Gaudreau -> DB: Johnny Gaudreau
  // johncarlson: "John Carlson", // Already listed
  // johnmarino: "John Marino", // Already listed
  // johntavares: "John Tavares", // Already listed
  // jonatanberggren: "Jonatan Berggren", // Already listed
  // jonathanmarchessault: "Jonathan Marchessault", // Already listed
  // jonathanhuberdeau: "Jonathan Huberdeau", // Already listed
  // jonathandrouin: "Jonathan Drouin", // Already listed
  // jordankyrou: "Jordan Kyrou", // Already listed
  // jordaneberle: "Jordan Eberle", // Already listed
  // jordangreenway: "Jordan Greenway", // Already listed
  // jordanmartinook: "Jordan Martinook", // Already listed
  // jordanspence: "Jordan Spence", // Already listed
  // jordanstaal: "Jordan Staal", // Already listed
  // joshdoan: "Josh Doan", // Already listed
  // joshmorrissey: "Josh Morrissey", // Already listed
  // joshnorris: "Josh Norris", // Already listed
  // joshanderson: "Josh Anderson", // Already listed
  // joshuaroy: "Joshua Roy", // Already listed
  // jurajslafkovsky: "Juraj Slafkovský", // Already listed
  // justinfaulk: "Justin Faulk", // Already listed
  // justinbrazeau: "Justin Brazeau", // Already listed
  // juusoparssinen: "Juuso Parssinen", // Already listed
  // juusovalimaki: "Juuso Valimaki", // Already listed
  // kaapokakko: "Kaapo Kakko", // Already listed
  // kaidenguhle: "Kaiden Guhle", // Already listed
  // kandremiller: "K'Andre Miller", // Already listed
  // kasperikapanen: "Kasperi Kapanen", // Already listed
  // kentjohnson: "Kent Johnson", // Already listed
  // kevinfiala: "Kevin Fiala", // Already listed
  // kevinhayes: "Kevin Hayes", // Already listed
  // kirbydach: "Kirby Dach", // Already listed
  // kirillkaprizov: "Kirill Kaprizov", // Already listed
  // kirillmarchenko: "Kirill Marchenko", // Already listed
  // krisletang: "Kris Letang", // Already listed
  // kyleconnor: "Kyle Connor", // Already listed
  // kylepalmieri: "Kyle Palmieri", // Already listed
  // lanehutson: "Lane Hutson", // Already listed
  // larseller: "Lars Eller", // Already listed
  // lawsoncrouse: "Lawson Crouse", // Already listed
  // leocarlsson: "Leo Carlsson", // Already listed
  // leondraisaitl: "Leon Draisaitl", // Already listed
  // logancooley: "Logan Cooley", // Already listed
  // loganoconnor: "Logan O'Connor", // Already listed
  // loganstankoven: "Logan Stankoven", // Already listed
  // louibelluz: "Luca Del Bel Belluz", // Check key
  // lucasraymond: "Lucas Raymond", // Already listed
  // lukasreichel: "Lukas Reichel", // Already listed
  // lukeevaangelista: "Luke Evangelista", // Already listed
  // lukehughes: "Luke Hughes", // Already listed
  // mackenzieweegar: "MacKenzie Weegar", // Already listed
  // mackiesamoskevich: "Mackie Samoskevich", // Already listed
  // macklincelebrini: "Macklin Celebrini", // Already listed
  // marcorossi: "Marco Rossi", // Already listed
  // marcusfoligno: "Marcus Foligno", // Already listed
  // marcusjohansson: "Marcus Johansson", // Already listed
  // marcuspettersson: "Marcus Pettersson", // Already listed
  // markscheifele: "Mark Scheifele", // Already listed
  // markstone: "Mark Stone", // Already listed
  // martinnecas: "Martin Necas", // Already listed
  // martinpospisil: "Martin Pospisil", // Already listed
  // masonappleton: "Mason Appleton", // Already listed
  // masonmarchment: "Mason Marchment", // Already listed
  // masonmctavish: "Mason McTavish", // Already listed
  // masonlohrei: "Mason Lohrei", // Already listed
  // mathieujoseph: "Mathieu Joseph", // Already listed
  // matiasmaccelli: "Matias Maccelli", // Already listed
  // mathewbarzal: "Mathew Barzal", // Already listed
  // matthewknies: "Matthew Knies", // Already listed
  // matthewpoitras: "Matthew Poitras", // Already listed
  // matthewtkachuk: "Matthew Tkachuk", // Already listed
  // mattboldy: "Matt Boldy", // Already listed
  // mattduchene: "Matt Duchene", // Already listed
  // mattiasekholm: "Mattias Ekholm", // Already listed
  // mattroy: "Matt Roy", // Already listed
  // matveimichkov: "Matvei Michkov", // Already listed
  // mavrikbourque: "Mavrik Bourque", // Already listed
  // maxdomi: "Max Domi", // Already listed
  // maxpacioretty: "Max Pacioretty", // Already listed
  // maximtsyplakov: "Maxim Tsyplakov", // Already listed
  // michaelamadio: "Michael Amadio", // Already listed
  // michaelbunting: "Michael Bunting", // Already listed
  // michaelcarcone: "Michael Carcone", // Already listed
  // michaelrasmussen: "Michael Rasmussen", // Already listed
  // mikaelbacklund: "Mikael Backlund", // Already listed
  // mikaelgranlund: "Mikael Granlund", // Already listed
  // mikazibanejad: "Mika Zibanejad", // Already listed
  // mikkoraattann: "Mikko Rantanen", // Already listed, verify Rantanen spelling
  // mileswood: "Miles Wood", // Already listed
  // miroheiskanen: "Miro Heiskanen", // Already listed
  // mitchmarner: "Mitch Marner", // Already listed
  // morganfrost: "Morgan Frost", // Already listed
  // morgangeekie: "Morgan Geekie", // Already listed
  // morganrielly: "Morgan Rielly", // Already listed
  // moritzseider: "Moritz Seider", // Already listed
  // nazemkadri: "Nazem Kadri", // Already listed
  // nealpionk: "Neal Pionk", // Already listed
  // nicholasroy: "Nicolas Roy", // check key vs nicolasroy
  // nicolasroy: "Nicolas Roy", // Already listed
  // nickbjugstad: "Nick Bjugstad", // Already listed
  // nickdowd: "Nic Dowd", // Already listed
  // nickfoligno: "Nick Foligno", // Already listed
  // nickleddy: "Nick Leddy", // Already listed
  // nickpaul: "Nick Paul", // Already listed
  // nickperbix: "Nick Perbix", // Already listed
  // nickschmaltz: "Nick Schmaltz", // Already listed
  // nicksuzuki: "Nick Suzuki", // Already listed
  // nicohischier: "Nico Hischier", // Already listed
  // nikolajehlers: "Nikolaj Ehlers", // Already listed
  // nikolaikovalenko: "Nikolai Kovalenko", // Already listed
  // nilshoglander: "Nils Hoglander", // Already listed
  // ninoniederreiter: "Nino Niederreiter", // Already listed
  // noahcates: "Noah Cates", // Already listed
  // noahdobson: "Noah Dobson", // Already listed
  // noahhanifin: "Noah Hanifin", // Already listed
  // olenzellweger: "Olen Zellweger", // Already listed
  // oliverbjorkstrand: "Oliver Bjorkstrand", // Already listed
  // oliverekmanlarsson: "Oliver Ekman-Larsson", // Already listed
  // ondrejpalat: "Ondrej Palat", // Already listed
  // owenpower: "Owen Power", // Already listed
  // owentippett: "Owen Tippett", // Already listed
  // patriklaine: "Patrik Laine", // Already listed
  // paulcotter: "Paul Cotter", // Already listed
  // pavelbuchnevich: "Pavel Buchnevich", // Already listed
  // paveldorofeyev: "Pavel Dorofeyev", // Already listed
  // pavelmintyukov: "Pavel Mintyukov", // Already listed
  // pavelzacha: "Pavel Zacha", // Already listed
  // philiptomasino: "Philip Tomasino", // Already listed
  // phillipdanault: "Phillip Danault", // Already listed
  // philippkurashev: "Philipp Kurashev", // Already listed
  // pierrelucdubois: "Pierre-Luc Dubois", // Already listed
  // pierreengvall: "Pierre Engvall", // Already listed
  // piussuter: "Pius Suter", // Already listed
  // quinnhughes: "Quinn Hughes", // Already listed
  // quintonbyfield: "Quinton Byfield", // Already listed
  // rasmusandersson: "Rasmus Andersson", // Already listed
  // rasmusdahlin: "Rasmus Dahlin", // Already listed
  // rasmussandin: "Rasmus Sandin", // Already listed
  // reillysmith: "Reilly Smith", // Already listed
  // rickardrakell: "Rickard Rakell", // Already listed
  // ridlygreig: "Ridly Greig", // Already listed
  // robbyfabbri: "Robby Fabbri", // Already listed
  // robertthomas: "Robert Thomas", // Already listed
  // romanjosi: "Roman Josi", // Already listed
  // roopehintz: "Roope Hintz", // Already listed
  // rosscolton: "Ross Colton", // Already listed
  // rutgermcgroarty: "Rutger McGroarty", // Already listed
  // ryandonato: "Ryan Donato", // Already listed
  // ryanhartman: "Ryan Hartman", // Already listed
  // ryanmcdonagh: "Ryan McDonagh", // Already listed
  // ryanmcleod: "Ryan McLeod", // Already listed
  // ryannugenthopkins: "Ryan Nugent-Hopkins", // Already listed
  // ryanoreilly: "Ryan O'Reilly", // Already listed
  // ryanpoehling: "Ryan Poehling", // Already listed
  // ryanstrome: "Ryan Strome", // Already listed
  // ryansuter: "Ryan Suter", // Already listed
  // sambennett: "Sam Bennett", // Already listed
  // samreinhart: "Sam Reinhart", // Already listed
  // samuelgirard: "Samuel Girard", // Already listed
  // scottlaughton: "Scott Laughton", // Already listed
  // scottperunovich: "Scott Perunovich", // Already listed
  // seanwalker: "Sean Walker", // Already listed
  // seancouturier: "Sean Couturier", // Already listed
  // seandurzi: "Sean Durzi", // Already listed
  // seanmonahan: "Sean Monahan", // Already listed
  // sebastianaho: "Sebastian Aho", // Already listed
  // sethjarvis: "Seth Jarvis", // Already listed
  // sethjones: "Seth Jones", // Already listed
  // shanepinto: "Shane Pinto", // Already listed
  // shanewright: "Shane Wright", // Already listed
  // shaynegostisbehere: "Shayne Gostisbehere", // Already listed
  // sheatheodore: "Shea Theodore", // Already listed
  // sidneycrosby: "Sidney Crosby", // Already listed
  // simonnemec: "Simon Nemec", // Already listed
  // sonnymilano: "Sonny Milano", // Already listed
  // stefannoesen: "Stefan Noesen", // Already listed
  // stevenstamkos: "Steven Stamkos", // Already listed
  // tagethompson: "Tage Thompson", // Already listed
  // tannerjeannot: "Tanner Jeannot", // Already listed
  // taylorhall: "Taylor Hall", // Already listed
  // teddyblueger: "Teddy Blueger", // Already listed
  // teuvoteravainen: "Teuvo Teravainen", // Already listed
  // thomaschabot: "Thomas Chabot", // Already listed
  // thomasharley: "Thomas Harley", // Already listed
  // timstutzle: "Tim Stützle", // Already listed
  // timomeier: "Timo Meier", // Already listed
  // tjbrodie: "TJ Brodie", // Already listed
  // tomwilson: "Tom Wilson", // Already listed
  // tomashertl: "Tomas Hertl", // Already listed
  // tomastatar: "Tomas Tatar", // Already listed
  // tommynovak: "Tommy Novak", // Already listed
  // travissanheim: "Travis Sanheim", // Already listed
  // traviskonecny: "Travis Konecny", // Already listed
  // trentfrederic: "Trent Frederic", // Already listed
  // trevormoore: "Trevor Moore", // Already listed
  // trevorzegras: "Trevor Zegras", // Already listed
  // troyterry: "Troy Terry", // Already listed
  // tyemberson: "Ty Emberson", // Already listed
  // tyekartye: "Tye Kartye", // Already listed
  // tylerbertuzzi: "Tyler Bertuzzi", // Already listed
  // tylerjohnson: "Tyler Johnson", // Already listed
  // tylerseguin: "Tyler Seguin", // Already listed
  // tylertoffoli: "Tyler Toffoli", // Already listed
  // tysonbarrie: "Tyson Barrie", // Already listed
  // tysonfoerster: "Tyson Foerster", // Already listed
  // valerinichushkin: "Valeri Nichushkin", // Already listed
  // vencedunn: "Vince Dunn", // Already listed
  // vincenttrocheck: "Vincent Trocheck", // Already listed
  // viktorarvidsson: "Viktor Arvidsson", // Already listed
  // vladimirltarasenko: "Vladimir Tarasenko", // Check key, probably vladimirtarasenko
  // vladimirtarasenko: "Vladimir Tarasenko",
  // vladislavgavrikov: "Vladislav Gavrikov", // Already listed
  // vladislavnamestnikov: "Vladislav Namestnikov", // Already listed
  // warrenfoegele: "Warren Foegele", // Already listed
  // willcuylle: "Will Cuylle", // Already listed
  // williameklund: "William Eklund", // Already listed
  // williamkarlsson: "William Karlsson", // Already listed
  // williamnylander: "William Nylander", // Already listed
  // willsmith: "Will Smith", // Already listed
  // wyattjohnston: "Wyatt Johnston", // Already listed
  // yannigourde: "Yanni Gourde", // Already listed
  // yegorchinakhov: "Yegor Chinakhov", // Already listed
  // yegorsharangovich: "Yegor Sharangovich", // Already listed
  // zachbenson: "Zach Benson", // Already listed
  // zachhyman: "Zach Hyman", // Already listed
  // zachwerenski: "Zach Werenski", // Already listed
};

/**
 * This map is a fallback to try and formalize common nicknames.
 * The result of this formalization is then typically re-checked against canonicalNameMap
 * or used if no explicit canonical mapping exists for the formalized version.
 */
export const commonNicknamesToFormal: Record<string, string> = {
  alex: "Alexander",
  al: "Alexander",
  will: "William",
  bill: "William",
  billy: "William",
  nick: "Nicholas",
  mike: "Michael",
  mikey: "Michael",
  mitch: "Mitchell",
  matt: "Matthew",
  matty: "Matthew",
  pat: "Patrick",
  paddy: "Patrick",
  chris: "Christopher",
  seb: "Sebastian",
  andy: "Andrew",
  drew: "Andrew",
  tom: "Thomas",
  tommy: "Thomas",
  zach: "Zachary",
  // "zac": "Zachary", // Be careful: "Zac Jones" is distinct
  jake: "Jacob",
  nate: "Nathan",
  tj: "T.J.", // For constructing T.J. if periods are desired
  jt: "J.T.",
  jj: "J.J."
};

/**
 * Normalizes a name string for use as a lookup key in canonicalNameMap.
 * Converts to lowercase, removes accents, specific suffixes, periods from initials, and apostrophes.
 */
function normalizeForLookup(name: string): string {
  if (!name || name.trim() === "") return "";
  let normalized = name.toLowerCase().trim();
  // Accent folding
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Remove common suffixes like (D), (C), (IR), (92), etc.
  normalized = normalized.replace(/\s*\([^)]*\)\s*$/, "").trim(); // Suffix with space before: "Name (D)"
  normalized = normalized.replace(/\([^)]*\)$/, "").trim(); // Suffix with no space: "Name(D)"
  // Remove apostrophes
  normalized = normalized.replace(/'/g, "");
  // Remove periods (and optionally spaces around them) from initials like T.J. -> tj / j.t. -> jt
  normalized = normalized.replace(/\.\s*/g, "").replace(/\./g, "");
  // Remove any remaining multiple spaces
  normalized = normalized.replace(/\s+/g, "");
  return normalized;
}

/**
 * Standardizes a player name from a CSV to match the canonical name in the database.
 * Priority:
 * 1. Direct match via canonicalNameMap using normalized CSV name.
 * 2. Try formalizing nickname, then re-check canonicalNameMap with formalized name.
 * 3. Fallback to a title-cased version of the cleaned original or formalized name.
 */
export function standardizePlayerName(name: string): string {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return "";
  }
  const originalTrimmedName = name.trim();
  const lookupKey = normalizeForLookup(originalTrimmedName);

  // --- BEGIN DEBUG LOGGING for specific names ---
  const debugNames = [
    "tim stutzle",
    "matthew beniers",
    "alexander ovechkin",
    "macklin celebrini",
    "fiip hronek"
  ]; // Add names you see failing
  const lowerOriginalName = originalTrimmedName.toLowerCase();

  if (debugNames.includes(lowerOriginalName)) {
    console.log(
      `[DEBUG standardizePlayerName] Input: '${originalTrimmedName}'`
    );
    console.log(`[DEBUG standardizePlayerName] Normalized Key: '${lookupKey}'`);
    const mapEntryExists = canonicalNameMap.hasOwnProperty(lookupKey);
    console.log(
      `[DEBUG standardizePlayerName] Key '${lookupKey}' in canonicalNameMap: ${mapEntryExists}`
    );
    if (mapEntryExists) {
      console.log(
        `[DEBUG standardizePlayerName] Direct map resolves to '${canonicalNameMap[lookupKey]}'`
      );
    }
  }
  // --- END DEBUG LOGGING ---

  if (canonicalNameMap[lookupKey]) {
    if (debugNames.includes(lowerOriginalName)) {
      console.log(
        `[DEBUG standardizePlayerName] Returning mapped canonical name '${canonicalNameMap[lookupKey]}'`
      );
    }
    return canonicalNameMap[lookupKey];
  }

  // 2. Try formalizing a nickname and then check canonicalNameMap again
  const words = originalTrimmedName
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .split(/\s+/);
  const firstName = words[0];
  const restOfName = words.slice(1).join(" ");
  const normalizedFirstNameLookup =
    firstName?.toLowerCase().replace(/\./g, "") || ""; // For commonNicknamesToFormal lookup

  if (commonNicknamesToFormal[normalizedFirstNameLookup]) {
    const formalFirstName = commonNicknamesToFormal[normalizedFirstNameLookup];
    const potentialFormalFullName = `${formalFirstName}${restOfName ? ` ${restOfName}` : ""}`;
    const potentialFormalLookupKey = normalizeForLookup(
      potentialFormalFullName
    );

    // Check if this formalized version has an explicit mapping to a DB canonical name
    if (canonicalNameMap[potentialFormalLookupKey]) {
      if (debugNames.includes(lowerOriginalName)) {
        console.log(
          `[DEBUG standardizePlayerName] Nickname formalization hit map -> '${canonicalNameMap[potentialFormalLookupKey]}'`
        );
      }
      return canonicalNameMap[potentialFormalLookupKey];
    }
    // If no explicit mapping, fall through to title-cased formal version as a last resort
    const formalTitle = titleCase(potentialFormalFullName);
    if (debugNames.includes(lowerOriginalName)) {
      console.log(
        `[DEBUG standardizePlayerName] Nickname formalization fallback -> '${formalTitle}'`
      );
    }
    return formalTitle;
  }

  // 3. Fallback: Title-case the original name (after cleaning suffixes).
  // This is used if no specific mapping or successful formalization-then-mapping occurred.
  const cleanedOriginal = originalTrimmedName
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .replace(/\([^)]*\)$/, "")
    .trim();
  const titleCasedFallback = titleCase(cleanedOriginal);
  if (debugNames.includes(lowerOriginalName)) {
    console.log(
      `[DEBUG standardizePlayerName] Final fallback -> '${titleCasedFallback}'`
    );
  }
  return titleCasedFallback;
}

// Basic Title Case Helper - Export this so other modules can use it.
export function titleCase(str: string): string {
  if (!str) return str as any;
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

console.log(
  "!!! nameStandardization.ts LOADED - VERSION 2025-05-07_1800_v1.1 !!!"
);
console.log(`!!! MAP HAS ${Object.keys(canonicalNameMap).length} ENTRIES !!!`); // Check if this number matches your expectation
