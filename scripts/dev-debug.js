// ===== 开发调试辅助(通过环境变量 PWM_DEBUG 启用,正常使用不受影响)=====
//   PWM_DEBUG=1        全量冒烟测试(驱动真实 UI 交互 + 各页面截图)
//   PWM_DEBUG=rollover 顺延逻辑端到端验证
//   PWM_DEBUG=demo     种入演示数据并对全部页面截图
//   PWM_DEBUG=dirtest  自定义数据目录迁移流程验证
// 截图与结果输出到项目根目录 debug-shots/(已在 .gitignore 中忽略)
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const ROOT = path.join(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'debug-shots');
const TEST_DATA = path.join(ROOT, 'test-data');
const DIRTEST_REPORT = path.join(SHOT_DIR, 'dirtest-result.txt');
const USER_DATA = app.getPath('userData');

let win = null;

function attachDebug(w) {
  win = w;
  const mode = process.env.PWM_DEBUG;
  if (!mode) return;
  const fn = { '1': debugSmoke, rollover: debugRollover, demo: debugDemo, dirtest: debugDirTest }[mode];
  if (fn) w.webContents.on('did-finish-load', () => setTimeout(fn, 700));
}

module.exports = { attachDebug };

// PWM_DEBUG=demo:种入演示数据并截图(视觉验收用)
async function debugDemo() {
  const wc = win.webContents;
  const fs = require('fs');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    await sleep(800);
    await wc.executeJavaScript(`(async () => {
      const g = Store.get('goals');
      if (!g.goals.length) g.goals.push({id:'demo-g1',title:'考取 PMP 证书',desc:'年底前拿证,每天推进一点',deadline:'2026-12-31',progress:30,status:'active',logs:[{date:todayKey(),to:30,note:'起步 30%'},{date:todayKey(),note:'完成待办「刷第三章真题」'}],createdAt:Date.now()});
      const r = Store.get('recurring');
      if (!r.tasks.length) {
        r.tasks.push({id:'demo-r1',title:'背 50 个单词',rule:{type:'daily'},history:[addDays(todayKey(),-1),addDays(todayKey(),-2)],createdAt:Date.now()});
        r.tasks.push({id:'demo-r2',title:'每周三次运动',rule:{type:'weekly',weekdays:[1,3,5]},history:[],createdAt:Date.now()});
      }
      const t = Store.get('timeline');
      if (!(t.entries[todayKey()] || []).length) t.entries[todayKey()] = [
        {id:'d1',title:'晨会',note:'',tag:'工作',start:'09:30',end:'10:00',createdAt:0},
        {id:'d2',title:'写方案初稿',note:'',tag:'工作',start:'10:10',end:'12:00',createdAt:0},
        {id:'d3',title:'午休 + 散步',note:'',tag:'休息',start:'12:10',end:'13:20',createdAt:0},
        {id:'d4',title:'看技术博客',note:'',tag:'学习',start:'15:00',end:'16:30',createdAt:0},
        {id:'d5',title:'健身',note:'',tag:'运动',start:'19:00',end:'20:00',createdAt:0},
        {id:'d6',title:'晚间复盘',note:'',tag:'工作',start:'21:30',end:null,createdAt:0}
      ];
      const n = Store.get('notes');
      if (!n.notes[todayKey()]) n.notes[todayKey()] = '应用搭建完成,顺手记一笔。;[灵感] 时间轴可以加一个周热力图。;[心情] 今天效率不错。';
      await Store.save('goals'); await Store.save('recurring'); await Store.save('timeline'); await Store.save('notes');
      return 'seeded';
    })()`, true);
    // 按钮尺寸检查(.btn 内 svg 不得撑大按钮)
    const rectOf = "r => Math.round(r.width) + 'x' + Math.round(r.height)";
    await wc.executeJavaScript(`App.nav('day')`, true);
    await sleep(300);
    const dayBtn = await wc.executeJavaScript(`(${rectOf})(document.getElementById('tb-add').getBoundingClientRect())`, true);
    await wc.executeJavaScript(`App.nav('goals')`, true);
    await sleep(300);
    const goalBtn = await wc.executeJavaScript(`(${rectOf})(document.getElementById('goal-add').getBoundingClientRect())`, true);
    await wc.executeJavaScript(`App.nav('recurring')`, true);
    await sleep(300);
    const recBtn = await wc.executeJavaScript(`(${rectOf})(document.getElementById('rec-add').getBoundingClientRect())`, true);
    console.log('[demo] buttons', JSON.stringify({ day: dayBtn, goal: goalBtn, rec: recBtn }));
    const shotDir = SHOT_DIR;
    fs.mkdirSync(shotDir, { recursive: true });
    for (const id of ['timeline', 'day', 'week', 'goals', 'recurring', 'notes', 'settings']) {
      await wc.executeJavaScript(`App.nav('${id}')`, true);
      await sleep(600);
      fs.writeFileSync(shotDir + '/' + id + '.png', (await wc.capturePage()).toPNG());
    }
    await wc.executeJavaScript(`App.nav('timeline')`, true);
    await sleep(400);
    await wc.executeJavaScript(`document.documentElement.dataset.theme='dark'`, true);
    await sleep(400);
    fs.writeFileSync(shotDir + '/dark-timeline.png', (await wc.capturePage()).toPNG());
    await wc.executeJavaScript(`document.documentElement.dataset.theme='light'`, true);
    console.log('[demo] DONE');
  } catch (e) {
    console.error('[demo] FAILED', e);
  }
}

