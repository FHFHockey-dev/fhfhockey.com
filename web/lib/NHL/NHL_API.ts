import fetchWithCache from "lib/fetchWithCache";

export const NHL_API_URL = "https://statsapi.web.nhl.com/api/v1";

export function fetchNHL<T = any>(endpoint: string): Promise<T> {
  return fetchWithCache(`${NHL_API_URL}${endpoint}`);
}
