const HIDE_APP_LAUNCHER_CSS = `
  #O365_MainLink_NavMenu,
  #O365_MainLink_NavMenu_Responsive,
  [data-automation-id="appLauncher"],
  [data-automation-id="AppLauncher"],
  [data-automationid="appLauncher"],
  [data-automationid="AppLauncher"],
  button[aria-label="App launcher"],
  button[aria-label="Microsoft 365 app launcher"],
  button[aria-label="Iniciador de aplicaciones"],
  button[title="App launcher"],
  button[title="Microsoft 365 app launcher"],
  button[title="Iniciador de aplicaciones"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

const HIDE_APP_LAUNCHER_SCRIPT = `
  (() => {
    if (window.__o365LinuxDesktopHideAppLauncher) return;
    window.__o365LinuxDesktopHideAppLauncher = true;

    const selectors = [
      '#O365_MainLink_NavMenu',
      '#O365_MainLink_NavMenu_Responsive',
      '[data-automation-id="appLauncher"]',
      '[data-automation-id="AppLauncher"]',
      '[data-automationid="appLauncher"]',
      '[data-automationid="AppLauncher"]',
      'button[aria-label="App launcher"]',
      'button[aria-label="Microsoft 365 app launcher"]',
      'button[aria-label="Iniciador de aplicaciones"]',
      'button[title="App launcher"]',
      'button[title="Microsoft 365 app launcher"]',
      'button[title="Iniciador de aplicaciones"]'
    ];

    const hideLauncher = () => {
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          element.style.setProperty('display', 'none', 'important');
          element.style.setProperty('visibility', 'hidden', 'important');
          element.style.setProperty('pointer-events', 'none', 'important');
          element.setAttribute('aria-hidden', 'true');
          element.setAttribute('tabindex', '-1');
        });
      });
    };

    hideLauncher();

    const observer = new MutationObserver(hideLauncher);
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'title', 'aria-label', 'data-automation-id', 'data-automationid']
    });
  })();
`;

function applyMicrosoftAppLauncherHiding(webContents, logger) {
  if (!webContents || webContents.isDestroyed()) return;
  if (webContents.__o365LinuxDesktopAppLauncherHiderAttached) return;
  webContents.__o365LinuxDesktopAppLauncherHiderAttached = true;

  const apply = () => {
    if (!webContents || webContents.isDestroyed()) return;

    webContents.insertCSS(HIDE_APP_LAUNCHER_CSS).catch((error) => {
      logger?.warn?.('No se pudo insertar CSS para ocultar el app launcher de Microsoft 365', {
        error: {
          message: error.message
        }
      });
    });

    webContents.executeJavaScript(HIDE_APP_LAUNCHER_SCRIPT, true).catch((error) => {
      logger?.warn?.('No se pudo ejecutar el ocultador del app launcher de Microsoft 365', {
        error: {
          message: error.message
        }
      });
    });
  };

  webContents.on('dom-ready', apply);
  webContents.on('did-finish-load', apply);
}

module.exports = {
  applyMicrosoftAppLauncherHiding
};
