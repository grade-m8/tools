# Design systems & tokens

## The problem with hardcoded values

If every component picks its own colors and spacing by eye (`#0a6565` here, `#0a6566` there, one button with 12px padding and another with 13px), an app slowly drifts into visual inconsistency that's hard to even pin down — nothing is *wrong* exactly, it just doesn't feel like one coherent product. A **design system** solves this by defining a small, fixed vocabulary of values up front and requiring components to use that vocabulary instead of inventing their own numbers.

## Tokens: named values instead of raw numbers

A **design token** is a name given to a specific value — `color-action-primary` instead of `#065252`, `space-md` instead of `16px`. Components reference the token name, not the raw value. This buys two things: consistency (every "primary action" surface is provably the same color, because they all point at the same token), and easy re-theming later (change what the token *means* once, and everything using it updates together — you're not hunting through every file for a hex code).

**Semantic tokens** go a level further than raw scale tokens — instead of `teal-700`, you have `text-brand` or `surface-page`, named by *role* rather than by raw color value. This is more resilient: if the brand color changes, `text-brand` gets repointed once, but a component that referenced `teal-700` directly would have to be found and edited by hand, and it's not obvious from the name alone that it was even standing in for "brand text."

## Where tokens come from

Tokens are usually derived from a design tool (Figma, in this project's case) where a designer has already decided the palette, spacing scale, and typography. Extracting them into code is a translation step — turning visual design decisions into named, reusable values the actual app can reference.

## Reference vs. dependency: a specific, deliberate choice

A separate design-system project (built in Storybook — a tool for building and previewing components in isolation, outside of any real app) can serve two very different roles:

- **A dependency**: the real app imports the design-system's actual components directly. Change the design system, the app changes too, automatically. Fast to keep in sync, but the app is now coupled to a separate project's release cycle and internals.
- **A reference**: the design-system is a *pattern* the app's own components are hand-recreated from, never imported. Slower to keep in sync (a change in the reference doesn't propagate automatically — someone has to notice and re-port it), but each app fully owns its own components, can diverge when its needs genuinely differ, and doesn't carry a dependency on code it doesn't control the release of.

Grade-M8 deliberately chose reference-only, given multiple independent repos with no shared package between them (see [10-grade-m8-architecture.md](./10-grade-m8-architecture.md)) — worth understanding as a real tradeoff, not a default, since "just import it" would genuinely be simpler if that decision were made differently.

Next: [Deployment & environments](./09-deployment-environments.md) — how "it works on my laptop" becomes something real users can reach.
