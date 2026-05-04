const STORAGE_KEY = "cosense-tl-projects";
const SIDEBAR_KEY = "cosense-tl-sidebar-collapsed";

const COLORS = [
  "#4a9", "#e67", "#59d", "#e94", "#8b5cf6",
  "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#6366f1",
];

// ── State ──

let projects = loadProjects(); // [{ id, color }]
let autoTimer = null;

// ── DOM ──

const addForm = document.getElementById("add-form");
const input = document.getElementById("project-input");
const listEl = document.getElementById("project-list");
const reloadBtn = document.getElementById("reload-btn");
const statusEl = document.getElementById("status");
const timelineEl = document.getElementById("timeline");
const autoToggle = document.getElementById("auto-toggle");
const autoInterval = document.getElementById("auto-interval");
const sidebarToggle = document.getElementById("sidebar-toggle");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const bulkIds = document.getElementById("bulk-ids");
const bulkCopy = document.getElementById("bulk-copy");
const bulkApply = document.getElementById("bulk-apply");
const bulkStatus = document.getElementById("bulk-status");

// ── Sidebar collapse ──

if (localStorage.getItem(SIDEBAR_KEY) === "1") {
  document.body.classList.add("sidebar-collapsed");
}

sidebarToggle.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
});

// ── Bulk edit panel ──

settingsToggle.addEventListener("click", () => {
  const willOpen = !settingsPanel.classList.contains("open");
  settingsPanel.classList.toggle("open", willOpen);
  settingsToggle.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    bulkIds.value = projects.map((p) => p.id).join("\n");
    bulkStatus.textContent = "";
    bulkStatus.className = "";
  }
});

bulkCopy.addEventListener("click", async () => {
  const text = projects.map((p) => p.id).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    flashStatus(`${projects.length} 件コピー`);
  } catch {
    bulkIds.value = text;
    bulkIds.select();
    flashStatus("クリップボード不可、選択しました", true);
  }
});

bulkApply.addEventListener("click", () => {
  const ids = bulkIds.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const seen = new Set();
  const unique = [];
  for (const id of ids) {
    if (id.includes("/")) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  const existing = new Map(projects.map((p) => [p.id, p.color]));
  projects = unique.map((id, i) => ({
    id,
    color: existing.get(id) || COLORS[i % COLORS.length],
  }));
  saveProjects();
  renderProjectList();
  flashStatus(`${projects.length} 件で置換`);
  if (projects.length > 0) {
    reloadAll();
  } else {
    timelineEl.innerHTML = "";
    statusEl.textContent = "サイドバーからプロジェクトIDを追加してください";
  }
});

function flashStatus(msg, isError = false) {
  bulkStatus.textContent = msg;
  bulkStatus.className = isError ? "error" : "";
}

// ── Init ──

renderProjectList();
if (projects.length > 0) {
  reloadAll();
} else {
  statusEl.textContent = "サイドバーからプロジェクトIDを追加してください";
}

// ── Events ──

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = input.value.trim();
  if (!id) return;
  if (projects.some((p) => p.id === id)) {
    input.value = "";
    return;
  }
  const color = COLORS[projects.length % COLORS.length];
  projects.push({ id, color });
  saveProjects();
  input.value = "";
  renderProjectList();
  reloadAll();
});

reloadBtn.addEventListener("click", () => reloadAll());

// ── Auto refresh ──

