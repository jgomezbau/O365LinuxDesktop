function createPopupWindowService({
  BrowserWindow,
  appIcon,
  defaultPartition,
  getEffectiveUserAgent,
  logPrimaryFlow,
  customizeWebContents = () => {}
}) {
  const popupWindows = new Set();

  function track(window) {
    if (!window) return;

    popupWindows.add(window);
    window.setMenuBarVisibility(false);
    const popupWebContents = window.webContents;

    if (popupWebContents) {
      customizeWebContents(popupWebContents);

      popupWebContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
        if (!isMainFrame) return;
        logPrimaryFlow('popup-did-start-navigation', {
          id: popupWebContents.id,
          url,
          isInPlace
        });
      });

      popupWebContents.on('did-redirect-navigation', (event, url, isInPlace, isMainFrame) => {
        if (!isMainFrame) return;
        logPrimaryFlow('popup-did-redirect-navigation', {
          id: popupWebContents.id,
          url,
          isInPlace
        });
      });

      popupWebContents.on('did-finish-load', () => {
        if (popupWebContents.isDestroyed()) return;
        logPrimaryFlow('popup-did-finish-load', {
          id: popupWebContents.id,
          url: popupWebContents.getURL(),
          title: popupWebContents.getTitle()
        });
      });
    }

    window.once('closed', () => {
      popupWindows.delete(window);
    });
  }

  function open(url, partition = defaultPartition) {
    if (!url || url === 'about:blank') return null;

    const popupWindow = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 900,
      minHeight: 640,
      show: true,
      autoHideMenuBar: true,
      backgroundColor: '#FFFFFF',
      icon: appIcon,
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        nativeWindowOpen: true
      }
    });

    popupWindow.webContents.setUserAgent(getEffectiveUserAgent());
    customizeWebContents(popupWindow.webContents);
    popupWindow.setMenuBarVisibility(false);
    track(popupWindow);
    popupWindow.loadURL(url);

    return popupWindow;
  }

  return {
    open,
    track
  };
}

module.exports = {
  createPopupWindowService
};
