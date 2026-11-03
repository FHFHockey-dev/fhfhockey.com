import { NextSeo } from "next-seo";
import CurrentPlayerCardStudio from "components/player-cards/CurrentPlayerCardStudio";
/** Free standalone entry. No account, entitlement, database or data load is required to open it. */
export default function PlayerCardsPage() {
  return <><NextSeo title="Player cards | FHFH" noindex nofollow /><CurrentPlayerCardStudio /></>;
}
