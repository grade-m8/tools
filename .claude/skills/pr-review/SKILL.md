---
name: pr-review
description: Automated read-only review of one grade-m8 backend/frontend PR, posted as a single comment in Tomi's format. Usage: /pr-review <pr-url> [--dry-run] [--sha <commit>]
disable-model-invocation: true
argument-hint: <pr-url> [--dry-run] [--sha <commit>]
---

# Automated PR review

Reviews one PR in `grade-m8/backend` or `grade-m8/frontend` against the ticket, `CONVENTIONS.md`, the criteria of its **task profile** (`profiles.md`, next to this skill) and the QA agents, then posts **one** comment. It runs **read-only**: the review guard (`.claude/hooks/review-guard.mjs`) blocks every write except the comment body in `/tmp/grade-m8-review/`. Arguments: `$ARGUMENTS`.

- `--dry-run`: do everything except posting. Print the comment instead.
- `--sha <commit>`: **backtest**. Review that commit instead of the head (e.g. the one a human reviewed), so you can compare the output with their review. Implies `--dry-run`. **Don't read the PR's comments at all**: they would give away the answers. Skip the comment-related parts of steps 2 and 7, and tell each reviewer the same.
- For frontend PRs whose profile calls for it, run `pr-browser-test` for the same commit **first**, in its own session. This session only reads its report (step 6).
- `<tools>` means this repo's root, which is the project directory.
- Run one plain command per `Bash` call. The guard denies pipes, `;`, `&&`, redirects and `--jq`, so read JSON output directly.

Work through the steps in order. Each ends on its **done when**.

## 1. Confirm the guard is live

Call `Write` on `/tmp/grade-m8-review-canary.txt` with any content.

**Done when** the call is denied by the review guard ("Review guard (review mode) denied this call"). If the write succeeds, or the denial names another mode, **stop**: report "review guard inactive — aborted" and post nothing.

## 2. Load the PR

Parse `owner/repo` and the number from the URL. If the repo isn't `grade-m8/backend` or `grade-m8/frontend`, stop and report it.

`gh pr view <n> --repo grade-m8/<repo> --json number,title,body,author,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,additions,deletions,changedFiles,files,closingIssuesReferences,comments`

With `--sha`, drop `comments` from the field list, and use that commit wherever this skill says head SHA.

Unless `--dry-run`, **skip** (report why, post nothing) when:
- the PR is a draft or not open;
- the base isn't `dev` or `main`;
- a comment already contains the **marker** `<!-- ai-review:repo=<repo> pr=<n> sha=<headRefOid> -->` (this commit was already reviewed).

If earlier `ai-review` comments exist for older commits, this is a **re-review**: keep their points at hand for step 7.

**Done when** you have the head SHA, base branch, author, changed files, and any earlier review comments.

## 3. Load the ticket, dependencies and CI

- Ticket: the issue in `closingIssuesReferences`. Otherwise, the number the branch name starts with (`77-integración-…` → 77). Read it with `gh issue view <issue> --repo grade-m8/<repo> --comments`. If it isn't there, try the other repo. If there's no ticket, note "sin ticket vinculado" and review against the PR description.
- Dependencies: `gh api repos/grade-m8/<repo>/issues/<issue>/dependencies/blocking` and `…/blocked_by`. Read each linked ticket (`gh issue view`). For each *blocking* ticket, look for its PR (branch starts with its number) and read how it uses this PR's output.
- CI: `gh pr checks <n> --repo grade-m8/<repo>`. Failing or pending checks are part of the review. Don't run lint/test/build yourself. With `--sha`, skip CI, since the checks belong to the current head.

**Done when** you have the ticket's title and requirements as a list (or have noted there is none), the status of every check, and, for each downstream (*blocking*) and upstream (*blocked by*) ticket, one line saying what it needs from this PR or what this PR should use from it.

## 4. Classify the task

`Read` `profiles.md` and classify the PR using **both** signals it describes: the ticket title (prefix and keyword) and the changed files. Apply every profile either signal points to.

- `training` → **stop**: report "ticket de capacitación: sin revisión automática" and post nothing.
- `hotfix` → keep the other profiles' correctness and security criteria, and drop their style, naming and scope criteria.
- If the title and the files point to different profiles, apply both, and add one line to the comment's intro asking whether the extra scope was intended (not a finding).

**Done when** you have the list of profiles, and for each one its **must check** list, reviewers, browser expectation, test expectation and **blocker when** rules, ready to pass on.

## 5. Build the context dir

Use `sha7` = the first 7 characters of the head SHA.

1. `mkdir -p /tmp/grade-m8-review-ctx`
2. `gh repo clone grade-m8/<repo> /tmp/grade-m8-review-ctx/<repo>-pr-<n>-<sha7>` (if the dir already exists, reuse it)
3. `git -C /tmp/grade-m8-review-ctx/<repo>-pr-<n>-<sha7> fetch origin pull/<n>/head:pr-<n>`
4. `git -C /tmp/grade-m8-review-ctx/<repo>-pr-<n>-<sha7> checkout --detach <sha>` (the head SHA, or the `--sha` commit)
   With `--sha`, `gh pr diff` shows the current head, so build the diff yourself: `git -C … fetch origin <base>`, then `git -C … merge-base origin/<base> <sha>`, then `git -C … diff <merge-base> <sha>`.
5. For profiles that check the **other repo** (`be-types`, `be-controller`, `fe-types`, `integration`, or any profile listing `integration-dev`): `gh repo clone grade-m8/<other> /tmp/grade-m8-review-ctx/<other>-dev -- --depth 1 --branch dev`. For `integration`, if the ticket or PR names a backend PR it depends on, fetch and check out that PR's head in this clone instead.
6. For `fe-component` and `fe-view`: clone `grade-m8/design-system` with `--depth 1` into `/tmp/grade-m8-review-ctx/design-system`.