// ===== 冒烟测试(PWM_DEBUG=1 全量 / PWM_DEBUG=rollover 顺延验证)=====
// PWM_DEBUG=dirtest:验证自定义数据目录迁移流程

async function debugDirTest() {
  const wc = win.webContents;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const report = (s) => {
    try { fs.mkdirSync(path.dirname(DIRTEST_REPORT), { recursive: true }); fs.appendFileSync(DIRTEST_REPORT, s + '\n', 'utf8'); } catch {}
    console.log('[dirtest]', s);
  };
  try {
    await sleep(1200);
    let doneAlready = false;
    try { doneAlready = fs.readFileSync(DIRTEST_REPORT, 'utf8').includes('DONE-PHASE2'); } catch {}
    const info = await wc.executeJavaScript(`window.api.info()`, true);
    if (doneAlready) {
      report(`phase3: 重启后 dir=${info.dir} custom=${info.custom} — STOP`);
      return;
    }
    report(`phase1: dir=${info.dir} custom=${info.custom}`);
    if (!info.custom) {
      const r = await wc.executeJavaScript(`api.changeDataFolder(TEST_DATA)`, true);
      report('changeDataFolder -> ' + JSON.stringify(r) + ' (应用应自动重启)');
    } else {
      await wc.executeJavaScript(`(async () => { const t = Store.get('timeline'); t.entries[todayKey()] = [{id:'dt1',title:'自定目录写入测试',note:'',tag:'工作',start:'12:00',end:'12:30',createdAt:0}]; await Store.save('timeline'); })()`, true);
      report('phase2: 新目录 timeline.json 存在=' + fs.existsSync(path.join(TEST_DATA, 'timeline.json')));
      let retired = 'none';
      try { retired = fs.readdirSync(USER_DATA).filter(d => d.startsWith('data-backup-')).join(','); } catch {}
      report('phase2: 旧目录已重命名为: ' + retired);
      const r2 = await wc.executeJavaScript(`api.resetDataFolder()`, true);
      report('resetDataFolder -> ' + JSON.stringify(r2));
      report('DONE-PHASE2');
    }
  } catch (e) {
    report('FAILED ' + ((e && e.message) || e));
  }
}

async function debugRollover() {
  const wc = win.webContents;
  const fs = require('fs');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = {};
  try {
    await sleep(800);
    await wc.executeJavaScript(`App.nav('day')`, true);
    await sleep(400);
    out.day = await wc.executeJavaScript(`({
      titles: [...document.querySelectorAll('.todo-title')].map(e => e.textContent.trim()),
      carryBadges: document.querySelectorAll('.badge-carry').length,
      summary: document.querySelector('.sum-card').textContent.replace(/\\s+/g, ' ').trim()
    })`, true);
    await wc.executeJavaScript(`App.nav('week')`, true);
    await sleep(400);
    out.week = await wc.executeJavaScript(`({
      titles: [...document.querySelectorAll('.todo-title')].map(e => e.textContent.trim()),
      carryBadges: document.querySelectorAll('.badge-carry').length
    })`, true);
    out.droppedTest = await wc.executeJavaScript(`(async () => {
      markDroppedCopies('daily', 'seed1', todayKey());
      await Store.save('daily');
      return Store.get('daily').todos['2026-09-08'][0].dropped;
    })()`, true);
    // 截图(带顺延标记的页面)
    const shotDir = SHOT_DIR;
    fs.mkdirSync(shotDir, { recursive: true });
    for (const id of ['timeline', 'day', 'week', 'goals', 'recurring', 'notes', 'settings']) {
      await wc.executeJavaScript(`App.nav('${id}')`, true);
      await sleep(450);
      fs.writeFileSync(shotDir + '/' + id + '.png', (await wc.capturePage()).toPNG());
    }
    fs.writeFileSync(shotDir + '/rollover-result.json', JSON.stringify(out, null, 2));
    console.log('[rollover]', JSON.stringify(out));
    console.log('[rollover] DONE');
  } catch (e) {
    console.error('[rollover] FAILED', e);
    try { fs.writeFileSync(path.join(SHOT_DIR, 'rollover-result.json'), JSON.stringify(out, null, 2)); } catch {}
  }
}

