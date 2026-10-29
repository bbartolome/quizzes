# Spec: Design system

Handoff spec for one design system shared by every quiz. It replaces the hand-written Tailwind classes in each feature with semantic tokens, a type scale, a page shell and a small set of shared UI components. It adds a dark theme and migrates every page onto the system.

The decisions here were drafted from a look-and-feel audit of every feature (2026-10-24), not from a wayfinder map. Three were set before drafting: per-quiz accents are dropped, dark mode is in scope, and the decisions are proposed in this spec for review. Vocabulary follows `GLOSSARY.md` (Target, Lure, Confidence, Skill score, Calibration curve, Deck).

Implementation follows the repo's TDD style: a `test: … (red)` commit, then the implementation commit.

## 1. Why

There is no shared design layer today. `src/styles.css` contains only `@import 'tailwindcss'`, `src/app/core` has no presentational code, and no template has a `dark:` variant. Each feature picked its own conventions, and they have drifted apart:

| Concern         | What the audit found                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral palette | `slate` (109 uses: stats, report, round, flash cards, glossary) vs `gray` (83 uses: library, quiz home, calibration)                                                                                                         |
| Accent          | `indigo` (48), `blue` (28), `sky` (5), plus a per-quiz hex `accent` applied inline on library cards and some primary buttons                                                                                                 |
| Focus ring      | `indigo-500`, `blue-600`, `sky-500` or `red-500`, with `ring-offset-2` or `ring-offset-1`. Flash card buttons have none.                                                                                                     |
| Page shell      | `min-h-screen bg-gray-50` (library, quiz home, calibration) vs no page background (stats, report, round, flash cards) vs a full-width header bar (glossary). Widths `max-w-2xl`, `4xl` and `5xl`.                            |
| Page title      | `text-3xl font-semibold` (library, quiz home, calibration), `text-3xl font-bold` (round, stats, report), `text-2xl font-bold` (flash card home), `text-xl` (glossary). Flash card round and report pages have no `h1`.       |
| Buttons         | The same primary button spelled at least four ways (`px-4 py-2` / `px-5 py-2.5`, `rounded-md` / `rounded-lg`, with or without shadow and focus ring). **End quiz** is filled in Reasoning Traps and outlined in flash cards. |
| Cards           | `rounded-lg border p-4`, `rounded-lg border p-5 shadow-sm`, `rounded-xl p-6`, `rounded-2xl ring-1 ring-black/5`, and raw `:host` CSS in `confidence-card.ts`                                                                 |
| Answer feedback | Flash cards label options in `emerald` / `rose`. Reasoning Traps shows the same statuses in plain `slate-500`. Calibration marks an answered (not graded) item `green-500`.                                                  |
| Charts          | `calibration-chart.html` hardcodes ten hex colors next to Tailwind `fill-*` classes. `calibration-sparkline.ts` uses `stroke="gray"`. Font sizes 9–11 are SVG attributes, plus `text-[9px]` and `text-[10px]` in templates.  |
| Sticky footer   | Flash cards: inside the page width, with negative margins, `bg-white/95`. Reasoning Traps: outside the page width, full-bleed, `bg-white/90`. Score reads "N of M correct" in one and "N / M correct" in the other.          |

## 2. Scope

In scope: design tokens, the light and dark themes, the type scale, the page shell, the shared UI components, answer-feedback semantics, chart colors, focus and target-size rules, removing per-quiz accents, a guard test, and migrating every page in `src/app/app.routes.ts`.

Out of scope:

- New pages, new features, or changes to quiz logic.
- Copy changes, except the back-link wording (§6.3) and the Reasoning Traps score line (§7.4).
- A manual theme toggle. The theme follows the system setting (§4).
- Quiz icons. The `icon` paths in `public/data/quizzes.json` (such as `icons/biases.svg`) do not exist in `public/icons`, and no template renders them. Drawing and showing them is a follow-up.
- An animation or motion system beyond the existing `transition` on hover states.
- A component library build, Storybook, or a third-party UI kit.

## 3. Tokens

### 3.1 Mechanism

