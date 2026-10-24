import receipt from "/private/tmp/fhfh-c2-isolated/web/lib/sources/fixtures/homepageNewsReceipt.json";
import { getPublicNewsSourceAttribution, sanitizePublicNewsFeedItem } from "/private/tmp/fhfh-c2-isolated/web/lib/newsFeed";
for (const row of receipt.pageProps.recentInjuryNews.matches as any[]) {
  const item = sanitizePublicNewsFeedItem({ ...row, blurb: row.blurb_prefix, source_label: null, source_account: null, metadata: null, players: [], card_status: "published" });
  console.log(row.id.slice(0, 8), getPublicNewsSourceAttribution({ item }).url ? "link" : "no-link");
}
