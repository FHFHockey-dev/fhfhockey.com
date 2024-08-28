// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\fetchWithCache.ts

import Fetch from "lib/cors-fetch"; // Importing the custom fetch module
// @ts-expect-error
import cacheData from "memory-cache"; // Importing the caching module

let num = 0; // Counter for logging purposes

// The main function to fetch data with cache support
export default async function fetchWithCache(url: string, json = true) {
  const value = cacheData.get(url); // Try to get data from cache
  if (value) {
    // If data is found in cache, return it
    return value;
  } else {
    // If data is not found in cache, fetch it from the network
    const hours = 24; // Cache duration
    // console.log(`num: ${num} - ${url}`); // Logging request number and URL
    num++;

    // Using the new Fetch structure
    const response = await Fetch(url)
      .then((res) => (json ? res.json() : res.text())) // Processing response according to the expected type (json or text)
      .catch((error) => {
        console.error(`Fetch error: ${error}`);
        throw error; // Rethrow the error after logging
      });

    cacheData.put(url, response, hours * 1000 * 60 * 60); // Store the fetched data in cache
    return response; // Return the fetched data
  }
}
