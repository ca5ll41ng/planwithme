// ===== 通用工具 =====
window.App = {
  views: {},
  view: 'timeline',
  register(id, mod) { this.views[id] = mod; },
  async refresh() {
    const mount = document.getElementById('view');
    if (App.views[App.view]) await App.views[App.view].render(mount);
  },
  nav(id) {
    App.view = id;
    renderNav();
    App.refresh();
  }
};

function pad(n) { return String(n).padStart(2, '0'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===== 日期工具(本地时区) =====
function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayKey() { return dateKey(new Date()); }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
function weekdayCN(k) { return '周' + '日一二三四五六'[parseKey(k).getDay()]; }
function fmtShort(k) { const d = parseKey(k); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function fmtFull(k) { const d = parseKey(k); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + weekdayCN(k); }
function labelForKey(k) {
  const base = fmtShort(k) + ' ' + weekdayCN(k);
  return k === todayKey() ? '今天 · ' + base : base;
}

// ISO 周(周一开始)
function isoWeek(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3); // 本周周四
  const year = t.getFullYear();
  const firstThu = new Date(year, 0, 4);
  const off = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - off + 3);
  const week = 1 + Math.round((t - firstThu) / (7 * 86400000));
  return { year, week };
}
function weekKeyOf(key) { const { year, week } = isoWeek(parseKey(key)); return year + '-W' + pad(week); }
function mondayOfWeek(wk) {
  const [y, w] = wk.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const off = (jan4.getDay() + 6) % 7;
  const w1mon = new Date(y, 0, 4 - off);
  return dateKey(new Date(w1mon.getFullYear(), w1mon.getMonth(), w1mon.getDate() + (w - 1) * 7));
}
function addWeeks(wk, n) { return weekKeyOf(addDays(mondayOfWeek(wk), n * 7)); }
function weekNumOf(wk) { return Number(wk.split('-W')[1]); }

// ===== 时间工具 =====
function nowHHMM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function minutesOf(hhmm) { const [h, m] = String(hhmm).split(':').map(Number); return (h || 0) * 60 + (m || 0); }
function fmtDuration(min) {
  if (min < 60) return min + ' 分钟';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? h + ' 小时 ' + m + ' 分钟' : h + ' 小时';
}
