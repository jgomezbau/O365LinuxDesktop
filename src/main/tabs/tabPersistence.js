function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTabPersistence({
  configManager,
  defaultPartition,
  sanitizeRestorableUrl,
  getTabs,
  createTab,
  logger
}) {
  function persistRestorableTabs() {
    if (!configManager.getReopenTabsOnLaunch()) {
      configManager.saveTabs([]);
      configManager.setActiveTabId(null);
      return;
    }

    const restorableTabs = getTabs()
      .filter((tab) => !tab.isPrimary)
      .map((tab) => ({
        url: sanitizeRestorableUrl(
          tab.restorableUrl ||
          ((tab.view && !tab.view.webContents.isDestroyed() && tab.view.webContents.getURL()) || tab.url)
        ),
        partition: tab.partition || defaultPartition,
        appId: tab.appId || null,
        title: tab.title || '',
        fullTitle: tab.fullTitle || tab.title || ''
      }))
      .filter((tab) => tab.url && tab.url !== 'about:blank');

    configManager.saveTabs(restorableTabs);
    configManager.setActiveTabId(null);
  }

  async function restoreSavedTabsAfterPrimaryLoad(primaryTab, savedTabs) {
    if (!savedTabs.length) {
      persistRestorableTabs();
      return;
    }

    const primaryWebContents = primaryTab?.view?.webContents;
    if (!primaryWebContents || primaryWebContents.isDestroyed()) return;

    const runRestoreQueue = async () => {
      let isFirstTab = true;

      for (const savedTab of savedTabs) {
        if (!savedTab || !savedTab.url) continue;

        if (!isFirstTab) {
          await delay(1300);
        }

        createTab({
          url: savedTab.url,
          partition: savedTab.partition || defaultPartition,
          appId: savedTab.appId || null,
          restoredAtStartup: true
        }, false);

        isFirstTab = false;
      }
    };

    if (!primaryWebContents.isLoadingMainFrame()) {
      await runRestoreQueue();
      return;
    }

    primaryWebContents.once('did-finish-load', () => {
      runRestoreQueue().catch((error) => {
        logger.error('No se pudieron restaurar algunas pestañas al iniciar', error);
      });
    });
  }

  return {
    persistRestorableTabs,
    restoreSavedTabsAfterPrimaryLoad
  };
}

module.exports = {
  createTabPersistence
};
