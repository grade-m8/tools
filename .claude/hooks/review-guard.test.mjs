// Run with: node .claude/hooks/review-guard.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide } from './review-guard.mjs';

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const tool = (tool_name, tool_input = {}) => ({ tool_name, tool_input });

const allowed = [
  tool('Read', { file_path: '/repo/src/index.ts' }),
  tool('Grep', { pattern: 'requireRoles' }),
  tool('Glob', { pattern: '**/*.ts' }),
  tool('Skill', { skill: 'qa-ticket-reviewer' }),
  tool('Agent', { prompt: 'review' }),
  tool('Write', { file_path: '/tmp/grade-m8-review/pr-55.md', content: '| a | b |' }),
  bash('gh pr view 55 --repo grade-m8/backend --json title,body,headRefName'),
  bash('gh pr view 55 --repo grade-m8/backend --comments'),
  bash('gh pr diff 110 --repo grade-m8/frontend'),
  bash('gh pr checks 110 --repo grade-m8/frontend'),
  bash('gh pr list --repo grade-m8/frontend --state open --json number,headRefName'),
  bash('gh pr list --repo grade-m8/frontend --state all --search "77"'),
  bash('gh issue view 77 --repo grade-m8/frontend --comments'),
  bash('gh pr comment 110 --repo grade-m8/frontend --body-file /tmp/grade-m8-review/pr-110.md'),
  bash('gh pr comment 110 --repo grade-m8/frontend --edit-last --body-file /tmp/grade-m8-review/pr-110.md'),
  bash('git clone --depth 1 --branch dev https://github.com/grade-m8/backend.git /tmp/grade-m8-review-ctx/backend'),
  bash('git clone https://github.com/grade-m8/design-system'),
  bash('git -C /tmp/grade-m8-review-ctx/backend log --oneline -5'),
  bash('git -C backend merge-base origin/dev HEAD'),
  bash('git diff --stat origin/dev...HEAD'),
  bash('ls -la /tmp/grade-m8-review-ctx'),
  bash('mkdir -p /tmp/grade-m8-review'),
  tool('mcp__github__get_pull_request'),
  tool('mcp__github__list_pull_requests'),
  tool('mcp__claude_ai_GitHub__search_code'),
  tool('mcp__github__add_issue_comment'),
];

const denied = [
  tool('Edit', { file_path: '/repo/src/index.ts' }),
  tool('Write', { file_path: '/repo/src/index.ts', content: 'x' }),
  tool('Write', { file_path: '/tmp/grade-m8-review/../../etc/x.md' }),
  tool('Write', { file_path: '/tmp/grade-m8-review/sub/x.md' }),
  tool('NotebookEdit', { notebook_path: '/repo/x.ipynb' }),
  tool('WebFetch', { url: 'https://example.com' }),
  tool('SomeFutureTool'),
  bash('git push origin HEAD'),
  bash('git commit -m x'),
  bash('git checkout -b evil'),
  bash('git diff --output=/repo/src/index.ts'),
  bash('git -C backend diff -o out.patch'),
  bash('gh pr merge 55 --repo grade-m8/backend'),
  bash('gh pr review 55 --repo grade-m8/backend --approve'),
  bash('gh pr close 55 --repo grade-m8/backend'),
  bash('gh pr edit 55 --repo grade-m8/backend --title x'),
  bash('gh pr comment 55 --repo grade-m8/backend --body "LGTM"'),
  bash('gh pr comment 55 --repo grade-m8/tools --body-file /tmp/grade-m8-review/x.md'),
  bash('gh pr comment 55 --repo grade-m8/backend --body-file /etc/passwd'),
  bash('gh pr view 55'),
  bash('gh pr view 55 --repo other-org/backend'),
  bash('gh api -X PATCH repos/grade-m8/backend/pulls/55 -f state=closed'),
  bash('gh api repos/grade-m8/backend/pulls/55'),
  bash('gh repo delete grade-m8/backend'),
  bash('gh pr view 55 --repo grade-m8/backend; git push'),
  bash('gh pr view 55 --repo grade-m8/backend && rm -rf /'),
  bash('gh pr view 55 --repo grade-m8/backend | sh'),
  bash('gh pr view $(git push) --repo grade-m8/backend'),
  bash('gh pr view `whoami` --repo grade-m8/backend'),
  bash('ls > /repo/x'),
  bash('git clone https://github.com/evil/repo'),
  bash('git clone https://github.com/grade-m8/backend.git && git push'),
  bash('curl -X POST https://api.github.com/repos/grade-m8/backend/merges'),
  bash('npm run build'),
  bash('rm -rf node_modules'),
  bash(''),
  tool('mcp__github__merge_pull_request'),
  tool('mcp__github__create_pull_request_review'),
  tool('mcp__github__create_or_update_file'),
  tool('mcp__github__push_files'),
  tool('mcp__github__update_pull_request'),
  tool('mcp__github__delete_branch'),
  tool('mcp__github__create_branch'),
  { tool_input: {} },
];

let failures = 0;
const check = (input, expectDenied) => {
  const result = decide(input);
  const isDenied = result?.hookSpecificOutput?.permissionDecision === 'deny';
  if (isDenied !== expectDenied) {
    failures += 1;
    console.error(`FAIL expected ${expectDenied ? 'deny' : 'allow'}: ${JSON.stringify(input)}`);
  }
};
allowed.forEach((input) => check(input, false));
denied.forEach((input) => check(input, true));

// End to end through stdin/env, the way Claude Code invokes the hook.
const script = fileURLToPath(new URL('./review-guard.mjs', import.meta.url));
const run = (env, input) =>
  spawnSync(process.execPath, [script], { input: JSON.stringify(input), env: { ...process.env, ...env }, encoding: 'utf8' });

const inactive = run({ REVIEW_MODE: '' }, tool('Edit', { file_path: '/x' }));
assert.equal(inactive.status, 0);
assert.equal(inactive.stdout, '', 'guard must be a no-op without REVIEW_MODE=1');

const active = run({ REVIEW_MODE: '1' }, tool('Edit', { file_path: '/x' }));
assert.equal(active.status, 0);
assert.equal(JSON.parse(active.stdout).hookSpecificOutput.permissionDecision, 'deny');

const activeAllowed = run({ REVIEW_MODE: '1' }, bash('gh pr diff 1 --repo grade-m8/backend'));
assert.equal(activeAllowed.stdout, '', 'allowed calls must produce no decision');

const garbage = spawnSync(process.execPath, [script], { input: 'not json', env: { ...process.env, REVIEW_MODE: '1' }, encoding: 'utf8' });
assert.equal(JSON.parse(garbage.stdout).hookSpecificOutput.permissionDecision, 'deny', 'must fail closed');

const total = allowed.length + denied.length;
if (failures) {
  console.error(`${failures}/${total} decision checks failed`);
  process.exit(1);
}
console.log(`ok: ${allowed.length} allowed + ${denied.length} denied decisions, plus 4 end-to-end checks`);