async function debugSmoke() {
  const wc = win.webContents;
  const out = { steps: [] };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const run = async (label, expr) => {
      const r = await wc.executeJavaScript(expr, true);
      out.steps.push({ label, result: r });
      console.log('[smoke]', label, JSON.stringify(r));
    };
    await sleep(600);
    await run('boot', `({nav: document.querySelectorAll('.nav-item').length, view: App.view, foot: document.getElementById('sidebar-foot').textContent})`);

    await run('timeline-add', `(async () => {
      const i = document.querySelector('#tl-input');
      i.value = '写周报';
      i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      return { blocks: document.querySelectorAll('.tl-block').length, running: document.querySelectorAll('.running-item').length };
    })()`);

    await run('day-add', `(async () => {
      App.nav('day');
      await new Promise(r=>setTimeout(r,300));
      const i = document.querySelector('#tb-input');
      i.value = '测试每日待办';
      i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      return { todos: document.querySelectorAll('.todo').length, pct: (document.querySelector('.todo-pct')||{}).textContent };
    })()`);

    await run('day-progress', `(async () => {
      const rg = document.querySelector('.todo-range');
      rg.value = '50'; rg.dispatchEvent(new Event('input',{bubbles:true})); rg.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      const t = Store.get('daily').todos[todayKey()][0];
      return { progress: t.progress, done: t.done };
    })()`);

    await run('week', `(async () => {
      App.nav('week');
      await new Promise(r=>setTimeout(r,300));
      const i = document.querySelector('#tb-input');
      i.value = '测试每周待办';
      i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      return { chips: document.querySelectorAll('.day-chip').length, todos: document.querySelectorAll('.todo').length };
    })()`);

    await run('goals', `(async () => {
      const g = Store.get('goals');
      g.goals.push({id:'smoke-g1',title:'考取 PMP 证书',desc:'年底前拿证,每天推进一点',deadline:'',progress:30,status:'active',logs:[{date:todayKey(),to:30,note:'起步 30%'}],createdAt:Date.now()});
      await Store.save('goals');
      App.nav('goals');
      await new Promise(r=>setTimeout(r,300));
      return { cards: document.querySelectorAll('.goal-card').length };
    })()`);

    await run('recurring', `(async () => {
      const t = Store.get('recurring');
      t.tasks.push({id:'smoke-r1',title:'背 50 个单词',rule:{type:'daily'},history:[],createdAt:Date.now()});
      await Store.save('recurring');
      App.nav('recurring');
      await new Promise(r=>setTimeout(r,300));
      return { rows: document.querySelectorAll('.rec-row').length };
    })()`);

    await run('checkin', `(async () => {
      App.nav('day');
      await new Promise(r=>setTimeout(r,300));
      const b = document.querySelector('[data-rec]');
      if (b) b.click();
      await new Promise(r=>setTimeout(r,300));
      return { done: Store.get('recurring').tasks[0].history.length };
    })()`);

    await run('notes', `(async () => {
      App.nav('notes');
      await new Promise(r=>setTimeout(r,300));
      const ta = document.querySelector('#note-text');
      ta.value = '今天心情不错,应用刚搭好,记一笔。\\n[测试] 随心记工作正常';
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,800));
      return { sideItems: document.querySelectorAll('.note-item').length, hint: document.getElementById('note-hint').textContent };
    })()`);

    await run('settings', `(async () => {
      App.nav('settings');
      await new Promise(r=>setTimeout(r,400));
      return { rows: document.querySelectorAll('.setting-row').length, hotkey: document.getElementById('st-hotkey').textContent, dir: !!document.querySelector('.path-code') };
    })()`);

    // 各页面截图
    const fs = require('fs');
    const shotDir = SHOT_DIR;
    fs.mkdirSync(shotDir, { recursive: true });
    for (const id of ['timeline', 'day', 'week', 'goals', 'recurring', 'notes', 'settings']) {
      await wc.executeJavaScript(`App.nav('${id}')`, true);
      await sleep(450);
      const img = await wc.capturePage();
      fs.writeFileSync(shotDir + '/' + id + '.png', img.toPNG());
    }
    await wc.executeJavaScript(`document.documentElement.dataset.theme='dark'`, true);
    await sleep(350);
    await wc.executeJavaScript(`App.nav('timeline')`, true);
    await sleep(450);
    fs.writeFileSync(shotDir + '/dark-timeline.png', (await wc.capturePage()).toPNG());
    await wc.executeJavaScript(`document.documentElement.dataset.theme='light'`, true);

    fs.writeFileSync(shotDir + '/smoke-result.json', JSON.stringify(out, null, 2));
    console.log('[smoke] DONE');
  } catch (e) {
    console.error('[smoke] FAILED', e);
    try { fs.writeFileSync(path.join(SHOT_DIR, 'smoke-result.json'), JSON.stringify(out, null, 2)); } catch {}
  }
}
