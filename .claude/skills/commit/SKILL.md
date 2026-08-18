---
name: commit
description: Runs a repo's verification suite (lint, typecheck, test, build) and creates a commit following the structure already established across backend/frontend/design-system history, only after checking for secrets/credential files and branch safety. Use whenever a dev asks to commit, save progress, or "wrap this up."
---

# Commit

Use when a dev asks to commit work. This is deliberately not a one-step `git commit -am` — it runs checks and stops on any failure, rather than committing broken or unsafe code. `backend/`, `frontend/`, and `design-system/` are three independent git repos with their own history; this skill operates on whichever one is currently being worked in.

## Steps

1. **Confirm which repo.** Determine from the current working directory, or ask if it's ambiguous — each repo has its own git history and its own `package.json` scripts.

2. **Branch safety.** Check the current branch (`git branch --show-current`). If it's the default branch (`main`), create and switch to a descriptively-named feature branch first, unless the dev has explicitly asked to commit directly to `main`. This matches the standing rule: commit or push only when asked, and branch first off the default branch.

3. **Review what's actually changing before touching anything** — `git status` and `git diff` (staged and unstaged). Don't reflexively `git add -A`.
   - **Secret/credential check — never skip this.** Look for anything that looks like a credential: service-account JSON keys, `.env*` files, API keys, tokens. Cross-check against `.gitignore` — and don't assume a filename is covered just because *something* in `.gitignore` looks related; confirm the actual glob matches the actual filename (e.g. `service-account*.json` does **not** match a file named `<project>-prod-key.json`). If anything matching looks unprotected, stop, flag it to the dev by name, and do not stage it — fixing the `.gitignore` is a separate, explicit step, not something to fold silently into a commit.
   - Give every **untracked** file a deliberate look before including it — is this something that belongs in git, or a local artifact (seed data, generated output, a stray IDE file)? Ask if it's unclear rather than assuming "new file = include it."

4. **Run the verification suite, in order, stopping at the first failure** — report the failure and do not proceed to commit until it's fixed:
   - `lint`
   - `typecheck`
   - `test`
   - `build`

   Use the exact script names the target repo's `package.json` defines under `"scripts"` (they're consistent across `backend/`/`frontend/` but confirm rather than assuming). A failing check blocks the commit — that's the entire point of running these first, not after.

5. **Stage deliberately** — `git add` the specific files reviewed in step 3, not a blanket `-A`, unless the dev has already reviewed and explicitly approved everything `git status` showed.

6. **Write the commit message** in the structure below.

7. **Commit, then confirm** — show the dev the result (`git log -1` or equivalent) rather than assuming success silently.

## Commit message structure

This matches the style already established across every repo's real history (`backend/`, `frontend/`, `design-system/`) — plain imperative subject lines, no Conventional-Commits type prefixes (`feat:`, `fix:`, etc. don't appear anywhere in this project's history, so don't introduce them without checking with the dev first):

- **Subject line**: imperative mood, capitalized, no trailing period, aim for ≤ 72 characters. Describes what the commit *does*, not what it fixed after the fact — `Add Cloud Tasks grading pipeline + LMStudio integration`, `Fix race condition in submission start/resume`, not `Added...`/`Fixes...`.
- **Body** (optional, blank line after the subject): only when the *why* isn't obvious from the diff — a tradeoff made, a bug's root cause, something a reviewer would otherwise have to ask about. Skip it for genuinely self-explanatory changes; don't pad every commit with a body for its own sake.
- **Trailer**: end with the `Co-Authored-By:` line per the standing instruction for this environment — not optional, not something to drop even for a small commit.

## What NOT to do

- Don't commit on `main` without the dev explicitly asking for that.
- Don't `git add -A` / `git commit -am` reflexively — review untracked files every time, not just the first time.
- Don't skip a failing verification step "just this once" or because "it's probably unrelated."
- Don't invent a different commit-message structure per commit — follow the one above so history stays scannable across both repos and both devs.
