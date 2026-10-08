#!/usr/bin/env node
// Automated PR reviews with a human approval step.
//
//   node scripts/pr-inbox.mjs watch        poll for new PRs and review them (launchd runs this)
//   node scripts/pr-inbox.mjs list [--json] drafts waiting for approval (--json: for the menu bar app)
//   node scripts/pr-inbox.mjs show <id>    print a draft
//   node scripts/pr-inbox.mjs open <id>    open a draft in your editor to change it
//   node scripts/pr-inbox.mjs post <id>    post the (edited) draft to the PR
//   node scripts/pr-inbox.mjs discard <id> drop a draft without posting
//   node scripts/pr-inbox.mjs review <pr>  review a PR now (<pr> = backend#72 or an inbox id)
//   node scripts/pr-inbox.mjs install      run `watch` every 10 minutes (launchd)
//   node scripts/pr-inbox.mjs uninstall
//
// Backend PR:  /pr-review --hold.  Frontend PR: /pr-browser-test, then /pr-review --hold.
// Nothing reaches GitHub until you run `post`. See .claude/hooks/README.md ("Automated runs").

import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = join(ROOT, 'review-artifacts', 'inbox');
const STATE = join(INBOX, 'state.json');
const LOCK = join(INBOX, 'watch.lock');
const REPOS = ['backend', 'frontend'];
const BASES = ['dev', 'main'];
const LABEL = 'com.grade-m8.pr-inbox';
const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const MINUTE = 60_000;
// Every automated run (browser test, review and the review's subagents) uses this model and effort.
const REVIEW_MODEL = 'claude-sonnet-5-5';
const REVIEW_EFFORT = 'medium';

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function notify(title, message) {
  const q = (s) => JSON.stringify(String(s));
  spawnSync('osascript', ['-e', `display notification ${q(message)} with title ${q(title)} sound name "Glass"`]);
}

// --- items ------------------------------------------------------------------

const itemDir = (id) => join(INBOX, id);
const readItem = (id) => {
  const meta = join(itemDir(id), 'meta.json');
  if (!existsSync(meta)) throw new Error(`no inbox item "${id}" (see: pr-inbox list)`);
  return readJson(meta);
};
const saveItem = (item) => writeJson(join(itemDir(item.id), 'meta.json'), item);
const allItems = () =>
  existsSync(INBOX)
    ? readdirSync(INBOX, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(INBOX, d.name, 'meta.json')))
        .map((d) => readItem(d.name))
    : [];
const isAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
// A run killed hard (SIGKILL, crash) can't update its own status: show it as interrupted.
const statusOf = (item) => (item.status === 'running' && !(item.pid && isAlive(item.pid)) ? 'interrupted' : item.status);

const prLockFile = (repo, number) => join(INBOX, `review-${repo}-${number}.lock`);

function isPrLocked(repo, number) {
  const file = prLockFile(repo, number);
  if (!existsSync(file)) return false;
  try {
    const pid = Number(readFileSync(file, 'utf8').trim());
    if (pid && isAlive(pid)) return pid;
  } catch {}
  try { rmSync(file, { force: true }); } catch {}
  return false;
}

function acquirePrLock(repo, number) {
  mkdirSync(INBOX, { recursive: true });
  const file = prLockFile(repo, number);
  const activePid = isPrLocked(repo, number);
  if (activePid && activePid !== process.pid) {
    throw new Error(`la PR ${repo}#${number} ya se está revisando (PID ${activePid})`);
  }
  const running = allItems().find(
    (i) => i.repo === repo && String(i.number) === String(number) && statusOf(i) === 'running' && i.pid !== process.pid
  );
  if (running) {
    throw new Error(`la PR ${repo}#${number} ya se está revisando (PID ${running.pid})`);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        let existingPid = null;
        try { existingPid = Number(readFileSync(file, 'utf8').trim()); } catch {}
        if (existingPid && existingPid === process.pid) return;
        if (existingPid && isAlive(existingPid)) {
          throw new Error(`la PR ${repo}#${number} ya se está revisando (PID ${existingPid})`);
        }
        try { rmSync(file, { force: true }); } catch {}
      } else {
        throw err;
      }
    }
  }
}

function releasePrLock(repo, number) {
  try {
    const file = prLockFile(repo, number);
    if (existsSync(file)) {
      const pid = Number(readFileSync(file, 'utf8').trim());
      if (pid === process.pid) rmSync(file, { force: true });
    }
  } catch {}
}

