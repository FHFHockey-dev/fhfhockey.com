// fetchWithCache.js
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\lib\fetchWithCache.js

import Fetch from "lib/cors-fetch";
import cacheData from "memory-cache";

let num = 0; // Counter for logging purposes

// The main function to fetch data with cache support
export default async function fetchWithCache(url, json = true) {
  const value = cacheData.get(url);
  if (value) {
    return value;
  } else {
    const hours = 24; // Cache duration
    console.log(`num: ${num} - ${url}`);
    num++;

    // Using the new Fetch structure
    const response = await Fetch(url)
      .then((res) => (json ? res.json() : res.text()))
      .catch((error) => {
        console.error(`Fetch error: ${error}`);
        throw error;
      });

    cacheData.put(url, response, hours * 1000 * 60 * 60); // Store the fetched data in cache
    return response;
  }
}
