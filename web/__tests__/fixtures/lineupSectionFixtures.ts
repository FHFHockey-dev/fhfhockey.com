import type { RosterNameEntry } from "lib/sources/lineupSourceIngestion";

// Exact user-supplied text. IDs, memberships and skater full names below are
// synthetic controls, not claims about hosted source-time roster records.
export const seattleSectionText = `Joey Daccord is not on the ice. Otherwise, no surprises. #SeaKraken

McCann / Beniers / Samoskevich
McMann / Stephenson / Eberle
Kakko / Catton / Wright
Meyers / Gaudreau / Winterton

Dunn / Larsson
Evans / Montour
Ottavainen / Mahura

Douglas / Fleury are extras.`;

export const edmontonSectionText = `The
@EdmontonOilers
morning skate:

Podkolzin-McDavid-Draisaitl
Hallander-Dickinson-Kapanen
Formenton-Michaels-Joseph
Frederic-Samanski-Howard
Jones-Hyman

Ekholm-Bouchard
Shea-Murphy
Mukhamadullin-Emberson
Walman

Levi
Jarry`;

function fixtureRoster(teamId: number, forwards: string[], defense: string[], goalies: string[]): RosterNameEntry[] {
  return [
    ...forwards.map((lastName, index) => ({ playerId: 100 + index, fullName: `Fixture ${lastName}`, lastName, position: "F", teamId })),
    ...defense.map((lastName, index) => ({ playerId: 200 + index, fullName: `Fixture ${lastName}`, lastName, position: "D", teamId })),
    ...goalies.map((lastName, index) => ({ playerId: 300 + index, fullName: `Fixture ${lastName}`, lastName, position: "G", teamId })),
  ];
}

export const seattleSectionRoster: RosterNameEntry[] = [
  ...fixtureRoster(55, ["McCann", "Beniers", "Samoskevich", "McMann", "Stephenson", "Eberle", "Kakko", "Catton", "Wright", "Meyers", "Gaudreau", "Winterton"], ["Dunn", "Larsson", "Evans", "Montour", "Ottavainen", "Mahura"], []),
  { playerId: 1, fullName: "Joey Daccord", lastName: "Daccord", position: "G", teamId: 55 },
  { playerId: 2, fullName: "Fixture Douglas", lastName: "Douglas", position: "F", teamId: 55 },
  { playerId: 3, fullName: "Fixture Fleury", lastName: "Fleury", position: "D", teamId: 55 },
];
export const edmontonSectionRoster = fixtureRoster(22, ["Podkolzin", "McDavid", "Draisaitl", "Hallander", "Dickinson", "Kapanen", "Formenton", "Michaels", "Joseph", "Frederic", "Samanski", "Howard", "Jones", "Hyman"], ["Ekholm", "Bouchard", "Shea", "Murphy", "Mukhamadullin", "Emberson", "Walman"], ["Levi", "Jarry"]);
export const explicit11F7DText = `11F 7D\n${edmontonSectionText.replace("Frederic-Samanski-Howard\n", "")}`;
