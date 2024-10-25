// web/components/WiGO/types.ts

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: "L" | "R" | "G" | "D" | "C";
  birthDate: string;
  birthCity: string | null;
  birthCountry: string | null;
  heightInCentimeters: number;
  weightInKilograms: number;
}
