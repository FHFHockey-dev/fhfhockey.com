# Narrow Player Pickup token contradiction check

Observed at 2026-10-24T17:30:07.417761+00:00. Read only: original cited nested path is absent; the PRD Relevant Files path below exists. No application edit/test/Git/hosted action.

Original citation: web/components/GameGrid/PlayerPickupTable/PlayerPickupTable.module.scss (absent).
Actual source: web/components/PlayerPickupTable/PlayerPickupTable.module.scss
Full-file SHA-256 (metadata integrity only): 7fb516b109574d7a1dcee9cacaa4da0b2cb9ac346f5049958549b7988627881f
Reviewed range:1744–1766 only; all other source content unreviewed.

```scss
1744: }
1745: 
1746: .yahooContext {
1747:   padding: 12px 16px;
1748:   border-bottom: 1px solid rgba(255, 255, 255, 0.16);
1749:   font-size: 0.85rem;
1750: 
1751:   p { margin: 0 0 8px; }
1752:   a { color: #77cfff; margin-right: 12px; }
1753:   button {
1754:     margin: 0 8px 8px 0;
1755:     padding: 6px 10px;
1756:     border: 1px solid rgba(255, 255, 255, 0.25);
1757:     border-radius: 4px;
1758:     background: #20252d;
1759:     color: inherit;
1760:     cursor: pointer;
1761:     &[aria-pressed="true"] { border-color: #77cfff; background: #10384e; }
1762:     &:disabled { opacity: 0.5; cursor: wait; }
1763:     &:focus-visible { outline: 2px solid #77cfff; outline-offset: 2px; }
1764:   }
1765:   summary { cursor: pointer; }
1766: }
```
