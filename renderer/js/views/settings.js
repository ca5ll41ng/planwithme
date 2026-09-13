// ===== 设置页 =====
App.register('settings', {
  _capturing: false,

  async render(mount) {
    const s = Store.get('settings');
    const info = await api.info();
    const loginItem = await api.getLoginItem();
    const hotkeyText = formatCombo(s.hotkey);

    mount.innerHTML = `
      <header class="view-head">
        <div>
          <h2>设置</h2>
          <p class="sub">数据全部保存在本机,不上传任何服务器</p>
        </div>
      </header>

      <div class="card">
        <h3>外观</h3>
        <div class="setting-row">
          <div class="info"><b>主题</b><p>浅色 / 深色模式</p></div>
          <select id="st-theme">
            <option value="light" ${s.theme !== 'dark' ? 'selected' : ''}>浅色</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>唤起快捷键</h3>
        <div class="setting-row">
          <div class="info"><b>全局快捷键</b><p>无论在做什么,按下即可唤起 / 隐藏 PlanWithMe,默认 Ctrl + Alt + P</p></div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="hotkey-display" id="st-hotkey">${esc(hotkeyText)}</span>
            <button class="btn" id="st-hotkey-edit">修改</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>通用</h3>
        <div class="setting-row">
          <div class="info"><b>最小化到托盘</b><p>点击窗口关闭按钮时,隐藏到系统托盘而不退出,随时可用快捷键唤起</p></div>
          <label class="switch-row"><input type="checkbox" id="st-tray" ${s.closeToTray !== false ? 'checked' : ''}>启用</label>
        </div>
        <div class="setting-row">
          <div class="info"><b>开机自启</b><p>登录 Windows 后自动启动(开发模式下指向 electron,打包安装后生效)</p></div>
          <label class="switch-row"><input type="checkbox" id="st-login" ${loginItem ? 'checked' : ''}>启用</label>
        </div>
      </div>

      <div class="card">
        <h3>数据</h3>
        <div class="setting-row">
          <div class="info"><b>数据目录${info.custom ? '(自定义)' : ''}</b><p>所有日程数据以 JSON 明文保存在这里,每次启动自动备份,保留最近 10 份。<br>可迁移到任意本地或网盘同步目录;迁移后原位置会保留一份完整备份。</p>
            <code class="path-code">${esc(info.dir)}</code>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;max-width:260px">
            <button class="btn" id="st-folder">打开文件夹</button>
            <button class="btn" id="st-backup">立即备份</button>
            <button class="btn btn-primary" id="st-move">更改位置</button>
            ${info.custom ? '<button class="btn" id="st-resetdir">恢复默认</button>' : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <h3>关于</h3>
        <div class="setting-row">
          <div class="info"><b>PlanWithMe v${esc(info.version)}</b><p>本地日程本:24 小时时间轴 · 每日/每周计划自动顺延 · 长期任务 · 周期打卡 · 随心记</p></div>
        </div>
      </div>`;

    mount.querySelector('#st-theme').onchange = async (e) => {
      s.theme = e.target.value;
      document.documentElement.dataset.theme = s.theme;
      await Store.save('settings');
      toast('主题已切换', 'ok');
    };

    mount.querySelector('#st-hotkey-edit').onclick = () => this.captureHotkey(mount);

    mount.querySelector('#st-tray').onchange = async (e) => {
      s.closeToTray = e.target.checked;
      await Store.save('settings');
    };

    mount.querySelector('#st-login').onchange = async (e) => {
      const want = e.target.checked;
      const ok = await api.setLoginItem(want);
      e.target.checked = ok;
      if (ok !== want) toast('设置失败,请重试', 'warn');
    };

    mount.querySelector('#st-folder').onclick = () => api.openFolder();
    mount.querySelector('#st-backup').onclick = async () => {
      await api.backup();
      toast('备份完成,已保存到数据目录下的 backups 文件夹', 'ok');
    };
    mount.querySelector('#st-move').onclick = async () => {
      const picked = await api.pickDataFolder();
      if (!picked) return;
      const ok = await confirmDlg({ title: '更改数据位置', message: `将把全部数据(含备份)迁移到:\n${picked}\n\n迁移完成后应用会自动重启;当前目录的数据会保留为备份文件夹。`, danger: false });
      if (!ok) return;
      const r = await api.changeDataFolder(picked);
      if (r.ok) toast('迁移完成,应用即将重启…', 'ok');
      else toast(r.msg || '迁移失败', 'warn');
    };
    const resetBtn = mount.querySelector('#st-resetdir');
    if (resetBtn) resetBtn.onclick = async () => {
      const ok = await confirmDlg({ title: '恢复默认数据位置', message: '应用将改回默认数据目录并重启;自定义目录中的数据会原样保留,不会删除。', danger: false });
      if (!ok) return;
      const r = await api.resetDataFolder();
      if (r.ok) toast('应用即将重启…', 'ok');
      else toast(r.msg || '操作失败', 'warn');
    };
  },

  captureHotkey(mount) {
    if (this._capturing) return;
    this._capturing = true;
    const s = Store.get('settings');
    const m = modal({
      title: '设置唤起快捷键',
      body: `<div class="hotkey-capture" id="hk-capture">请按下新的快捷键组合…<p class="sub" style="margin-top:8px">需包含 Ctrl 或 Alt,按 Esc 取消</p></div>`
    });
    const cleanup = () => { document.removeEventListener('keydown', onKey, true); this._capturing = false; };
    const onKey = async (e) => {
      if (e.key === 'Escape') { cleanup(); m.close(); return; }
      e.preventDefault();
      e.stopPropagation();
      const combo = comboFromEvent(e);
      if (!combo) return;
      if (!combo.modifier) {
        m.el.querySelector('#hk-capture').innerHTML = `❌ 请至少包含 <b>Ctrl</b> 或 <b>Alt</b>,再试一次`;
        return;
      }
      cleanup();
      const ok = await api.setHotkey(combo.str);
      if (ok) {
        s.hotkey = combo.str;
        await Store.save('settings');
        toast(`唤起快捷键已设为 ${formatCombo(combo.str)}`, 'ok');
      } else {
        toast('注册失败,该组合可能被其他软件占用,请换一个', 'warn');
      }
      m.close();
      this.render(mount);
    };
    document.addEventListener('keydown', onKey, true);
  }
});

function comboFromEvent(e) {
  const keyMap = { ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Enter': 'Return', 'Escape': null };
  let key = e.key.length === 1 ? e.key.toUpperCase() : (e.key in keyMap ? keyMap[e.key] : e.key);
  if (!key) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(key);
  return {
    str: parts.join('+'),
    modifier: e.ctrlKey || e.metaKey || e.altKey
  };
}

function formatCombo(combo) {
  return String(combo || '')
    .replace(/CommandOrControl/g, 'Ctrl')
    .split('+').map(p => p.trim()).join(' + ');
}
