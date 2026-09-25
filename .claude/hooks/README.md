# Review guard

`review-guard.mjs` is a `PreToolUse` hook (registered in `../settings.json`) that makes an automated PR review **read-only**. It does nothing unless `REVIEW_MODE=1`, so normal work in `tools/` is unaffected.

When active, every tool call is denied unless it's on the allowlist:

| Allowed | Notes |
|---|---|
| `Read`, `Grep`, `Glob`, `Skill`, `Agent`, `ToolSearch`, `TodoWrite` | Subagents' calls go through the same guard |
| `Write` to `/tmp/grade-m8-review/<name>.md` | The comment body only |
| `gh pr view/diff/checks <n> --repo grade-m8/<repo>`, `gh pr list --repo …`, `gh issue view <n> --repo …` | `--repo` is required and limited to `grade-m8` |
| `gh pr comment <n> --repo grade-m8/{backend,frontend} [--edit-last] --body-file /tmp/grade-m8-review/<name>.md` | The only way to post |
| `git clone https://github.com/grade-m8/…`, read-only `git` (`fetch`, `diff`, `log`, `show`, `status`, `rev-parse`, `merge-base`, `ls-files`, `branch --list`), `ls`, `mkdir -p /tmp/grade-m8-review` | No `--output`/`-o` |
| MCP connector operations named `get_*`, `list_*`, `search_*`, `read_*`, `fetch_*`, or `add_issue_comment` | Anything with merge/approve/push/delete/close/update/review/branch/fork is denied |

Everything else, including unknown tools and any Bash command containing `;`, `&`, `|`, `` ` ``, `$(`, `>`, `<` or newlines, is denied with a reason. Invalid hook input is also denied (fail closed).

## Turning it on

The automation must start Claude Code **with `tools/` as the project directory** (so `.claude/settings.json` loads) and either:

- `claude --settings .claude/review-mode.settings.json …`, which sets `REVIEW_MODE=1` and adds a static `permissions.deny` list as a second layer, or
- `REVIEW_MODE=1` in the environment, if the runner can't pass `--settings`.

Before reviewing, the entry point should check the guard is live: try a `Write` outside the scratch dir and **abort the review if it isn't denied**.

## Testing

```bash
node .claude/hooks/review-guard.test.mjs
```

This covers allowed and denied decisions, plus end-to-end runs through stdin/env the way Claude Code invokes the hook. When you change the allowlist, add cases to both lists.
