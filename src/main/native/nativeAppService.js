const path = require('path');
const { fileTypeToAppCommand } = require('./nativeAppCatalog');
const { createWorkerClient } = require('../workers/workerClient');

function detectFileType(url) {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const extension = path.extname(pathname);

    if (extension && fileTypeToAppCommand[extension]) {
      return fileTypeToAppCommand[extension].name;
    }

    if (url.includes('/download?') || url.includes('/Download?')) {
      if (url.includes('docx') || url.includes('document')) return 'Word';
      if (url.includes('xlsx') || url.includes('spreadsheet')) return 'Hoja de cálculo';
      if (url.includes('pptx') || url.includes('presentation')) return 'PowerPoint';
      if (url.includes('pdf')) return 'PDF';
    }

    return '';
  } catch (error) {
    return '';
  }
}

function createNativeAppService({ workerPath, logger }) {
  const workerClient = createWorkerClient(workerPath, { timeoutMs: 45000 });

  async function request(action, payload) {
    try {
      return await workerClient.request(action, payload);
    } catch (error) {
      logger?.error?.(`Native app worker failed: ${action}`, error, { action });
      if (action === 'downloadAndOpenWithApp') return false;
      return action === 'detectInstalledApps' ? {} : [];
    }
  }

  return {
    detectFileType,
    detectInstalledApps: () => request('detectInstalledApps', {}),
    getAvailableAppsForFile: (filePath) => request('getAvailableAppsForFile', { filePath }),
    downloadAndOpenWithApp: (url, appCommand) => request('downloadAndOpenWithApp', { url, appCommand })
  };
}

module.exports = {
  createNativeAppService,
  detectFileType
};
