// Grade-M8 Sprint Hub & Live Kanban Bridge Client Application

let allTickets = [];
let liveKanban = null;
let currentTab = 'devs-board';
let activeTicket = null;
let selectedFolder = 'sprint_29_03_nov'; // Default to the newly created Sprint (29/10 - 05/11)

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const searchInput = document.getElementById('input-search');
const moduleSelect = document.getElementById('select-filter-module');
const btnSyncLive = document.getElementById('btn-sync-live');
const syncBtnLabel = document.getElementById('sync-btn-label');
const githubStatusText = document.getElementById('github-status-text');

// Drawer Elements
const drawerOverlay = document.getElementById('ticket-drawer-overlay');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const drawerTag = document.getElementById('drawer-tag');
const drawerHours = document.getElementById('drawer-hours');
const drawerStatus = document.getElementById('drawer-status');
const drawerTitle = document.getElementById('drawer-title');
const drawerDev = document.getElementById('drawer-dev');
const drawerSprint = document.getElementById('drawer-sprint');
const drawerModule = document.getElementById('drawer-module');
const drawerLayer = document.getElementById('drawer-layer');
const drawerDeps = document.getElementById('drawer-deps');
const drawerBlocks = document.getElementById('drawer-blocks');
const drawerGhLink = document.getElementById('drawer-gh-link');
const btnCopyMarkdown = document.getElementById('btn-copy-markdown');
const drawerRenderedMarkdown = document.getElementById('drawer-rendered-markdown');

// Initialize
async function init() {
  setupEventListeners();
  await refreshData(false);
}