// The browser test's run folder has the same name as the inbox id (frontend-pr-<n>-<sha7>).
// Screenshots are listed failures first, so they're the first thing you see.
function browserRun(id) {
  const run = join(ROOT, 'review-artifacts', id);
  if (!existsSync(run)) return {};
  const rank = (f) => (f.includes('-fail') ? 0 : f.includes('-layout-') ? 2 : 1);
  const screenshots = readdirSync(run)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((f) => join(run, f));
  const report = join(run, 'report.md');
  return { screenshots, ...(existsSync(report) && { report }) };
}

// A browser test can exit cleanly without testing anything (guard denial, port taken,
// stack down: every scenario `bloqueado`). Its report decides whether the review may run.
// Returns { ok, summary } or { ok: false, reason }.
function browserGate(reportText) {
  if (reportText === null) return { ok: false, reason: 'no dejó report.md' };
  const text = reportText.trim();
  if (/^sin cambios de UI\b/i.test(text)) return { ok: true, summary: text.split('\n')[0] };
  const line = text.match(/Resultado:\s*(\d+)\s*ok\s*·\s*(\d+)\s*fallas?\s*·\s*(\d+)\s*bloqueados?/i);
  if (!line) return { ok: false, reason: 'report.md sin línea "Resultado: <n> ok · <n> fallas · <n> bloqueados"' };
  const [ok, fallas, bloqueados] = line.slice(1).map(Number);
  if (bloqueados > 0) return { ok: false, reason: `${bloqueados} escenario(s) bloqueado(s), ver report.md` };
  if (ok + fallas === 0) return { ok: false, reason: 'no se ejecutó ningún escenario' };
  return { ok: true, summary: `${ok} ok · ${fallas} fallas` };
}

// --- watch ------------------------------------------------------------------

function openPrs(repo) {
  const json = gh('pr', 'list', '--repo', `grade-m8/${repo}`, '--state', 'open', '--limit', '100',
    '--json', 'number,title,url,author,headRefOid,isDraft,baseRefName');
  return JSON.parse(json).filter((pr) => !pr.isDraft && BASES.includes(pr.baseRefName));
}

function runClaude(prompt, flags, logFile, timeoutMin) {
  // Output goes straight to the log, so `tail -f` shows progress while the run is going.
  writeFileSync(logFile, `$ claude -p "${prompt}" ${flags.join(' ')}\n\n`);
  const fd = openSync(logFile, 'a');
  // No user settings: their hooks (e.g. RTK rewriting `find`/`grep` into filtered output) would change
  // what the session sees. The review guard lives in the project settings, so it still loads.
  const res = spawnSync('claude', ['-p', prompt, '--model', REVIEW_MODEL, '--effort', REVIEW_EFFORT,
    '--permission-mode', 'bypassPermissions', '--strict-mcp-config', '--setting-sources', 'project,local', ...flags], {
    cwd: ROOT, stdio: ['ignore', fd, fd], timeout: timeoutMin * MINUTE,
    env: { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: REVIEW_MODEL },
  });
  closeSync(fd);
  const lastLine = readFileSync(logFile, 'utf8').trim().split('\n').pop() ?? '';
  // Ctrl-C, terminal closed, `kill`…: claude may die on the signal or exit with 128+signal.
  // A timeout sets error instead, so it counts as a failure.
  const interrupted = (Boolean(res.signal) || res.status > 128) && !res.error;
  return { ok: res.status === 0, lastLine, interrupted, error: res.error?.message };
}

