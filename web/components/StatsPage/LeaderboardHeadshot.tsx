import { useState } from "react";
import { buildPlayerHeadshotSources } from "lib/images";

type Props = {
  imageUrl?: string | null;
  playerId: number;
  playerName: string;
  className?: string;
};

function LeaderboardHeadshotRenderer({
  imageUrl,
  playerId,
  playerName,
  className,
}: Props) {
  const sources = buildPlayerHeadshotSources(imageUrl, playerId);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeSource = sources[sourceIndex];

  if (!activeSource) return null;

  return (
    // The official CMS fallback host is intentionally outside the Next image
    // allowlist, so this bounded raw image owns its complete fallback sequence.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={activeSource}
      src={activeSource}
      alt={playerName}
      width={168}
      height={168}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ cursor: "pointer" }}
      onError={() => {
        setSourceIndex((current) => current + 1);
      }}
    />
  );
}

export default function LeaderboardHeadshot(props: Props) {
  return (
    <LeaderboardHeadshotRenderer
      {...props}
      key={`${props.playerId}\u0000${props.imageUrl ?? ""}`}
    />
  );
}