// Event Listeners
function setupEventListeners() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });

  // Folder Pills Event Listeners
  const folderPills = document.querySelectorAll('.folder-pill');
  folderPills.forEach(pill => {
    pill.addEventListener('click', () => {
      folderPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedFolder = pill.getAttribute('data-folder');
      renderDeveloperBoard();
      filterCards();
    });
  });

  searchInput.addEventListener('input', () => filterCards());
  moduleSelect.addEventListener('change', () => filterCards());

  btnSyncLive.addEventListener('click', async () => {
    await refreshData(true);
  });

  btnCloseDrawer.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) closeDrawer();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  btnCopyMarkdown.addEventListener('click', () => {
    if (!activeTicket) return;
    navigator.clipboard.writeText(activeTicket.body || '').then(() => {
      const originalText = btnCopyMarkdown.innerHTML;
      btnCopyMarkdown.innerHTML = '✅ ¡Copiado al Portapapeles!';
      btnCopyMarkdown.style.background = '#10B981';
      setTimeout(() => {
        btnCopyMarkdown.innerHTML = originalText;
        btnCopyMarkdown.style.background = '';
      }, 2000);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  tabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
  tabPanes.forEach(p => p.classList.toggle('active', p.id === `pane-${tabId}`));
}

// Data Fetching
async function refreshData(force = false) {
  try {
    syncBtnLabel.textContent = 'Sincronizando...';
    btnSyncLive.style.opacity = '0.6';

    const [ticketsRes, liveRes] = await Promise.all([
      fetch('/api/tickets'),
      fetch(`/api/github-live${force ? '?force=true' : ''}`)
    ]);

    allTickets = await ticketsRes.json();
    liveKanban = await liveRes.json();

    // Normalize folder property defensively
    allTickets.forEach(t => {
      if (!t.folder) {
        const parts = (t.filePath || '').replace(/\\/g, '/').split('/');
        t.folder = parts.length > 1 ? parts[1] : 'root';
      }
    });

    // Update Folder Pills Counts
    const count29 = allTickets.filter(t => t.folder === 'sprint_29_03_nov').length;
    const count22 = allTickets.filter(t => t.folder === 'sprint_22_29_oct').length;
    const countActive = allTickets.filter(t => t.folder === 'active_sprint').length;
    const countTotal = allTickets.length;

    const elPill29 = document.getElementById('count-pill-29-03');
    const elPill22 = document.getElementById('count-pill-22-29');
    const elPillActive = document.getElementById('count-pill-active');
    const elPillAll = document.getElementById('count-pill-all');
    const elTabAll = document.getElementById('tab-count-all');
    const elCatTotal = document.getElementById('catalog-total-count');

    if (elPill29) elPill29.textContent = count29;
    if (elPill22) elPill22.textContent = count22;
    if (elPillActive) elPillActive.textContent = countActive;
    if (elPillAll) elPillAll.textContent = countTotal;
    if (elTabAll) elTabAll.textContent = countTotal;
    if (elCatTotal) elCatTotal.textContent = `${countTotal} tickets`;

    githubStatusText.textContent = `GitHub Project 1: Conectado (${liveKanban.projectItemsCount} items)`;
    const elBridgeSync = document.getElementById('bridge-last-sync');
    if (elBridgeSync) elBridgeSync.textContent = `Actualizado ${new Date().toLocaleTimeString('es-AR')}`;

    renderAll();
  } catch (err) {
    console.error('Error fetching data:', err);
    githubStatusText.textContent = 'Error de conexión con GitHub';
  } finally {
    syncBtnLabel.textContent = 'Sincronizar Live';
    btnSyncLive.style.opacity = '1';
  }
}

// Render Master
function renderAll() {
  renderDeveloperBoard();
  renderKanbanBridge();
  renderAllTicketsTable();
  renderDiscrepancies();
}

// 1. Render Developer Board (Filtrado por Carpeta / Sprint)
function renderDeveloperBoard() {
  const activeSprintList = document.getElementById('active-sprint-list');
  const activeSprintContainer = document.getElementById('active-sprint-container');
  const listTomi = document.getElementById('list-tomi');
  const listFacu = document.getElementById('list-facu');
  const listLulo = document.getElementById('list-lulo');

  if (activeSprintList) activeSprintList.innerHTML = '';
  listTomi.innerHTML = '';
  listFacu.innerHTML = '';
  listLulo.innerHTML = '';

  // Banner Header Dynamic Text
  const sprintTitle = document.getElementById('sprint-banner-title');
  const sprintDesc = document.getElementById('sprint-banner-desc');
  const sprintBadge = document.getElementById('sprint-banner-badge');

  if (selectedFolder === 'sprint_29_03_nov') {
    if (sprintTitle) sprintTitle.textContent = 'Sprint Plan: 29 de Octubre al 5 de Noviembre de 2026';
    if (sprintDesc) sprintDesc.innerHTML = '<strong>18.0 horas comprometidas</strong> (6.0 hs c/u: Tomi, Facu, Lulo) en <strong>11 tickets</strong> · Cierre de Exámenes, Aprobación Individual y Reintentos Masivos.';
    if (sprintBadge) sprintBadge.textContent = 'Sprint 29/10 - 05/11';
    if (activeSprintContainer) activeSprintContainer.style.display = 'none';
  } else if (selectedFolder === 'sprint_22_29_oct') {
    if (sprintTitle) sprintTitle.textContent = 'Sprint Plan: 22 de Octubre al 29 de Octubre de 2026';
    if (sprintDesc) sprintDesc.innerHTML = '<strong>18.0 horas comprometidas</strong> (6.0 hs c/u: Tomi, Facu, Lulo) en <strong>12 tickets</strong> · Reintentos de Corrección y Banco de Pruebas IA.';
    if (sprintBadge) sprintBadge.textContent = 'Semana Clave (22-29 Oct)';
    if (activeSprintContainer) activeSprintContainer.style.display = 'block';
  } else if (selectedFolder === 'active_sprint') {
    if (sprintTitle) sprintTitle.textContent = 'Sprint Actual en Curso (Tareas Previas)';
    if (sprintDesc) sprintDesc.innerHTML = 'Tareas activas de semanas previas en ejecución hasta el inicio formal de los sprints planificados.';
    if (sprintBadge) sprintBadge.textContent = 'Sprint Activo';
    if (activeSprintContainer) activeSprintContainer.style.display = 'block';
  } else {
    if (sprintTitle) sprintTitle.textContent = 'Todos los Sprints y Tareas Planificadas';
    if (sprintDesc) sprintDesc.innerHTML = `Visualización consolidada de <strong>${allTickets.length} tickets</strong> en todas las carpetas del repositorio.`;
    if (sprintBadge) sprintBadge.textContent = 'Vista Consolidada';
    if (activeSprintContainer) activeSprintContainer.style.display = 'block';
  }

  // 1. Active Sprint (tareas en curso hasta 22/10)
  const activeTickets = allTickets.filter(t => t.folder === 'active_sprint');
  if (activeSprintList) {
    activeTickets.forEach(ticket => {
      const card = createActiveTicketCard(ticket);
      activeSprintList.appendChild(card);
    });
    const pill = document.getElementById('active-tickets-pill');
    if (pill) {
      pill.textContent = `${activeTickets.length} ticket${activeTickets.length !== 1 ? 's' : ''} activo${activeTickets.length !== 1 ? 's' : ''} en Todo`;
    }
  }

  // 2. Tickets according to selected folder
  let sprintTickets = [];
  if (selectedFolder === 'all') {
    sprintTickets = allTickets;
  } else {
    sprintTickets = allTickets.filter(t => t.folder === selectedFolder);
  }

  let countTomi = 0, countFacu = 0, countLulo = 0;
  let hoursTomi = 0, hoursFacu = 0, hoursLulo = 0;

  sprintTickets.forEach(ticket => {
    const card = createTicketCard(ticket);
    const dev = (ticket.assignee_local || '').toLowerCase();
    const h = Number(ticket.hours) || 0;

    if (dev.includes('tomi') || dev.includes('tomas') || dev.includes('tomás') || dev.includes('bregoli')) {
      listTomi.appendChild(card);
      countTomi++;
      hoursTomi += h;
    } else if (dev.includes('facu') || dev.includes('garcia') || dev.includes('garcía')) {
      listFacu.appendChild(card);
      countFacu++;
      hoursFacu += h;
    } else if (dev.includes('lulo') || dev.includes('luciano') || dev.includes('renkine')) {
      listLulo.appendChild(card);
      countLulo++;
      hoursLulo += h;
    }
  });

  // Update counters and hours in dev column headers
  const elCountTomi = document.getElementById('count-tomi');
  const elCountFacu = document.getElementById('count-facu');
  const elCountLulo = document.getElementById('count-lulo');
  if (elCountTomi) elCountTomi.textContent = `${countTomi} ticket${countTomi !== 1 ? 's' : ''}`;
  if (elCountFacu) elCountFacu.textContent = `${countFacu} ticket${countFacu !== 1 ? 's' : ''}`;
  if (elCountLulo) elCountLulo.textContent = `${countLulo} ticket${countLulo !== 1 ? 's' : ''}`;

  const elHoursTomi = document.getElementById('hours-tomi');
  const elHoursFacu = document.getElementById('hours-facu');
  const elHoursLulo = document.getElementById('hours-lulo');
  if (elHoursTomi) elHoursTomi.textContent = hoursTomi.toFixed(1);
  if (elHoursFacu) elHoursFacu.textContent = hoursFacu.toFixed(1);
  if (elHoursLulo) elHoursLulo.textContent = hoursLulo.toFixed(1);

  // Update dev card footers and progress bars
  const folderLabel = selectedFolder === 'sprint_29_03_nov' ? 'Sprint 29/10-05/11' :
                      selectedFolder === 'sprint_22_29_oct' ? 'Sprint 22-29/10' :
                      selectedFolder === 'active_sprint' ? 'Sprint Activo' : 'Todas las carpetas';

  const devsData = [
    { key: 'tomi', hours: hoursTomi, count: countTomi },
    { key: 'facu', hours: hoursFacu, count: countFacu },
    { key: 'lulo', hours: hoursLulo, count: countLulo },
  ];
  devsData.forEach(d => {
    const elCount = document.getElementById(`metric-count-${d.key}`);
    const elProg = document.getElementById(`progress-${d.key}`);
    const elStat = document.getElementById(`metric-status-${d.key}`);
    if (elCount) elCount.textContent = `${d.count} tickets (${folderLabel})`;
    if (elProg) elProg.style.width = `${Math.min(100, Math.round((d.hours / 6.0) * 100))}%`;
    if (elStat) {
      if (d.hours === 6.0) {
        elStat.textContent = 'Balance 100%';
        elStat.className = 'status-indicator';
      } else if (d.hours < 6.0) {
        elStat.textContent = `${(6.0 - d.hours).toFixed(1)}h pendientes`;
        elStat.className = 'status-indicator';
      } else {
        elStat.textContent = `${(d.hours - 6.0).toFixed(1)}h extra`;
        elStat.className = 'status-indicator danger';
      }
    }
  });

  // Dynamic Total Card Update
  const totalHours = hoursTomi + hoursFacu + hoursLulo;
  const totalTickets = countTomi + countFacu + countLulo;
  const elHoursTotal = document.getElementById('hours-total');
  const elCountTotal = document.getElementById('count-total');
  const elProgressTotal = document.getElementById('progress-total');
  const elStatusTotal = document.getElementById('status-total');
  const elMetricTotalTitle = document.getElementById('metric-title-total');

  if (elMetricTotalTitle) elMetricTotalTitle.textContent = folderLabel;
  if (elHoursTotal) elHoursTotal.textContent = totalHours.toFixed(1);
  if (elCountTotal) elCountTotal.textContent = `${totalTickets} ticket${totalTickets !== 1 ? 's' : ''} asignado${totalTickets !== 1 ? 's' : ''}`;
  if (elProgressTotal) {
    const targetHours = selectedFolder === 'all' ? (totalHours > 0 ? totalHours : 18.0) : 18.0;
    const pct = Math.min(100, Math.round((totalHours / targetHours) * 100));
    elProgressTotal.style.width = `${pct}%`;
  }
  if (elStatusTotal) {
    if (totalHours === 18.0) {
      elStatusTotal.textContent = 'Optimizada';
      elStatusTotal.className = 'status-indicator success';
    } else if (totalHours < 18.0) {
      elStatusTotal.textContent = `${(18.0 - totalHours).toFixed(1)}h pendientes`;
      elStatusTotal.className = 'status-indicator';
    } else {
      elStatusTotal.textContent = `${(totalHours - 18.0).toFixed(1)}h sobrecarga`;
      elStatusTotal.className = 'status-indicator danger';
    }
  }

  filterCards();
}

function createActiveTicketCard(ticket) {
  const card = document.createElement('div');
  card.className = 'active-card';
  card.setAttribute('data-id', ticket.id || '');
  card.setAttribute('data-module', ticket.module || '');
  card.setAttribute('data-dev', ticket.assignee_local || '');
  card.setAttribute('data-title', ticket.title || '');

  const liveInfo = liveKanban && liveKanban.kanbanMap ? liveKanban.kanbanMap[ticket.id] : null;
  const kanbanStatus = liveInfo ? liveInfo.status : (ticket.kanban_status || 'Todo');

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span class="ticket-id" style="color:#fbbf24; font-weight:700;">${ticket.id}</span>
      <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight:700;">
        ⚡ Estado: ${kanbanStatus} · ⏱️ ${ticket.hours}h
      </span>
    </div>
    <div style="color:#f8fafc; font-weight:600; font-size:0.88rem; line-height:1.35;">${ticket.title}</div>
    <div style="display:flex; gap:8px; align-items:center; font-size:0.75rem; color:#94a3b8; margin-top:4px;">
      <span style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">👤 Asignado: Tomi Bregoli</span>
      <span style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">📦 Mod ${ticket.module} (${ticket.layer})</span>
      <span style="color:#38bdf8; margin-left:auto; text-decoration:underline;">Ver detalle ↗</span>
    </div>
  `;

  card.addEventListener('click', () => openDrawer(ticket));
  return card;
}

function createTicketCard(ticket) {
  const card = document.createElement('div');
  card.className = 'ticket-card';
  card.setAttribute('data-id', ticket.id || '');
  card.setAttribute('data-module', ticket.module || '');
  card.setAttribute('data-dev', ticket.assignee_local || '');
  card.setAttribute('data-title', ticket.title || '');

  // Match with live kanban
  const liveInfo = liveKanban && liveKanban.kanbanMap ? liveKanban.kanbanMap[ticket.id] : null;
  const kanbanStatus = liveInfo ? liveInfo.status : (ticket.kanban_status || 'Backlog');
  const isLinked = !!liveInfo;

  let kanbanClass = 'kanban-backlog';
  if (!isLinked) kanbanClass = 'kanban-unlinked';
  else if (kanbanStatus === 'Todo') kanbanClass = 'kanban-todo';
  else if (kanbanStatus === 'Next Week') kanbanClass = 'kanban-next-week';

  const depsCount = (ticket.dependencies || []).length;
  const blocksCount = (ticket.blocks || []).length;

  let depHtml = '';
  if (blocksCount > 0) {
    depHtml += `<div class="dep-badge blocking">🔒 Bloquea a: ${ticket.blocks.map(b => `<span class="chip-tag">${b}</span>`).join(' ')}</div>`;
  }
  if (depsCount > 0) {
    depHtml += `<div class="dep-badge blocked">⛔ Bloqueado por: ${ticket.dependencies.map(d => `<span class="chip-tag">${d}</span>`).join(' ')}</div>`;
  }
  if (depsCount === 0 && blocksCount === 0) {
    depHtml += `<div class="dep-badge ready">🟢 Sin bloqueos (Listo para arrancar)</div>`;
  }

  const folderTag = ticket.folder ? `<span class="meta-tag tag-folder">📁 ${ticket.folder}</span>` : '';

  card.innerHTML = `
    <div class="ticket-top">
      <span class="ticket-id">${ticket.id}</span>
      <span class="ticket-hours-badge">⏱️ ${ticket.hours}h</span>
    </div>
    <div class="ticket-title">${ticket.title}</div>
    <div class="ticket-meta-row">
      <span class="meta-tag tag-module">Mod ${ticket.module}</span>
      <span class="meta-tag tag-layer">${ticket.layer}</span>
      ${folderTag}
      <span class="meta-tag tag-kanban ${kanbanClass}">${isLinked ? kanbanStatus : 'No en Project 1'}</span>
    </div>
    <div class="ticket-deps">
      ${depHtml}
    </div>
  `;

  card.addEventListener('click', () => openDrawer(ticket));
  return card;
}

// 2. Render Kanban Bridge
function renderKanbanBridge() {
  const containerBacklog = document.getElementById('bridge-cards-backlog');
  const containerNextWeek = document.getElementById('bridge-cards-next-week');
  const containerTodo = document.getElementById('bridge-cards-todo');
  const containerProgress = document.getElementById('bridge-cards-in-progress');
  const containerReview = document.getElementById('bridge-cards-in-review');

  if (containerBacklog) containerBacklog.innerHTML = '';
  if (containerNextWeek) containerNextWeek.innerHTML = '';
  if (containerTodo) containerTodo.innerHTML = '';
  if (containerProgress) containerProgress.innerHTML = '';
  if (containerReview) containerReview.innerHTML = '';

  let countBacklog = 0;
  let countNextWeek = 0;
  let countTodo = 0;
  let countProgress = 0;
  let countReview = 0;

  if (!liveKanban || !liveKanban.kanbanMap) return;

  Object.entries(liveKanban.kanbanMap).forEach(([tag, item]) => {
    const card = document.createElement('div');
    card.className = 'bridge-card';

    // Match with local ticket metadata
    const local = allTickets.find(t => t.id === tag);
    const hours = local ? `${local.hours}h` : '';
    const assigneePlanned = local ? local.assignee_local : '';
    const assigneesActual = (item.assignees || []).join(', ') || 'Sin asignar';

    let diffWarning = '';
    if (local && local.assignee_github_planned && !item.assignees.includes(local.assignee_github_planned)) {
      diffWarning = `<span style="color: #fbbf24; font-size: 0.7rem; font-weight: 600;">⚠️ Plan: ${assigneePlanned}</span>`;
    }

    let bridgeDepHtml = '';
    if (local) {
      if ((local.blocks || []).length > 0) {
        bridgeDepHtml = `<div class="dep-badge blocking" style="margin-top:6px;">🔒 Bloquea: ${local.blocks.join(', ')}</div>`;
      } else if ((local.dependencies || []).length > 0) {
        bridgeDepHtml = `<div class="dep-badge blocked" style="margin-top:6px;">⛔ Bloqueado por: ${local.dependencies.join(', ')}</div>`;
      }
    }

    card.innerHTML = `
      <div class="bridge-card-top">
        <span class="ticket-id">${tag}</span>
        ${hours ? `<span class="ticket-hours-badge">${hours}</span>` : ''}
      </div>
      <div class="bridge-card-title">${item.title}</div>
      <div class="bridge-card-assignee">
        👤 GitHub: ${assigneesActual} ${diffWarning}
      </div>
      ${bridgeDepHtml}
    `;

    if (local) {
      card.addEventListener('click', () => openDrawer(local));
    }

    if (item.status === 'Next Week') {
      if (containerNextWeek) containerNextWeek.appendChild(card);
      countNextWeek++;
    } else if (item.status === 'Todo') {
      if (containerTodo) containerTodo.appendChild(card);
      countTodo++;
    } else if (item.status === 'In Progress') {
      if (containerProgress) containerProgress.appendChild(card);
      countProgress++;
    } else if (item.status === 'In Review') {
      if (containerReview) containerReview.appendChild(card);
      countReview++;
    } else {
      if (containerBacklog) containerBacklog.appendChild(card);
      countBacklog++;
    }
  });

  const elCountBacklog = document.getElementById('badge-count-backlog');
  const elCountNextWeek = document.getElementById('badge-count-next-week');
  const elCountTodo = document.getElementById('badge-count-todo');
  const elCountProgress = document.getElementById('badge-count-in-progress');
  const elCountReview = document.getElementById('badge-count-in-review');

  if (elCountBacklog) elCountBacklog.textContent = countBacklog;
  if (elCountNextWeek) elCountNextWeek.textContent = countNextWeek;
  if (elCountTodo) elCountTodo.textContent = countTodo;
  if (elCountProgress) elCountProgress.textContent = countProgress;
  if (elCountReview) elCountReview.textContent = countReview;
}

// 3. Render Discrepancies
function renderDiscrepancies() {
  const container = document.getElementById('discrepancy-list');
  container.innerHTML = '';

  const discrepancies = [];

  // Check 1: Tickets not yet linked to Project 1
  allTickets.forEach(t => {
    const isLinked = liveKanban && liveKanban.kanbanMap && liveKanban.kanbanMap[t.id];
    if (!isLinked && t.sprint.includes('22/10')) {
      discrepancies.push({
        type: 'unlinked',
        id: t.id,
        text: `El ticket <strong>${t.id}</strong> (${t.title}) es del Sprint 22/10 pero <strong>no está vinculado</strong> al tablero Project 1.`,
        action: 'Agregar a Project 1 en Backlog',
      });
    }
  });

  // Check 2: Assignee mismatches
  allTickets.forEach(t => {
    const liveInfo = liveKanban && liveKanban.kanbanMap && liveKanban.kanbanMap[t.id];
    if (liveInfo && t.assignee_github_planned) {
      if (!liveInfo.assignees.includes(t.assignee_github_planned)) {
        discrepancies.push({
          type: 'assignee_mismatch',
          id: t.id,
          text: `En <strong>${t.id}</strong>: en GitHub está asignado a <code>${liveInfo.assignees.join(', ') || 'nadie'}</code>, pero según el plan corresponde a <strong>${t.assignee_local} (${t.assignee_github_planned})</strong>.`,
          action: 'Reasignar en GitHub',
        });
      }
    }
  });

  if (discrepancies.length === 0) {
    container.innerHTML = `<div style="color: #34d399; font-size: 0.9rem;">✅ ¡Impecable! Todos los tickets del plan están sincronizados y alineados con GitHub Projects.</div>`;
    return;
  }

  discrepancies.forEach(d => {
    const div = document.createElement('div');
    div.className = 'discrepancy-item';
    div.innerHTML = `
      <div>${d.text}</div>
      <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
        ${d.action}
      </span>
    `;
    container.appendChild(div);
  });
}

// 4. Render All Tickets Table
function renderAllTicketsTable() {
  const tbody = document.getElementById('table-body-tickets');
  tbody.innerHTML = '';

  allTickets.forEach(ticket => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-search', `${ticket.id} ${ticket.title} ${ticket.assignee_local} ${ticket.module} ${ticket.folder || ''}`.toLowerCase());

    const liveInfo = liveKanban && liveKanban.kanbanMap ? liveKanban.kanbanMap[ticket.id] : null;
    const ghState = liveInfo ? liveInfo.status : (ticket.github_state || 'OPEN');

    tr.innerHTML = `
      <td><span class="ticket-id">${ticket.id}</span></td>
      <td><strong>${ticket.title}</strong></td>
      <td><span class="meta-tag tag-folder">📁 ${ticket.folder || 'root'}</span></td>
      <td>${ticket.assignee_local}</td>
      <td><span class="ticket-hours-badge">${ticket.hours}h</span></td>
      <td><span style="font-size: 0.78rem; color: #94a3b8;">${ticket.sprint}</span></td>
      <td><span class="meta-tag tag-module">Mod ${ticket.module}</span></td>
      <td><span class="meta-tag tag-layer">${ticket.layer}</span></td>
      <td><span class="meta-tag tag-kanban kanban-backlog">${ghState}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.75rem;">
          Ver Detalle
        </button>
      </td>
    `;

    tr.querySelector('button').addEventListener('click', () => openDrawer(ticket));
    tbody.appendChild(tr);
  });
}

// Filter Functionality
function filterCards() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedModule = moduleSelect.value;

  // Filter Cards on Board
  const cards = document.querySelectorAll('.ticket-card, .active-card');
  cards.forEach(card => {
    const title = (card.getAttribute('data-title') || '').toLowerCase();
    const id = (card.getAttribute('data-id') || '').toLowerCase();
    const dev = (card.getAttribute('data-dev') || '').toLowerCase();
    const mod = card.getAttribute('data-module') || '';

    const matchesQuery = !query || title.includes(query) || id.includes(query) || dev.includes(query);
    const matchesModule = selectedModule === 'all' || mod === selectedModule;

    card.style.display = (matchesQuery && matchesModule) ? 'flex' : 'none';
  });

  // Filter Table Rows
  const rows = document.querySelectorAll('#table-body-tickets tr');
  rows.forEach(row => {
    const text = row.getAttribute('data-search') || '';
    const matchesQuery = !query || text.includes(query);
    row.style.display = matchesQuery ? '' : 'none';
  });
}

// Drawer Functions
function openDrawer(ticket) {
  activeTicket = ticket;

  drawerTag.textContent = ticket.id;
  drawerHours.textContent = `${ticket.hours} hs`;
  drawerStatus.textContent = ticket.kanban_status || 'Backlog';
  drawerTitle.textContent = ticket.title;

  drawerDev.textContent = `${ticket.assignee_local} (${ticket.assignee_github_planned || 'Sin asignar'})`;
  drawerSprint.textContent = `${ticket.sprint} (📁 ${ticket.folder || 'root'})`;
  drawerModule.textContent = `Módulo ${ticket.module}`;
  drawerLayer.textContent = ticket.layer;
  drawerDeps.textContent = (ticket.dependencies && ticket.dependencies.length > 0) ? ticket.dependencies.join(', ') : 'Ninguna';
  drawerBlocks.textContent = (ticket.blocks && ticket.blocks.length > 0) ? ticket.blocks.join(', ') : 'Ninguno';

  drawerGhLink.href = ticket.github_url || '#';

  // Render Markdown Body
  drawerRenderedMarkdown.innerHTML = renderMarkdown(ticket.body || '');

  drawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
  activeTicket = null;
}

// Lightweight Markdown Renderer
function renderMarkdown(md) {
  if (!md) return '<p>Sin descripción.</p>';

  let html = md
    // Escape basic HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Checkboxes
    .replace(/^- \[ \] (.*$)/gim, '<li style="list-style: none;"><input type="checkbox" disabled style="margin-right: 6px;"> $1</li>')
    .replace(/^- \[x\] (.*$)/gim, '<li style="list-style: none;"><input type="checkbox" checked disabled style="margin-right: 6px;"> $1</li>')
    // Unordered lists
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    // Code blocks
    .replace(/```([a-z]*)\r?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    // Paragraphs
    .replace(/\r?\n\r?\n/gim, '</p><p>');

  return `<p>${html}</p>`;
}

// Start
document.addEventListener('DOMContentLoaded', init);