// Bypass mode is safe here only because the review guard hook allowlists every call and both skills
// abort unless the guard is live. Review sessions additionally can't post: `post` is the only way out.
// Each step runs only if the previous one succeeded. Returns false when a step failed.
function review(repo, pr) {
  acquirePrLock(repo, pr.number);
  const sha7 = pr.headRefOid.slice(0, 7);
  const id = `${repo}-pr-${pr.number}-${sha7}`;
  const dir = itemDir(id);
  mkdirSync(dir, { recursive: true });
  const previous = existsSync(join(dir, 'meta.json')) ? readItem(id) : null;
  const startedAt = Date.now();
  const item = {
    id, repo, number: pr.number, sha: pr.headRefOid, url: pr.url, title: pr.title,
    author: pr.author?.login, status: 'running', pid: process.pid, createdAt: new Date(startedAt).toISOString(),
  };
  saveItem(item);
  log(`reviewing ${id}: ${pr.title} (log: review-artifacts/inbox/${id}/)`);

  // Stopped midway: keep the draft an earlier run of this same commit left, if any.
  const stop = () => {
    const hasDraft = existsSync(join(dir, 'comment.md'));
    Object.assign(item, hasDraft && previous?.verdict
      ? { status: 'pending', verdict: previous.verdict, summary: previous.summary }
      : { status: 'interrupted' });
    delete item.pid;
    saveItem(item);
    releasePrLock(repo, pr.number);
    log(`${id}: interrupted — ${item.status}`);
    process.exit(130);
  };

  // A step failed (crash, timeout, usage limit…): skip the rest of the pipeline.
  const fail = (step, logName, reason) => {
    Object.assign(item, { status: 'failed', summary: `${step} falló: ${reason}` });
    delete item.pid;
    saveItem(item);
    notify(`PR ${repo}#${pr.number}: ${step} falló`, `Log: review-artifacts/inbox/${id}/${logName}`);
    log(`${id}: failed — ${item.summary}`);
    return false;
  };

  try {
    if (repo === 'frontend') {
      const b = runClaude(`/pr-browser-test ${pr.url}`, [
        '--settings', '.claude/browser-test.settings.json',
        '--mcp-config', '.claude/browser-test.mcp.json',
      ], join(dir, 'browser-test.log'), 60);
      if (b.interrupted) stop();
      if (!b.ok) return fail('la prueba en navegador', 'browser-test.log', b.error ?? b.lastLine);
      const { report } = browserRun(id);
      const gate = browserGate(report ? readFileSync(report, 'utf8') : null);
      if (!gate.ok) return fail('la prueba en navegador', 'browser-test.log', gate.reason);
      item.browserTest = gate.summary;
    }

    const r = runClaude(`/pr-review ${pr.url} --hold`, [
      '--settings', '.claude/review-mode.settings.json',
      '--disallowedTools', 'Bash(gh pr comment *)',
    ], join(dir, 'review.log'), 30);
    if (r.interrupted) stop();
    if (!r.ok) return fail('la revisión', 'review.log', r.error ?? r.lastLine);
    item.summary = r.lastLine;
    delete item.pid;

    // Only a draft written by this run counts: /tmp may hold one from an earlier manual review.
    const draft = `/tmp/grade-m8-review/${id}.md`;
    if (existsSync(draft) && statSync(draft).mtimeMs >= startedAt) {
      copyFileSync(draft, join(dir, 'comment.md'));
      const verdict = readFileSync(draft, 'utf8').match(/\*\*Veredicto:\*\*\s*([^·\n]+)/);
      item.verdict = verdict ? verdict[1].trim() : '?';
      item.status = 'pending';
      notify(`PR ${repo}#${pr.number}: ${item.verdict}`, `${pr.title} — revisá el borrador: pr-inbox show ${id}`);
    } else {
      item.status = 'skipped'; // training ticket, draft, already reviewed…: the reason is in summary
    }
    saveItem(item);
    log(`${id}: ${item.status} — ${item.summary}`);
    return true;
  } finally {
    releasePrLock(repo, pr.number);
  }
}

function watch() {
  mkdirSync(INBOX, { recursive: true });
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8'));
    try { process.kill(pid, 0); return log(`another watch is running (pid ${pid})`); } catch { /* stale lock */ }
  }
  writeFileSync(LOCK, String(process.pid));
  try {
    const firstRun = !existsSync(STATE);
    const state = readJson(STATE, { seen: {} });
    for (const repo of REPOS) {
      for (const pr of openPrs(repo)) {
        const key = `${repo}#${pr.number}`;
        if (state.seen[key]) continue;
        if (isPrLocked(repo, pr.number)) {
          log(`saltando ${repo}#${pr.number}: ya hay una revisión en curso`);
          continue;
        }
        // One review per PR, when it's first opened (or leaves draft). Use `review` after new commits.
        // On the very first run, PRs that are already open are recorded, not reviewed.
        const ok = firstRun || review(repo, pr);
        // Marked seen even when it failed, so the next check doesn't retry it on its own; `review` re-runs it.
        state.seen[key] = { sha: pr.headRefOid, at: new Date().toISOString() };
        writeJson(STATE, state);
        // A failure (often the usage limit) would repeat on every remaining PR: leave them for the next check.
        if (!ok) return log(`deteniendo: ${key} falló, el resto queda para la próxima revisión`);
      }
    }
    if (firstRun) log(`first run: recorded ${Object.keys(state.seen).length} open PRs without reviewing them`);
  } finally {
    rmSync(LOCK, { force: true });
  }
}

// --- approval ---------------------------------------------------------------

function list(json) {
  const items = allItems().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (json) {
    return console.log(JSON.stringify(items.map((i) => ({ ...i, status: statusOf(i), dir: itemDir(i.id), ...browserRun(i.id) }))));
  }
  if (!items.length) return console.log('Inbox vacío.');
  for (const i of items) {
    const verdict = i.verdict ? ` [${i.verdict}]` : '';
    console.log(`${statusOf(i).padEnd(11)} ${i.id}${verdict}  ${i.title}`);
  }
}

