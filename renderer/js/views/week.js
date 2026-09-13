// ===== 功能3:每周计划 =====
App.register('week', {
  state: { key: weekKeyOf(todayKey()) },

  async render(mount) {
    const wk = this.state.key;
    const mon = mondayOfWeek(wk);
    const sun = addDays(mon, 6);
    const daily = Store.get('daily').todos;

    const strip = [...Array(7)].map((_, i) => {
      const k = addDays(mon, i);
      const l = daily[k] || [];
      const d = l.filter(x => x.done).length;
      return `<button class="day-chip ${k === todayKey() ? 'today' : ''}" data-k="${k}">
        <b>${'一二三四五六日'[i]}</b><span>${fmtShort(k)}</span><em>${l.length ? d + '/' + l.length : '—'}</em>
      </button>`;
    }).join('');

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>每周计划 <span class="sub">第 ${weekNumOf(wk)} 周</span></h2>
          <p class="sub">${fmtShort(mon)} ~ ${fmtShort(sun)} · 本周没完成的会自动顺延到下周</p>
        </div>
        <div class="date-nav">
          <button class="icon-btn" data-nav="-1" title="上一周">${ICONS.chevL}</button>
          <button class="btn btn-ghost date-label" data-nav="0" title="回到本周">${wk === weekKeyOf(todayKey()) ? '本周 · ' : ''}${esc(wk)}</button>
          <button class="icon-btn" data-nav="1" title="下一周">${ICONS.chevR}</button>
        </div>
      </header>
      <div class="week-strip">${strip}</div>
      <div id="week-board"></div>`;

    mount.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const v = b.dataset.nav;
      this.state.key = v === '0' ? weekKeyOf(todayKey()) : addWeeks(wk, Number(v));
      this.render(mount);
    });

    mount.querySelectorAll('.day-chip').forEach(ch => ch.onclick = () => {
      App.views.day.state.key = ch.dataset.k;
      App.nav('day');
    });

    await TodoBoard.render(mount.querySelector('#week-board'), { col: 'weekly', key: wk, showRecurring: false });
  }
});
