// ===== 功能5:周期性任务 =====
App.register('recurring', {
  async render(mount) {
    const tasks = Store.get('recurring').tasks;
    const today = todayKey();
    const last14 = [...Array(14)].map((_, i) => addDays(today, i - 13));

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>周期任务</h2>
          <p class="sub">每天要背单词、每周三次运动、每两天敷面膜……到点打卡,今天该做的也会出现在每日计划页</p>
        </div>
        <button class="btn btn-primary" id="rec-add">${ICONS.plus} 新建周期任务</button>
      </header>
      ${tasks.length ? `<div class="card">${tasks.map(t => this.rowHTML(t, last14, today)).join('')}</div>`
        : `<div class="card">${emptyState('还没有周期任务,添加一个开始打卡吧')}</div>`}`;

    mount.querySelector('#rec-add').onclick = () => this.editModal(null, () => this.render(mount));

    mount.querySelectorAll('.rec-row').forEach(row => {
      const t = tasks.find(x => x.id === row.dataset.id);
      if (!t) return;
      row.querySelector('[data-check]').onclick = async () => {
        if (Recurring.isDone(t, today)) t.history = t.history.filter(d => d !== today);
        else t.history.push(today);
        await Store.save('recurring');
        this.render(mount);
      };
      row.querySelector('[data-edit]').onclick = () => this.editModal(t, () => this.render(mount));
    });
  },

  rowHTML(t, last14, today) {
    const doneToday = Recurring.isDone(t, today);
    const due = Recurring.dueToday(t, today);
    const streak = Recurring.streak(t);
    const streakText = streak == null
      ? `已打卡 ${t.history.length} 次`
      : (streak > 0 ? `<span class="rec-streak">🔥 连续 ${streak} 次</span>` : '今天加油,别断签');
    const dots = last14.map(k =>
      `<i class="${Recurring.isDone(t, k) ? 'on' : ''} ${k === today ? 'today' : ''}" title="${k}"></i>`).join('');
    const btnCls = doneToday ? 'btn-ok' : (due ? 'btn-primary' : 'btn-ghost');
    const btnTitle = doneToday ? '点击撤销今日打卡' : (due ? '' : '今日不在计划内,可补打卡');
    return `<div class="rec-row" data-id="${t.id}">
      <div class="rec-main">
        <b>${esc(t.title)}${due ? '' : '<span class="badge badge-note" title="按计划今天不用打卡">今日非计划日</span>'}</b>
        <span class="sub">${esc(Recurring.ruleText(t.rule))} · ${streakText}</span>
      </div>
      <div class="rec-dots" title="最近 14 天打卡记录">${dots}</div>
      <button class="btn ${btnCls}" data-check title="${btnTitle}">${doneToday ? '✓ 已打卡' : '打卡'}</button>
      <button class="icon-btn" data-edit title="编辑">${ICONS.pen}</button>
    </div>`;
  },

  editModal(t, done) {
    const isNew = !t;
    t = t || { id: uid(), title: '', rule: { type: 'daily' }, history: [], createdAt: Date.now() };
    const r = t.rule;
    const wd = r.weekdays || [1, 2, 3, 4, 5];
    const m = modal({
      title: isNew ? '新建周期任务' : '编辑周期任务',
      body: `
        <label class="field"><span>任务名称</span><input type="text" id="rm-title" maxlength="60" value="${esc(t.title)}" placeholder="例如:背 50 个单词"></label>
        <label class="field"><span>重复频率</span>
          <select id="rm-type">
            <option value="daily" ${r.type === 'daily' ? 'selected' : ''}>每天</option>
            <option value="weekly" ${r.type === 'weekly' ? 'selected' : ''}>每周指定几天</option>
            <option value="interval" ${r.type === 'interval' ? 'selected' : ''}>每隔几天</option>
            <option value="monthly" ${r.type === 'monthly' ? 'selected' : ''}>每月几号</option>
          </select>
        </label>
        <div id="rm-detail"></div>
        <div class="modal-actions">
          ${isNew ? '' : '<button class="btn btn-danger-ghost" data-del>删除</button>'}
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>保存</button>
        </div>`
    });

    const detail = m.el.querySelector('#rm-detail');
    const renderDetail = () => {
      const type = m.el.querySelector('#rm-type').value;
      if (type === 'weekly') {
        const names = ['一', '二', '三', '四', '五', '六', '日'];
        detail.innerHTML = `<div class="field" style="display:flex;gap:14px;flex-wrap:wrap;padding:4px 0">
          ${names.map((n, i) => `<label class="switch-row"><input type="checkbox" data-wd="${i + 1}" ${wd.includes(i + 1) ? 'checked' : ''}>周${n}</label>`).join('')}
        </div>`;
      } else if (type === 'interval') {
        detail.innerHTML = `<label class="field"><span>间隔天数</span><input type="number" id="rm-interval" min="1" max="365" value="${r.interval || 2}"></label>`;
      } else if (type === 'monthly') {
        detail.innerHTML = `<label class="field"><span>每月几号</span><input type="number" id="rm-dom" min="1" max="31" value="${r.dayOfMonth || 1}"></label>`;
      } else {
        detail.innerHTML = `<p class="sub" style="padding:4px 0">每天都会出现在待办里,完成后记得打卡</p>`;
      }
    };
    renderDetail();
    m.el.querySelector('#rm-type').onchange = renderDetail;

    m.el.querySelector('[data-cancel]').onclick = m.close;
    const delBtn = m.el.querySelector('[data-del]');
    if (delBtn) delBtn.onclick = async () => {
      if (!(await confirmDlg({ message: `删除周期任务「${t.title}」及打卡记录?` }))) return;
      const tasks = Store.get('recurring').tasks;
      const i = tasks.findIndex(x => x.id === t.id);
      if (i > -1) tasks.splice(i, 1);
      await Store.save('recurring');
      m.close(); toast('已删除'); done();
    };
    m.el.querySelector('[data-save]').onclick = async () => {
      const title = m.el.querySelector('#rm-title').value.trim();
      if (!title) { toast('名称不能为空', 'warn'); return; }
      const type = m.el.querySelector('#rm-type').value;
      const rule = { type };
      if (type === 'weekly') {
        rule.weekdays = [...detail.querySelectorAll('[data-wd]')].filter(c => c.checked).map(c => Number(c.dataset.wd));
        if (!rule.weekdays.length) { toast('至少选择一天', 'warn'); return; }
      } else if (type === 'interval') {
        rule.interval = Math.max(1, Number(m.el.querySelector('#rm-interval').value) || 2);
      } else if (type === 'monthly') {
        rule.dayOfMonth = Math.min(31, Math.max(1, Number(m.el.querySelector('#rm-dom').value) || 1));
      }
      t.title = title;
      t.rule = rule;
      if (isNew) Store.get('recurring').tasks.push(t);
      await Store.save('recurring');
      m.close(); toast(isNew ? '已创建' : '已保存', 'ok'); done();
    };
  }
});
