const fs = require('fs');
const path = require('path');

const ACTIVE_TAB_DIAGNOSTIC_SCRIPT = `
(() => {
  const truncate = (value, max = 50000) => {
    const text = String(value || '');
    return text.length > max ? text.slice(0, max) : text;
  };

  const readAttribute = (element, name) => {
    try {
      return element.getAttribute(name) || '';
    } catch (error) {
      return '';
    }
  };

  const collectElements = () => {
    const candidates = [];
    const keywords = [
      'guardado',
      'saved',
      'last saved',
      'ultima',
      'ultima vez',
      'modificado',
      'modified',
      'folder',
      'carpeta',
      'ubicacion',
      'location',
      'path',
      'onedrive',
      'sharepoint',
      'archivo',
      'file'
    ];

    const nodes = Array.from(document.querySelectorAll('*'));

    for (const el of nodes) {
      const text = (el.innerText || el.textContent || '').trim();
      const aria = readAttribute(el, 'aria-label');
      const title = readAttribute(el, 'title');
      const alt = readAttribute(el, 'alt');
      const dataAutomationId = readAttribute(el, 'data-automation-id') || readAttribute(el, 'data-automationid');
      const role = readAttribute(el, 'role');
      const id = el.id || '';
      const className = typeof el.className === 'string' ? el.className : '';
      const combined = [text, aria, title, alt, dataAutomationId, role, id, className].join(' ').toLowerCase();

      if (keywords.some((keyword) => combined.includes(keyword))) {
        candidates.push({
          tag: el.tagName,
          id,
          className,
          role,
          dataAutomationId,
          aria,
          title,
          alt,
          text: truncate(text, 1000)
        });
      }
    }

    return candidates.slice(0, 500);
  };

  const collectMeta = () => {
    return Array.from(document.querySelectorAll('meta')).map((meta) => ({
      name: readAttribute(meta, 'name'),
      property: readAttribute(meta, 'property'),
      content: readAttribute(meta, 'content')
    }));
  };

  const collectLinks = () => {
    return Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
      text: truncate((anchor.innerText || anchor.textContent || '').trim(), 300),
      title: readAttribute(anchor, 'title'),
      aria: readAttribute(anchor, 'aria-label'),
      href: anchor.href
    })).slice(0, 500);
  };

  const collectScriptsText = () => {
    return Array.from(document.querySelectorAll('script'))
      .map((script) => script.textContent || '')
      .filter((text) => /saved|guardado|modified|modificado|folder|carpeta|location|ubicaci|onedrive|sharepoint|file|archivo/i.test(text))
      .map((text) => truncate(text, 5000))
      .slice(0, 50);
  };

  const collectPerformanceResources = () => {
    try {
      return performance.getEntriesByType('resource')
        .map((resource) => ({
          name: resource.name,
          initiatorType: resource.initiatorType
        }))
        .filter((resource) => /onedrive|sharepoint|office|word|excel|powerpoint|wac|metadata|drive|item|file/i.test(resource.name))
        .slice(0, 500);
    } catch (error) {
      return { error: String(error) };
    }
  };

  const collectWindowKeys = () => {
    try {
      return Object.keys(window)
        .filter((key) => /office|odsp|onedrive|sharepoint|wac|word|excel|power|file|drive|item|boot|config|app/i.test(key))
        .slice(0, 300);
    } catch (error) {
      return { error: String(error) };
    }
  };

  return {
    capturedAt: new Date().toISOString(),
    location: {
      href: window.location.href,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    },
    document: {
      title: document.title,
      readyState: document.readyState,
      referrer: document.referrer,
      bodyInnerTextSample: truncate(document.body?.innerText || '', 50000),
      bodyTextContentSample: truncate(document.body?.textContent || '', 50000)
    },
    meta: collectMeta(),
    links: collectLinks(),
    candidateElements: collectElements(),
    matchingScripts: collectScriptsText(),
    performanceResources: collectPerformanceResources(),
    windowKeys: collectWindowKeys()
  };
})()
`;

function createActiveTabDiagnosticsExporter({
  app,
  getTabs,
  getActiveTabId,
  showWebNotification,
  logger
}) {
  function getActiveTab() {
    return getTabs().find((tab) => tab.id === getActiveTabId()) || null;
  }

  function getDiagnosticsDirectory() {
    return path.join(app.getPath('userData'), 'diagnostics');
  }

  function getSafeFilePart(value = 'tab') {
    const safeValue = String(value || 'tab')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return safeValue || 'tab';
  }

  async function exportActiveTabDiagnostics() {
    const activeTab = getActiveTab();

    if (!activeTab || !activeTab.view || activeTab.view.webContents.isDestroyed()) {
      throw new Error('No hay una pestaña activa disponible para diagnosticar.');
    }

    const webContents = activeTab.view.webContents;
    const capturedAt = new Date();
    const dump = await webContents.executeJavaScript(ACTIVE_TAB_DIAGNOSTIC_SCRIPT, true);
    const payload = {
      app: {
        name: app.getName(),
        version: app.getVersion()
      },
      activeTab: {
        id: activeTab.id,
        title: activeTab.title,
        fullTitle: activeTab.fullTitle,
        url: activeTab.url,
        webContentsUrl: webContents.getURL(),
        webContentsTitle: webContents.getTitle(),
        isPrimary: Boolean(activeTab.isPrimary),
        isDetached: Boolean(activeTab.isDetached),
        partition: activeTab.partition || null,
        appId: activeTab.appId || null
      },
      dump
    };

    const diagnosticsDirectory = getDiagnosticsDirectory();
    fs.mkdirSync(diagnosticsDirectory, { recursive: true });

    const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-');
    const titlePart = getSafeFilePart(activeTab.title || activeTab.fullTitle || `tab-${activeTab.id}`);
    const filePath = path.join(diagnosticsDirectory, `active-tab-${activeTab.id}-${titlePart}-${timestamp}.json`);

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    logger?.info?.('Active tab diagnostics exported', {
      tabId: activeTab.id,
      filePath
    });
    showWebNotification?.(`Diagnóstico exportado: ${filePath}`, 'success');

    return {
      ok: true,
      filePath,
      tabId: activeTab.id,
      url: activeTab.url
    };
  }

  return {
    exportActiveTabDiagnostics
  };
}

module.exports = {
  createActiveTabDiagnosticsExporter
};
