export const formatHeight = (centimeters: number | null | undefined): string => {
  if (centimeters == null || !Number.isFinite(centimeters) || centimeters <= 0) return "—";
  const inches = Math.round(centimeters / 2.54);
  return `${Math.floor(inches / 12)}' ${inches % 12}\"`;
};

export const formatWeight = (kilograms: number | null | undefined): string =>
  kilograms != null && Number.isFinite(kilograms) && kilograms > 0
    ? `${Math.round(kilograms * 2.20462)} lbs`
    : "—";

// Age advances at midnight UTC; a February 29 birthday advances March 1 in
// non-leap years. Reject dates that JavaScript would normalize (e.g. Feb 30).
export const getAge = (birthDate: string | null | undefined, today = new Date()): number | "—" => {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return "—";
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(today.getTime()) ||
      birth.toISOString().slice(0, 10) !== birthDate || birth > today) return "—";
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() ||
      (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};

export const formatPosition = (position: string | null | undefined): string =>
  position && ["C", "L", "R", "LW", "RW", "D", "G"].includes(position) ? position : "—";
