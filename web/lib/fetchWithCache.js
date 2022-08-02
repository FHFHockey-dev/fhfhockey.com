import cacheData from "memory-cache";

export default async function fetchWithCache(url, json = true) {
    const value = cacheData.get(url);
    if (value) {
        return value;
    } else {
        const hours = 24;
        const res = await fetch(url);
        const data = json ? (await res.json()) : (await res.text());

        cacheData.put(url, data, hours * 1000 * 60 * 60);
        return data;
    }
}