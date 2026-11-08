import { useEffect, useState } from "react";
import type { HeroSample, PreparedHero } from "./HeroPlayerCard";
import { prepareHero } from "../../lib/player-cards/shareExport";
import { prepareOutlinedPortrait, portraitKey, isPortraitStyle, type PortraitStyle } from "../../lib/player-cards/portraitTreatment";
import { outlineInks, type OutlineInk } from "../../lib/player-cards/alphaOutline";
import { defaultOutlineStack, outlineStackKey, OUTLINE_LIMITS, readOutlineDraft, type OutlineDraftRing, type OutlineRing } from "../../lib/player-cards/outlineStack";
const draftFrom = (rings: OutlineRing[]): OutlineDraftRing[] => rings.map((ring, index) => ({ id: `preset-${index}`, color: ring.color, width: String(ring.width), colorMode: "preset" }));
const STYLE_STORAGE = "fhfh-player-card-portrait-v1";

/** One bounded artwork pipeline for illustrative and observed-data editors. */
export function usePlayerArtwork(sample: HeroSample | undefined, loadArtwork = prepareHero, treatArtwork = prepareOutlinedPortrait, initialOutlineInk: OutlineInk = "white") {
  const [hero, setHero] = useState<PreparedHero | null>(null), [styledHero, setStyledHero] = useState<PreparedHero | null>(null), [treating, setTreating] = useState(false);
  const [portraitStyle, setStyle] = useState<PortraitStyle>("team-colors"), [outlineInk, setOutlineInk] = useState<OutlineInk>(initialOutlineInk);
  const [outlineDraft, setOutlineDraft] = useState<OutlineDraftRing[]>(() => draftFrom(defaultOutlineStack(sample?.team || "")));
  const [appliedRings, setAppliedRings] = useState<OutlineRing[]>(() => defaultOutlineStack(sample?.team || ""));
  const [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => { const rings = defaultOutlineStack(sample?.team || ""); setOutlineDraft(draftFrom(rings)); setAppliedRings(rings); }, [sample?.id, sample?.team]);
  const inks = outlineInks(sample?.team || ""), selectedInk = inks.find(option => option.id === outlineInk) || inks[0], ink = selectedInk.id;
  const parsed = readOutlineDraft(outlineDraft), draftKey = parsed.rings ? outlineStackKey(parsed.rings) : null, appliedKey = outlineStackKey(appliedRings);
  const customPending = ink === "custom" && draftKey !== appliedKey;
  useEffect(() => {
    if (ink !== "custom" || draftKey === null || draftKey === appliedKey) return;
    const timer = setTimeout(() => setAppliedRings(JSON.parse(draftKey) as OutlineRing[]), OUTLINE_LIMITS.debounceMs);
    return () => clearTimeout(timer);
  }, [ink, draftKey, appliedKey]);
  useEffect(() => {
    try { const saved = localStorage.getItem(STYLE_STORAGE); if (isPortraitStyle(saved)) setPortraitStyle(saved); } catch { /* Session selection works without storage. */ }
  }, []);
  useEffect(() => {
    let active = true; setHero(null); setError("");
    if (!sample) return;
    loadArtwork(sample).then(value => { if (active) setHero(value); }, reason => { if (active) setError(reason instanceof Error ? reason.message : "Artwork unavailable."); });
    return () => { active = false; };
  }, [sample, retry, loadArtwork]);
  useEffect(() => {
    const controller = new AbortController(); setStyledHero(null);
    if (!hero || hero.id !== sample?.id) { setTreating(false); return; }
    setTreating(true); setError("");
    treatArtwork(hero, portraitStyle, controller.signal, ink, ink === "custom" ? appliedRings : undefined).then(value => {
      if (!controller.signal.aborted) { setStyledHero(value); setTreating(false); }
    }, reason => {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Portrait unavailable."); setTreating(false); }
    });
    return () => controller.abort();
  }, [hero, sample, portraitStyle, treatArtwork, ink, appliedRings]);
  const readyHero = styledHero?.id === sample?.id && styledHero?.team === sample?.team && styledHero?.treatment?.style === portraitStyle && (!styledHero.outline || styledHero.outline.ink === ink) && (ink !== "custom" || outlineStackKey(styledHero.outlineSettings || []) === appliedKey) ? styledHero : null;
  function setPortraitStyle(value: PortraitStyle) { setStyle(value); try { localStorage.setItem(STYLE_STORAGE, value); } catch { /* Session selection works without storage. */ } }
  return { readyHero, portraitStyle, setPortraitStyle, outlineDraft, setOutlineDraft, appliedRings, ink, inks, selectedInk, setOutlineInk, customPending, treating, error,
    resetOutline: () => setOutlineDraft(draftFrom(defaultOutlineStack(sample?.team || ""))), retryArtwork: () => setRetry(n => n + 1),
    versionKey: `${sample?.id || "none"}:${sample?.team || ""}:${portraitStyle}:${ink}:${draftKey}:${readyHero ? portraitKey(readyHero) : "pending"}`,
  };
}
export type PlayerArtworkController = ReturnType<typeof usePlayerArtwork>;
