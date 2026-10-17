#!/usr/bin/env node
// PreToolUse guard for the automated PR review.
//
// Modes, from REVIEW_MODE:
//   "1" / "review" — the review session (`pr-review`). Reads code and posts one
//                    comment. Never runs the PR's code.
//   "browser"      — the browser-test session (`pr-browser-test`). Runs the PR's
//                    code against local emulators and drives a headless browser
//                    on localhost. Can never post to GitHub.
//   anything else  — inactive: normal work in tools/ is unaffected.
//
// Both modes are allowlists: every tool call is denied unless a rule lets it
// through. Allowed calls get no output (the normal permission flow still
// applies); denied calls get a PreToolUse "deny" decision with a reason.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCRATCH_DIR = '/tmp/grade-m8-review/';
export const CONTEXT_DIR = '/tmp/grade-m8-review-ctx/';
export const ARTIFACTS_DIRNAME = 'review-artifacts';
const OWNER = 'grade-m8';
const COMMENT_REPOS = ['backend', 'frontend'];
const READ_REPOS = ['backend', 'frontend', 'tools', 'design-system'];

// Tools that only read, or only orchestrate other (also guarded) calls.
// SubagentHandback only returns a subagent's report to the session that launched
// it (no files, no commands, nothing leaves the machine). SendMessage stays out:
// it can reach other local sessions, which this guard doesn't cover.
const ALLOWED_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'LS', 'Skill', 'Agent', 'Task', 'ToolSearch', 'TodoWrite',
  'SubagentHandback',
]);
// Browser mode also manages the background servers it starts.
const BROWSER_EXTRA_TOOLS = new Set(['TaskStop', 'KillShell', 'BashOutput']);

