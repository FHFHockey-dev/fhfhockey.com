import { useCallback, useEffect, useRef, useState } from "react";

export const DRAFT_SOUND_CUES_PREFERENCE = "draftDashboard.soundCuesEnabled";

type CuePhase = "next-up" | "your-turn";

export interface DraftSoundCueState {
  /** The authoritative actionable pick currently on the clock. */
  currentPickNumber: number | null;
  /** The authoritative next actionable pick belonging to the user. */
  nextPickNumber: number | null;
  /** The authoritative current-turn ownership result. */
  isMyTurn: boolean;
  /** Computed by the draft workflow, including skipped, keeper, and traded slots. */
  isNextUp: boolean;
  draftComplete?: boolean;
}

export interface DraftSoundCues {
  enabled: boolean;
  toggleEnabled: () => void;
  enable: () => void;
  unlock: () => void;
}

type AudioContextConstructor = new () => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
}

function playCue(context: AudioContext, phase: CuePhase) {
  const now = context.currentTime;
  const notes = phase === "your-turn"
    ? [523.25, 659.25, 783.99]
    : [392, 523.25];
  const duration = phase === "your-turn" ? 0.44 : 0.3;

  notes.forEach((frequency, index) => {
    const start = now + index * 0.1;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}

function readPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DRAFT_SOUND_CUES_PREFERENCE) === "true";
  } catch {
    return false;
  }
}

export function useDraftSoundCues(state: DraftSoundCueState): DraftSoundCues {
  const [enabled, setEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);
  const previousPhaseRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const unlock = useCallback(() => {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return;
    try {
      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") {
        void context.resume().then(() => {
          unlockedRef.current = context.state === "running";
        }).catch(() => {
          unlockedRef.current = false;
        });
      } else {
        unlockedRef.current = context.state === "running";
      }
    } catch {
      // Audio is an enhancement; a missing or blocked context must not affect drafting.
    }
  }, []);

  const enable = useCallback(() => {
    setEnabled(true);
    try { window.localStorage.setItem(DRAFT_SOUND_CUES_PREFERENCE, "true"); } catch { /* Storage may be unavailable. */ }
    unlock();
  }, [unlock]);

  useEffect(() => {
    setEnabled(readPreference());
  }, []);

  const toggleEnabled = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      try { window.localStorage.setItem(DRAFT_SOUND_CUES_PREFERENCE, "false"); } catch { /* Storage may be unavailable. */ }
      return;
    }
    enable();
  }, [enable, enabled]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const handleGesture = () => unlock();
    document.addEventListener("pointerdown", handleGesture, { once: true, passive: true });
    document.addEventListener("keydown", handleGesture, { once: true });
    return () => {
      document.removeEventListener("pointerdown", handleGesture);
      document.removeEventListener("keydown", handleGesture);
    };
  }, [enabled, unlock]);

  useEffect(() => {
    const phase: CuePhase | null = state.draftComplete
      ? null
      : state.isMyTurn
        ? "your-turn"
        : state.isNextUp
          ? "next-up"
          : null;
    const eventKey = phase && state.currentPickNumber != null
      ? `${phase}:${state.currentPickNumber}`
      : null;
    if (!mountedRef.current) {
      mountedRef.current = true;
      previousPhaseRef.current = eventKey;
      return;
    }
    if (!enabled) {
      if (eventKey) previousPhaseRef.current = eventKey;
      return;
    }
    if (!eventKey || eventKey === previousPhaseRef.current) return;
    previousPhaseRef.current = eventKey;
    if (!unlockedRef.current || !audioContextRef.current || audioContextRef.current.state !== "running") return;
    try {
      if (phase) playCue(audioContextRef.current, phase);
    } catch {
      // Ignore browser audio failures and leave the draft usable.
    }
  }, [enabled, state.currentPickNumber, state.draftComplete, state.isMyTurn, state.isNextUp]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  return { enabled, toggleEnabled, enable, unlock };
}
