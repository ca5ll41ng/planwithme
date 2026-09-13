// ===== 本地数据层:所有数据通过 IPC 写入 userData/data/*.json =====
const COLLECTIONS = ['settings', 'timeline', 'daily', 'weekly', 'goals', 'recurring', 'notes'];

const DEFAULTS = {
  settings: () => ({ hotkey: 'CommandOrControl+Alt+P', theme: 'light', closeToTray: true }),
  timeline: () => ({ entries: {} }),   // { 'YYYY-MM-DD': [ {id,title,note,tag,start,end,createdAt} ] }
  daily:   () => ({ todos: {} }),      // { 'YYYY-MM-DD': [ {id,title,note,done,progress,linkedGoal,carriedFrom,dropped,createdAt} ] }
  weekly:  () => ({ todos: {} }),      // { 'YYYY-Www': [ ...同上 ] }
  goals:   () => ({ goals: [] }),      // [ {id,title,desc,deadline,progress,status,logs:[{date,to,note}],createdAt} ]
  recurring: () => ({ tasks: [] }),    // [ {id,title,rule:{type,weekdays,interval,dayOfMonth},history:[key],createdAt} ]
  notes:   () => ({ notes: {} })       // { 'YYYY-MM-DD': 'text' }
};

const Store = {
  cache: {},
  async init() {
    for (const c of COLLECTIONS) {
      const d = await api.read(c);
      this.cache[c] = d || DEFAULTS[c]();
    }
    document.documentElement.dataset.theme = this.cache.settings.theme === 'dark' ? 'dark' : 'light';
  },
  get(c) { return this.cache[c]; },
  async save(c) { await api.write(c, this.cache[c]); }
};

// ===== 自动顺延:昨日(及近 7 天)未完成 → 今天;上周未完成 → 本周 =====
function rolloverDaily() {
  const data = Store.get('daily');
  const today = todayKey();
  if (!data.todos[today]) data.todos[today] = [];
  const list = data.todos[today];
  const ids = new Set(list.map(t => t.id));
  let changed = false;
  for (let i = 7; i >= 1; i--) {
    const k = addDays(today, -i);
    const src = data.todos[k];
    if (!src || !src.length) continue;
    for (const t of src) {
      if (!t.done && !t.dropped && !ids.has(t.id)) {
        list.push({ ...t, carriedFrom: t.carriedFrom || k });
        ids.add(t.id);
        changed = true;
      }
    }
  }
  return changed;
}

function rolloverWeekly() {
  const data = Store.get('weekly');
  const wk = weekKeyOf(todayKey());
  if (!data.todos[wk]) data.todos[wk] = [];
  const list = data.todos[wk];
  const ids = new Set(list.map(t => t.id));
  let changed = false;
  for (let i = 4; i >= 1; i--) {
    const k = addWeeks(wk, -i);
    const src = data.todos[k];
    if (!src || !src.length) continue;
    for (const t of src) {
      if (!t.done && !t.dropped && !ids.has(t.id)) {
        list.push({ ...t, carriedFrom: t.carriedFrom || k });
        ids.add(t.id);
        changed = true;
      }
    }
  }
  return changed;
}

// 删除"顺延"待办时,把历史日期里的同源条目标记 dropped,避免明天再次顺延
function markDroppedCopies(col, id, currentKey) {
  const data = Store.get(col);
  for (const k of Object.keys(data.todos)) {
    if (k >= currentKey) continue;
    for (const t of data.todos[k]) {
      if (t.id === id) t.dropped = true;
    }
  }
}
