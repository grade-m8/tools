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
- `gh pr view/diff/checks <n> --repo grade-m8/<repo>`, `gh pr list --repo …`, `gh issue view <n> --repo …`. `--repo` is required and limited to `grade-m8`.
- `gh repo clone grade-m8/<repo> /tmp/grade-m8-review-ctx/<dir> [-- --depth N --branch X]`, `git -C /tmp/grade-m8-review-ctx/<dir> checkout <ref>`, read-only `git` (`fetch`, `diff`, `log`, `show`, `status`, `rev-parse`, `merge-base`, `ls-files`, `branch --list`), `ls`, `mkdir -p` of the scratch dirs. Branch names may contain accents.
- MCP connector operations named `get_*`, `list_*`, `search_*`, `read_*`, `fetch_*`. Anything with merge/approve/push/delete/close/update/review/branch/fork is denied.

**Review only:**
- `Write` to `/tmp/grade-m8-review/<name>.md` (the comment body).
- `gh pr comment <n> --repo grade-m8/{backend,frontend} --body-file /tmp/grade-m8-review/<name>.md`, or the connector's `add_issue_comment`. Always a new comment: `--edit-last` is denied because it edits the authenticated user's last comment, which may be a human's.

**Browser only:**
- `Write` to `<tools>/review-artifacts/<run>/<file>.{md,ts,json}`.
- On clones in `/tmp/grade-m8-review-ctx/`, always named explicitly because the shell's working directory resets after each call: `npm --prefix <clone> ci --ignore-scripts`, `npm --prefix <clone> run build|seed`, `seed:admin` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, and `cp <clone>/.env.example <clone>/.env`.
- `Write` of `<clone>/firebase.review.json`: a copy of `firebase.json` with the review stack's own ports.
- `npx --yes firebase-tools emulators:start --config <clone>/firebase[.review].json --only … --project demo-*`, optionally with `PATH=<standard JDK dir>/bin:$PATH` in front.
- `VITE_*=… npm --prefix <clone> run dev -- --port <n> --strictPort`, `curl -s http://localhost:<port>/…`, `java -version`, `/usr/libexec/java_home -v 21+`.
- Background task tools (`TaskStop`, `KillShell`, `BashOutput`).
- Playwright MCP `browser_*` tools, where `browser_navigate` is limited to `http://localhost`. `browser_run_code_unsafe` (runs Node code outside the page), `browser_file_upload` and `browser_drop` (read local files) are denied. Page JavaScript goes through `browser_evaluate`.

## Running a review

Always start Claude Code **with `tools/` as the project directory**, so `.claude/settings.json` and its hook load.

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

### Browser-test requirements
- Node 20+, and JDK 21+ for the Firestore emulator. On macOS the skill finds a newer JDK with `java_home` if the default one is older.
- `npx` must be able to download `firebase-tools` and `@playwright/mcp`. The first run installs Chromium.
- The review stack uses ports 4400, 4500, 5101 (Functions, moved off the default 5001, which other local projects use), 5173, 8080 and 9099 (Auth, fixed because the frontend hardcodes it). If one is taken, the run reports it as blocked. It never stops a process it didn't start, and the guard denies `kill`/`pkill`.

Screenshots, the plan, the re-runnable `scenarios.spec.ts` and `report.md` stay in `tools/review-artifacts/<run>/`, which is gitignored. `gh` can't attach images to PR comments, so the comment names each screenshot file instead.

## Testing

```bash
node .claude/hooks/review-guard.test.mjs
```

This covers allowed and denied decisions for both modes, the calls review mode must refuse because only browser mode may make them, and end-to-end runs through stdin/env the way Claude Code invokes the hook. When you change an allowlist, add cases to the matching lists.
