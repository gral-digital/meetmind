const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require("electron");

let mainWindow = null;

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    x: screenWidth - 400,
    y: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 300,
    minHeight: 400,
    maxWidth: 600,
    maxHeight: 900,
    hasShadow: false,
    movable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.setAlwaysOnTop(true, "floating");

  // Register toggle shortcut
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// Manual drag handling — renderer sends mouse deltas
ipcMain.on("drag-start", (_, { mouseX, mouseY }) => {
  if (mainWindow) {
    const [winX, winY] = mainWindow.getPosition();
    mainWindow._dragOffset = { x: mouseX - winX, y: mouseY - winY };
  }
});

ipcMain.on("drag-move", (_, { mouseX, mouseY }) => {
  if (mainWindow && mainWindow._dragOffset) {
    mainWindow.setPosition(
      mouseX - mainWindow._dragOffset.x,
      mouseY - mainWindow._dragOffset.y
    );
  }
});

// Manual resize handling
ipcMain.on("resize-start", (_, { mouseX, mouseY }) => {
  if (mainWindow) {
    const [w, h] = mainWindow.getSize();
    mainWindow._resizeStart = { mouseX, mouseY, width: w, height: h };
  }
});

ipcMain.on("resize-move", (_, { mouseX, mouseY }) => {
  if (mainWindow && mainWindow._resizeStart) {
    const { mouseX: startX, mouseY: startY, width, height } = mainWindow._resizeStart;
    const newWidth = Math.max(300, Math.min(600, width + (mouseX - startX)));
    const newHeight = Math.max(400, Math.min(900, height + (mouseY - startY)));
    mainWindow.setSize(Math.round(newWidth), Math.round(newHeight));
  }
});

ipcMain.on("resize-end", () => {
  if (mainWindow) {
    mainWindow._resizeStart = null;
  }
});

ipcMain.on("drag-end", () => {
  if (mainWindow) {
    mainWindow._dragOffset = null;
  }
});

app.whenReady().then(createWindow);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  app.quit();
});
