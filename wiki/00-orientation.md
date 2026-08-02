# Orientation

This wiki explains the concepts behind Grade-M8's stack, written for someone who has never built a web app before. It doesn't teach you to code line-by-line — it teaches you the *shape* of the ideas, so that when Claude (or a teammate) shows you code, you already have somewhere to hang it in your head.

## Reading order

There isn't a required order — jump to whatever's relevant to what you're working on. But if you want a sensible path through it from zero:

1. [01-how-the-web-works.md](./01-how-the-web-works.md) — the foundation everything else sits on.
2. [02-rest-apis.md](./02-rest-apis.md) — how the frontend and backend talk to each other.
3. [03-databases-and-firestore.md](./03-databases-and-firestore.md) — where data lives.
4. [04-auth-and-roles.md](./04-auth-and-roles.md) — how the app knows who you are and what you're allowed to do.
5. [05-docker-and-local-dev.md](./05-docker-and-local-dev.md) — how you run all of this on your own laptop.
6. [06-async-jobs-and-queues.md](./06-async-jobs-and-queues.md) — why some things happen "in the background."
7. [07-frontend-basics.md](./07-frontend-basics.md) — how the screen you see is built.
8. [08-design-systems-and-tokens.md](./08-design-systems-and-tokens.md) — where colors, spacing, and components come from.
9. [09-deployment-environments.md](./09-deployment-environments.md) — what happens when this stops being "just on my laptop."
10. [10-grade-m8-architecture.md](./10-grade-m8-architecture.md) — all of the above, applied specifically to this product.

[glossary.md](./glossary.md) has one-line definitions for every term used across these pages — every page links terms there the first time they appear.

## How to actually use this

Don't read this front-to-back before writing any code — you'll forget most of it and it'll feel like homework. The intended use is: you're doing a real task, you hit a term or an idea you don't have a handle on, you ask Claude about it, Claude points you at (or reads from) the relevant page and explains it in context. The wiki exists so those explanations are consistent every time, not so you study it in isolation.

If something here is confusing, out of date, or wrong once you're deeper into the real build, say so — these pages should get corrected, not treated as fixed truth.
