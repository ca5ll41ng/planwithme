// ===== 启动与导航 =====
const NAV = [
  { id: 'timeline', label: '时间轴', icon: 'clock' },
  { id: 'day', label: '每日计划', icon: 'sun' },
  { id: 'week', label: '每周计划', icon: 'calendar' },
  { id: 'goals', label: '长期任务', icon: 'target' },
  { id: 'recurring', label: '周期任务', icon: 'repeat' },
  { id: 'notes', label: '随心记', icon: 'pen' },
  { id: 'settings', label: '设置', icon: 'gear' }
];

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(n =>
    `<button class="nav-item ${App.view === n.id ? 'active' : ''}" data-id="${n.id}">${ICONS[n.icon]}<span>${n.label}</span></button>`).join('');
  nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => App.nav(b.dataset.id));
}

async function boot() {
  await Store.init();

  // 启动即执行顺延:昨日未完成 → 今天,上周未完成 → 本周
  const a = rolloverDaily();
  const b = rolloverWeekly();
  if (a) await Store.save('daily');
  if (b) await Store.save('weekly');
  if (a || b) toast('已把上次未完成的计划顺延到今天/本周', 'ok');

  renderNav();
  App.nav('timeline');

  const info = await api.info();
  document.getElementById('sidebar-foot').textContent = 'v' + info.version + ' · 本地存储';

  // 快捷键唤起时聚焦时间轴快捷输入
  api.onSummon(() => {
    if (App.view !== 'timeline') App.nav('timeline');
    setTimeout(() => {
      const el = document.getElementById('tl-input');
      if (el) el.focus();
    }, 80);
  });

  // 跨天守护:应用一直开着时,新的一天自动顺延并刷新
  let lastDay = todayKey();
  setInterval(async () => {
    if (todayKey() === lastDay) return;
    lastDay = todayKey();
    const ca = rolloverDaily();
    const cb = rolloverWeekly();
    if (ca) await Store.save('daily');
    if (cb) await Store.save('weekly');
    if (ca || cb) toast('新的一天:未完成的计划已自动顺延', 'ok');
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (!typing) App.refresh();
  }, 30 * 1000);

  // 时间轴"现在"指示线每分钟刷新
  setInterval(() => {
    if (App.view === 'timeline' && !document.querySelector('.modal-overlay')) {
      const active = document.activeElement;
      const typing = active && active.tagName === 'INPUT';
      if (!typing) App.refresh();
    }
  }, 60 * 1000);
}

boot().catch(e => {
  document.getElementById('view').innerHTML =
    `<div class="card" style="margin-top:40px"><h3>启动失败</h3><p class="sub">${String(e && e.stack || e)}</p></div>`;
  console.error('[boot]', e);
});
