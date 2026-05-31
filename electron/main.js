const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const extractZip = require('extract-zip');

const defaultNick = 'YTArturWayUa';
const version = '1.21.4';
const iconPath = path.join(__dirname, 'assets', 'pulse-icon.png');
const defaultDownloadUrl = 'https://github.com/Tarasproger-ui/CrackedPulse-launcher-site/releases/latest/download/CrackedPulse.zip';

let mainWindow;
let gameProcess;
let installInProgress = false;

app.setAppUserModelId('ua.crackedpulse.launcher');

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getGameRootFromInstallDir(installDir) {
  if (path.basename(installDir).toLowerCase() === 'crackedpulse') {
    return installDir;
  }

  return path.join(installDir, 'CrackedPulse');
}

function defaultInstallDir() {
  return app.getPath('downloads');
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
  const installDir = settings.installDir || defaultInstallDir();
  const gameRoot = settings.gameRoot || getGameRootFromInstallDir(installDir);
  return {
    nickname: sanitizeNick(settings.nickname),
    installDir,
    gameRoot,
    downloadUrl: settings.downloadUrl || defaultDownloadUrl,
    memoryMb: Number(settings.memoryMb) || 4096,
    closeAfterLaunch: Boolean(settings.closeAfterLaunch)
  };
}

function saveSettings(nextSettings) {
  const current = readSettings();
  const installDir = nextSettings.installDir ?? current.installDir;
  const gameRoot = nextSettings.gameRoot ?? getGameRootFromInstallDir(installDir);
  const settings = {
    ...current,
    ...nextSettings,
    installDir,
    gameRoot,
    downloadUrl: nextSettings.downloadUrl ?? current.downloadUrl,
    nickname: sanitizeNick(nextSettings.nickname ?? current.nickname),
    memoryMb: Number(nextSettings.memoryMb ?? current.memoryMb) || 4096,
    closeAfterLaunch: Boolean(nextSettings.closeAfterLaunch ?? current.closeAfterLaunch)
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

function sendInstallProgress(payload) {
  mainWindow?.webContents.send('install:progress', payload);
}

function downloadFile(url, outputPath, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error('Забагато перенаправлень завантаження.'));
  }

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url).toString();
        response.resume();
        downloadFile(nextUrl, outputPath, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        if (response.statusCode === 404) {
          reject(new Error('Не знайдено CrackedPulse.zip у GitHub Release. Завантаж CrackedPulse.zip у latest release з точно такою назвою файлу.'));
          return;
        }
        reject(new Error(`Не вдалося скачати Minecraft: HTTP ${response.statusCode}`));
        return;
      }

      const total = Number(response.headers['content-length']) || 0;
      let downloaded = 0;
      const file = fs.createWriteStream(outputPath);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        sendInstallProgress({
          phase: 'download',
          percent: total ? Math.round((downloaded / total) * 100) : 0,
          message: total ? `Скачування ${Math.round((downloaded / total) * 100)}%` : 'Скачування...'
        });
      });

      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });

    request.on('error', reject);
  });
}

async function installGame() {
  if (installInProgress) {
    return { ok: false, message: 'Minecraft вже скачується.' };
  }

  installInProgress = true;
  const settings = readSettings();
  const tempZip = path.join(app.getPath('temp'), `CrackedPulse-${Date.now()}.zip`);
  const extractDir = path.join(app.getPath('temp'), `CrackedPulse-install-${Date.now()}`);

  try {
    fs.mkdirSync(settings.installDir, { recursive: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    sendInstallProgress({ phase: 'download', percent: 0, message: 'Починаю скачування...' });
    await downloadFile(settings.downloadUrl, tempZip);

    sendInstallProgress({ phase: 'extract', percent: 100, message: 'Розпаковую...' });
    await extractZip(tempZip, { dir: extractDir });

    const extractedRoot = path.join(extractDir, 'CrackedPulse');
    const sourceRoot = fs.existsSync(extractedRoot) ? extractedRoot : extractDir;
    if (!isValidGameRoot(sourceRoot)) {
      throw new Error('Архів має містити loader-1.21.4.ps1 і папку game.');
    }

    fs.rmSync(settings.gameRoot, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(settings.gameRoot), { recursive: true });
    fs.renameSync(sourceRoot, settings.gameRoot);

    const saved = saveSettings({
      installDir: settings.installDir,
      gameRoot: settings.gameRoot
    });

    sendInstallProgress({ phase: 'done', percent: 100, message: 'Minecraft встановлено.' });
    return {
      ok: true,
      message: 'Minecraft встановлено.',
      ...saved,
      validGameRoot: isValidGameRoot(saved.gameRoot)
    };
  } catch (error) {
    sendInstallProgress({ phase: 'error', percent: 0, message: error.message });
    return { ok: false, message: error.message };
  } finally {
    installInProgress = false;
    fs.rmSync(tempZip, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 580,
    resizable: false,
    frame: false,
    transparent: true,
    icon: iconPath,
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

ipcMain.handle('app:choose-install-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Вибери куди скачати CrackedPulse',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const installDir = result.filePaths[0];
  const saved = saveSettings({
    installDir,
    gameRoot: getGameRootFromInstallDir(installDir)
  });
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

ipcMain.handle('game:launch', async (_event, nickname) => {
  if (gameProcess && !gameProcess.killed) {
    return { ok: false, message: 'Minecraft вже запускається.' };
  }

  let settings = saveSettings({ nickname });

  if (!isValidGameRoot(settings.gameRoot)) {
    const installResult = await installGame();
    if (!installResult.ok) {
      return installResult;
    }
    settings = saveSettings({ nickname });
  }

  const paths = getRunOnlyPaths(settings.gameRoot);

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
    if (readSettings().closeAfterLaunch && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    mainWindow?.webContents.send('game:stopped');
  });

  gameProcess.unref();

  if (settings.closeAfterLaunch) {
    mainWindow?.hide();
  }

  return {
    ok: true,
    message: `Запускаю як ${settings.nickname}...`,
    nickname: settings.nickname,
    installDir: settings.installDir,
    gameRoot: settings.gameRoot,
    memoryMb: settings.memoryMb,
    closeAfterLaunch: settings.closeAfterLaunch,
    validGameRoot: true
  };
});
