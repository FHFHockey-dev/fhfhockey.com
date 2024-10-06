const BASE_URL_ONE = "https://api-web.nhle.com/v1";
const BASE_URL_TWO = "https://api.nhle.com/stats/rest/en";

/**
 * `BASE_URL` https://api-web.nhle.com/v1
 * @param path
 * @returns
 */
export function get<T = any>(path: string, debug: boolean = false): Promise<T> {
  const url = `${BASE_URL_ONE}${path}`;
  if (debug) {
    console.log({ url });
  }
  return fetch(url)
    .then((res) => res.json())
    .catch((e) => {
      throw new Error("Failed to fetch " + url + "\n" + e.message);
    });
}

/**
 * `BASE_URL` https://api.nhle.com/stats/rest/en
 * @param path
 * @returns
 */
export function restGet<T = any>(
  path: string
): Promise<{ data: T[]; total: number }> {
  return fetch(`${BASE_URL_TWO}${path}`).then((res) => res.json());
}
