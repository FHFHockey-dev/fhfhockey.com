// fetchWithCache.js
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\lib\fetchWithCache.js

import cacheData from "memory-cache";

let num = 0;
export default async function fetchWithCache(url, json = true) {
  const value = cacheData.get(url);
  if (value) {
    return value;
  } else {
    const hours = 24;
    console.log(`num: ${num} - ${url}`);
    num++;
    const res = await fetch(url);
    const data = json ? await res.json() : await res.text();

    cacheData.put(url, data, hours * 1000 * 60 * 60);
    return data;
  }
}
