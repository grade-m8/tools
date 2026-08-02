# Grade-M8 Mentor Tool System

This directory is the support system for rebuilding Grade-M8 from scratch with two junior developers who are new to web development. It is not the app itself — it's the wiki, working agreement, and skills that make the rebuild go well.

## What's here

- **[MENTOR.md](./MENTOR.md)** — the working agreement. Read this first. It defines how Claude should behave across the whole rebuild: teacher and coder at once, defaulting to checking in rather than assuming.
- **[wiki/](./wiki/)** — a concept reference, written for absolute beginners, covering everything the stack will require: how the web works, REST APIs, Firestore, auth, Docker, async job queues, React basics, design tokens, and deployment. `wiki/10-grade-m8-architecture.md` is the one page specific to this product — the data model, API surface, and grading pipeline, told as a narrative.
- **[.claude/skills/](./.claude/skills/)** — scaffolding skills for once real coding starts: generating a backend resource, a frontend page, or porting a design-system component. Each one ends with an explanation step, not just silent file generation. `scaffold-page` and `scaffold-component` both start by pointing at `../design-system/` — its Storybook has every component and every full screen already built as the visual reference for anything the frontend needs.

## How to use this, if you're one of the two devs

You don't need to read the wiki cover to cover before starting. Ask Claude about whatever you're stuck on, whenever you're stuck on it — "what's a REST API," "why does this need Docker," "walk me through what this endpoint does" — and it'll pull the relevant wiki page(s) and explain at whatever depth you need. You can also just ask for something to be built and get an explanation afterward instead of before. Both are fine; say which you want.

## How to use this, if you're future-me (Claude)

Load `MENTOR.md` before starting any work session on the rebuild — it's the persona/working-agreement for this project, not optional flavor text. When a dev asks a conceptual question, check `wiki/glossary.md` and the relevant numbered page before improvising an explanation from scratch, so answers stay consistent across sessions. Use the `/teach` skill for structured concept walkthroughs, and the `scaffold-*` skills once the actual `backend/`/`frontend/` repos exist.

## Portability caveat

Claude Code discovers skills by walking up from the current working directory. These skills live at `tools/.claude/skills/` and will only be auto-discovered when working from inside `tools/`. Once the real `backend/` and `frontend/` rebuild repos are created (as siblings of this directory, same layout as the current reference repos), copy the relevant skill folders into each new repo's own `.claude/skills/` — `scaffold-resource` belongs in `backend/`, `scaffold-page` and `scaffold-component` belong in `frontend/`, and `teach` is useful in either. Do the same with `MENTOR.md`: drop its content into each new repo's `CLAUDE.md` so the working agreement travels with the code, not just with this reference directory.

## What this system deliberately doesn't do

It doesn't hand the devs a curriculum of practice exercises to work through in order (see `../TRAINING_IDEA.md` for that pattern if a standalone practice exercise is ever wanted). It's reactive, not prescriptive: the devs decide what to build and when to ask for teaching, and this system makes sure the teaching that happens is accurate, consistent, and pitched at the right level.
