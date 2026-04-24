function registerIpcHandlers({
  app,
  ipcMain,
  configManager,
  floatingModal,
  tabDragGhost,
  getMainWindow,
  getTabs,
  getActiveTabId,
  getEffectiveUserAgent,
  createTab,
  switchTab,
  closeTab,
  reloadTab,
  moveTab,
  reorderTabs,
  detachTabToWindow,
  toggleFavoriteForTab,
  sendTabsUpdate,
  persistRestorableTabs,
  showWebNotification
}) {
  ipcMain.on('create-tab', (event, url) => {
    createTab(url, true);
  });

  ipcMain.on('switch-tab', (event, tabId) => {
    switchTab(tabId);
  });

  ipcMain.on('close-tab', (event, tabId) => {
    closeTab(tabId);
  });

  ipcMain.on('reload-tab', (event, tabId) => {
    reloadTab(tabId);
  });

  ipcMain.on('move-tab', (event, tabId, targetIndex) => {
    moveTab(tabId, targetIndex);
  });

  ipcMain.on('reorder-tabs', (event, orderedIds) => {
    reorderTabs(orderedIds);
  });

  ipcMain.on('detach-tab-to-window', (event, tabId) => {
    tabDragGhost.hide();
    detachTabToWindow(tabId);
  });

  ipcMain.on('show-tab-drag-ghost', (event, payload) => {
    tabDragGhost.show(payload);
  });

  ipcMain.on('move-tab-drag-ghost', (event, payload) => {
    tabDragGhost.move(payload);
  });

  ipcMain.on('hide-tab-drag-ghost', () => {
    tabDragGhost.hide();
  });

  ipcMain.on('window-control', (event, action) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        mainWindow.close();
        break;
    }
  });

  ipcMain.handle('toggle-maximize', () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return false;

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }

    mainWindow.maximize();
    return true;
  });

  ipcMain.on('toggle-floating-modal', (event, config) => {
    floatingModal.toggle(config || {});
  });

  ipcMain.on('open-floating-modal', (event, config) => {
    const type = config && typeof config.type === 'string' ? config.type : null;
    const payload = config && typeof config.payload === 'object' ? config.payload : {};
    if (!type) return;
    floatingModal.open(type, payload);
  });

  ipcMain.on('close-floating-modal', () => {
    floatingModal.close();
  });

  ipcMain.on('floating-tab-info:hover', (_event, payload = {}) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('tab-info-hover-state', { inside: Boolean(payload.inside) });
  });

  ipcMain.on('floating-tab-info:toggle-favorite', (_event, payload = {}) => {
    const result = toggleFavoriteForTab(Number(payload.tabId));
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-info-favorite-toggle', result);
    }
    sendTabsUpdate();
  });

  ipcMain.on('floating-tab-info:detach', (_event, payload = {}) => {
    floatingModal.close();
    detachTabToWindow(Number(payload.tabId));
  });

  ipcMain.handle('floating-modal:get-state', () => {
    return floatingModal.getState();
  });

  ipcMain.on('floating-modal:notify', (event, payload) => {
    if (!payload || !payload.message) return;
    showWebNotification(payload.message, payload.type || 'info');
  });

  ipcMain.on('open-url-in-active-tab', (event, url) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || !url) return;

    const activeTab = getTabs().find((tab) => tab.id === getActiveTabId());
    if (activeTab && activeTab.view) {
      activeTab.url = url;
      activeTab.view.webContents.loadURL(url);
      sendTabsUpdate();
    } else {
      createTab(url, true);
    }
  });

  ipcMain.handle('get-main-url', () => {
    return configManager.getMainUrl();
  });

  ipcMain.handle('set-main-url', (event, url) => {
    configManager.setMainUrl(url);

    const activeTab = getTabs().find((tab) => tab.id === getActiveTabId());
    if (activeTab && activeTab.view) {
      activeTab.url = url;
      activeTab.view.webContents.loadURL(url);
      sendTabsUpdate();
    }

    return true;
  });

  ipcMain.handle('get-user-agent', () => {
    return configManager.getUserAgent();
  });

  ipcMain.handle('set-user-agent', (event, userAgent) => {
    configManager.setUserAgent(userAgent);

    const activeTab = getTabs().find((tab) => tab.id === getActiveTabId());
    if (activeTab && activeTab.view) {
      activeTab.view.webContents.setUserAgent(getEffectiveUserAgent());
    }

    return true;
  });

  ipcMain.handle('get-theme', () => {
    return configManager.getTheme();
  });

  ipcMain.handle('set-theme', (event, theme) => {
    configManager.setTheme(theme);
    return true;
  });

  ipcMain.handle('get-reopen-tabs-on-launch', () => {
    return configManager.getReopenTabsOnLaunch();
  });

  ipcMain.handle('set-reopen-tabs-on-launch', (event, enabled) => {
    configManager.setReopenTabsOnLaunch(enabled);
    persistRestorableTabs();
    return true;
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });
}

module.exports = {
  registerIpcHandlers
};
