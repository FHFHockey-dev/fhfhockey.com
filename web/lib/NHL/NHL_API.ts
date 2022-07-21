export const NHL_API_URL = "https://statsapi.web.nhl.com/api/v1/";

export function fetchNHL(endpoint: string) {
  return fetch(`${NHL_API_URL}${endpoint}`).then((res) => res.json());
}