function post(id, force) {
  const item = readItem(id);
  if (item.status !== 'pending') throw new Error(`${id} is ${item.status}, not pending`);
  const pr = JSON.parse(gh('pr', 'view', String(item.number), '--repo', `grade-m8/${item.repo}`, '--json', 'headRefOid,state'));
  if (pr.state !== 'OPEN') throw new Error(`PR is ${pr.state}; not posting`);
  if (pr.headRefOid !== item.sha && !force) {
    throw new Error(`the PR has new commits since this review (${pr.headRefOid.slice(0, 7)}). ` +
      `Run \`pr-inbox review ${id}\`, or \`post ${id} --force\` to post the old review anyway.`);
  }
  const body = join(itemDir(id), 'comment.md');
  if (!readFileSync(body, 'utf8').trimEnd().endsWith('-->')) {
    throw new Error('the ai-review marker must stay the last line of comment.md');
  }
  const url = gh('pr', 'comment', String(item.number), '--repo', `grade-m8/${item.repo}`, '--body-file', body).trim();
  Object.assign(item, { status: 'posted', postedAt: new Date().toISOString(), commentUrl: url });
  saveItem(item);
  console.log(`Publicado: ${url}`);
}

// Review a PR on demand: one opened before the watcher, or one with new commits since its review.
function reviewNow(ref, force = false) {
  const m = ref.match(/^(backend|frontend)#(\d+)$/);
  const old = m ? null : readItem(ref);
  const [repo, number] = m ? [m[1], m[2]] : [old.repo, String(old.number)];
  const num = Number(number);

  acquirePrLock(repo, num);

  const otherRunning = allItems().find(
    (i) => (i.repo !== repo || String(i.number) !== String(number)) && statusOf(i) === 'running'
  );
  if (otherRunning && !force) {
    releasePrLock(repo, num);
    throw new Error(
      `ya hay otra revisión en curso (${otherRunning.repo}#${otherRunning.number}, PID ${otherRunning.pid}). ` +
      `Esperá a que termine para no saturar la cuota de tokens, o usá \`pr-inbox review ${ref} --force\` para forzarla.`
    );
  }

  try {
    const pr = JSON.parse(gh('pr', 'view', number, '--repo', `grade-m8/${repo}`,
      '--json', 'number,title,url,author,headRefOid,isDraft,baseRefName'));
    for (const i of allItems()) {
      if (i.repo === repo && i.number === pr.number && i.status === 'pending') saveItem({ ...i, status: 'discarded' });
    }
    mkdirSync(INBOX, { recursive: true });
    if (!review(repo, pr)) process.exitCode = 1;
  } finally {
    releasePrLock(repo, num);
  }
}

// --- launchd ----------------------------------------------------------------

function install() {
  const node = process.execPath;
  const path = [dirname(node), join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':');
  mkdirSync(INBOX, { recursive: true });
  writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${node}</string><string>${join(ROOT, 'scripts', 'pr-inbox.mjs')}</string><string>watch</string></array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${path}</string></dict>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${join(INBOX, 'watch.log')}</string>
  <key>StandardErrorPath</key><string>${join(INBOX, 'watch.log')}</string>
</dict>
</plist>
`);
  const domain = `gui/${process.getuid()}`;
  spawnSync('launchctl', ['bootout', `${domain}/${LABEL}`]);
  execFileSync('launchctl', ['bootstrap', domain, PLIST]);
  console.log(`Installed ${PLIST}. Checks every 10 minutes; log: review-artifacts/inbox/watch.log`);
}

function uninstall() {
  spawnSync('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`]);
  rmSync(PLIST, { force: true });
  console.log('Uninstalled.');
}

// --- cli --------------------------------------------------------------------

// Ctrl-C / closing the terminal also stops the claude child; ignoring it here lets review() see
// that and save the item's status instead of dying with it stuck on "running".
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => {});

const [cmd, id, ...rest] = process.argv.slice(2);
const needId = () => { if (!id) throw new Error(`usage: pr-inbox ${cmd} <id>`); return id; };
try {
  switch (cmd) {
    case 'watch': watch(); break;
    case 'list': case undefined: list(id === '--json'); break;
    case 'show': readItem(needId()); console.log(readFileSync(join(itemDir(id), 'comment.md'), 'utf8')); break;
    case 'open': readItem(needId()); spawnSync('open', ['-t', join(itemDir(id), 'comment.md')]); break;
    case 'post': post(needId(), rest.includes('--force')); break;
    case 'discard': saveItem({ ...readItem(needId()), status: 'discarded' }); console.log('Descartado.'); break;
    case 'review': reviewNow(needId(), rest.includes('--force')); break;
    case 'install': install(); break;
    case 'uninstall': uninstall(); break;
    default: throw new Error(`unknown command "${cmd}"`);
  }
} catch (err) {
  console.error(`pr-inbox: ${err.message}`);
  process.exit(1);
}
