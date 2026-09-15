import type { DraftSoundCueState } from "hooks/useDraftSoundCues";
import { useDraftSoundCues } from "hooks/useDraftSoundCues";

interface DraftSoundCuesProps extends DraftSoundCueState {
  className?: string;
}

/** Opt-in control plus the side-effectful cue hook; render once per dashboard. */
export default function DraftSoundCues({ className, ...state }: DraftSoundCuesProps) {
  const cues = useDraftSoundCues(state);
  return (
    <button
      type="button"
      className={className}
      data-control-variant="primary"
      aria-pressed={cues.enabled}
      aria-label={cues.enabled ? "Turn off draft sounds" : "Turn on draft sounds"}
      title={cues.enabled ? "Draft sounds on" : "Enable draft sounds"}
      onClick={cues.toggleEnabled}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {cues.enabled ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="m16 10 4 4m0-4-4 4" />}
      </svg>
    </button>
  );
}
