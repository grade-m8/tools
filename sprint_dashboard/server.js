const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3333;
const ROOT_DIR = path.resolve(__dirname, '../../');
const TICKETS_DIR = path.resolve(ROOT_DIR, 'next_tickets');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

let githubCache = {
  data: null,
  timestamp: 0,
};

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }
  const rawMeta = match[1];
  const body = match[2];
  const metadata = {};

  rawMeta.split(/\r?\n/).forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith('[') && val.endsWith(']')) {
      try {
        val = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    } else if (!isNaN(Number(val)) && val !== '') {
      val = Number(val);
    }
    metadata[key] = val;
  });

  return { metadata, body };
}

function getAllMarkdownFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMarkdownFiles(fullPath));
    } else if (file.endsWith('.md') && !file.includes('PLAN') && !file.includes('GAP')) {
      results.push(fullPath);
    }
  });
  return results;
}

function loadLocalTickets() {
  const files = getAllMarkdownFiles(TICKETS_DIR);
  return files.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const parts = relPath.split('/');
    const folder = parts.length > 2 ? parts[1] : 'root';
    return {
      ...metadata,
      folder,
      filePath: relPath,
      body,
    };
  }).filter((t) => t && t.id);
}

function runCommandAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.warn(`Command failed: ${cmd}`, err.message);
        resolve('');
      } else {
        resolve(stdout || '');
      }
    });
  });
}

async function fetchGitHubLive() {
  const [projectOut, frontOut, backOut] = await Promise.all([
    runCommandAsync('gh project item-list 1 --owner grade-m8 --format json --limit 200'),
    runCommandAsync('gh issue list --repo grade-m8/frontend --state open --json number,title,assignees,url'),
    runCommandAsync('gh issue list --repo grade-m8/backend --state open --json number,title,assignees,url'),
  ]);

  let projectItems = [];
  try {
    const p = JSON.parse(projectOut);
    projectItems = p.items || [];
  } catch {}

  let frontOpen = [];
  try { frontOpen = JSON.parse(frontOut); } catch {}

  let backOpen = [];
  try { backOpen = JSON.parse(backOut); } catch {}

  const kanbanMap = {};
  projectItems.forEach((item) => {
    const content = item.content || {};
    const repo = (content.repository || '').split('/').pop();
    const number = content.number;
    if (repo && number) {
      kanbanMap[`${repo}#${number}`] = {
        id: item.id,
        status: item.status || 'No Status',
        assignees: item.assignees || [],
        title: item.title,
        updatedAt: item.updatedAt,
      };
    }
  });

  const liveData = {
    projectItemsCount: projectItems.length,
    kanbanMap,
    frontOpenCount: frontOpen.length,
    backOpenCount: backOpen.length,
    fetchedAt: new Date().toISOString(),
  };

  githubCache.data = liveData;
  githubCache.timestamp = Date.now();
  return liveData;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/tickets') {
    try {
      const tickets = loadLocalTickets();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(tickets));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/github-live') {
    const force = url.searchParams.get('force') === 'true';
    if (!force && githubCache.data && Date.now() - githubCache.timestamp < 30000) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(githubCache.data));
      return;
    }

    try {
      const live = await fetchGitHubLive();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(live));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/overview') {
    try {
      const tickets = loadLocalTickets();
      let live = githubCache.data;
      if (!live) {
        live = await fetchGitHubLive();
      }

      const devSummary = {
        Tomi: { name: 'Tomi Bregoli', gh: 'tomibrg', hours: 0, sprintHours: 0, ticketsCount: 0, sprintTicketsCount: 0, tickets: [] },
        Facu: { name: 'Facu García', gh: 'Facugarciar0805', hours: 0, sprintHours: 0, ticketsCount: 0, sprintTicketsCount: 0, tickets: [] },
        Lulo: { name: 'Luciano Renkine', gh: 'LucianoRenkine', hours: 0, sprintHours: 0, ticketsCount: 0, sprintTicketsCount: 0, tickets: [] },
        Unassigned: { name: 'Sin Asignar (Batch)', gh: '', hours: 0, sprintHours: 0, ticketsCount: 0, sprintTicketsCount: 0, tickets: [] },
      };

      tickets.forEach((t) => {
        let devKey = 'Unassigned';
        const assignee = (t.assignee_local || '').toLowerCase();
        if (assignee.includes('tomi') || assignee.includes('tomas') || assignee.includes('tomás') || assignee.includes('bregoli')) devKey = 'Tomi';
        else if (assignee.includes('facu') || assignee.includes('garcia') || assignee.includes('garcía')) devKey = 'Facu';
        else if (assignee.includes('lulo') || assignee.includes('luciano') || assignee.includes('renkine')) devKey = 'Lulo';

        const isNextSprint = (t.sprint || '').startsWith('Sprint 22/10');
        const h = Number(t.hours) || 0;

        devSummary[devKey].hours += h;
        devSummary[devKey].ticketsCount += 1;
        devSummary[devKey].tickets.push(t);

        if (isNextSprint) {
          devSummary[devKey].sprintHours += h;
          devSummary[devKey].sprintTicketsCount += 1;
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        totalTickets: tickets.length,
        devSummary,
        liveKanban: live,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files serving
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Grade-M8 Sprint Hub & Live Kanban Bridge activo!`);
  console.log(`🌐 Accedé desde tu navegador en: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
