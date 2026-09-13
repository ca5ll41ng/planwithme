// ===== 功能4:长期任务 =====
App.register('goals', {
  async render(mount) {
    const goals = Store.get('goals').goals;
    const order = { active: 0, paused: 1, done: 2 };
    const sorted = [...goals].sort((a, b) => (order[a.status] - order[b.status]) || (b.createdAt - a.createdAt));

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>长期任务</h2>
          <p class="sub">把大计划钉在这里,慢慢推进;每日/每周待办可关联到这里,完成后自动留下进展</p>
        </div>
        <button class="btn btn-primary" id="goal-add">${ICONS.plus} 新建长期任务</button>
      </header>
      ${sorted.length ? `<div class="goal-grid">${sorted.map(g => this.cardHTML(g)).join('')}</div>` : `<div class="card">${emptyState('还没有长期任务。学一门课、写一本书、减重十斤……都可以放进来')}</div>`}`;

    mount.querySelector('#goal-add').onclick = () => this.editModal(null, () => this.render(mount));

    mount.querySelectorAll('.goal-card').forEach(card => {
      const g = goals.find(x => x.id === card.dataset.id);
      if (!g) return;
      card.querySelector('[data-act="prog"]').onclick = () => this.progressModal(g, () => this.render(mount));
      card.querySelector('[data-act="edit"]').onclick = () => this.editModal(g, () => this.render(mount));
      const doneBtn = card.querySelector('[data-act="done"]');
      if (doneBtn) doneBtn.onclick = async () => {
        g.status = 'done'; g.progress = 100;
        g.logs.push({ date: todayKey(), to: 100, note: '✅ 任务完成' });
        await Store.save('goals');
        toast(`🎉 完成:「${g.title}」`, 'ok');
        this.render(mount);
      };
      const resumeBtn = card.querySelector('[data-act="resume"]');
      if (resumeBtn) resumeBtn.onclick = async () => {
        g.status = 'active';
        if (g.progress >= 100) g.progress = 90;
        await Store.save('goals');
        this.render(mount);
      };
    });
  },

  cardHTML(g) {
    const p = g.progress || 0;
    let deadlineHTML = '';
    if (g.deadline) {
      const days = Math.round((parseKey(g.deadline) - parseKey(todayKey())) / 86400000);
      let txt, cls = '';
      if (days < 0) { txt = `已过期 ${-days} 天`; cls = 'overdue'; }
      else if (days === 0) txt = '今天截止';
      else txt = `剩余 ${days} 天`;
      deadlineHTML = `<div class="goal-deadline ${cls}">📅 截止 ${fmtShort(g.deadline)} · ${txt}</div>`;
    }
    const logs = (g.logs || []).slice(-3).reverse().map(l =>
      `<div class="log"><span>${l.date}</span><span>${esc(l.note)}${l.to != null ? ` → ${l.to}%` : ''}</span></div>`).join('');
    const statusMap = { active: '<span class="chip chip-active">进行中</span>', done: '<span class="chip chip-done">已完成</span>', paused: '<span class="chip chip-paused">已搁置</span>' };
    return `<div class="card goal-card ${g.status !== 'active' ? 'muted' : ''}" data-id="${g.id}">
      <div class="goal-top"><h3>${esc(g.title)}</h3>${statusMap[g.status] || ''}</div>
      ${g.desc ? `<p class="goal-desc">${esc(g.desc)}</p>` : ''}
      ${deadlineHTML}
      <div class="goal-progress"><div class="bar big"><i style="width:${p}%"></i></div><b>${p}%</b></div>
      <div class="goal-logs">${logs || '<div class="log"><span>—</span><span>暂无进展记录</span></div>'}</div>
      <div class="goal-actions">
        <button class="btn btn-primary" data-act="prog">记进度</button>
        <button class="btn" data-act="edit">编辑</button>
        ${g.status === 'active' ? '<button class="btn" data-act="done">完成</button>' : '<button class="btn" data-act="resume">重新推进</button>'}
      </div>
    </div>`;
  },

  progressModal(g, done) {
    const m = modal({
      title: `记录进展 · ${g.title}`,
      body: `
        <label class="field"><span>当前进度:<b id="gp-val">${g.progress || 0}%</b></span>
          <input type="range" id="gp-range" min="0" max="100" step="5" value="${g.progress || 0}">
        </label>
        <label class="field"><span>进展说明(可选)</span>
          <input type="text" id="gp-note" maxlength="100" placeholder="例如:读完第 3 章 / 跑完 10 公里">
        </label>
        <div class="modal-actions">
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>记录</button>
        </div>`
    });
    const range = m.el.querySelector('#gp-range');
    range.oninput = () => { m.el.querySelector('#gp-val').textContent = range.value + '%'; };
    m.el.querySelector('[data-cancel]').onclick = m.close;
    m.el.querySelector('[data-save]').onclick = async () => {
      g.progress = Number(range.value);
      const note = m.el.querySelector('#gp-note').value.trim();
      if (g.progress >= 100 && g.status === 'active') g.status = 'done';
      g.logs.push({ date: todayKey(), to: g.progress, note: note || '更新进度' });
      await Store.save('goals');
      m.close(); toast('进展已记录', 'ok'); done();
    };
  },

  editModal(g, done) {
    const isNew = !g;
    g = g || { id: uid(), title: '', desc: '', deadline: '', progress: 0, status: 'active', logs: [], createdAt: Date.now() };
    const m = modal({
      title: isNew ? '新建长期任务' : '编辑长期任务',
      body: `
        <label class="field"><span>任务名称</span><input type="text" id="gm-title" maxlength="60" value="${esc(g.title)}" placeholder="例如:备考 PMP / 写完小说初稿"></label>
        <label class="field"><span>描述(可选)</span><textarea id="gm-desc" rows="3" placeholder="拆解一下这个大目标…">${esc(g.desc || '')}</textarea></label>
        <label class="field"><span>截止日期(可选)</span><input type="date" id="gm-deadline" value="${g.deadline || ''}"></label>
        <div class="modal-actions">
          ${isNew ? '' : '<button class="btn btn-danger-ghost" data-del>删除</button>'}
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>保存</button>
        </div>`
    });
    m.el.querySelector('[data-cancel]').onclick = m.close;
    const delBtn = m.el.querySelector('[data-del]');
    if (delBtn) delBtn.onclick = async () => {
      if (!(await confirmDlg({ message: `删除长期任务「${g.title}」及其全部进展记录?` }))) return;
      const goals = Store.get('goals').goals;
      const i = goals.findIndex(x => x.id === g.id);
      if (i > -1) goals.splice(i, 1);
      await Store.save('goals');
      m.close(); toast('已删除'); done();
    };
    m.el.querySelector('[data-save]').onclick = async () => {
      const title = m.el.querySelector('#gm-title').value.trim();
      if (!title) { toast('名称不能为空', 'warn'); return; }
      g.title = title;
      g.desc = m.el.querySelector('#gm-desc').value;
      g.deadline = m.el.querySelector('#gm-deadline').value || '';
      if (isNew) Store.get('goals').goals.push(g);
      await Store.save('goals');
      m.close(); toast(isNew ? '已创建' : '已保存', 'ok'); done();
    };
  }
});
