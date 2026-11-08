# 2026-11-07 Claude: chrome tokens + Controls field contrast

## Scope
Fix fhfh-styles.md §14.2 drift items: (1) site chrome literals → `$chrome-*` tokens in `web/styles/vars.scss` (pixel-identical); (2) Controls input/select edges → `$border-control`. Update §7.9, §14.2 and brand-style-cheat-sheet.md (front matter + Known Gaps).

## Where
- octoberBranch, canonical checkout. Uncommitted (TJ approval needed before commit).
- Files: web/styles/vars.scss, Header/NavbarItems/Layout/UserMenu .module.scss, web/styles/Controls.module.scss, the two rule docs.
- Baseline/after compiled CSS in the session scratchpad (before/, after/).

## State
- Baseline compiled + pure check OK for all 5 modules (sass + next's postcss-modules-local-by-default pure).
- Done: 11 `$chrome-*` tokens in vars.scss (incl. `$chrome-bottom-nav-text` #d5dce1, missing from the old §7.9 table); literals swapped in 4 modules.
- Compiled after vs before: Header, NavbarItems, Layout byte-identical; UserMenu rules identical, only gains vars.scss's 4 loud breakpoint comments (stripped in prod minify). Controls adds one rule: `.scope.scope :where(select, input:not([type=checkbox]):not([type=range])) { border-color: #6b6f75 !important }`. Hover/primary/gold variants still win on specificity.
- Pure check after: all 5 OK. Docs: §7.9 table (token column), §9.14 prose, §14.2 rows Closed; cheat sheet front matter, chrome prose, Known Gaps.

## Next
TJ approval to commit (my files only: 6 SCSS, 2 rule docs, this diary). Optional follow-up: checkbox edge (also $border-secondary, 2.1:1).

## Gotchas
- UserMenu.module.scss had no `@use "styles/vars"`; adding one.
- UserMenu also has `#e7f5fb` and `#36434c`, not in the task's literal list; left as is.
- Buttons/summary and the checkbox keep `$border-secondary` (task: buttons unchanged unless TJ says).
