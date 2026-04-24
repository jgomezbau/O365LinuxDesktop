const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { parentPort } = require('worker_threads');
const { fileTypeToAppCommand } = require('../native/nativeAppCatalog');

let detectedAppsCache = null;

function execFileAsync(command, args = {}, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function detectInstalledApps() {
  if (detectedAppsCache) return detectedAppsCache;
  if (process.platform !== 'linux') return {};

  const result = {};
  const allApps = new Set();
  Object.values(fileTypeToAppCommand).forEach((typeInfo) => {
    typeInfo.apps.forEach((app) => {
      allApps.add(app.split(' ')[0]);
    });
  });

  for (const appName of allApps) {
    try {
      const { stdout } = await execFileAsync('which', [appName]);
      if (stdout.trim()) {
        result[appName] = stdout.trim();
      }
    } catch (error) {
      // App not installed.
    }
  }

  if (result.libreoffice) {
    result['libreoffice --writer'] = result.libreoffice;
    result['libreoffice --calc'] = result.libreoffice;
    result['libreoffice --impress'] = result.libreoffice;
  }

  detectedAppsCache = result;
  return result;
}

async function getAvailableAppsForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!extension) return [];

  const fileType = fileTypeToAppCommand[extension];
  if (!fileType) return [];

  const installedApps = await detectInstalledApps();
  return fileType.apps
    .filter((appCmd) => {
      const appName = appCmd.split(' ')[0];
      return Boolean(installedApps[appName] || installedApps[appCmd]);
    })
    .map((appCmd) => {
      const appName = appCmd.split(' ')[0];
      return {
        name: appName.charAt(0).toUpperCase() + appName.slice(1),
        command: appCmd,
        path: installedApps[appName] || installedApps[appCmd]
      };
    });
}

async function downloadAndOpenWithApp(url, appCommand) {
  let fileName = path.basename(url).split('?')[0];
  if (!fileName || fileName.length < 3) {
    const extension = url.match(/\.(docx|xlsx|pptx|pdf|txt|jpg|png)(\?|$)/i);
    fileName = `file-${Date.now()}${extension ? `.${extension[1]}` : ''}`;
  }

  const tempDir = path.join(os.tmpdir(), 'ms365app');
  await fs.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, fileName);

  await execFileAsync('curl', ['-L', '-o', filePath, url]);

  const [command, ...baseArgs] = String(appCommand || '').split(/\s+/).filter(Boolean);
  if (!command) return false;

  await execFileAsync(command, [...baseArgs, filePath]);
  return true;
}

async function handleMessage(message) {
  switch (message.action) {
    case 'detectInstalledApps':
      return detectInstalledApps();
    case 'getAvailableAppsForFile':
      return getAvailableAppsForFile(message.payload.filePath);
    case 'downloadAndOpenWithApp':
      return downloadAndOpenWithApp(message.payload.url, message.payload.appCommand);
    default:
      throw new Error(`Unknown native app worker action: ${message.action}`);
  }
}

parentPort.on('message', async (message) => {
  try {
    const result = await handleMessage(message || {});
    parentPort.postMessage({ id: message.id, ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      id: message?.id,
      ok: false,
      error: {
        message: error.message
      }
    });
  }
});
