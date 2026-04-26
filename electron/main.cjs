const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http');
const path = require('path');

const isDev = !app.isPackaged;
const isWindows = process.platform === 'win32';
const WINDOW_ICON_PATH = path.join(__dirname, 'assets', isWindows ? 'icon.ico' : 'icon.png');
const DEV_HOST = process.env.VITE_DEV_HOST || 'localhost';
const DEV_PORT_START = Number(process.env.VITE_DEV_PORT_START || 5173);
const DEV_PORT_END = Number(process.env.VITE_DEV_PORT_END || 5190);
const DEV_SERVER_WAIT_MS = Number(process.env.VITE_DEV_SERVER_WAIT_MS || 30000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isViteServerUp(baseUrl) {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/@vite/client`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolveDevServerUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  const start = Date.now();

  while (Date.now() - start < DEV_SERVER_WAIT_MS) {
    for (let port = DEV_PORT_END; port >= DEV_PORT_START; port -= 1) {
      const baseUrl = `http://${DEV_HOST}:${port}`;
      if (await isViteServerUp(baseUrl)) {
        return baseUrl;
      }
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for Vite dev server on ports ${DEV_PORT_START}-${DEV_PORT_END}.`
  );
}

async function createWindow() {
  const { workAreaSize, workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1400, workAreaSize.width);

  const win = new BrowserWindow({
    width,
    height: workAreaSize.height,
    x: Math.round(workArea.x + (workAreaSize.width - width) / 2),
    y: workArea.y,
    icon: WINDOW_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const devServerUrl = await resolveDevServerUrl();
    console.log(`Using Vite dev server: ${devServerUrl}`);
    await win.loadURL(devServerUrl);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Налична е нова версия',
      message: 'Нова версия беше изтеглена. Рестартирайте приложението за да инсталирате update-а.',
      buttons: ['Рестартирай сега', 'По-късно'],
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Auto-update check failed:', err);
  });
}

ipcMain.on('app:quit', () => {
  app.quit();
});

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error('Failed to create Electron window:', error);
    app.quit();
  });

  if (!isDev) {
    setupAutoUpdater();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
