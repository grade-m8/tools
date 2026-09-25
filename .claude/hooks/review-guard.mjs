#!/usr/bin/env node
// PreToolUse guard for the automated PR review.
//
// Inactive unless REVIEW_MODE=1. When active it is an allowlist: every tool
// call is denied unless a rule below explicitly lets it through. Allowed calls
// get no output, so the normal permission flow still applies to them; denied
// calls get a PreToolUse "deny" decision with a reason Claude can read.
//
// The only thing a review may write is its own comment body, under
// SCRATCH_DIR, which `gh pr comment --body-file` then posts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCRATCH_DIR = '/tmp/grade-m8-review/';
const OWNER = 'grade-m8';
const COMMENT_REPOS = ['backend', 'frontend'];
const READ_REPOS = ['backend', 'frontend', 'tools', 'design-system'];

// Tools that only read, or only orchestrate other (also guarded) calls.
const ALLOWED_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'LS', 'Skill', 'Agent', 'Task', 'ToolSearch', 'TodoWrite',
]);

// Shell metacharacters that could chain, substitute or redirect commands.
const SHELL_META = /[;&|`<>\n\r\\]|\$\(|\$\{/;

const repoAlt = (repos) => `${OWNER}/(?:${repos.join('|')})`;
const REPO_FLAG = `--repo ${repoAlt(READ_REPOS)}`;
const NUM = '\\d+';
const SAFE_ARG = `[A-Za-z0-9._,:/=@-]+`;

const BASH_RULES = [
  // Read PR / issue data.
  new RegExp(`^gh pr (?:view|diff|checks) ${NUM} ${REPO_FLAG}(?: ${SAFE_ARG})*$`),
  new RegExp(`^gh pr list ${REPO_FLAG}(?: ${SAFE_ARG}| "[^"$]*")*$`),
  new RegExp(`^gh issue view ${NUM} ${REPO_FLAG}(?: ${SAFE_ARG})*$`),
  // Post (or update its own last) review comment, body from the scratch dir only.
  new RegExp(
    `^gh pr comment ${NUM} --repo ${repoAlt(COMMENT_REPOS)}(?: --edit-last)? --body-file ${SCRATCH_DIR}[A-Za-z0-9._-]+\\.md$`,
  ),
  // Clone the org's repos for context (read-only use afterwards).
  new RegExp(
    `^git clone(?: --depth ${NUM})?(?: --branch ${SAFE_ARG})? https://github\\.com/${repoAlt(READ_REPOS)}(?:\\.git)?(?: ${SAFE_ARG})?$`,
  ),
  // Read-only git inspection, optionally with -C <dir>.
  new RegExp(
    `^git(?: -C ${SAFE_ARG})? (?:fetch|diff|log|show|status|rev-parse|merge-base|ls-files|branch --list)(?: ${SAFE_ARG})*$`,
  ),
  /^ls(?: -[a-zA-Z]+)?(?: [A-Za-z0-9._\/-]+)*$/,
  new RegExp(`^mkdir -p ${SCRATCH_DIR.slice(0, -1)}$`),
];

// For MCP tools (e.g. a GitHub connector) the operation is the last `__` segment.
const MCP_READ = /^(?:get|list|search|read|fetch)_/;
const MCP_COMMENT = new Set(['add_issue_comment', 'add_comment', 'create_issue_comment']);
const MCP_FORBIDDEN = /merge|approve|push|create_or_update|delete|close|update_pull|create_branch|fork|review/;

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Review mode is read-only: ${reason}`,
    },
  };
}

function checkBash(command) {
  const cmd = String(command ?? '').trim();
  if (!cmd) return deny('empty command.');
  if (SHELL_META.test(cmd)) {
    return deny('chaining, pipes, redirects and substitutions are not allowed. Run one plain command at a time.');
  }
  // git/gh options that write to disk even on read-only subcommands.
  if (/(?:^| )(?:--output|-o)(?:=| |$)/.test(cmd)) return deny('output-to-file options are not allowed.');
  if (BASH_RULES.some((rule) => rule.test(cmd))) return null;
  return deny(`\`${cmd.slice(0, 80)}\` is not on the review allowlist (gh pr view/diff/checks/list, gh issue view, gh pr comment --body-file, git clone/read-only git, ls).`);
}

function checkWrite(filePath) {
  const path = String(filePath ?? '');
  if (/^\/tmp\/grade-m8-review\/[A-Za-z0-9._-]+\.md$/.test(path)) return null;
  return deny(`writes are only allowed to ${SCRATCH_DIR}<name>.md (the comment body).`);
}

function checkMcp(toolName) {
  const op = toolName.split('__').pop() ?? '';
  if (MCP_FORBIDDEN.test(op)) return deny(`connector operation \`${op}\` modifies the repository.`);
  if (MCP_READ.test(op) || MCP_COMMENT.has(op)) return null;
  return deny(`connector operation \`${op}\` is not on the review allowlist.`);
}

export function decide(input) {
  const toolName = input?.tool_name;
  const toolInput = input?.tool_input ?? {};
  if (typeof toolName !== 'string') return deny('malformed hook input.');

  if (ALLOWED_TOOLS.has(toolName)) return null;
  if (toolName === 'Bash') return checkBash(toolInput.command);
  if (toolName === 'Write') return checkWrite(toolInput.file_path);
  if (toolName.startsWith('mcp__')) return checkMcp(toolName);
  return deny(`tool \`${toolName}\` is not available during a review.`);
}

function main() {
  if (process.env.REVIEW_MODE !== '1') return;

  let result;
  try {
    result = decide(JSON.parse(readFileSync(0, 'utf8')));
  } catch {
    result = deny('could not parse hook input.');
  }
  if (result) process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
