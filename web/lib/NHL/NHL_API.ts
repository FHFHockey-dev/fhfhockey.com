import fetchWithCache from "lib/fetchWithCache";

export const NHL_API_URL = "https://statsapi.web.nhl.com/api/v1";

export function fetchNHL(endpoint: string) {
  return fetchWithCache(`${NHL_API_URL}${endpoint}`);
}