Tokens are CSS custom properties in `src/styles.css`, exposed to Tailwind v4 through `@theme inline` so each one becomes a utility (`bg-surface`, `text-muted`, `border-default`, `ring-focus`, `fill-danger`, and so on). Because `@theme inline` emits `var(--…)` into each utility, switching the variables switches the theme at runtime with no `dark:` variants.

```css
@import 'tailwindcss';

@theme inline {
  --color-surface: var(--surface);
  --color-raised: var(--surface-raised);
  /* … one line per token in §3.2 … */
}

:root {
  color-scheme: light dark;
  --surface: var(--color-slate-50);
  --surface-raised: var(--color-white);
  /* … light values … */
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: var(--color-slate-950);
    --surface-raised: var(--color-slate-900);
    /* … dark values … */
  }
}
```

The default Tailwind palette stays loaded because the token values reference it. The guard test (§10), not the build, keeps raw palette classes out of templates.

### 3.2 Token set

Neutral scale: **slate** (the majority today). Accent: **indigo** (the majority today). There is no separate `info` hue: tips and info callouts use the accent's subtle tones.

| Token              | Utility stem     | Role                                                      | Light         | Dark          |
| ------------------ | ---------------- | --------------------------------------------------------- | ------------- | ------------- |
| `--surface`        | `surface`        | Page background                                           | `slate-50`    | `slate-950`   |
| `--surface-raised` | `raised`         | Cards, sticky footer, inputs                              | `white`       | `slate-900`   |
| `--surface-sunken` | `sunken`         | Prompt box, feedback panel, progress track                | `slate-100`   | `slate-800`   |
| `--border`         | `default`        | Card and divider borders                                  | `slate-200`   | `slate-700`   |
| `--border-strong`  | `strong`         | Input borders, secondary button border, chart guide lines | `slate-500`   | `slate-500`   |
| `--text`           | `text`           | Headings and body text                                    | `slate-900`   | `slate-50`    |
| `--text-muted`     | `muted`          | Descriptions, captions, labels, unpicked option status    | `slate-600`   | `slate-400`   |
| `--accent`         | `accent`         | Primary buttons, selected and current states, links       | `indigo-600`  | `indigo-400`  |
| `--accent-hover`   | `accent-hover`   | Primary hover                                             | `indigo-500`  | `indigo-300`  |
| `--on-accent`      | `on-accent`      | Text on an accent fill                                    | `white`       | `slate-950`   |
| `--accent-subtle`  | `accent-subtle`  | Selected option background, tip callout background        | `indigo-50`   | `indigo-950`  |
| `--focus`          | `focus`          | The one focus ring color                                  | `indigo-500`  | `indigo-300`  |
| `--success`        | `success`        | Correct (text, icons, chart marks)                        | `emerald-700` | `emerald-400` |
| `--success-subtle` | `success-subtle` | Correct option background                                 | `emerald-50`  | `emerald-950` |
| `--danger`         | `danger`         | Wrong pick, destructive actions, flagged chart points     | `rose-700`    | `rose-400`    |
| `--danger-subtle`  | `danger-subtle`  | Wrong-pick background, overconfident chart region         | `rose-50`     | `rose-950`    |
| `--warning`        | `warning`        | Missed (a correct option left unpicked)                   | `amber-700`   | `amber-400`   |
| `--warning-subtle` | `warning-subtle` | Missed option background                                  | `amber-50`    | `amber-950`   |

Implementation may adjust a shade to meet §9's contrast rule; it may not add hues. `--border-strong` is `slate-500` in both themes: the original `slate-300` and `slate-600` gave 1.4:1 (light) and 2.7:1 (dark) on the surfaces, below §9's 3:1 for non-text marks.

### 3.3 Shape and elevation

| Property | Value                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Radius   | `rounded-lg` for cards, buttons, options, inputs and callouts. `rounded-full` for pills, dots and bars. Nothing else. |
| Shadow   | `shadow-sm` on raised cards only. Hover on interactive cards may raise it to `shadow-md`.                             |
| Border   | 1px `border-default` on cards and options. No `ring-1 ring-black/5` cards.                                            |