// Shell metacharacters that could chain, substitute or redirect commands.
const SHELL_META = /[;&|`<>\n\r\\]|\$\(|\$\{/;

const repoAlt = (repos) => `${OWNER}/(?:${repos.join('|')})`;
const REPO_FLAG = `--repo ${repoAlt(READ_REPOS)}`;
const NUM = '\\d+';
// Branch names carry accents (e.g. `77-integración-...`), so letters are Unicode.
// `%` for git's --format placeholders (e.g. `--format=%h%x20%cd`).
const SAFE_ARG = '[\\p{L}\\p{N}._,:/=@%-]+';
// A search pattern or glob: quoted (so the shell never expands it) or a plain safe arg.
// SHELL_META already rejects `$(`, `${`, backslashes, pipes and backticks anywhere in the command.
const QUOTED_ARG = `(?:"[^"$]*"|'[^']*'|${SAFE_ARG})`;
const NAME = '[\\p{L}\\p{N}._-]+';
const CTX_PATH = `${CONTEXT_DIR}${NAME}`;
const CTX_OR_FUNCTIONS = `${CTX_PATH}(?:/functions)?`;
// Standard JDK install locations (macOS, Homebrew, Linux) — never a dir the PR controls.
const JDK_DIR = '(?:/Library/Java|/Users/[\\w.-]+/Library/Java|/opt/homebrew/opt|/usr/local/opt|/usr/lib/jvm)/[\\w.@/-]+';
const LOCALHOST = '(?:localhost|127\\.0\\.0\\.1)';
const rule = (source) => new RegExp(source, 'u');

// Reading PRs, issues and code: shared by both modes.
const READ_RULES = [
  rule(`^gh pr (?:view|diff|checks) ${NUM} ${REPO_FLAG}(?: ${SAFE_ARG})*$`),
  rule(`^gh pr list ${REPO_FLAG}(?: ${SAFE_ARG}| "[^"$]*")*$`),
  rule(`^gh issue view ${NUM} ${REPO_FLAG}(?: ${SAFE_ARG})*$`),
  // Ticket dependency graph (GitHub issue dependencies), read-only GET. The only
  // `gh api` call allowed: no -X/-f/--input can match this exact shape.
  rule(`^gh api repos/${repoAlt(COMMENT_REPOS)}/issues/${NUM}/dependencies/(?:blocked_by|blocking)$`),
  // Clone the org's repos into the context dir (gh handles private-repo auth).
  rule(`^gh repo clone ${repoAlt(READ_REPOS)} ${CTX_PATH}(?: --(?: --depth ${NUM}| --branch ${SAFE_ARG}| --no-single-branch)*)?$`),
  rule(`^git clone(?: --depth ${NUM})?(?: --branch ${SAFE_ARG})? https://github\\.com/${repoAlt(READ_REPOS)}(?:\\.git)? ${CTX_PATH}$`),
  // Move a context clone to a given commit — only inside the context dir.
  rule(`^git -C ${CTX_PATH} (?:checkout|switch) (?:--detach )?${SAFE_ARG}$`),
  // Read-only git inspection, optionally with -C <dir>. `git grep -O` (runs a pager) is rejected in checkBash.
  rule(`^git(?: -C ${SAFE_ARG})? (?:fetch|diff|log|show|status|rev-parse|merge-base|ls-files|ls-tree|grep|branch --list)(?: ${QUOTED_ARG})*$`),
  rule(`^ls(?: -[a-zA-Z]+)?(?: [\\p{L}\\p{N}._/-]+)*$`),
  rule(`^mkdir -p (?:${SCRATCH_DIR.slice(0, -1)}|${CONTEXT_DIR.slice(0, -1)})$`),
];

// Searching code (this build has no Grep/Glob tools, so search goes through Bash): grep and
// find, read-only flags only, over the review clones, the project dir, or paths relative to it
// (the shell's cwd). `..` segments are rejected in checkBash.
function searchRules(projectDir) {
  const seg = '[\\p{L}\\p{N}._@+-]+';
  const roots = [CONTEXT_DIR.slice(0, -1)];
  if (projectDir) roots.push(projectDir.replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // A relative path can't start with `-`, or an option like find's `-fprint` would pass as one.
  const path = `(?:(?:${roots.join('|')})(?:/${seg})*/?|[\\p{L}\\p{N}._@+]${seg.slice(0, -1)}*(?:/${seg})*/?)`;
  const grepOpt = `(?:-[a-zA-Z]+|-[ABCm] ?${NUM}|--(?:include|exclude|exclude-dir)=${QUOTED_ARG}|-e ${QUOTED_ARG}|--color=never)`;
  const findExpr = `(?:-(?:max|min)depth ${NUM}|-type [fdl]|-i?(?:name|path) ${QUOTED_ARG}|-not|-print)`;
  return [
    rule(`^grep(?: ${grepOpt})*(?: ${QUOTED_ARG})?(?: ${path})+$`),
    rule(`^find(?: ${path})+(?: ${findExpr})*$`),
  ];
}

// Posting: review mode only. Always a new comment — no --edit-last, which edits
// the authenticated user's last comment (possibly a human's).
const POST_RULES = [
  rule(`^gh pr comment ${NUM} --repo ${repoAlt(COMMENT_REPOS)} --body-file ${SCRATCH_DIR}${NAME}\\.md$`),
];

// Running the stack: browser mode only, and only inside the context dir.
const RUN_RULES = [
  // Commands name the clone explicitly (--prefix / --config): the shell's cwd is
  // reset to the project dir after each call, so `cd` into a clone doesn't stick.
  rule(`^npm --prefix ${CTX_OR_FUNCTIONS} ci --ignore-scripts(?: --no-audit)?(?: --no-fund)?$`),
  rule(`^npm --prefix ${CTX_OR_FUNCTIONS} run (?:build|seed)$`),
  rule(`^ADMIN_EMAIL=[\\w.@+-]+ ADMIN_PASSWORD=[\\w!.@#+-]+ npm --prefix ${CTX_PATH} run seed:admin$`),
  rule(`^cp ${CTX_PATH}/\\.env\\.example ${CTX_PATH}/\\.env$`),
  // Emulators only ever against a demo-* project, so real projects are unreachable.
  // firebase-tools calls `java` from PATH, so a newer JDK may be put first on PATH.
  rule(`^(?:PATH=${JDK_DIR}/bin:\\$PATH )?npx --yes firebase-tools(?:@[\\d.]+)? emulators:start --config ${CTX_PATH}/firebase(?:\\.review)?\\.json --only [a-z,]+ --project demo-[\\w-]+$`),
  rule(`^(?:VITE_[A-Z_]+=[\\w.:/-]+ )*npm --prefix ${CTX_PATH} run dev -- --port ${NUM} --strictPort$`),
  rule(`^curl -s?f?s? http://${LOCALHOST}:${NUM}(?:/[\\w./-]*)?$`),
  /^\/usr\/libexec\/java_home -v \d+\+?$/,
  /^java -version$/,
];

// For MCP tools the operation is the last `__` segment.
const MCP_READ = /^(?:get|list|search|read|fetch)_/;
const MCP_COMMENT = new Set(['add_issue_comment', 'add_comment', 'create_issue_comment']);
const MCP_FORBIDDEN = /merge|approve|push|create_or_update|delete|close|update_pull|create_branch|fork|review/;
const PLAYWRIGHT_TOOL = /^mcp__playwright__browser_/;
// run_code_unsafe executes Node code in the MCP server process (outside the page,
// outside this guard); file_upload/drop read local files. Page JS goes through
// browser_evaluate instead.
const PLAYWRIGHT_DENIED = /^browser_(?:run_code_unsafe|file_upload|drop)$/;

function deny(mode, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Review guard (${mode} mode) denied this call: ${reason}`,
    },
  };
}

function checkBash(mode, command, projectDir) {
  const cmd = String(command ?? '').trim();
  if (!cmd) return deny(mode, 'empty command.');
  if (SHELL_META.test(cmd)) {
    return deny(mode, 'chaining, pipes, redirects and substitutions are not allowed. Run one plain command at a time.');
  }
  // git/gh/curl options that write to disk even on read-only subcommands.
  if (/(?:^| )(?:--output|-o)(?:=| |$)/.test(cmd)) return deny(mode, 'output-to-file options are not allowed.');
  // `git grep -O<cmd>` / `--open-files-in-pager` runs a program on the matches.
  if (/(?:^| )(?:-O|--open-files-in-pager)/.test(cmd)) return deny(mode, 'pager/exec options are not allowed.');
  if (/(?:^|[\s/='"])\.\.(?:[/\s'"]|$)/.test(cmd)) return deny(mode, '`..` path segments are not allowed.');
  const rules = [...READ_RULES, ...searchRules(projectDir), ...(mode === 'browser' ? RUN_RULES : POST_RULES)];
  if (rules.some((r) => r.test(cmd))) return null;
  const allowed = mode === 'browser'
    ? 'reads, grep/find over the clones and the project, clones into the context dir, npm --prefix <clone> ci/build/seed/dev, emulators with --config <clone>/firebase.json on a demo project, curl to localhost'
    : 'gh pr view/diff/checks/list, gh issue view, gh pr comment --body-file, gh repo clone into the context dir, read-only git (incl. grep, ls-tree), grep/find over the clones and the project, ls';
  return deny(mode, `\`${cmd.slice(0, 80)}\` is not on the allowlist (${allowed}).`);
}

function checkWrite(mode, filePath, projectDir) {
  const path = String(filePath ?? '');
  if (mode === 'review') {
    if (rule(`^${SCRATCH_DIR}${NAME}\\.md$`).test(path)) return null;
    return deny(mode, `writes are only allowed to ${SCRATCH_DIR}<name>.md (the comment body).`);
  }
  // The review stack's own emulator ports (e.g. Functions on 5101, so it never
  // collides with other local services) live in a copy of firebase.json in the clone.
  if (rule(`^${CTX_PATH}/firebase\\.review\\.json$`).test(path)) return null;
  // Harness for a component no route renders yet (pr-browser-test step 4b): a page
  // Vite serves from the frontend clone, rendering the component in fixed states.
  if (rule(`^${CTX_PATH}/(?:review-harness\\.html|src/__review__/${NAME}\\.tsx)$`).test(path)) return null;
  if (projectDir) {
    const artifacts = `${projectDir.replace(/\/+$/, '')}/${ARTIFACTS_DIRNAME}/`;
    const escaped = artifacts.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (rule(`^${escaped}${NAME}/${NAME}\\.(?:md|ts|tsx|html|json)$`).test(path) && !path.includes('/../')) return null;
  }
  return deny(mode, `writes are only allowed to <tools>/${ARTIFACTS_DIRNAME}/<run>/<file>.{md,ts,tsx,html,json}, <clone>/firebase.review.json and the component harness (<clone>/review-harness.html, <clone>/src/__review__/<name>.tsx).`);
}

function checkPlaywright(mode, toolName, toolInput) {
  if (mode !== 'browser') return deny(mode, 'the browser is only available in browser-test mode.');
  const op = toolName.split('__').pop() ?? '';
  if (PLAYWRIGHT_DENIED.test(op)) return deny(mode, `\`${op}\` can reach outside the page; use browser_evaluate for page JavaScript.`);
  const url = toolInput?.url;
  if (url !== undefined && !rule(`^http://${LOCALHOST}(?::${NUM})?(?:/|$)`).test(String(url))) {
    return deny(mode, `the browser may only open http://localhost (got \`${String(url).slice(0, 60)}\`).`);
  }
  return null;
}

function checkMcp(mode, toolName, toolInput) {
  if (PLAYWRIGHT_TOOL.test(toolName)) return checkPlaywright(mode, toolName, toolInput);
  const op = toolName.split('__').pop() ?? '';
  if (MCP_FORBIDDEN.test(op)) return deny(mode, `connector operation \`${op}\` modifies the repository.`);
  if (MCP_READ.test(op)) return null;
  if (MCP_COMMENT.has(op) && mode === 'review') return null;
  return deny(mode, `connector operation \`${op}\` is not on the allowlist.`);
}

export function decide(input, mode = 'review', projectDir = process.env.CLAUDE_PROJECT_DIR) {
  let toolName = input?.tool_name;
  let toolInput = input?.tool_input ?? {};

  if (input?.toolCall) {
    const rawName = input.toolCall.name;
    const args = input.toolCall.args || {};
    if (rawName === 'run_command' || rawName === 'Bash') {
      toolName = 'Bash';
      toolInput = { command: args.CommandLine || args.command };
    } else if (rawName === 'write_to_file' || rawName === 'Write') {
      toolName = 'Write';
      toolInput = { file_path: args.TargetFile || args.file_path, content: args.CodeContent || args.content };
    } else if (rawName === 'replace_file_content') {
      toolName = 'Write';
      toolInput = { file_path: args.TargetFile || args.file_path };
    } else {
      toolName = rawName;
      toolInput = args;
    }
  }

  if (typeof toolName !== 'string') return deny(mode, 'malformed hook input.');

  if (ALLOWED_TOOLS.has(toolName)) return null;
  if (mode === 'browser' && BROWSER_EXTRA_TOOLS.has(toolName)) return null;
  if (toolName === 'Bash') return checkBash(mode, toolInput.command, projectDir);
  if (toolName === 'Write') return checkWrite(mode, toolInput.file_path, projectDir);
  if (toolName.startsWith('mcp__')) return checkMcp(mode, toolName, toolInput);
  return deny(mode, `tool \`${toolName}\` is not available in this mode.`);
}

export function modeFromEnv(value) {
  if (value === '1' || value === 'review') return 'review';
  if (value === 'browser') return 'browser';
  return null;
}

function main() {
  const mode = modeFromEnv(process.env.REVIEW_MODE);
  if (!mode) return;

  let input;
  let result;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
    result = decide(input, mode);
  } catch {
    result = deny(mode, 'could not parse hook input.');
  }

  if (input?.toolCall) {
    if (!result) {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
    } else {
      const reason = result.hookSpecificOutput?.permissionDecisionReason || 'denied by review guard';
      process.stdout.write(JSON.stringify({ decision: 'deny', reason }));
    }
    return;
  }

  if (result) process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
