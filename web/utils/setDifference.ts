export function setDifference<T>(setA: Set<T>, setB: Set<T>) {
  // Create a new Set to store the result
  const difference = new Set<T>();

  // Iterate through setA
  for (const element of setA) {
    // If element is not in setB, add it to the difference
    if (!setB.has(element)) {
      difference.add(element);
    }
  }

  return difference;
}