## 4. Dark mode

- The theme follows `prefers-color-scheme`. There is no toggle and nothing is stored.
- Components get dark mode only through the tokens. Templates never use `dark:` variants.
- `src/index.html` gains `<meta name="color-scheme" content="light dark">` and two `theme-color` metas (one per `media="(prefers-color-scheme: …)"`) set to the `--surface` values.
- Charts are covered too (§8): every SVG mark draws with a token color.

## 5. Typography

One scale, defined once as Tailwind `@utility` classes in `src/styles.css`. Templates use the role class, not the individual size, weight and color utilities.

| Role class     | Used for                                       | Definition                                                 |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `type-title`   | The page `h1`                                  | `text-3xl font-semibold tracking-tight text-text`          |
| `type-section` | Section `h2`, empty-state heading              | `text-lg font-semibold text-text`                          |
| `type-card`    | Card `h3`, card `legend`, card sub-label       | `text-base font-semibold text-text`                        |
| `type-eyebrow` | Small label above a title or stat              | `text-xs font-semibold uppercase tracking-wide text-muted` |
| `type-body`    | Running text                                   | `text-base text-text`                                      |
| `type-detail`  | Descriptions, feedback text, option status     | `text-sm text-muted`                                       |
| `type-caption` | Chart notes, scale end labels, table footnotes | `text-xs text-muted`                                       |
| `type-stat`    | A headline number (skill score, rounds played) | `text-3xl font-bold tabular-nums text-text`                |

- Headings are `font-semibold`. `font-bold` is reserved for `type-stat` and for the flash card bold prompt (`docs/specs/flash-cards.md` §4.1).
- The smallest size is `text-xs` (12px). Arbitrary sizes (`text-[9px]`, `text-[10px]`) are removed.
- The system font stack stays. No web font is added.
- Sanctioned raw utilities. These are the exceptions to the role-class rule above, and each has no role class. A `font-medium` weight on `type-caption` for table headers (`chart-table.ts`) and for the bipolar scale label (`bipolar-scale.ts`). The sizes and weights of the four-way answer control (`four-way-control.ts`), the callout and feedback verdict (`callout.ts`, `feedback-panel.ts`), the status badge (`status-badge.ts`), the review list label (`review-list.ts`) and the chart table body (`chart-table.ts`). Any other raw size or weight needs a new role class or a new entry here.
- Filter-group labels, such as the quiz home "Category" and "Traits", use `type-eyebrow` on a `<p>`. The eyebrow is a label, not a heading (§5 row above), so a filter group has no heading level.

## 6. Layout

### 6.1 Page shell

A `PageShell` component wraps every page. It renders:

1. The page background (`bg-surface`, full height) and a centred content column with the standard padding (`px-4 py-8 sm:px-8`).
2. An optional back link (§6.3).
3. An optional eyebrow, then the `h1` (`type-title`), then an optional description (`type-detail`).
4. The projected page content.
5. An optional projected sticky footer, kept inside the content width (§7.4).

It renders immediately. A page whose data hasn't loaded shows its shell and back link, not a blank screen; this replaces `@if (title())` around the whole flash card home page.

### 6.2 Widths

Two widths. A page is **wide** only if it lays content out in columns.

| Width  | Class       | Pages                                                                                                                                                                  |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Narrow | `max-w-2xl` | Every round (`quiz/:id/round`, `<kind>/:id/round`, `calibration/:id/round`), every report (`quiz/:id/report`, `<kind>/:id/report`), stats (`…/stats`), flash card home |
| Wide   | `max-w-5xl` | Library, quiz home (`quiz/:id`), glossary, calibration home, calibration results                                                                                       |

`max-w-4xl` is retired. Glossary's two-column grid uses a named track (`grid-cols-[18rem_minmax(0,1fr)]` defined once as a `@utility`) instead of an inline `280px`.

### 6.3 Back links and headings

