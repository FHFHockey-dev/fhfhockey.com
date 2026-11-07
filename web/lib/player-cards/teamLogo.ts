import { teamsInfo } from "../teamsInfo";

// Existing local team assets inspected and pinned for the qualified card compositions.
const LOGOS: Record<string, { path: string; sha256: string; size: number }> = {
  TOR: { path: "/teamLogos/TOR.png", sha256: "b88d6edb92e4bcca291f7d3a37c1265fee39e1f5ef41650aaa19d8a39ad7e01d", size: 1023 },
  MIN: { path: "/teamLogos/MIN.png", sha256: "430c6a4073da40b9d2e147c2528dba317f019273390ef2bdd43363895c5e0fc2", size: 1280 },
  TBL: { path: "/teamLogos/TBL.png", sha256: "51a484101a24be2f33145a58d1c7855bfc5b408bec39a7195a29aec7aaa6332c", size: 1099 },
};
export type PreparedTeamLogo = { team: string; dataUrl: string; sha256: string; localPath: string };

export function isPreparedTeamLogo(logo: PreparedTeamLogo | undefined, team: string): logo is PreparedTeamLogo {
  const source = LOGOS[team];
  return !!source && !!teamsInfo[team] && !!logo && logo.team === team && logo.sha256 === source.sha256 && logo.localPath === source.path && logo.dataUrl.startsWith("data:image/png;base64,");
}

export async function prepareTeamLogo(team: string, signal?: AbortSignal): Promise<PreparedTeamLogo> {
  const source = LOGOS[team];
  if (!source || !teamsInfo[team]) throw new Error("A reviewed local team logo is unavailable.");
  const response = await fetch(source.path, { signal });
  if (!response.ok) throw new Error("Team logo unavailable. Please retry.");
  const bytes = await response.arrayBuffer();
  const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (sha256 !== source.sha256) throw new Error("Team logo changed since review. Export blocked.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Team logo could not be read.")); reader.readAsDataURL(new Blob([bytes], { type: "image/png" }));
  });
  const image = new Image(); image.src = dataUrl; await image.decode();
  if (signal?.aborted) throw new DOMException("Portrait rendering cancelled.", "AbortError");
  if (image.naturalWidth !== source.size || image.naturalHeight !== source.size) throw new Error("Team logo dimensions changed.");
  return { team, dataUrl, sha256, localPath: source.path };
}
