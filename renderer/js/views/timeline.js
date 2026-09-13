// ===== 功能1:24小时时间轴 =====
const H = 56; // 每小时像素高度

App.register('timeline', {
  state: { key: null },

  async render(mount) {
    const S = this.state;
    if (!S.key) S.key = todayKey();
    const data = Store.get('timeline');
    const entries = data.entries[S.key] || (data.entries[S.key] = []);
    const isToday = S.key === todayKey();

    let totalMin = 0;
    const running = [];
    for (const e of entries) {
      if (e.end && minutesOf(e.end) > minutesOf(e.start)) totalMin += minutesOf(e.end) - minutesOf(e.start);
      else if (!e.end) running.push(e);
    }

    const hourRows = [];
    for (let h = 0; h < 24; h++) {
      hourRows.push(`<div class="tl-hour" style="top:${h * H}px"><span>${pad(h)}:00</span></div>`);
    }

    const { items, laneCount } = layoutEntries(entries, isToday ? minutesOf(nowHHMM()) : null);
    const blocks = items.map(it => {
      const e = it.e;
      const top = it.s / 1440 * 24 * H;
      const height = Math.max(28, (it.t - it.s) / 1440 * 24 * H);
      const w = 100 / laneCount;
      return `<div class="tl-block ${e.end ? '' : 'running'}" data-id="${e.id}"
        style="top:${top}px;height:${height}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 6px);--c:${tagColor(e.tag)}">
        <div class="tl-time">${e.start}${e.end ? ' - ' + e.end : ' - 进行中'}</div>
        <div class="tl-title">${esc(e.title)}</div>
      </div>`;
    }).join('');

    const nowLine = isToday ? (() => {
      const d = new Date();
      const top = (d.getHours() * 60 + d.getMinutes()) / 1440 * 24 * H;
      return `<div class="tl-now" style="top:${top}px"><span>${nowHHMM()}</span></div>`;
    })() : '';

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>时间轴</h2>
          <p class="sub">做之前随手记一笔,时间轴会落在当前时刻。点击色块可修改或补记。</p>
        </div>
        ${dateNavHTML(labelForKey(S.key))}
      </header>
      <div class="card quick-card">
        <span class="quick-dot"></span>
        <input type="text" id="tl-input" maxlength="60" placeholder="此刻要开始做什么?回车即刻从当前时间点开始记录">
        <select id="tl-tag">${TAGS.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}</select>
        <button class="btn btn-primary" id="tl-add">开始记录</button>
      </div>
      ${running.length ? `<div class="running-list">${running.map(e => {
        const s = minutesOf(e.start), now = minutesOf(nowHHMM());
        const dur = Math.max(1, now >= s ? now - s : 1440 - s + now);
        return `
        <div class="running-item" style="--c:${tagColor(e.tag)}">
          <div><b>${esc(e.title)}</b><span class="run-meta">自 ${e.start} 开始 · 已进行 ${dur} 分钟</span></div>
          <button class="btn btn-ok" data-end="${e.id}">完成它</button>
        </div>`;
      }).join('')}</div>` : ''}
      <div class="tl-stats">
        <span>记录 <b>${entries.length}</b> 项</span>
        <span>有记录时长 <b>${fmtDuration(totalMin)}</b></span>
        ${running.length ? `<span>进行中 <b>${running.length}</b> 项</span>` : ''}
      </div>
      <div class="card tl-card">
        <div class="tl-scroll">
          <div class="tl-wrap">
            ${hourRows.join('')}
            <div class="tl-canvas">${blocks}${nowLine}</div>
          </div>
        </div>
      </div>`;

    // --- 日期导航 ---
    mount.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const v = b.dataset.nav;
      this.state.scrollTop = null;
      S.key = v === '0' ? todayKey() : addDays(S.key, Number(v));
      this.render(mount);
    });

    // 今天首次进入时,自动滚动让当前时刻出现在画面中部;之后记住用户的滚动位置
    const scroller = mount.querySelector('.tl-scroll');
    if (S.scrollTop != null) {
      scroller.scrollTop = S.scrollTop;
    } else if (isToday) {
      requestAnimationFrame(() => {
        const now = scroller.querySelector('.tl-now');
        if (now) now.scrollIntoView({ block: 'center' });
      });
    }
    scroller.addEventListener('scroll', () => { S.scrollTop = scroller.scrollTop; }, { passive: true });

    // --- 快捷记录 ---
    const input = mount.querySelector('#tl-input');
    const tagSel = mount.querySelector('#tl-tag');
    const addNow = async () => {
      const title = input.value.trim();
      if (!title) { toast('先写下要做的事再开始记录', 'warn'); input.focus(); return; }
      entries.push({ id: uid(), title, note: '', tag: tagSel.value, start: nowHHMM(), end: null, createdAt: Date.now() });
      await Store.save('timeline');
      toast(`${nowHHMM()} 已开始记录:${title}`, 'ok');
      this.render(mount);
    };
    mount.querySelector('#tl-add').onclick = addNow;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addNow(); });

    // --- 结束进行中 ---
    mount.querySelectorAll('[data-end]').forEach(b => b.onclick = async () => {
      const e = entries.find(x => x.id === b.dataset.end);
      if (!e) return;
      let end = nowHHMM();
      if (minutesOf(end) <= minutesOf(e.start)) {
        const m = Math.min(1439, minutesOf(e.start) + 1);
        end = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
      }
      e.end = end;
      await Store.save('timeline');
      toast(`已完成:${e.title}(${e.start} - ${end})`, 'ok');
      this.render(mount);
    });

    // --- 点击色块编辑 ---
    mount.querySelectorAll('.tl-block').forEach(el => el.onclick = () => {
      const e = entries.find(x => x.id === el.dataset.id);
      if (e) this.editModal(e, () => this.render(mount));
    });
  },

  editModal(e, done) {
    const m = modal({
      title: '编辑记录',
      body: `
        <label class="field"><span>做了什么</span><input type="text" id="em-title" maxlength="60" value="${esc(e.title)}"></label>
        <div class="field-row">
          <label class="field"><span>开始时间</span><input type="time" id="em-start" value="${e.start}"></label>
          <label class="field"><span>结束时间(留空 = 进行中)</span><input type="time" id="em-end" value="${e.end || ''}"></label>
        </div>
        <label class="field"><span>分类</span><select id="em-tag">${TAGS.map(t => `<option value="${t.name}" ${t.name === e.tag ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
        <label class="field"><span>备注</span><textarea id="em-note" rows="3" placeholder="补充细节…">${esc(e.note || '')}</textarea></label>
        <div class="modal-actions">
          <button class="btn btn-danger-ghost" data-del>删除</button>
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>保存</button>
        </div>`
    });
    m.el.querySelector('[data-cancel]').onclick = m.close;
    m.el.querySelector('[data-del]').onclick = async () => {
      if (!(await confirmDlg({ message: `删除记录「${e.title}」?` }))) return;
      const entries = Store.get('timeline').entries[this.state.key] || [];
      const i = entries.findIndex(x => x.id === e.id);
      if (i > -1) entries.splice(i, 1);
      await Store.save('timeline');
      m.close(); toast('已删除'); done();
    };
    m.el.querySelector('[data-save]').onclick = async () => {
      const title = m.el.querySelector('#em-title').value.trim();
      if (!title) { toast('标题不能为空', 'warn'); return; }
      e.title = title;
      e.tag = m.el.querySelector('#em-tag').value;
      e.note = m.el.querySelector('#em-note').value;
      e.start = m.el.querySelector('#em-start').value || e.start;
      e.end = m.el.querySelector('#em-end').value || null;
      await Store.save('timeline');
      m.close(); toast('已保存', 'ok'); done();
    };
  }
});

// 按时间分段抢占"车道",重叠记录并排显示;进行中的记录(仅限今天视图)延伸到当前时刻
function layoutEntries(entries, nowMin) {
  const items = entries.filter(e => e.start).map(e => {
    const s = minutesOf(e.start);
    let t;
    if (e.end) t = minutesOf(e.end);
    else if (nowMin != null) t = Math.min(1439, Math.max(s + 30, nowMin));
    else t = Math.min(1439, s + 45);
    if (t <= s) t = Math.min(1439, s + 30);
    return { e, s, t };
  });
  items.sort((a, b) => a.s - b.s || a.t - b.t);
  const lanes = [];
  for (const it of items) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= it.s) { it.lane = i; lanes[i] = it.t; placed = true; break; }
    }
    if (!placed) { it.lane = lanes.length; lanes.push(it.t); }
  }
  return { items, laneCount: Math.max(1, lanes.length) };
}