autoToggle.addEventListener("change", () => {
  if (autoToggle.checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

autoInterval.addEventListener("change", () => {
  if (autoToggle.checked) {
    stopAutoRefresh();
    startAutoRefresh();
  }
});

function startAutoRefresh() {
  stopAutoRefresh();
  const sec = parseInt(autoInterval.value, 10) || 60;
  autoTimer = setInterval(() => {
    if (projects.length > 0) reloadAll();
  }, sec * 1000);
}

function stopAutoRefresh() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

// ── Projects persistence ──

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function removeProject(id) {
  projects = projects.filter((p) => p.id !== id);
  saveProjects();
  renderProjectList();
  if (projects.length > 0) {
    reloadAll();
  } else {
    timelineEl.innerHTML = "";
    statusEl.textContent = "サイドバーからプロジェクトIDを追加してください";
  }
}

// ── Sidebar rendering ──

function renderProjectList() {
  listEl.innerHTML = "";
  reloadBtn.disabled = projects.length === 0;
  for (const p of projects) {
    const li = document.createElement("li");
    li.className = "project-item";

    const dot = document.createElement("span");
    dot.className = "project-dot";
    dot.style.background = p.color;

    const name = document.createElement("span");
    name.className = "project-name";
    name.textContent = p.id;

    const remove = document.createElement("button");
    remove.className = "project-remove";
    remove.textContent = "\u00d7";
    remove.title = "削除";
    remove.addEventListener("click", () => removeProject(p.id));

    li.append(dot, name, remove);
    listEl.appendChild(li);
  }
}

// ── Fetch & merge ──

async function reloadAll() {
  timelineEl.innerHTML = "";
  statusEl.className = "loading";
  statusEl.textContent = "";
  reloadBtn.disabled = true;

  const results = await Promise.allSettled(
    projects.map(async (p) => {
      const res = await fetch(`/api/stream/${encodeURIComponent(p.id)}`);
      if (!res.ok) throw new Error(`${p.id}: HTTP ${res.status}`);
      const data = await res.json();
      return { project: p, data };
    })
  );

  const allPages = [];
  const errors = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { project, data } = r.value;
      for (const page of data.pages || []) {
        const updatedAt = getPageUpdatedAt(page);
        allPages.push({ project, page, updatedAt });
      }
    } else {
      errors.push(r.reason.message);
    }
  }

  // Sort by most recently updated
  allPages.sort((a, b) => b.updatedAt - a.updatedAt);

  statusEl.className = "";
  reloadBtn.disabled = projects.length === 0;

  if (errors.length > 0) {
    statusEl.className = "error";
    statusEl.textContent = errors.join(" / ");
  } else {
    statusEl.textContent = "";
  }

  if (allPages.length === 0 && errors.length === 0) {
    statusEl.textContent = "ページがありません";
    return;
  }

  renderTimeline(allPages);
}

function getPageUpdatedAt(page) {
  let max = 0;
  for (const line of page.lines) {
    if (line.updated > max) max = line.updated;
  }
  return max;
}

// ── Timeline rendering ──

function renderTimeline(items) {
  const fragment = document.createDocumentFragment();
  let currentDateLabel = "";

  for (const { project, page, updatedAt } of items) {
    const dateLabel = formatDateLabel(updatedAt);
    if (dateLabel !== currentDateLabel) {
      currentDateLabel = dateLabel;
      const header = document.createElement("div");
      header.className = "tl-date-header";
      header.textContent = dateLabel;
      fragment.appendChild(header);
    }

    const url = `https://scrapbox.io/${encodeURIComponent(project.id)}/${encodeURIComponent(page.title)}`;

    const card = document.createElement("a");
    card.className = "card";
    card.href = url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    // Header: badge + time
    const headerDiv = document.createElement("div");
    headerDiv.className = "card-header";

    const badge = document.createElement("span");
    badge.className = "card-badge";
    badge.style.background = project.color;
    badge.textContent = project.id;

    const time = document.createElement("span");
    time.className = "card-time";
    time.textContent = formatTime(updatedAt);

    headerDiv.append(badge, time);
    card.appendChild(headerDiv);

    // Body
    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = page.title;
    body.appendChild(title);

    const SESSION_WINDOW_SEC = 30 * 60;
    const contentLines = page.lines
      .slice(1)
      .filter(
        (l) =>
          l.text.trim() !== "" && updatedAt - l.updated <= SESSION_WINDOW_SEC
      );
    if (contentLines.length > 0) {
      const linesDiv = document.createElement("div");
      linesDiv.className = "card-lines";
      const shown = contentLines.slice(0, 8);
      for (const line of shown) {
        const lineEl = document.createElement("div");
        lineEl.className = "card-line";
        lineEl.innerHTML = formatLine(line.text);
        linesDiv.appendChild(lineEl);
      }
      if (contentLines.length > 8) {
        const more = document.createElement("div");
        more.className = "card-line card-more";
        more.textContent = `… 他 ${contentLines.length - 8} 行`;
        linesDiv.appendChild(more);
      }
      body.appendChild(linesDiv);
    }

    card.appendChild(body);
    fragment.appendChild(card);
  }

  timelineEl.appendChild(fragment);
}

// ── Formatting helpers ──

function formatLine(text) {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]/g,
    '<span class="card-line-bracket">$1</span>'
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(unixSec) {
  const d = new Date(unixSec * 1000);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;

  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(unixSec) {
  const d = new Date(unixSec * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - target) / 86400000);

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;

  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