- Every page has exactly one `h1`. The flash card round page's `h1` is the quiz title. The flash card report page's `h1` is "<Quiz title>: report", matching calibration results ("<Quiz title>: results").
- Back links appear in the shell header on home, glossary and stats pages. They read "← Back to library" on home pages and "← Back to <quiz title>" on glossary and stats pages. Rounds exit through **End quiz**. Reports and results exit through their own action rows, which `docs/specs/flash-cards.md` §7 already defines for flash cards.
- Glossary's full-width white header bar goes; its back link and title move into the shell.

## 7. Shared components

All live in `src/app/shared/ui/`, are standalone, use `OnPush`, and style themselves only with tokens. Features may import from `shared/ui`; `shared/ui` imports nothing from `features/` or `core/`. This keeps `docs/specs/flash-cards.md` §3.2's rule (flash cards don't import Reasoning Traps' features) intact.

Directives are used where the host element's semantics matter (a `fieldset`, a native `button`, a `label` wrapping an `input`, a router `a`). Components are used where the markup is the component's own.

### 7.1 Directives

| Name        | Selector                        | Inputs                                                                                       | Notes                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`    | `button[uiButton], a[uiButton]` | `variant: 'primary' \| 'secondary' \| 'danger' \| 'link'` (default `primary`)                | One size: `px-5 py-2.5 text-sm font-semibold rounded-lg`. `link` has no padding or fill. Disabled: `opacity-50 cursor-not-allowed`. Every variant gets the §9 focus ring.                                                                                                                                                   |
| `Card`      | `[uiCard]`                      | `tone: 'raised' \| 'sunken'` (default `raised`), `interactive: boolean`, `selected: boolean` | `raised`: `bg-raised border-default rounded-lg p-5 shadow-sm`. `sunken`: `bg-sunken rounded-lg p-4`, no border or shadow. `interactive` adds the hover shadow. `selected` swaps in the §7.3 selected look and keeps the tone's shape (the glossary concept rows, §12). Works on `section`, `fieldset`, `a`, `li`, `button`. |
| `OptionRow` | `label[uiOption]`               | `state: 'idle' \| 'selected' \| 'correct' \| 'wrong' \| 'missed' \| 'neutral'`               | Border and background per §7.3. The native `input` stays inside the label and is restyled with `accent-accent`.                                                                                                                                                                                                             |
| `Chip`      | `button[uiChip], label[uiChip]` | `state: 'idle' \| 'selected'` (default `idle`)                                               | Filter toggles: category and trait chips. `idle` is `border-default bg-raised`; `selected` is the §7.3 selected look. `rounded-full` (§3.3), `px-3 py-1.5 text-sm font-medium`. Every chip gets the §9 focus ring.                                                                                                          |

Variants by role:

- **primary**: the one main action in a view (Start quiz, Start round, Check answer, Submit, Next round).
- **secondary**: other actions (Weak spots, Back, Retry, Show as table, End quiz).
- **danger**: destroys stored progress (Reset all progress, Reset progress for this quiz, Start over).
- **link**: inline navigation styled as text (Stats, Glossary links).

**End quiz** is `secondary` everywhere. Only one `primary` button is visible at a time; in a round that is **Check answer**.

### 7.2 Components

| Name            | Selector           | Purpose                                                                                                                                                                                                     |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageShell`     | `ui-page-shell`    | §6.1. Inputs: `title`, `eyebrow?`, `description?`, `width: 'narrow' \| 'wide'`, `back?: { label, link }`. Slots: default, `[footer]`.                                                                       |
| `EmptyState`    | `ui-empty-state`   | A sunken card with a `type-section` heading, a `type-detail` message and a projected action. Replaces the "No stats yet", "No report" and flash card report empty blocks.                                   |
| `Callout`       | `ui-callout`       | A tip or note: `bg-accent-subtle`, `rounded-lg`, `type-detail` in `text-text`, optional "Tip:" label. Used by spotting tips, pair tips, the confusion tip on the report, and the option ⓘ definition panel. |
| `FeedbackPanel` | `ui-feedback`      | Sunken panel after **Check answer**. Input `verdict: 'correct' \| 'incorrect'` renders the verdict line in `success` or `danger` with a ✓ / ✗ glyph. The body is projected.                                 |
| `StatusBadge`   | `ui-status`        | Inputs `tone: 'success' \| 'danger' \| 'warning' \| 'neutral'` and `label`. Text in the tone color with its glyph (§7.3).                                                                                   |
| `StickyFooter`  | `ui-sticky-footer` | `sticky bottom-0`, `bg-raised/95 backdrop-blur`, top `border-default`, inside the shell's content width. Score on the left, projected actions on the right.                                                 |
| `ProgressBar`   | `ui-progress`      | Input `value` (0–100). A `bg-sunken` rounded track with an `bg-accent` fill. Replaces the stats trait bar and its "first descendant div" comment.                                                           |
| `ProgressDots`  | `ui-progress-dots` | Calibration's item stepper. Inputs: `count`, `current`, `answered: boolean[]`. Emits `select`. See §7.3 and §9 for colors and hit areas.                                                                    |

