import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_SOUND_CUES_PREFERENCE, useDraftSoundCues } from "./useDraftSoundCues";

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "running";
  destination = {} as AudioDestinationNode;
  oscillators = 0;
  createOscillator() {
    this.oscillators += 1;
    return { type: "", frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), addEventListener: vi.fn(), start: vi.fn(), stop: vi.fn() } as unknown as OscillatorNode;
  }
  createGain() { return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode; }
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("useDraftSoundCues", () => {
  let audio: FakeAudioContext;

  beforeEach(() => {
    audio = new FakeAudioContext();
    vi.stubGlobal("AudioContext", vi.fn(() => audio));
  });

  it("is opt-in, persists the preference, and unlocks from the enabling gesture", () => {
    const { result } = renderHook(() => useDraftSoundCues({ currentPickNumber: 1, nextPickNumber: 2, isMyTurn: false, isNextUp: true }));
    expect(result.current.enabled).toBe(false);
    act(() => result.current.enable());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(DRAFT_SOUND_CUES_PREFERENCE)).toBe("true");
    expect(audio.resume).not.toHaveBeenCalled();
  });

  it("does not cue on initial load, then emits distinct cues once per actionable event", () => {
    const { result, rerender } = renderHook((state) => useDraftSoundCues(state), {
      initialProps: { currentPickNumber: 1, nextPickNumber: 4, isMyTurn: false, isNextUp: false },
    });
    act(() => result.current.enable());
    expect(audio.oscillators).toBe(0);
    rerender({ currentPickNumber: 2, nextPickNumber: 3, isMyTurn: false, isNextUp: true });
    expect(audio.oscillators).toBe(2);
    rerender({ currentPickNumber: 2, nextPickNumber: 4, isMyTurn: false, isNextUp: false });
    expect(audio.oscillators).toBe(2);
    rerender({ currentPickNumber: 3, nextPickNumber: 3, isMyTurn: true, isNextUp: false });
    expect(audio.oscillators).toBe(5);
  });

  it("ignores cues after opt-out and closes audio on unmount", () => {
    const { result, unmount, rerender } = renderHook((state) => useDraftSoundCues(state), {
      initialProps: { currentPickNumber: 1, nextPickNumber: 2, isMyTurn: false, isNextUp: true },
    });
    act(() => result.current.enable());
    act(() => result.current.toggleEnabled());
    rerender({ currentPickNumber: 2, nextPickNumber: 2, isMyTurn: true, isNextUp: false });
    expect(audio.oscillators).toBe(0);
    unmount();
    expect(audio.close).toHaveBeenCalledOnce();
  });

  it("hydrates an existing opt-in without replaying the initial state", () => {
    localStorage.setItem(DRAFT_SOUND_CUES_PREFERENCE, "true");
    const { result, rerender } = renderHook((state) => useDraftSoundCues(state), {
      initialProps: { currentPickNumber: 1, nextPickNumber: 2, isMyTurn: false, isNextUp: true },
    });
    expect(result.current.enabled).toBe(true);
    expect(audio.oscillators).toBe(0);
    act(() => result.current.unlock());
    rerender({ currentPickNumber: 2, nextPickNumber: 3, isMyTurn: false, isNextUp: true });
    expect(result.current.enabled).toBe(true);
    expect(audio.oscillators).toBe(2);
  });

  it("swallows a rejected resume during gesture unlock", () => {
    audio.state = "suspended";
    audio.resume = vi.fn(async () => { throw new Error("autoplay blocked"); });
    const { result } = renderHook(() => useDraftSoundCues({ currentPickNumber: 1, nextPickNumber: 8, isMyTurn: false, isNextUp: false }));
    expect(() => act(() => result.current.enable())).not.toThrow();
    expect(audio.resume).toHaveBeenCalledOnce();
    expect(audio.oscillators).toBe(0);
  });
});
