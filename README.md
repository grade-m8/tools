# Grade-M8 Mentor Tool System

This directory is the support system for rebuilding Grade-M8 from scratch with two junior developers who are new to web development. It is not the app itself — it's the wiki, working agreement, and skills that make the rebuild go well.

## What's here

- **[MENTOR.md](./MENTOR.md)** — the working agreement. Read this first. It defines how Claude should behave across the whole rebuild: teacher and coder at once, defaulting to checking in rather than assuming.
- **[wiki/](./wiki/)** — a concept reference, written for absolute beginners, covering everything the stack will require: how the web works, REST APIs, Firestore, auth, Docker, async job queues, React basics, design tokens, and deployment. `wiki/10-grade-m8-architecture.md` is the one page specific to this product — the data model, API surface, and grading pipeline, told as a narrative.
- **[.claude/skills/](./.claude/skills/)** — repeatable workflows for once real coding starts:
  - *Scaffolding*: `scaffold-resource` (backend REST resource), `scaffold-page` (frontend route), `scaffold-component` (port a design-system component). Each ends with an explanation step, not just silent file generation. `scaffold-page`/`scaffold-component` both start by pointing at `../design-system/` — its Storybook has every component and every full screen already built as the visual reference for anything the frontend needs.
  - *Process*: `teach` (structured concept walkthrough), `commit` (runs a repo's lint/typecheck/test/build gate, checks for secrets and branch safety, then commits in this project's established message structure — never a reflexive `git add -A && git commit`), `classify-vulnerability` (anchors `security-reviewer`'s severity/difficulty ratings to concrete decision tables and maps every finding to its MITRE CWE entry for consistent classification across sessions), `define-color-palette` (derives, structures, and implements functional WCAG AA color palettes with 60-30-10 distribution, predictable state luminances, and immutable TypeScript tokens).
  - *Testing*: `backend-tester` (unit tests and mock factories for backend business logic), `backend-test-setup` (verifies and configures backend Jest and TypeScript test infrastructure).
- **[.claude/agents/](./.claude/agents/)** — subagents built on top of the skills above, grouped by what they own:
  - *Build*: `frontend-dev` (routes/screens/components, reaching for `scaffold-page`/`scaffold-component`), `backend-dev` (REST resources, reaching for `scaffold-resource`), `feature-scaffolder` (scaffolds 4-layer decoupled backend REST features: routes, controller, service, repository, and types contract), `ai-grading-engineer` (the LMStudio prompt/response/retry internals — the architecture's highest-risk piece), `backend-test-engineer` (writes unit tests and mock factories, reaching for `backend-tester`/`backend-test-setup`).
  - *Cross-cutting*: `integration-dev` (keeps the two independent repos' hand-duplicated shared types and API contracts from drifting), `firebase-expert` (Firestore rules, custom claims, Cloud Tasks/queue config, emulator/deploy topology), `qa` (reviews already-written code against this project's specific conventions — not a generic linter), `qa-engineer` (QA lead and SDET, orchestrating testing and PR reviews across backend and frontend), `security-reviewer` (SAST-only: finds, classifies, and explains first-party code vulnerabilities by severity and remediation difficulty; does not fix code or cover dependency/infra security), `react-clean-code-expert` (audits, compartmentalizes, and refactors React/TypeScript codebases for strict modularity, 1-file-per-component single responsibility, TSDoc interfaces, state colocation, and render optimization), `frontend-ui-designer` (designs high-density, task-oriented React/TypeScript UIs, enforcing strict anti-"UI slop" rules, typography hierarchy, neutral surface balance, and complete interaction states), `teacher` (wraps `teach` for on-demand concept explanations).
  - *Occasional*: `gherkin-writer` (turns a design-system screen into Gherkin acceptance criteria — a spec artifact, not test automation; MENTOR.md's no-E2E-for-v1 decision stays intact), `ticket-creator` (creates clear, structured development tickets in .md format across Backend, Frontend, and Integration categories without giving ready-to-copy code; enforces strict category separation and exhaustive acceptance criteria), `release-checklist` (runs the dev/prod deploy checklist, always confirms before touching prod).
  - *Meta*: `agent-builder` (creates new agents for this roster, following the same pattern all the above follow, and keeps this README section in sync afterward).

  Invoke one directly when a task is clearly single-purpose (e.g. "have the qa agent look at this PR"); for mixed tasks, default Claude behavior already covers the same ground.

## How to use this, if you're one of the two devs

You don't need to read the wiki cover to cover before starting. Ask Claude about whatever you're stuck on, whenever you're stuck on it — "what's a REST API," "why does this need Docker," "walk me through what this endpoint does" — and it'll pull the relevant wiki page(s) and explain at whatever depth you need. You can also just ask for something to be built and get an explanation afterward instead of before. Both are fine; say which you want.

## How to use this, if you're future-me (Claude)

Load `MENTOR.md` before starting any work session on the rebuild — it's the persona/working-agreement for this project, not optional flavor text. When a dev asks a conceptual question, check `wiki/glossary.md` and the relevant numbered page before improvising an explanation from scratch, so answers stay consistent across sessions. Use the `/teach` skill for structured concept walkthroughs, and the `scaffold-*` skills once the actual `backend/`/`frontend/` repos exist.

## Portability caveat

Claude Code discovers skills and agents by walking up from the current working directory. These skills and agents live at `tools/.claude/skills/` and `tools/.claude/agents/` and will only be auto-discovered when working from inside `tools/`. Once the real `backend/` and `frontend/` rebuild repos are created (as siblings of this directory, same layout as the current reference repos), copy the relevant skill and agent files into each new repo's own `.claude/skills/`/`.claude/agents/`:

  - `backend/`: `scaffold-resource`, `backend-tester`, `backend-test-setup` skills; `backend-dev`, `feature-scaffolder`, `backend-test-engineer`, `ai-grading-engineer` agents.
  - `frontend/`: `scaffold-page`, `scaffold-component`, `define-color-palette` skills; `frontend-dev`, `gherkin-writer`, `react-clean-code-expert`, `frontend-ui-designer` agents.
  - Either (or both): `teach`, `commit`, `classify-vulnerability` skills; `qa`, `teacher`, `integration-dev`, `firebase-expert`, `release-checklist`, `security-reviewer`, `ticket-creator` agents — none of them reference paths outside `wiki/`/`MENTOR.md`/skill names, so they work from either repo. `security-reviewer` in particular is repo-agnostic: it only reads source files, classifies findings, and never touches Firestore rules or infra config, so it's equally useful from `backend/` or `frontend/`. `classify-vulnerability` travels with `security-reviewer` — wherever the agent goes, the skill goes too.
  - **Not copied**: `agent-builder` stays in `tools/` only — its job is authoring/maintaining this whole roster against this README, which doesn't exist inside `backend/`/`frontend/` once split, so copying it there would leave it with no roster to check overlap against or update.

Do the same with `MENTOR.md`: drop its content into each new repo's `CLAUDE.md` so the working agreement travels with the code, not just with this reference directory.

## What this system deliberately doesn't do

It doesn't hand the devs a curriculum of practice exercises to work through in order (see `../TRAINING_IDEA.md` for that pattern if a standalone practice exercise is ever wanted). It's reactive, not prescriptive: the devs decide what to build and when to ask for teaching, and this system makes sure the teaching that happens is accurate, consistent, and pitched at the right level.
