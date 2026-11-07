# Tweet trainer style backlog

Medium/Low findings from /superstyle on /db/tweet-pattern-review?mode=trainer (2026-11-06).

| page | element (file) | finding and suggested fix | Medium/Low/Done | pass |
|---|---|---|---|---|
| trainer 390 | line rows (TweetSwipeTrainer.module.scss `.slotRow` mobile) | ~~At 390 the L1/D1 label sits on its own row, so a 3-player line takes 3 rows. Keep a 32px label column on phones so lines take 2 rows.~~ | Done (Medium) | 1 |
| trainer 390 | verdict buttons (TweetSwipeTrainer.tsx `.actionBar`) | ~~On a long card the Wrong/Skip/Correct buttons scroll off the top, and drags that start on a chip (now a button) don't swipe. Repeat a compact verdict row under the card, or let drags start on chips with a 10px click threshold.~~ | Done (Medium) | 1 |
| trainer | font sizes (TweetSwipeTrainer.module.scss) | ~~13px ×10, 15px ×3, 11px ×2 have no $font-size token. Snap to the scale (13→14 sm, 15→16 base, 11→12 xs) in one visible pass, or add a documented $font-size-13 if the site uses 13px widely.~~ | Done (Low) | 2 |
| trainer 390 | chips, type segments (TweetSwipeTrainer.module.scss) | ~~Touch targets are 32px (chips, segments) and 36px (buttons): AA-compliant, but under the 44px AAA / platform guidance for a swipe-first phone tool. Raise to 40-44px on coarse pointers.~~ | Done (Low) | 3 |
| trainer | verdict feedback (TweetSwipeTrainer.tsx) | ~~A "correct" swipe advances silently for screen readers; announce "Saved as correct. Card N of M." via the role=status line.~~ | Done (Low) | 3 |
