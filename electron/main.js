const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const defaultNick = 'YTArturWayUa';
const version = '1.21.4';

let mainWindow;
let gameProcess;

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function defaultGameRoot() {
  return path.join(app.getPath('downloads'), 'CrackedPulse-RunOnly');
}

function sanitizeNick(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || defaultNick;
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function readSettings() {
  const settings = readJson(getSettingsPath(), {});
  return {
    nickname: sanitizeNick(settings.nickname),
    gameRoot: settings.gameRoot || defaultGameRoot(),
    memoryMb: Number(settings.memoryMb) || 4096
  };
}

function saveSettings(nextSettings) {
  const current = readSettings();
  const settings = {
    ...current,
    ...nextSettings,
    nickname: sanitizeNick(nextSettings.nickname ?? current.nickname),
    memoryMb: Number(nextSettings.memoryMb ?? current.memoryMb) || 4096
  };
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

function getRunOnlyPaths(gameRoot) {
  return {
    loader: path.join(gameRoot, `loader-${version}.ps1`),
    launcherDir: path.join(gameRoot, 'launcher'),
    nicknameFile: path.join(gameRoot, 'launcher', 'nickname.dat')
  };
}

function isValidGameRoot(gameRoot) {
  const paths = getRunOnlyPaths(gameRoot);
  return fs.existsSync(paths.loader) && fs.existsSync(path.join(gameRoot, 'game'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 410,
    height: 520,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:get-state', () => {
  const settings = readSettings();
  return {
    ...settings,
    validGameRoot: isValidGameRoot(settings.gameRoot)
  };
});

ipcMain.handle('app:save-settings', (_event, settings) => {
  const saved = saveSettings(settings);
  return {
    ...saved,
    validGameRoot: isValidGameRoot(saved.gameRoot)
  };
});

ipcMain.handle('app:choose-game-root', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Вибери папку CrackedPulse-RunOnly',
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const saved = saveSettings({ gameRoot: result.filePaths[0] });
  return {
    ...saved,
    validGameRoot: isValidGameRoot(saved.gameRoot)
  };
});

ipcMain.handle('app:open-game-root', async () => {
  const { gameRoot } = readSettings();
  await shell.openPath(gameRoot);
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => mainWindow?.close());

ipcMain.handle('game:launch', (_event, nickname) => {
  if (gameProcess && !gameProcess.killed) {
    return { ok: false, message: 'Minecraft вже запускається.' };
  }

  const settings = saveSettings({ nickname });
  const paths = getRunOnlyPaths(settings.gameRoot);

  if (!isValidGameRoot(settings.gameRoot)) {
    return { ok: false, message: 'Вибери правильну папку CrackedPulse-RunOnly у налаштуваннях.' };
  }

  fs.mkdirSync(paths.launcherDir, { recursive: true });
  fs.writeFileSync(paths.nicknameFile, settings.nickname, 'utf8');

  gameProcess = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-File',
      paths.loader,
      '-Nick',
      settings.nickname,
      '-MemoryMb',
      String(settings.memoryMb)
    ],
    {
      cwd: settings.gameRoot,
      windowsHide: true,
      detached: false,
      stdio: 'ignore'
    }
  );

  gameProcess.on('exit', () => {
    gameProcess = undefined;
    mainWindow?.webContents.send('game:stopped');
  });

  gameProcess.unref();
  return { ok: true, message: `Запускаю як ${settings.nickname}...`, nickname: settings.nickname };
});
