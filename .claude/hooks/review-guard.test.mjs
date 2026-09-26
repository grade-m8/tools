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
  bash('gh pr comment 110 --repo grade-m8/frontend --body-file /tmp/grade-m8-review/frontend-pr-110.md'),
  bash('git clone --depth 1 --branch dev https://github.com/grade-m8/backend.git /tmp/grade-m8-review-ctx/backend'),
  bash('gh repo clone grade-m8/frontend /tmp/grade-m8-review-ctx/frontend'),
  bash('gh repo clone grade-m8/design-system /tmp/grade-m8-review-ctx/design-system -- --depth 1'),
  bash('gh repo clone grade-m8/frontend /tmp/grade-m8-review-ctx/frontend-pr -- --depth 50 --branch 77-integración-413-vista-paso-1'),
  bash('git -C /tmp/grade-m8-review-ctx/frontend fetch origin pull/110/head:pr-110'),
  bash('git -C /tmp/grade-m8-review-ctx/frontend checkout --detach pr-110'),
  bash('git -C /tmp/grade-m8-review-ctx/backend log --oneline -5'),
  bash('git -C /tmp/grade-m8-review-ctx/frontend diff --stat origin/dev...pr-110'),
  bash('mkdir -p /tmp/grade-m8-review-ctx'),
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
  bash('git -C /Users/me/sandbox/grade-m8/backend checkout pr-110'),
  bash('git -C /tmp/grade-m8-review-ctx/../../Users/me/backend checkout main'),
  bash('git clone https://github.com/grade-m8/design-system'),
  bash('git clone https://github.com/grade-m8/backend /Users/me/backend'),
  bash('gh repo clone grade-m8/backend /Users/me/backend'),
  bash('gh repo clone other-org/x /tmp/grade-m8-review-ctx/x'),
  bash('gh repo delete grade-m8/tools --yes'),
  bash('gh pr comment 110 --repo grade-m8/frontend --edit-last --body-file /tmp/grade-m8-review/pr-110.md'),
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

// Browser-test mode: runs the stack and the browser, never posts.
const PROJECT = '/work/tools';
const CTX = '/tmp/grade-m8-review-ctx';
const pw = (name, tool_input = {}) => ({ tool_name: `mcp__playwright__browser_${name}`, tool_input });

const browserAllowed = [
  tool('Read', { file_path: `${CTX}/frontend-pr-110-abc1234/src/routes/AppRouter.tsx` }),
  tool('TaskStop', { task_id: 'x' }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/frontend-pr-110-abc1234/plan.md` }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/frontend-pr-110-abc1234/scenarios.spec.ts` }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/_guard/check.md` }),
  tool('Write', { file_path: `${CTX}/frontend-pr-110-abc1234-backend/firebase.review.json` }),
  bash(`npx --yes firebase-tools emulators:start --config ${CTX}/frontend-pr-110-abc1234-backend/firebase.review.json --only auth,firestore,functions --project demo-grade-m8`),
  bash(`VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-grade-m8 VITE_FIREBASE_API_KEY=demo-key VITE_API_BASE_URL=http://localhost:5101/demo-grade-m8/us-central1 npm --prefix ${CTX}/frontend-pr-110-abc1234 run dev -- --port 5173 --strictPort`),
  bash('curl -s http://127.0.0.1:5101/demo-grade-m8/us-central1/exams/owned'),
  bash('gh pr view 110 --repo grade-m8/frontend --json files,headRefOid'),
  bash(`gh repo clone grade-m8/backend ${CTX}/backend-dev -- --depth 1 --branch dev`),
  bash(`npm --prefix ${CTX}/backend-dev/functions ci --ignore-scripts --no-audit --no-fund`),
  bash(`npm --prefix ${CTX}/backend-dev/functions run build`),
  bash(`npm --prefix ${CTX}/backend-dev run seed`),
  bash(`ADMIN_EMAIL=admin@gradem8.com ADMIN_PASSWORD=Password123! npm --prefix ${CTX}/backend-dev run seed:admin`),
  bash(`cp ${CTX}/backend-dev/.env.example ${CTX}/backend-dev/.env`),
  bash(`npx --yes firebase-tools emulators:start --config ${CTX}/backend-dev/firebase.json --only auth,firestore,functions --project demo-grade-m8`),
  bash(`PATH=/Library/Java/JavaVirtualMachines/microsoft-25.jdk/Contents/Home/bin:$PATH npx --yes firebase-tools@14.9.0 emulators:start --config ${CTX}/backend-dev/firebase.json --only auth,firestore --project demo-grade-m8`),
  bash(`VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-grade-m8 VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_AUTH_DOMAIN=localhost npm --prefix ${CTX}/frontend-pr-110-abc1234 run dev -- --port 5173 --strictPort`),
  bash('curl -sf http://localhost:5173/'),
  bash('curl -s http://127.0.0.1:4400/emulators'),
  bash(`PATH=/usr/lib/jvm/java-21-openjdk-amd64/bin:$PATH npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth,firestore --project demo-grade-m8`),
  bash(`PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth,firestore,functions --project demo-grade-m8`),
  bash('/usr/libexec/java_home -v 21+'),
  bash('java -version'),
  pw('navigate', { url: 'http://localhost:5173/' }),
  pw('navigate', { url: 'http://localhost:5173/materias' }),
  pw('snapshot'),
  pw('click', { element: 'Ingresar', ref: 'e12' }),
  pw('type', { element: 'Email', ref: 'e5', text: 'prof.turing@gradem8.com' }),
  pw('take_screenshot', { filename: 'frontend-pr-110-abc1234/S03-fail.png' }),
  pw('console_messages'),
  pw('evaluate', { function: "() => { window.__origFetch = window.fetch; }" }),
  pw('network_requests'),
  pw('wait_for', { text: 'Mis Cursos' }),
  pw('close'),
  tool('mcp__github__get_pull_request'),
];

