# Review guard

`review-guard.mjs` is a `PreToolUse` hook (registered in `../settings.json`) that locks down the automated PR review sessions. `REVIEW_MODE` selects the mode. When it's unset, the guard does nothing, so normal work in `tools/` is unaffected.

| Mode | `REVIEW_MODE` | Session | Can | Can never |
|---|---|---|---|---|
| **review** | `1` or `review` | `/pr-review` | Read PRs, issues and code; clone into the context dir; post **one** comment | Run the PR's code, open a browser, write anything but the comment body |
| **browser** | `browser` | `/pr-browser-test` | Everything review can read, plus install/build/seed, start emulators (demo project only) and Vite, drive a headless browser on `localhost`, write to `review-artifacts/` | Post to GitHub, touch non-`demo-*` Firebase projects, open non-local URLs |

Splitting them keeps the session that **runs PR code** away from the session that **can post**.

## Allowlists

Both modes deny every tool call unless a rule allows it. They also deny any Bash command containing `;`, `&`, `|`, `` ` ``, `$(`, `${`, `>`, `<`, `\` or newlines, and `--output`/`-o` flags. Invalid hook input is denied (fail closed).

**Shared (read-only):**
- `Read`, `Grep`, `Glob`, `Skill`, `Agent`, `ToolSearch`, `TodoWrite`. Subagents' calls go through the same guard.
- `SubagentHandback`: how a subagent returns its report to the session that launched it. It only returns text (no files, no commands, nothing leaves the machine); without it, reviewers finish their work but the report never arrives. `SendMessage` stays denied: it can reach other local sessions and bypass the guard that way.
- `gh pr view/diff/checks <n> --repo grade-m8/<repo>`, `gh pr list --repo …`, `gh issue view <n> --repo …`. `--repo` is required and limited to `grade-m8`.
- `gh api repos/grade-m8/{backend,frontend}/issues/<n>/dependencies/{blocked_by,blocking}`: the ticket dependency graph. This exact read-only form is the only `gh api` call allowed. The static deny lists don't block `gh api` as a whole so this read works; the guard rejects every other shape.
- `gh repo clone grade-m8/<repo> /tmp/grade-m8-review-ctx/<dir> [-- --depth N --branch X]`, `git -C /tmp/grade-m8-review-ctx/<dir> checkout <ref>`, read-only `git` (`fetch`, `diff`, `log`, `show`, `status`, `rev-parse`, `merge-base`, `ls-files`, `ls-tree`, `grep`, `branch --list`; `git grep -O`/`--open-files-in-pager` is denied because it runs a program), `ls`, `mkdir -p` of the scratch dirs. Branch names may contain accents.
- Code search, because this Claude Code build has no `Grep`/`Glob` tools: `grep` with flags, `-e`, `-A/-B/-C <n>`, `--include/--exclude/--exclude-dir`, and `find` with only `-maxdepth/-mindepth`, `-type`, `-name/-iname/-path/-ipath`, `-not`, `-print` (no `-exec`, `-delete` or `-fprint`). Paths must be in `/tmp/grade-m8-review-ctx/`, in the project dir, or relative to it. Patterns and globs must be quoted or plain. Any `..` segment is denied.
- MCP connector operations named `get_*`, `list_*`, `search_*`, `read_*`, `fetch_*`. Anything with merge/approve/push/delete/close/update/review/branch/fork is denied.

**Review only:**
- `Write` to `/tmp/grade-m8-review/<name>.md` (the comment body).
- `gh pr comment <n> --repo grade-m8/{backend,frontend} --body-file /tmp/grade-m8-review/<name>.md`, or the connector's `add_issue_comment`. Always a new comment: `--edit-last` is denied because it edits the authenticated user's last comment, which may be a human's.

**Browser only:**
- `Write` to `<tools>/review-artifacts/<run>/<file>.{md,ts,tsx,html,json}`.
- On clones in `/tmp/grade-m8-review-ctx/`, always named explicitly because the shell's working directory resets after each call: `npm --prefix <clone> ci --ignore-scripts`, `npm --prefix <clone> run build|seed`, `seed:admin` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, and `cp <clone>/.env.example <clone>/.env`.
- `Write` of `<clone>/firebase.review.json`: a copy of `firebase.json` with the review stack's own ports.
- `Write` of the component harness, `<clone>/review-harness.html` and `<clone>/src/__review__/<name>.tsx`: the page that mounts a component no route renders yet. Nothing else in the clone is writable.
- `npx --yes firebase-tools emulators:start --config <clone>/firebase[.review].json --only … --project demo-*`, optionally with `PATH=<standard JDK dir>/bin:$PATH` in front.
- `VITE_*=… npm --prefix <clone> run dev -- --port <n> --strictPort`, `curl -s http://localhost:<port>/…`, `java -version`, `/usr/libexec/java_home -v 21+`.
- Background task tools (`TaskStop`, `KillShell`, `BashOutput`).
- Playwright MCP `browser_*` tools, where `browser_navigate` is limited to `http://localhost`. `browser_run_code_unsafe` (runs Node code outside the page), `browser_file_upload` and `browser_drop` (read local files) are denied. Page JavaScript goes through `browser_evaluate`.

## Running a review

Always start Claude Code **with `tools/` as the project directory**, so `.claude/settings.json` and its hook load.

### Interactive: `REVIEW_MODE` shortcuts

An env var alone can't load an MCP config, so `scripts/review-shell.zsh` defines a `claude` shell function that adds the flags for you. Source it once from `~/.zshrc`:

```bash
source /path/to/tools/scripts/review-shell.zsh
```

Then, from any directory:

```bash
REVIEW_MODE=browser claude   # browser-test settings + Playwright MCP config
REVIEW_MODE=1 claude         # review-mode settings (REVIEW_MODE=review also works)
claude                       # unchanged when REVIEW_MODE is unset or anything else
```

With `REVIEW_MODE` set, the function `cd`s into `tools/` in a subshell before it starts, so the guard hook loads and your shell's cwd stays where it was. It calls `command claude`, so it never calls itself. `pr-browser-test` checks for the Playwright tools first, so a session started without the MCP config stops in seconds instead of after the stack is up.

### Explicit flags (`claude -p`, CI)

Non-interactive runners don't source your shell config, so pass the flags directly:

```bash
# 1. Frontend PRs that change UI or API calls: browser test first (runs PR code, can't post)
claude -p "/pr-browser-test <pr-url>" \
  --settings .claude/browser-test.settings.json \
  --mcp-config .claude/browser-test.mcp.json

# 2. Every PR: the review (reads the browser report if one exists, then posts)
claude -p "/pr-review <pr-url>" --settings .claude/review-mode.settings.json
```

Each settings file sets `REVIEW_MODE` and adds a static `permissions.deny` list as a second layer. If a runner can't pass `--settings`, export `REVIEW_MODE=browser` / `REVIEW_MODE=1` instead. Both skills start by checking that the guard is live in the expected mode, and stop if it isn't.

For backtesting on an old commit, add `--sha <commit>` to both. `pr-review` then never posts and ignores the PR's existing comments.

### Automated runs with approval (`scripts/pr-inbox.mjs`)

A launchd job on your Mac checks `grade-m8/backend` and `grade-m8/frontend` every 10 minutes. When a PR opens (or leaves draft) against `dev`/`main`:

- **backend**: `/pr-review <url> --hold`
- **frontend**: `/pr-browser-test <url>`, then `/pr-review <url> --hold`, but only if the browser test's `report.md` ran at least one scenario and has no `bloqueado` ones (or is the one-line "sin cambios de UI"). Otherwise the item is marked failed, with the reason, and no review runs.

`--hold` writes the comment but doesn't post it. The draft goes to `review-artifacts/inbox/<repo>-pr-<n>-<sha7>/comment.md`, and you get a macOS notification with the verdict. Nothing reaches GitHub until you approve:

```bash
node scripts/pr-inbox.mjs install        # once; `uninstall` removes it
node scripts/pr-inbox.mjs list           # drafts and their status
node scripts/pr-inbox.mjs show <id>      # read a draft
node scripts/pr-inbox.mjs open <id>      # edit it (keep the ai-review marker as the last line)
node scripts/pr-inbox.mjs post <id>      # post it; refuses if the PR got new commits since
node scripts/pr-inbox.mjs discard <id>
node scripts/pr-inbox.mjs review backend#72   # review one PR now (e.g. after new commits)
```

**Menu bar app.** `scripts/pr-inbox-bar/build.sh` builds `~/Applications/PR Inbox.app` (needs only the Xcode Command Line Tools; `--login` also opens it at login, `--remove` uninstalls). The icon shows how many drafts are waiting. Click one to read it, edit it, publish it or discard it. Frontend drafts show the browser test's screenshots under the comment (failures first; click one to open it in Preview) and a button for its `report.md`. It also lists reviews in progress, runs that didn't finish (review again, view the log) and recently published comments, and has "Review a PR…" for on-demand runs. Every action calls `pr-inbox.mjs`, so the checks are the same as the CLI's.

Each PR is reviewed once, when it's first seen. The first run only records the PRs that are already open. The sessions run with `--permission-mode bypassPermissions` (a headless run can't answer prompts), so the guard is what limits them: both skills abort unless it's live. The review session also gets `--disallowedTools "Bash(gh pr comment *)"` and `--strict-mcp-config`, so it can't post even if the flag were dropped. Logs: `review-artifacts/inbox/watch.log`, plus `browser-test.log` and `review.log` per item. The Mac has to be awake and logged in for the job to run.

### Browser-test requirements
- Node 20+, and JDK 21+ for the Firestore emulator. On macOS the skill finds a newer JDK with `java_home` if the default one is older.
- `npx` must be able to download `firebase-tools` and `@playwright/mcp`. The first run installs Chromium.
- The review stack uses ports 4400, 4500, 5101 (Functions, moved off the default 5001), 5188 (Vite, moved off the default 5173), 8080 and 9099 (Auth, fixed because the frontend hardcodes it). Other local projects use the defaults. The skill checks all six are free before it clones or starts anything; if one is taken, the run reports it as blocked, naming the port. It never stops a process it didn't start, and the guard denies `kill`/`pkill`.

Screenshots, the plan, the re-runnable `scenarios.spec.ts` and `report.md` stay in `tools/review-artifacts/<run>/`, which is gitignored. `gh` can't attach images to PR comments, so the comment names each screenshot file instead.

## Testing

```bash
node .claude/hooks/review-guard.test.mjs
```

This covers allowed and denied decisions for both modes, the calls review mode must refuse because only browser mode may make them, and end-to-end runs through stdin/env the way Claude Code invokes the hook. When you change an allowlist, add cases to the matching lists.
