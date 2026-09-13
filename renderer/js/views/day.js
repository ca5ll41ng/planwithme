// ===== 功能2:每日计划 =====
App.register('day', {
  state: { key: todayKey() },

  async render(mount) {
    const k = this.state.key;
    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>每日计划</h2>
          <p class="sub">${fmtFull(k)} · 当天没完成的事项,会自动顺延到第二天</p>
        </div>
        ${dateNavHTML(labelForKey(k))}
      </header>
      <div id="day-board"></div>`;

    mount.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const v = b.dataset.nav;
      this.state.key = v === '0' ? todayKey() : addDays(k, Number(v));
      this.render(mount);
    });

    await TodoBoard.render(mount.querySelector('#day-board'), { col: 'daily', key: k, showRecurring: true });
  }
});
