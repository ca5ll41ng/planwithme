// ===== 周期任务核心逻辑(供周期任务页和每日计划页共用) =====
window.Recurring = {
  // 0=周日..6=周六 → 1=周一..7=周日
  weekdayNum(key) { return (parseKey(key).getDay() + 6) % 7 + 1; },

  isDone(task, key) { return task.history.includes(key); },

  dueToday(task, key) {
    const r = task.rule;
    switch (r.type) {
      case 'daily': return true;
      case 'weekly': return (r.weekdays || []).includes(this.weekdayNum(key));
      case 'interval': {
        if (!r.interval || r.interval < 1) return true;
        const past = task.history.filter(d => d < key);
        if (!past.length) return true;
        const last = past[past.length - 1];
        return Math.round((parseKey(key) - parseKey(last)) / 86400000) >= r.interval;
      }
      case 'monthly': return parseKey(key).getDate() === r.dayOfMonth;
      default: return false;
    }
  },

  streak(task) {
    if (task.rule.type === 'interval') return null; // 间隔型用总次数表示
    let n = 0;
    for (let i = 0; i < 366; i++) {
      const k = addDays(todayKey(), -i);
      if (this.dueToday(task, k)) {
        if (this.isDone(task, k)) n++;
        else if (i > 0) break;
      }
    }
    return n;
  },

  ruleText(rule) {
    switch (rule.type) {
      case 'daily': return '每天';
      case 'weekly': {
        const names = ['一', '二', '三', '四', '五', '六', '日'];
        const wd = (rule.weekdays || []).slice().sort((a, b) => a - b).map(d => names[d - 1]);
        return '每周' + (wd.length ? wd.join('、') : '?');
      }
      case 'interval': return '每 ' + (rule.interval || 1) + ' 天';
      case 'monthly': return '每月 ' + (rule.dayOfMonth || 1) + ' 号';
      default: return '';
    }
  }
};