Read `CONVENTIONS.md` (in this repo, `tools`) yourself.

**Done when** the PR clone's `git -C … rev-parse HEAD` equals the head SHA, and each clone the profiles need exists.

## 6. Run the reviewers

Check the ticket yourself using the **Review Objectives** of the `qa-ticket-reviewer` skill (the ticket, the diff from `gh pr diff <n> --repo grade-m8/<repo>`, and `CONVENTIONS.md`), including **dependencies between tickets**, in both directions.

At the same time, dispatch with `Agent`, in parallel, the **union of the reviewers** the profiles list (`qa`, `security-reviewer`, `integration-dev`). Give each one this **brief**, filled in:

> Review PR #<n> in grade-m8/<repo> (<title>), base `<base>`, head `<sha7>`, author @<author>. The code at the PR head is checked out at `<clone path>`; <other clones, if any>. Changed files: <list>. Ticket summary: <requirements>. Dependencies: <downstream tickets and what each needs from this PR; upstream tickets and what this PR should reuse>. CI: <status>. Read `CONVENTIONS.md` in the current project first; it overrides anything in your own instructions.
> **Task profile(s): <profiles>.** Check these first, one by one: <the profiles' "must check" items>. A finding is a **blocker** when: <the profiles' "blocker when" rules>. <For `hotfix`: skip style, naming and scope suggestions.>
> Read-only: don't run scripts or edit files (a guard blocks it). Use the diff (`gh pr diff <n> --repo grade-m8/<repo>`) and the clone.
> Judge what this PR builds against the downstream tickets too: a component, hook, service or type another ticket will use must fit that use (`CONVENTIONS.md` → Cross-ticket contracts).
> Report only problems **in lines this PR adds or changes, or directly caused by them**. "Known debt" counts only if the PR touches or worsens it. "Planned, not built yet" counts only if the PR introduces that feature.
> For each finding return: `severity` (blocker | major | minor), `file:line` (at the PR head), `what` (one sentence), `why` (what breaks at runtime or for whom), `source` (CONVENTIONS.md section, profile, wiki page, or ticket), `hint` (direction, not the finished code), `confidence` (high | medium). If you find nothing, say `none`. Also list up to 3 things the PR does well, each naming the file.

**Tests** — apply the profiles' test expectation: when a profile marks unit tests as **required** and the PR adds or changes that logic without them, that's a blocker. When a profile says none are required, don't ask for them.

**Browser tests** — when a profile expects them (`fe-view`, `integration`, and `fe-component` only if a route already renders it): `Read` `<tools>/review-artifacts/frontend-pr-<n>-<sha7>/report.md`. Every `falla` becomes a finding with the report's suggested impact, its steps, and its screenshot path. Don't re-verify it by reading code: the screenshot and console output are the evidence. Keep the results table for the comment. If a profile expects a report and there isn't one, note "pruebas en navegador no ejecutadas para este commit". For `integration`, a report that didn't run end to end (no Functions emulator) doesn't count.

Add the **branch hygiene** findings yourself from step 2:
- `mergeStateStatus` `BEHIND` → major ("actualizar con `origin/<base>`"); `DIRTY` → blocker (conflicts).
- Files this PR deletes or reverts that exist on the base only because of a newer merge → major (the branch would revert someone else's work).
- More than 40 changed files or 1,500 added lines → minor (suggest splitting, unless the ticket calls for it).

**Done when** every dispatched agent has returned, every profile's "must check" item is marked checked (with or without a finding), and the ticket check is written down as met / partially met / missing, per requirement.

## 7. Consolidate

1. **Verify** each blocker and major by reading the cited line in the PR clone. Drop any you can't point to in the code, and any `medium`-confidence minor.
2. **Deduplicate**: when agents report the same problem, keep one entry with the highest severity.
3. **Re-review**: drop points from earlier `ai-review` comments that are now fixed, and list them as fixed in the intro ("Ya quedaron resueltos: …"). Keep points that are still open, marked as still pending.
4. **Apply the profiles**: raise to blocker anything matching a profile's "blocker when" rule. For `hotfix`, drop style, naming and scope findings.
5. **Shape**: blockers and the **3 most severe majors** get the full format. Any remaining majors go in a compact "Otros puntos importantes" list, one line each (`file:line` — problem — hint). At most 5 minors, as non-blocking suggestions. A dev should be able to read the whole comment in a couple of minutes.
6. **Verdict**: any blocker, or a core ticket requirement missing → `Requiere cambios`. Wrong ticket, or the PR doesn't match its purpose at all → `Rechazado` (rare). Otherwise → `Aprobado`.

**Done when** every remaining blocker and major has been checked against the code at the head SHA and has a hint.

## 8. Write and post the comment

Invoke `pr-feedback-generator` in **automated mode** with the findings (already shaped as in step 7), the praise, the verdict, the profiles, the author, the browser-test table if there is one, and the target path `/tmp/grade-m8-review/<repo>-pr-<n>-<sha7>.md`. The body must end with the marker `<!-- ai-review:repo=<repo> pr=<n> sha=<headRefOid> -->`.

- `--dry-run`: `Read` the file and print it. Stop.
- Otherwise: `gh pr comment <n> --repo grade-m8/<repo> --body-file /tmp/grade-m8-review/<repo>-pr-<n>-<sha7>.md`

**Done when** the comment is posted (or printed, in dry-run) and you've reported one line: `<repo>#<n> @ <sha7> [<profiles>]: <verdict>, <blockers>/<majors>/<minors>`.