const browserDenied = [
  bash('gh pr comment 110 --repo grade-m8/frontend --body-file /tmp/grade-m8-review/x.md'),
  tool('mcp__github__add_issue_comment'),
  tool('Write', { file_path: '/tmp/grade-m8-review/frontend-pr-110.md' }),
  tool('Write', { file_path: `${PROJECT}/src/index.ts` }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/../CONVENTIONS.md` }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/run/x.sh` }),
  tool('Write', { file_path: `${CTX}/frontend-pr-110-abc1234-backend/firebase.json` }),
  tool('Write', { file_path: `${CTX}/frontend-pr-110-abc1234-backend/functions/src/index.ts` }),
  tool('Write', { file_path: '/Users/me/backend/firebase.review.json' }),
  bash('kill 34215'),
  bash('pkill -f uvicorn'),
  bash('lsof -ti :5001'),
  tool('Edit', { file_path: `${CTX}/frontend-pr-110-abc1234/src/App.tsx` }),
  bash('cd /Users/me'),
  bash('cd /tmp/grade-m8-review-ctx/../..'),
  bash('npm ci'),
  bash('npm install left-pad'),
  bash('npm --prefix /Users/me/backend run seed'),
  bash('npm --prefix /tmp/grade-m8-review-ctx/backend-dev run deploy'),
  bash(`npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth,firestore --project grade-prod-f94ca`),
  bash('npx --yes firebase-tools emulators:start --config /Users/me/backend/firebase.json --only auth --project demo-grade-m8'),
  bash('npx --yes firebase-tools emulators:start --only auth,firestore --project demo-grade-m8'),
  bash(`cd ${CTX}/backend-dev`),
  bash('npm ci --ignore-scripts'),
  bash(`npm --prefix ${CTX}/f run dev -- --port 5173 --strictPort --host 0.0.0.0`),
  bash('npm --prefix /Users/me/frontend run dev -- --port 5173 --strictPort'),
  bash('npx --no-install vite --port 5173 --strictPort'),
  bash('npx --yes firebase-tools deploy --project demo-grade-m8'),
  bash('npx vite build'),
  bash('PATH=/tmp/evil/bin:$PATH npx --yes firebase-tools deploy --project demo-grade-m8'),
  bash(`PATH=/tmp/grade-m8-review-ctx/frontend-pr-1/node_modules/bin:$PATH npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth --project demo-grade-m8`),
  bash(`PATH=/opt/x:/tmp/evil/bin:$PATH npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth --project demo-grade-m8`),
  bash('curl -sf https://evil.example.com/'),
  bash('curl -X POST http://localhost:5001/demo/us-central1/exams'),
  bash('curl -s http://localhost:5173/ -o /tmp/x'),
  bash('VITE_X=$(whoami) npx --no-install vite'),
  pw('navigate', { url: 'https://github.com/grade-m8/backend/settings' }),
  pw('navigate', { url: 'http://evil.example.com/' }),
  pw('navigate', { url: 'http://localhost.evil.com/' }),
  pw('run_code_unsafe', { code: "require('fs').writeFileSync('/x', 'y')" }),
  pw('file_upload', { paths: ['/Users/me/.ssh/id_rsa'] }),
  pw('drop', { paths: ['/etc/passwd'] }),
];

// Review mode must never run code or drive the browser.
const reviewDeniedBrowserOnly = [
  bash(`npx --yes firebase-tools emulators:start --config ${CTX}/b/firebase.json --only auth --project demo-grade-m8`),
  bash(`npm --prefix ${CTX}/b ci --ignore-scripts`),
  bash('curl -sf http://localhost:5173/'),
  pw('navigate', { url: 'http://localhost:5173/' }),
  tool('TaskStop', { task_id: 'x' }),
  tool('Write', { file_path: `${PROJECT}/review-artifacts/run/plan.md` }),
];

let failures = 0;
const check = (input, expectDenied, mode = 'review') => {
  const result = decide(input, mode, PROJECT);
  const isDenied = result?.hookSpecificOutput?.permissionDecision === 'deny';
  if (isDenied !== expectDenied) {
    failures += 1;
    console.error(`FAIL expected ${expectDenied ? 'deny' : 'allow'}: ${JSON.stringify(input)}`);
  }
};
allowed.forEach((input) => check(input, false));
denied.forEach((input) => check(input, true));
browserAllowed.forEach((input) => check(input, false, 'browser'));
browserDenied.forEach((input) => check(input, true, 'browser'));
reviewDeniedBrowserOnly.forEach((input) => check(input, true, 'review'));

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

const browserE2e = run({ REVIEW_MODE: 'browser' }, bash('gh pr comment 1 --repo grade-m8/frontend --body-file /tmp/grade-m8-review/x.md'));
assert.equal(JSON.parse(browserE2e.stdout).hookSpecificOutput.permissionDecision, 'deny', 'browser mode must never post');

const total = allowed.length + denied.length + browserAllowed.length + browserDenied.length + reviewDeniedBrowserOnly.length;
if (failures) {
  console.error(`${failures}/${total} decision checks failed`);
  process.exit(1);
}
console.log(`ok: ${total} decisions (review ${allowed.length}/${denied.length}, browser ${browserAllowed.length}/${browserDenied.length}, review-blocks-browser ${reviewDeniedBrowserOnly.length}), plus 5 end-to-end checks`);
