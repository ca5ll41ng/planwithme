const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const COLLECTIONS = ['settings', 'timeline', 'daily', 'weekly', 'goals', 'recurring', 'notes'];
const USER_DATA = app.getPath('userData');
const LOCATION_FILE = path.join(USER_DATA, 'data-location.json');

// 数据目录:默认 userData/data,可由用户在设置中迁移到任意本地目录(记录在 data-location.json)
function resolveDataDir() {
  try {
    const cfg = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
    if (cfg && cfg.dataDir) return cfg.dataDir;
  } catch {}
  return path.join(USER_DATA, 'data');
}
let DATA_DIR = resolveDataDir();
const DEFAULT_DATA_DIR = path.join(USER_DATA, 'data');

function pad(n) { return String(n).padStart(2, '0'); }
function stamp() {
  const d = new Date();
  return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
function colPath(name) { return path.join(DATA_DIR, name + '.json'); }
function ensureDataDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

async function readCol(name) {
  try { return JSON.parse(await fsp.readFile(colPath(name), 'utf8')); } catch { return null; }
}
async function writeCol(name, data) {
  ensureDataDir();
  const p = colPath(name);
  const tmp = p + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, p).catch(async () => {
    await fsp.copyFile(tmp, p);
    await fsp.unlink(tmp).catch(() => {});
  });
}
function readSettingsSync() {
  try { return JSON.parse(fs.readFileSync(colPath('settings'), 'utf8')); } catch { return {}; }
}

async function backupNow() {
  ensureDataDir();
  const name = 'backup-' + stamp();
  const dir = path.join(DATA_DIR, 'backups', name);
  await fsp.mkdir(dir, { recursive: true });
  for (const c of COLLECTIONS) {
    try { await fsp.copyFile(colPath(c), path.join(dir, c + '.json')); } catch {}
  }
  try {
    const root = path.join(DATA_DIR, 'backups');
    const dirs = (await fsp.readdir(root)).filter(x => x.startsWith('backup-')).sort();
    while (dirs.length > 10) await fsp.rm(path.join(root, dirs.shift()), { recursive: true, force: true });
  } catch {}
  return dir;
}

function createWindow() {
  const s = readSettingsSync();
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: s.theme === 'dark' ? '#12151d' : '#f4f6fb',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); });
  require('./scripts/dev-debug').attachDebug(win);
  win.on('close', (e) => {
    if (!quitting && readSettingsSync().closeToTray !== false) {
      e.preventDefault();
      win.hide();
    }
  });
  win.webContents.on('console-message', (...args) => {
    const a = args[0];
    if (a && typeof a === 'object' && 'message' in a) console.log('[renderer]', a.message);
    else console.log('[renderer]', args[2]);
  });
  win.webContents.on('render-process-gone', (_e, d) => console.error('[renderer gone]', d && d.reason));
}

function showWindow() {
  if (!win) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win && win.isVisible() && !win.isMinimized()) {
    win.hide();
  } else {
    showWindow();
    setTimeout(() => { try { win.webContents.send('focus-quick'); } catch {} }, 180);
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('PlanWithMe — 我的日程本');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏 (唤起)', click: toggleWindow },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
}

function registerHotkey(combo) {
  try {
    if (currentHotkey) globalShortcut.unregister(currentHotkey);
    if (!combo) { currentHotkey = null; return true; }
    const ok = globalShortcut.register(combo, toggleWindow);
    if (ok) { currentHotkey = combo; console.log('[hotkey] 注册成功:', combo); }
    else console.log('[hotkey] 注册失败(可能被占用):', combo);
    return ok;
  } catch (e) {
    console.error('[hotkey] 出错', e);
    return false;
  }
}

function registerIpc() {
  ipcMain.handle('data:read', (_e, name) => COLLECTIONS.includes(name) ? readCol(name) : null);
  ipcMain.handle('data:write', (_e, name, data) => {
    if (!COLLECTIONS.includes(name)) return false;
    return writeCol(name, data).then(() => true).catch(() => false);
  });
  ipcMain.handle('data:info', () => ({ dir: DATA_DIR, version: app.getVersion(), platform: process.platform, custom: path.resolve(DATA_DIR) !== path.resolve(DEFAULT_DATA_DIR) }));
  ipcMain.handle('data:openFolder', async () => { ensureDataDir(); return shell.openPath(DATA_DIR); });
  ipcMain.handle('data:backup', () => backupNow());
  ipcMain.handle('data:pickDir', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '选择数据存储位置',
      properties: ['openDirectory', 'createDirectory']
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('data:changeDir', async (_e, newPath) => {
    try {
      if (!newPath || !path.isAbsolute(newPath)) return { ok: false, msg: '路径无效' };
      if (path.resolve(newPath) === path.resolve(DATA_DIR)) return { ok: false, msg: '新位置与当前数据目录相同' };
      ensureDataDir();
      await fsp.mkdir(newPath, { recursive: true });
      for (const c of COLLECTIONS) {
        try { await fsp.copyFile(colPath(c), path.join(newPath, c + '.json')); } catch {}
      }
      try {
        if (fs.existsSync(path.join(DATA_DIR, 'backups'))) {
          await fsp.cp(path.join(DATA_DIR, 'backups'), path.join(newPath, 'backups'), { recursive: true });
        }
      } catch {}
      await fsp.writeFile(LOCATION_FILE, JSON.stringify({ dataDir: path.resolve(newPath) }, null, 2), 'utf8');
      try { await fsp.rename(DATA_DIR, path.join(USER_DATA, 'data-backup-' + stamp())); } catch {}
      setTimeout(() => { app.relaunch(); app.exit(0); }, 800);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: String((e && e.message) || e) };
    }
  });
  ipcMain.handle('data:resetDir', async () => {
    try {
      await fsp.unlink(LOCATION_FILE).catch(() => {});
      setTimeout(() => { app.relaunch(); app.exit(0); }, 800);
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: String((e && e.message) || e) };
    }
  });
  ipcMain.handle('hotkey:set', (_e, combo) => registerHotkey(combo));
  ipcMain.handle('app:getLoginItem', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('app:setLoginItem', (_e, v) => {
    app.setLoginItemSettings({ openAtLogin: !!v });
    return app.getLoginItemSettings().openAtLogin;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(async () => {
    ensureDataDir();
    registerIpc();
    await backupNow().catch(() => {});
    createWindow();
    createTray();
    const s = readSettingsSync();
    const ok = registerHotkey(s.hotkey || 'CommandOrControl+Alt+P');
    if (!ok) console.log('[hotkey] 已跳过,可在设置中重新配置');
    console.log('[app] PlanWithMe 已启动, 数据目录:', DATA_DIR);
  });

  app.on('window-all-closed', () => { /* 常驻托盘,不退出 */ });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