### 7.3 Answer feedback semantics

One mapping from an option's outcome to its look. Labels stay as each quiz's spec defines them; only the look is shared.

| Outcome                    | `OptionRow` state | Border / background                | `StatusBadge` tone | Glyph | Reasoning Traps label | Flash card label |
| -------------------------- | ----------------- | ---------------------------------- | ------------------ | ----- | --------------------- | ---------------- |
| Not yet checked, picked    | `selected`        | `border-accent bg-accent-subtle`   | —                  | —     | —                     | —                |
| Correct option, picked     | `correct`         | `border-success bg-success-subtle` | `success`          | ✓     | Correct               | Correct answer   |
| Picked, not correct        | `wrong`           | `border-danger bg-danger-subtle`   | `danger`           | ✗     | Wrong pick            | Your pick        |
| Correct option, not picked | `missed`          | `border-warning bg-warning-subtle` | `warning`          | !     | Missed                | Correct answer   |
| Not picked, not correct    | `neutral`         | `border-default`                   | `neutral`          | —     | Not picked            | —                |

- Color is never the only signal: every non-neutral badge carries its glyph and its text label.
- A flash card's correct option is `correct` when it was picked and `missed` when it wasn't, both labelled "Correct answer" (`docs/specs/flash-cards.md` §6.2).
- The mapping lives in `shared/ui` as `OUTCOME_LOOK: Record<'correct' | 'wrong' | 'missed' | 'neutral', { state, tone }>`. `OptionStatus` and `STATUS_LABELS` stay in `features/report/report-logic.ts`, since round and report are both Reasoning Traps pages.
- Calibration items are not graded while answering. Its progress dots show **current** in `accent`, **answered** in `muted` fill, and **unanswered** as an outlined `border-strong` dot. Green is not used for "answered".
- Calibration's selected confidence (bipolar scale) and selected choice (four-way control) both use the `selected` look. The blue / indigo split goes.

### 7.4 Score line

Both endless rounds show "N of M correct" in the `StickyFooter`. Reasoning Traps' "N / M correct" changes to match flash cards and `summaryLine` in `report-logic.ts`.

## 8. Charts

Every SVG mark uses a token through a `fill-*` / `stroke-*` utility or `currentColor`. No hex, no named colors, no `[attr.stroke]="'#…'"` literals.

| Mark (calibration curve)                  | Today                            | Token                                                                                                        |
| ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Overconfident region                      | `#fecaca`                        | `fill-danger-subtle`                                                                                         |
| Underconfident region                     | `#dbeafe`                        | `fill-accent-subtle`                                                                                         |
| "Overconfident" / "Underconfident" labels | `fill-red-700` / `fill-blue-700` | `fill-danger` / `fill-accent`                                                                                |
| Perfect-calibration diagonal, chance line | `#9ca3af`, `#94a3b8`             | `stroke-strong` (chance line keeps its dash)                                                                 |
| Axis tick labels, bucket counts           | `fill-gray-400…600`              | `fill-muted`                                                                                                 |
| Bucket range bars                         | `#6b7280`                        | `stroke-muted`                                                                                               |
| The player's curve and points             | `#1f2937`                        | `stroke-text`, `fill-text`                                                                                   |
| Flag rings                                | `#dc2626`                        | `stroke-danger`                                                                                              |
| Comparison overlay line and hollow points | `#059669`, `fill="white"`        | `stroke-accent`, `fill-raised` (dashed line and hollow points tell it apart from the curve, not color alone) |

