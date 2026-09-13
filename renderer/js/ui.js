// ===== UI 组件:图标 / 弹窗 / 确认 / 提示 / 日期导航 =====
const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  clock: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  sun: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  calendar: SVG('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  target: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  repeat: SVG('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  pen: SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  check: SVG('<path d="M20 6 9 17l-5-5"/>'),
  x: SVG('<path d="M18 6 6 18M6 6l12 12"/>'),
  chevL: SVG('<path d="M15 18l-6-6 6-6"/>'),
  chevR: SVG('<path d="M9 18l6-6-6-6"/>'),
  note: SVG('<path d="M4 4h16v12l-4 4H4Z"/><path d="M16 20v-4h4"/>')
};

const TAGS = [
  { name: '工作', color: '#4f7cff' },
  { name: '学习', color: '#8b5cf6' },
  { name: '运动', color: '#f59e0b' },
  { name: '生活', color: '#10b981' },
  { name: '休息', color: '#94a3b8' }
];
function tagColor(name) { const t = TAGS.find(t => t.name === name); return t ? t.color : '#64748b'; }

function modal({ title, body, width }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const panel = document.createElement('div');
  panel.className = 'modal';
  if (width) panel.style.width = width;
  panel.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${ICONS.x}</button></div><div class="modal-body"></div>`;
  const bodyEl = panel.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  overlay.appendChild(panel);
  root.appendChild(overlay);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  panel.querySelector('[data-close]').onclick = close;
  requestAnimationFrame(() => {
    const f = panel.querySelector('.modal-body input:not([type=hidden]), .modal-body textarea, .modal-body select');
    if (f) f.focus();
  });
  return { el: panel, close };
}

function confirmDlg({ title = '确认操作', message = '确定执行该操作？', danger = true }) {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<p class="confirm-msg">${esc(message)}</p><div class="modal-actions"><button class="btn" data-no>取消</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>确定</button></div>` });
    m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
  });
}

function toast(msg, type = 'info') {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}

function dateNavHTML(label) {
  return `<div class="date-nav">
    <button class="icon-btn" data-nav="-1" title="前一天">${ICONS.chevL}</button>
    <button class="btn btn-ghost date-label" data-nav="0" title="回到今天">${esc(label)}</button>
    <button class="icon-btn" data-nav="1" title="后一天">${ICONS.chevR}</button>
  </div>`;
}

function emptyState(text) {
  return `<div class="empty"><div class="empty-icon">${ICONS.check}</div><p>${esc(text)}</p></div>`;
}
