const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');

const isDev = !app.isPackaged;
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
    for (let port = DEV_PORT_START; port <= DEV_PORT_END; port += 1) {
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
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  if (isDev) {
    const devServerUrl = await resolveDevServerUrl();
    console.log(`Using Vite dev server: ${devServerUrl}`);
    await win.loadURL(devServerUrl);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error('Failed to create Electron window:', error);
    app.quit();
  });
});