- Chart text has two roles, label and caption, set once as constants next to `box` in the chart component. Rendered at the narrowest layout, neither may be smaller than 12px; today's size-9 bucket counts are raised.
- `calibration-sparkline.ts`: the diagonal uses `stroke-strong`, the curve `stroke-text`, the points `fill-text`. Its segment `line`s currently have no `stroke`, so the curve doesn't render; this fixes it.
- `skill-score-card.html`: the "worse than guessing" band is `bg-sunken`, the guessing-to-perfect band is a `bg-success-subtle` → `bg-success` gradient, the marker is `bg-text`. The in-bar `text-[9px]` label is removed; the band keeps its `aria-label` and `title`, and the "guessing" / "perfect" captions below the bar remain.
- **Show as table** is a `secondary` `Button`. `chart-table.ts` gets the table styles: `type-caption` header row, `border-default` row dividers, right-aligned `tabular-nums` numbers.
- `[style.width]` and `[style.left]` bindings that carry geometry (skill card bands and marker, `ProgressBar` fill) are allowed. Bindings that carry color are not (§10).

## 9. Accessibility

- **Focus**: every interactive element shows `focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface`. Inputs inside `OptionRow` show the ring on the row (`focus-within`). Flash card buttons and links, which have none today, get it through `Button`.
- **Contrast**: text tokens meet WCAG AA (4.5:1) on `surface`, `raised` and `sunken`, and on their own `-subtle` backgrounds, in both themes. Non-text marks (borders on inputs, chart lines, focus ring) meet 3:1.
- **Target size**: every pointer target is at least 24×24px. Calibration's progress dots keep a small visible dot inside a 24px hit area. Bipolar-scale buttons drop `text-[10px]` for `text-xs` and grow to 24px.
- **Live regions**: library drops `aria-live="polite"` from the whole stats summary.
- **Redundant names**: library cards drop the `aria-label` that repeats their visible title and description.

## 10. Guard test

`src/app/design-system.spec.ts` reads every `*.html` under `src/app` and every inline `template:` in `*.ts` (excluding `*.spec.ts`), using `readFileSync` from `node:fs` the way `knowledge-base.spec.ts` does. It fails on:

- Raw Tailwind palette classes: `(bg|text|border|ring|fill|stroke|from|via|to|divide|outline|accent|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+`, plus `bg-white`, `bg-black`, `text-white`, `ring-black/…`.
- Hex colors (`#[0-9a-fA-F]{3,8}\b`) inside quoted attribute values and `styles:` blocks. Template reference variables such as `#cardEl` are not colors and must not trip it. Quoted values of `href`, `title`, `id` and `aria-*` are not colors and are exempt.
- Named SVG colors in `fill=` / `stroke=` attributes other than `none` and `currentColor`.
- Arbitrary size and color values: `text-[…]`, `bg-[…]`, `border-[…]`.
- Color style bindings: `[style.color]`, `[style.backgroundColor]`, `[style.borderColor]`, `[style.borderLeftColor]`, `[style.fill]`, `[style.stroke]`, and any `[style.…]` bound to an `accent` value.
- `dark:` variants (themes go through tokens).
- A `styles:` block in a component that sets `background`, `color` or `border-radius`.

Each rule reports file and line. The test carries an `ALLOWLIST` of feature folders not migrated yet. S2 adds the test with every feature listed; each migration slice removes its folder; S11 asserts the list is empty and deletes it.

## 11. Removing per-quiz accents

The bindings go in each feature's migration slice, because the guard won't let a folder leave the allowlist while it still binds a color. The field goes last (S11), once nothing reads it.

