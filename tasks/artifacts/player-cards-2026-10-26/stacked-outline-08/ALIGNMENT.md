# Three non-overlapping contour bands

Inside→outside: Minnesota primary green #154734 for0–5px, jersey red #A6192E for5–10px, secondary tan #DDCBA4 for10–15px. Actual teamsInfo.ts fields, no invented fallback. Stacked is offered only where primary/jersey/secondary are valid and distinct. Existing white/single options remain.

One Euclidean distance field computes D5,D10,D15 coverage. The single RGBA asset contains D5, D10−D5, D15−D10. Their sum equals D15. Fractional AA coverage partitions pixels between neighboring colors; no opaque image hides another band. Original>=50%alpha interior excluded; originalRGBA unchanged. Wide holes remain open; narrow gaps may close under15px dilation.

Player frame600/4/600/337.5 is fixed. At2×,31raster-pixel padding produces1262×737; displayed band frame584.5/−11.5/631/368.5 places the source content exactly on the old player frame. Same1200×338headerclip and right-edge logo/fade. Natural frame clipping trims portions outside top/right/bottom; actual nonzero outside-mask counts are in PARITY-AND-CLIPPING.json. No movement to make room. Padding prevents mask-asset clipping. One band image sits above logo and below player.

Native SVG/canvas control has five exported pixels per color,15total, with transparent exterior/interior. Manifest/export key binds individual5px width,total15,order,padding/geometry and assethash. Max2MP/cache2 unchanged; no per-pixel temporary arrays. All analytics pixels equal07. Fresh unchanged07white control and current08white are RGB-identical. A difference from a historical saved07PNG also appears when rerendering unchanged07; its cause is not established, and original evidence is preserved.
