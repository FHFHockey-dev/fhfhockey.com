// Define a generic interface for the items in the array
interface Groupable<T> {
  [key: string]: T[];
}

// Define the groupBy function
export default function groupBy<T>(
  items: T[],
  keySelector: (item: T) => string
): Groupable<T> {
  const result: Groupable<T> = {};

  // Iterate over the items
  for (const item of items) {
    // Use the key selector function to get the grouping key
    const key = keySelector(item);

    // If the key doesn't exist in the result object, initialize it with an empty array
    if (!result[key]) {
      result[key] = [];
    }

    // Push the current item into the array for its group
    result[key].push(item);
  }

  return result;
}
