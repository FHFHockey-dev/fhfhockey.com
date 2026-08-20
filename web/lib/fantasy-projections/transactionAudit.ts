import { createHash } from "crypto";

export type OfficialNhlArticleCapture = {
  url: string;
  articleBody: string;
  datePublished: string | null;
  dateModified: string | null;
  sourceHash: string;
};

export type OfficialRosterAuditEvidence = {
  eventType: "trade" | "signing" | "membership";
  sourceUrl: string;
  sourceHash: string;
  excerpt: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function regexEscaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseOfficialNhlArticleCapture(
  html: string,
  url: string,
): OfficialNhlArticleCapture {
  const scripts = Array.from(
    html.matchAll(
      /<script\s+type="application\/ld(?:&#x2B;|\+)json">([\s\S]*?)<\/script>/gi,
    ),
  );
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const article = candidates.find(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          typeof candidate.articleBody === "string",
      );
      if (!article) continue;
      return {
        url,
        articleBody: normalizedText(article.articleBody),
        datePublished:
          typeof article.datePublished === "string" ? article.datePublished : null,
        dateModified:
          typeof article.dateModified === "string" ? article.dateModified : null,
        sourceHash: sha256(html),
      };
    } catch {
      // Keep looking; NHL pages can contain unrelated JSON-LD scripts.
    }
  }
  throw new Error(`Official NHL article metadata is unavailable for ${url}.`);
}

function playerContext(articleBody: string, playerName: string): string | null {
  const name = regexEscaped(normalizedText(playerName));
  const match = new RegExp(`.{0,280}\\b${name}\\b.{0,280}`, "i").exec(articleBody);
  return match ? normalizedText(match[0]) : null;
}

function tradeEntry(articleBody: string, playerName: string): string | null {
  const entries = articleBody.split(/(?=\*\*[A-Z]+ \d{1,2}:\*\*)/);
  const normalizedName = normalizedText(playerName).toLowerCase();
  return (
    entries.find((entry) => normalizedText(entry).toLowerCase().includes(normalizedName)) ??
    null
  );
}

function teamSection(articleBody: string, teamName: string): string | null {
  const sections = articleBody.split(
    /(?=##\s+[A-Z][A-Z .''’-]+(?=\s+#####))/,
  );
  const heading = new RegExp(`^##\\s+${regexEscaped(teamName)}\\s+#####`, "i");
  return sections.find((section) => heading.test(section)) ?? null;
}

export function findOfficialRosterAuditEvidence(args: {
  playerName: string;
  teamName: string;
  teamAbbreviation: string;
  captures: OfficialNhlArticleCapture[];
}): OfficialRosterAuditEvidence | null {
  const teamName = normalizedText(args.teamName);
  for (const capture of args.captures) {
    if (!/trade/i.test(capture.url)) continue;
    const entry = tradeEntry(capture.articleBody, args.playerName);
    if (
      entry &&
      new RegExp(`${regexEscaped(teamName)}\\s+acquire`, "i").test(entry)
    ) {
      return {
        eventType: "trade",
        sourceUrl: capture.url,
        sourceHash: sha256(normalizedText(entry)),
        excerpt: normalizedText(entry),
      };
    }
  }

  for (const capture of args.captures) {
    if (!/free-agency/i.test(capture.url)) continue;
    const context = playerContext(capture.articleBody, args.playerName);
    if (!context) continue;
    const signedForTeam = new RegExp(
      `signed(?: after trade)?:\\s*${regexEscaped(args.teamAbbreviation)}(?:[),.;\\s]|$)`,
      "i",
    ).test(context);
    if (signedForTeam) {
      return {
        eventType: "signing",
        sourceUrl: capture.url,
        sourceHash: sha256(context),
        excerpt: context,
      };
    }

    const section = teamSection(capture.articleBody, teamName);
    if (
      section &&
      new RegExp(`\\b${regexEscaped(normalizedText(args.playerName))}\\b`, "i").test(
        section,
      )
    ) {
      return {
        eventType: "membership",
        sourceUrl: capture.url,
        sourceHash: sha256(context),
        excerpt: context,
      };
    }
  }
  return null;
}
