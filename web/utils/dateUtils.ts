/**
 * Returns an array of dates representing the start of each week (Monday)
 * between a given start and end date (inclusive of the week the end date falls in).
 *
 * @param seasonStartDate - The start date of the season (YYYY-MM-DD string or Date object).
 * @param seasonEndDate - The end date of the season (YYYY-MM-DD string or Date object).
 * @returns An array of Date objects, each representing the Monday of a week.
 */
export const getWeekStartDates = (
  seasonStartDate: string | Date,
  seasonEndDate: string | Date
): Date[] => {
  const weekStarts: Date[] = [];
  let currentDate = new Date(seasonStartDate);
  const endDate = new Date(seasonEndDate);

  // Adjust currentDate to the first Monday on or after seasonStartDate
  const dayOfWeek = currentDate.getDay(); // Sunday is 0, Monday is 1, ..., Saturday is 6
  if (dayOfWeek !== 1) {
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // if Sunday, go back 6 days to get to Monday, else go forward
    currentDate.setDate(currentDate.getDate() + diff);
  }
  // If the first Monday is before the season actually started due to adjustment, advance to next Monday
  if (currentDate < new Date(seasonStartDate)) {
    currentDate.setDate(currentDate.getDate() + 7);
  }

  while (currentDate <= endDate) {
    weekStarts.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weekStarts;
};
