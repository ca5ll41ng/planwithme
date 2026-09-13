// ===== 功能6:每日随心记 =====
App.register('notes', {
  state: { key: todayKey(), q: '' },

  async render(mount) {
    const S = this.state;
    const notes = Store.get('notes').notes;
    const text = notes[S.key] || '';

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>随心记</h2>
          <p class="sub">今天的碎碎念、灵感、吐槽,写下来就好,自动保存</p>
        </div>
        ${dateNavHTML(labelForKey(S.key))}
      </header>
      <div class="notes-layout">
        <div class="notes-main card" style="padding:18px 22px">
          <textarea class="note-editor" id="note-text" placeholder="想到什么写什么…">${esc(text)}</textarea>
          <div class="save-hint" id="note-hint">${text ? '已保存 ✓' : ''}</div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn" id="note-ts">插入时间戳</button>
          </div>
        </div>
        <div class="notes-side card">
          <h3>历史随笔 <span class="sub" id="note-count"></span></h3>
          <input type="text" id="note-search" placeholder="搜索随笔内容…" style="width:100%;margin-bottom:10px" value="${esc(S.q)}">
          <div class="side-list" id="note-side"></div>
        </div>
      </div>`;

    const ta = mount.querySelector('#note-text');
    const hint = mount.querySelector('#note-hint');
    const sideEl = mount.querySelector('#note-side');

    const itemHTML = (d) => `
      <div class="note-item ${d === S.key ? 'active' : ''}" data-k="${d}">
        <b>${fmtShort(d)} ${weekdayCN(d)}${d === todayKey() ? ' · 今天' : ''}</b>
        <p>${esc((notes[d] || '').split('\n').map(l => l.trim()).find(Boolean) || '…')}</p>
      </div>`;

    const renderSide = () => {
      const all = Object.keys(notes).filter(d => notes[d] && notes[d].trim());
      const shown = all.filter(d => !S.q || notes[d].includes(S.q)).sort().reverse();
      mount.querySelector('#note-count').textContent = `${all.length} 天`;
      sideEl.innerHTML = shown.slice(0, 60).map(itemHTML).join('')
        || `<p class="sub" style="padding:6px 2px">${S.q ? '没有匹配的随笔' : '还没有随笔'}</p>`;
      sideEl.querySelectorAll('.note-item').forEach(item => item.onclick = async () => {
        await saveNow();
        S.key = item.dataset.k;
        this.render(mount);
      });
    };

    const saveNow = async () => {
      if (notes[S.key] === ta.value) return;
      notes[S.key] = ta.value;
      await Store.save('notes');
      hint.textContent = '已保存 ✓ ' + nowHHMM();
      renderSide();
    };
    const debouncedSave = debounce(saveNow, 400);
    this._flush = saveNow;
    ta.addEventListener('input', () => { hint.textContent = '编辑中…'; debouncedSave(); });

    mount.querySelector('#note-ts').onclick = () => {
      ta.value = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n' : '') + `[${nowHHMM()}] `;
      ta.focus();
      ta.scrollTop = ta.scrollHeight;
      saveNow();
    };

    // 日期导航(先落盘当前内容再切换)
    mount.querySelectorAll('[data-nav]').forEach(b => b.onclick = async () => {
      await saveNow();
      const v = b.dataset.nav;
      S.key = v === '0' ? todayKey() : addDays(S.key, Number(v));
      this.render(mount);
    });

    mount.querySelector('#note-search').oninput = (e) => {
      S.q = e.target.value.trim();
      renderSide();
    };

    renderSide();
  }
});
