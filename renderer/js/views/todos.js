// ===== 功能2/3共用:每日 & 每周 待办面板 =====
window.TodoBoard = {
  async render(mount, ctx) {
    // ctx: { col:'daily'|'weekly', key, showRecurring:boolean }
    const data = Store.get(ctx.col);
    const list = data.todos[ctx.key] || (data.todos[ctx.key] = []);
    const goals = Store.get('goals').goals;
    const goalOf = t => goals.find(g => g.id === t.linkedGoal);

    const doneN = list.filter(t => t.done).length;
    const totalP = list.length ? Math.round(list.reduce((s, t) => s + (t.done ? 100 : (t.progress || 0)), 0) / list.length) : 0;

    // 今日周期任务(仅每日计划页展示)
    let recHTML = '';
    if (ctx.showRecurring) {
      const tasks = Store.get('recurring').tasks.filter(t => Recurring.dueToday(t, ctx.key));
      if (tasks.length) {
        recHTML = `<section class="card rec-today">
          <h3>今日周期任务</h3>
          ${tasks.map(t => {
            const done = Recurring.isDone(t, ctx.key);
            return `<div class="rec-line">
              <b>${esc(t.title)}</b>
              <span class="sub">${esc(Recurring.ruleText(t.rule))}</span>
              <button class="btn ${done ? 'btn-ok' : 'btn-primary'}" data-rec="${t.id}" style="padding:4px 12px;font-size:12.5px">${done ? '✓ 已打卡' : '打卡'}</button>
            </div>`;
          }).join('')}
        </section>`;
      }
    }

    mount.innerHTML = `
      <div class="card sum-card">
        <span class="sum-chip"><b>${doneN}</b>/${list.length} 完成</span>
        <span class="sum-chip"><b>${totalP}%</b>总进度</span>
        <div class="bar big sum-bar"><i style="width:${totalP}%"></i></div>
      </div>
      ${recHTML}
      <div class="card">
        <div class="add-bar" style="margin-bottom:6px">
          <input type="text" id="tb-input" maxlength="80" placeholder="添加待办,回车确认;点击条目可写备注、关联长期任务">
          <button class="btn btn-primary" id="tb-add">${ICONS.plus}</button>
        </div>
        ${list.length ? `<div class="todo-list">${list.map(t => this.rowHTML(t, goalOf(t))).join('')}</div>` : emptyState('今天还没有待办,添加一条开始吧')}
      </div>`;

    // --- 添加 ---
    const input = mount.querySelector('#tb-input');
    const add = async () => {
      const title = input.value.trim();
      if (!title) return;
      list.push({ id: uid(), title, note: '', done: false, progress: 0, createdAt: Date.now() });
      await Store.save(ctx.col);
      this.render(mount, ctx);
    };
    mount.querySelector('#tb-add').onclick = add;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });

    // --- 周期任务打卡 ---
    mount.querySelectorAll('[data-rec]').forEach(b => b.onclick = async () => {
      const t = Store.get('recurring').tasks.find(x => x.id === b.dataset.rec);
      if (!t) return;
      if (Recurring.isDone(t, ctx.key)) t.history = t.history.filter(d => d !== ctx.key);
      else t.history.push(ctx.key);
      await Store.save('recurring');
      this.render(mount, ctx);
    });

    // --- 勾选完成 ---
    mount.querySelectorAll('.todo-check').forEach(cb => cb.onchange = async () => {
      const t = list.find(x => x.id === cb.closest('.todo').dataset.id);
      if (!t) return;
      const wasDone = t.done;
      t.done = cb.checked;
      if (cb.checked) {
        t.progress = 100;
        if (t.linkedGoal) logGoal(t.linkedGoal, ctx.key, `完成待办「${t.title}」`);
      } else if (t.progress >= 100) {
        t.progress = 0;
      }
      await Store.save(ctx.col);
      if (!wasDone && t.done) toast(`完成:${t.title}`, 'ok');
      this.render(mount, ctx);
    });

    // --- 进度滑杆:拖动即时预览,松手保存 ---
    mount.querySelectorAll('.todo-range').forEach(rg => {
      const row = rg.closest('.todo');
      const t = list.find(x => x.id === row.dataset.id);
      if (!t) return;
      rg.oninput = () => {
        row.querySelector('.todo-pct').textContent = rg.value + '%';
      };
      rg.onchange = async () => {
        const wasDone = t.done;
        t.progress = Number(rg.value);
        t.done = t.progress >= 100;
        if (!wasDone && t.done && t.linkedGoal) logGoal(t.linkedGoal, ctx.key, `完成待办「${t.title}」`);
        if (t.done && t.progress < 100) t.progress = 100;
        if (!t.done && t.progress >= 100) t.progress = 0;
        await Store.save(ctx.col);
        this.render(mount, ctx);
      };
    });

    // --- 编辑 ---
    mount.querySelectorAll('.todo-edit').forEach(b => b.onclick = () => {
      const t = list.find(x => x.id === b.closest('.todo').dataset.id);
      if (t) this.editModal(t, ctx, goals, () => this.render(mount, ctx));
    });
    mount.querySelectorAll('.todo-title').forEach(el => el.onclick = () => {
      const t = list.find(x => x.id === el.closest('.todo').dataset.id);
      if (t) this.editModal(t, ctx, goals, () => this.render(mount, ctx));
    });
  },

  rowHTML(t, goal) {
    const p = t.done ? 100 : (t.progress || 0);
    return `<div class="todo ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" class="todo-check" ${t.done ? 'checked' : ''}>
      <div class="todo-main">
        <div class="todo-title">${esc(t.title)}${t.carriedFrom ? `<span class="badge badge-carry" title="从 ${fmtShort(t.carriedFrom)} 顺延而来">顺延</span>` : ''}${goal ? `<span class="badge badge-goal" title="关联长期任务">${esc(goal.title)}</span>` : ''}${t.note ? `<span class="badge badge-note">备注</span>` : ''}</div>
        ${t.note ? `<div class="todo-note">${esc(t.note)}</div>` : ''}
      </div>
      <input type="range" class="todo-range" min="0" max="100" step="5" value="${p}" title="拖动调整进度">
      <span class="todo-pct">${p}%</span>
      <button class="icon-btn todo-edit" title="编辑">${ICONS.pen}</button>
    </div>`;
  },

  editModal(t, ctx, goals, done) {
    const activeGoals = goals.filter(g => g.status === 'active');
    const m = modal({
      title: '编辑待办',
      body: `
        <label class="field"><span>内容</span><input type="text" id="tm-title" maxlength="80" value="${esc(t.title)}"></label>
        <label class="field"><span>备注</span><textarea id="tm-note" rows="3" placeholder="补充说明…">${esc(t.note || '')}</textarea></label>
        <label class="field"><span>关联长期任务(完成后自动记录进展)</span>
          <select id="tm-goal">
            <option value="">不关联</option>
            ${activeGoals.map(g => `<option value="${g.id}" ${g.id === t.linkedGoal ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}
          </select>
        </label>
        ${t.carriedFrom ? `<p class="sub">↩ 这条待办从 <b>${fmtShort(t.carriedFrom)}</b> 自动顺延而来</p>` : ''}
        <div class="modal-actions">
          <button class="btn btn-danger-ghost" data-del>删除</button>
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>保存</button>
        </div>`
    });
    m.el.querySelector('[data-cancel]').onclick = m.close;
    m.el.querySelector('[data-del]').onclick = async () => {
      if (!(await confirmDlg({ message: `删除待办「${t.title}」?${t.carriedFrom ? '\n删除后不会再顺延。' : ''}` }))) return;
      if (t.carriedFrom) markDroppedCopies(ctx.col, t.id, ctx.key);
      const data = Store.get(ctx.col);
      const arr = data.todos[ctx.key] || [];
      const i = arr.findIndex(x => x.id === t.id);
      if (i > -1) arr.splice(i, 1);
      await Store.save(ctx.col);
      m.close(); toast('已删除'); done();
    };
    m.el.querySelector('[data-save]').onclick = async () => {
      const title = m.el.querySelector('#tm-title').value.trim();
      if (!title) { toast('内容不能为空', 'warn'); return; }
      t.title = title;
      t.note = m.el.querySelector('#tm-note').value;
      t.linkedGoal = m.el.querySelector('#tm-goal').value || undefined;
      await Store.save(ctx.col);
      m.close(); toast('已保存', 'ok'); done();
    };
  }
};

// 长期任务进展日志
function logGoal(goalId, date, note) {
  const g = Store.get('goals').goals.find(x => x.id === goalId);
  if (!g) return;
  g.logs.push({ date, note });
  Store.save('goals');
}