- In the feature slices: remove every accent binding: `library-page.html` (`borderLeftColor`, the 6px `borderLeftWidth`, `backgroundColor`) in S4, `quiz-home-page.html` in S5, `calibration-home-page.html` and `calibration-round-page.html` in S10. S4 also removes `accentTint` and `withAlpha` from `library-page.ts`.
- In S11: remove `accent` from all five entries in `public/data/quizzes.json` and from `QuizManifestEntry` in `core/models/quiz.models.ts`.
- Library cards are interactive `Card`s distinguished by title and description. Quizzes look the same apart from their content.
- Update the spec fixtures that build manifest entries with `accent` (`quiz-data.service.spec.ts`, the calibration specs, `library-page.spec.ts` and the other page specs that set it).
- No quiz `version` bump is needed: `accent` isn't stored in progress.

## 12. Per-feature migration notes

Each slice moves one feature onto `PageShell`, the directives, the components and the type roles, and removes its folder from the guard allowlist. Points specific to each:

| Feature (folder)                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library (`library`)                                  | Wide shell, no back link. Cards become `a[uiCard][interactive]`. **Reset all progress** is `danger`. The "Skill score" `dd` repeats its `dt` ("Skill score Skill score 62"); the `dd` keeps only the number. §9 live-region and label fixes.                                                                                                                                                                                                                           |
| Quiz home (`quiz-home`)                              | Wide shell, back to library. **Start quiz** `primary`; **Weak spots** `secondary` (the amber styling goes). Category and trait toggle chips use the `selected` look when on, so the duplicated active/inactive class strings collapse into one state input.                                                                                                                                                                                                            |
| Glossary (`glossary`)                                | Wide shell, back to the quiz. Header bar removed (§6.3). Concept list items are interactive `Card` rows that take the `selected` border and background (§7.3) when chosen. Detail is a raised `Card`; pair blocks are sunken `Card`s with a `Callout` for the pair tip. Links use `link`, not `sky`.                                                                                                                                                                   |
| Stats (`stats`)                                      | Narrow shell, back to the quiz. Stat tiles use `type-eyebrow` + `type-stat`. Trait rows use `ProgressBar`. "No stats yet" becomes `EmptyState`. Reset is `danger` (today it's neutral with a red focus ring).                                                                                                                                                                                                                                                          |
| Reasoning Traps round and report (`round`, `report`) | Narrow shell. Options use `OptionRow` + `StatusBadge` (§7.3). The ⓘ definition panel is a `Callout`. Feedback uses `FeedbackPanel`. Footer moves inside the shell (`StickyFooter`) with `secondary` **End quiz** and the §7.4 score line. Report option statuses gain their tone, and its confusion tip becomes a `Callout`.                                                                                                                                           |
| Flash cards (`flash-cards`)                          | Narrow shells; round and report gain their `h1` (§6.3). Home renders before its data (§6.1). Options use `OptionRow` + `StatusBadge`. Tips use `Callout`. Report empty state uses `EmptyState`. `flash-card-home-page.spec.ts` C2 asserts `bg-indigo-600`; it changes to assert the `primary` variant.                                                                                                                                                                 |
| Calibration (`calibration`)                          | Wide shells for home and results, narrow for the round. `ProgressDots`, `selected` looks for both answer controls, §8 for the chart, sparkline, skill card and table. `confidence-card.ts` drops its `styles:` block and becomes a raised `Card` with a `type-card` heading, matching the skill card beside it. `bank-unavailable.ts` uses `EmptyState` with a `secondary` **Retry**. **Start over** is `danger`. `review-list.ts` flags use `StatusBadge` (`danger`). |

Calibration decisions (S10), which refine the calibration row above:

- The chart keeps its text in HTML, not in the svg. Axis labels, tick labels, bucket counts and region labels are placed as a percentage of the chart box, so they stay at 12px at every width. The svg keeps only the marks, and each mark uses a token.
- The two chart text roles (§8) take these values. A label is a region name ("Overconfident", "Underconfident") in `text-xs font-semibold`, coloured `text-danger` or `text-accent`. A caption is everything else in the chart, and the first-round note: `type-caption`. §8 names the roles without values.
- The selected look for the bipolar scale and the four-way control is `SELECTED_LOOK` from `shared/ui/option-row.ts`. No new directive, and `Chip` is not used (§7.1 reserves it for filter toggles).
- The skill card track is `bg-raised` with a `border-default` outline. The "worse than guessing" band stays `bg-sunken`; a `bg-sunken` track would hide it.
- Calibration home is a wide shell with "← Back to library" (§6.3). Results has a primary **Next round** to the round route and a secondary **Back to quiz** to the home page, the same action pair as the Reasoning Traps report (§12).
- The calibration round has no **End quiz**. **Submit round** exits to results, and the calibration row above names no End quiz.

Flash card decisions (S9), which refine the flash cards row above:

- The home back link is the shell's, reading "← Back to library". It keeps its `back` testid through `PageShell`'s `backTestId` input (default `back-home`).
- The home shell and back link render at once. The body waits for the manifest title, so a missing entry shows an empty `h1` and no Start round.
- The round `h1` is the quiz title. The report `h1` is "<Quiz title>: report", and the report page loads the manifest for it.
- Option labels: "Correct answer" for the correct option (picked or missed) and "Your pick" for a wrong pick, shown as `StatusBadge`s inside the `OptionRow`, per §7.3.
- The report empty state is an `EmptyState` with no heading, so copy does not change. `EmptyState`'s heading is optional, and its message keeps the `empty` testid through `messageTestId`.
- A `Callout` label is followed by a space, so "Tip: …" and "A vs B: …" no longer run into the body text.

Reasoning Traps decisions (S8), which refine the round and report row above:

- The ⓘ definition is `type-body`. Its spotting tip is a `ui-callout` labelled "Tip", so the copy stays "Tip:".
- The ⓘ button is a `link` `Button` after the option row, with `min-h-6 min-w-6` for the §9 24px target. The state border stays on the label.
- Round feedback's confusion tips are `ui-callout`s labelled with the pair ("A vs B"), as the report's are.
- Report option rows stay neutral (`border-default bg-sunken`). The `StatusBadge` carries the tone.
- Report "Back to quiz" is a `secondary` `Button`. "Next round" is `primary`. The no-results block is an `EmptyState` with a `primary` "Go to quiz" link.

All `data-testid` attributes stay where they are; specs find elements by them.

## 13. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit. These are proposals; turning them into issues is a separate step.

| #   | Slice                                                                                                                                                    | Covers              | Depends on |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| S1  | Tokens and themes: `@theme inline` tokens, light and dark values, type-role and grid `@utility` classes, `index.html` color-scheme and theme-color metas | §3, §4, §5          | —          |
| S2  | Core primitives and guard: `Button`, `Card`, `PageShell`, `EmptyState`; `design-system.spec.ts` with every feature on the allowlist                      | §6, §7.1, §7.2, §10 | S1         |
| S3  | Answer and progress primitives: `OptionRow`, `StatusBadge`, `OUTCOME_LOOK`, `FeedbackPanel`, `Callout`, `StickyFooter`, `ProgressBar`, `ProgressDots`    | §7.2, §7.3          | S2         |
| S4  | Library                                                                                                                                                  | §12                 | S2         |
| S5  | Quiz home                                                                                                                                                | §12                 | S2         |
| S6  | Glossary                                                                                                                                                 | §12                 | S3         |
| S7  | Stats                                                                                                                                                    | §12                 | S3         |
| S8  | Reasoning Traps round and report, including the §7.4 score line                                                                                          | §7.4, §12           | S3         |
| S9  | Flash cards                                                                                                                                              | §12                 | S3         |
| S10 | Calibration, including the chart, sparkline fix, skill and confidence cards, table and progress dots                                                     | §8, §12             | S3         |
| S11 | Accent field removal and guard close-out: `accent` out of the manifest, model and spec fixtures; empty allowlist removed                                 | §11, §10            | S4–S10     |

S4 and S5 can start once S2 lands. S6–S10 are independent of each other once S3 lands. S11 goes last because the accent bindings are removed in S4, S5 and S10, and it deletes the field they read.

Each feature slice is verified by its existing specs (with only class-name assertions updated), the guard test for its folder, and a manual pass of its pages in both light and dark system settings.
