import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';
import { isSafeExternalUrl, windowOptions } from './window-options';

function createMainWindow() {
  const window = new BrowserWindow(
    windowOptions(join(import.meta.dirname, '../preload/index.cjs')),
  );
  window.once('ready-to-show', () => window.show());

  // Links open in the system browser; the app window never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) void window.loadURL(devServer);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

void app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
