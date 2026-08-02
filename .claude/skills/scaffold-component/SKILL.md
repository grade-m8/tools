---
name: scaffold-component
description: Walk a junior dev through hand-porting a component from the design-system Storybook reference into the real frontend app, explaining the reference-vs-dependency distinction as it happens rather than just doing the port silently.
---

# Port a design-system component

Use this skill when the frontend needs a UI component that already exists as a reference in the `design-system/` Storybook (e.g. Button, Card, Badge) but doesn't yet exist in the real `frontend/` app. This is **not** a copy-paste operation — see [Design systems & tokens](../../wiki/08-design-systems-and-tokens.md) for why the design system is reference-only, never a dependency.

## Usage

```
/scaffold-component <category>/<ComponentName>
```

Example: `/scaffold-component buttons/Button`

## What to do

1. **Look at the reference** — open the matching component (and its story/preview file, if present) in `design-system/`. Note its visual variants, states, and structure — not to copy its code, but to understand what it needs to look and behave like.

2. **Check the token layer exists first** — before building the component, confirm the frontend app already has the relevant design tokens available (colors, spacing, type scale) matching the design system's. If the frontend's token setup doesn't have what this component needs yet, that's a prerequisite step, not something to work around inside the component itself.

3. **Re-derive it, don't transcribe it** — build the component fresh in the frontend app, in the same category/name path as the reference (for discoverability), using the frontend's own styling approach and semantic token names (`bg-surface-card`, not a raw hex value — see [Design systems & tokens](../../wiki/08-design-systems-and-tokens.md) on why semantic tokens are preferred over raw scale values). Its API (props) can diverge from the reference if this app's actual usage calls for something different — the reference is a starting point, not a contract to match exactly.

4. **Don't reach for a third-party component library to rebuild something the reference already covers** — third-party primitives (dialogs, tooltips, dropdowns, toasts, and similar interactive-but-not-visually-branded pieces) are for things the design-system reference genuinely doesn't have, not a shortcut around porting something that does exist there.

## The teaching step (required, not optional)

While doing this, explicitly name the "reference, not dependency" idea if this is the dev's first time porting a component — many developers' first instinct is "why not just import it," and the tradeoff (full ownership vs. automatic sync) is worth a genuine explanation, not just a rule to follow. Point at [Design systems & tokens](../../wiki/08-design-systems-and-tokens.md) for the fuller reasoning.

## What NOT to do

- Don't import anything from `design-system/` into `frontend/` — there is no dependency relationship between these repos, by design.
- Don't invent a component that doesn't exist in the reference and doesn't have a real need yet — check with the requesting dev if it's unclear whether something belongs here or as a one-off third-party primitive instead.
