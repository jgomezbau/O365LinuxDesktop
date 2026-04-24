const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, shell, clipboard, Tray, desktopCapturer, screen, nativeImage } = require('electron');
const path = require('path');
const configManager = require('../config/configManager');
const { configureAppSession } = require('./appSession');
const { createFloatingModalController } = require('./floatingModal');
const { createMainWindowStateManager } = require('./windowState');
const { shouldOpenInternally } = require('./navigation/urlRules');
const { createAppPaths } = require('./app/paths');
const { APP_SESSION_PARTITION, DEBUG_PRIMARY_FLOW, FIREFOX_USER_AGENT, IS_DEV } = require('./app/constants');
const { configureChromiumCommandLine } = require('./app/chromiumSwitches');
const { createLogger } = require('./logging/logger');
const { createNativeAppService } = require('./native/nativeAppService');
const { createTabDragGhostController } = require('./windows/tabDragGhostWindow');
const { createPopupWindowService } = require('./windows/popupWindowService');
const { createOfficeUrlService } = require('./navigation/officeUrlService');
const {
  buildInternalPopupOptions,
  shouldAllowNativeOutlookPopup,
  shouldAllowNativePopup
} = require('./navigation/popupRules');
const { sanitizeRestorableUrl } = require('./navigation/restorableUrl');
const { createFavoriteService } = require('./favorites/favoriteService');
const { createTrayManager } = require('./tray/trayManager');
const { createTabPersistence } = require('./tabs/tabPersistence');
const { registerIpcHandlers } = require('./ipc/registerIpcHandlers');
const { applyMicrosoftAppLauncherHiding } = require('./content/microsoftAppLauncherHider');

// Verificar si estamos en desarrollo
const rootDir = path.join(__dirname, '..', '..');
configureChromiumCommandLine(app);
const appPaths = createAppPaths(rootDir);
const logger = createLogger({ module: 'main' });
const nativeAppService = createNativeAppService({
  workerPath: path.join(__dirname, 'workers', 'nativeApp.worker.js'),
  logger: logger.child({ module: 'native-apps' })
});
const { getAvailableAppsForFile, downloadAndOpenWithApp, detectFileType } = nativeAppService;
const isDev = IS_DEV;
const debugPrimaryFlow = DEBUG_PRIMARY_FLOW;
let mainWindow;
let tray = null; // Variable para mantener la referencia al Tray
let activeMainContentView = null;

const mainWindowState = createMainWindowStateManager({
  configManager,
  screen,
  getMainWindow: () => mainWindow
});

const floatingModal = createFloatingModalController({
  BrowserWindow,
  getMainWindow: () => mainWindow,
  preloadPath: appPaths.modalPreload,
  modalHtmlPath: appPaths.modalHtml
});

const tabDragGhost = createTabDragGhostController({
  BrowserWindow,
  screen,
  getMainWindow: () => mainWindow
});

const officeUrlService = createOfficeUrlService({
  getMainUrl: () => configManager.getMainUrl()
});

const {
  getPreferredOneDriveUrl,
  getPreferredOneNoteUrl,
  getPreferredOutlookUrl,
  getPreferredSharePointUrl,
  getPreferredTeamsUrl,
  isOfficeAppLaunchUrl,
  isOfficeDocumentUrl,
  normalizeInternalAppUrl
} = officeUrlService;

const favoriteService = createFavoriteService({
  configManager,
  sanitizeRestorableUrl,
  defaultPartition: APP_SESSION_PARTITION,
  onFavoritesChanged: () => rebuildTrayMenu()
});

const trayManager = createTrayManager({
  app,
  Menu,
  Tray,
  nativeImage,
  iconPath: appPaths.appIcon,
  iconsDir: appPaths.iconsDir,
  getMainWindow: () => mainWindow,
  favoriteService,
  openFavorite: (favorite) => openFavoriteFromTray(favorite),
  openApp: (appKey) => openTrayAppWindow(appKey)
});

const {
  isFavoriteTab,
  updateFavoriteEntryForTab
} = favoriteService;

function logPrimaryFlow(label, payload) {
  if (!debugPrimaryFlow) return;
  logger.debug(`PRIMARY:${label}`, payload);
}

const popupWindowService = createPopupWindowService({
  BrowserWindow,
  appIcon: appPaths.appIcon,
  defaultPartition: APP_SESSION_PARTITION,
  getEffectiveUserAgent,
  logPrimaryFlow,
  customizeWebContents: (webContents) => {
    applyMicrosoftAppLauncherHiding(webContents, logger.child({ module: 'content-customization' }));
  }
});

function openTrayAppWindow(appKey) {
  let targetUrl = null;

  switch (appKey) {
    case 'word':
      targetUrl = normalizeInternalAppUrl('https://www.microsoft365.com/launch/word');
      break;
    case 'excel':
      targetUrl = normalizeInternalAppUrl('https://www.microsoft365.com/launch/excel');
      break;
    case 'powerpoint':
      targetUrl = normalizeInternalAppUrl('https://www.microsoft365.com/launch/powerpoint');
      break;
    case 'outlook':
      targetUrl = getPreferredOutlookUrl();
      break;
    case 'onedrive':
      targetUrl = getPreferredOneDriveUrl();
      break;
    case 'teams':
      targetUrl = getPreferredTeamsUrl();
      break;
    case 'onenote':
      targetUrl = getPreferredOneNoteUrl();
      break;
    default:
      return null;
  }

  return popupWindowService.open(targetUrl, APP_SESSION_PARTITION);
}

function toggleFavoriteForTab(tabId) {
  const tab = tabManager.tabs.find((existingTab) => existingTab.id === Number(tabId));
  return favoriteService.toggleFavoriteForTab(tab) || { tabId: Number(tabId) || null, isFavorite: false };
}

function openFavoriteFromTray(favorite) {
  if (!favorite || !favorite.url) return null;
  return popupWindowService.open(favorite.url, favorite.partition || APP_SESSION_PARTITION);
}

function rebuildTrayMenu() {
  trayManager.rebuildMenu();
}

function getEffectiveUserAgent() {
  const configuredUserAgent = configManager.getUserAgent().trim();
  return configuredUserAgent || FIREFOX_USER_AGENT;
}

// Objeto para administrar las pestañas
let tabManager = {
  tabs: [],
  activeTabId: null,
  nextTabId: 1,
  // Inicializa el administrador de pestañas
  init: function() {
    // No cargar pestañas guardadas - siempre iniciamos con una limpia
    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
  },
  // No guardar pestañas entre sesiones
  saveTabs: function() {
    persistRestorableTabs();
  }
};

const tabPersistence = createTabPersistence({
  configManager,
  defaultPartition: APP_SESSION_PARTITION,
  sanitizeRestorableUrl,
  getTabs: () => tabManager.tabs,
  createTab: (config, makeActive) => createTab(config, makeActive),
  logger: logger.child({ module: 'tab-persistence' })
});

const { persistRestorableTabs, restoreSavedTabsAfterPrimaryLoad } = tabPersistence;

// Crea la ventana principal y carga el HTML
function createMainWindow() {
  const initialBounds = mainWindowState.getValidatedWindowBounds();
  const shouldStartMaximized = configManager.getWindowMaximized();

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: 900,
    minHeight: 650,
    icon: appPaths.appIcon,
    webPreferences: {
      preload: appPaths.mainPreload,
      partition: APP_SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      sandbox: true,
      spellcheck: true,
      nativeWindowOpen: true,
    },
    titleBarStyle: 'hidden',
    frame: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#FFFFFF',
  });
  mainWindow.setMaxListeners(0);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(appPaths.mainWindowHtml);
  }

  // Mostrar la ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    if (shouldStartMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();

    tabManager.tabs = [];
    tabManager.activeTabId = null;
    tabManager.nextTabId = 1;
    const mainUrl = configManager.getMainUrl();
    const reopenTabsOnLaunch = configManager.getReopenTabsOnLaunch();
    const savedTabs = reopenTabsOnLaunch ? configManager.getTabs() : [];

    setTimeout(() => {
      const primaryTab = createTab({ url: mainUrl, isPrimary: true }, true);
      restoreSavedTabsAfterPrimaryLoad(primaryTab, savedTabs);
    }, 100);
  });

  mainWindow.on('resize', () => {
    updateActiveTabBounds();
    floatingModal.syncBounds();
    mainWindowState.persist();
  });

  mainWindow.on('move', () => {
    floatingModal.syncBounds();
    mainWindowState.persist();
  });

  mainWindow.on('maximize', () => {
    mainWindowState.persist(true);
    setTimeout(() => {
      updateActiveTabBounds();
      floatingModal.syncBounds();
    }, 50);
  });

  mainWindow.on('unmaximize', () => {
    mainWindowState.persist(true);
    setTimeout(() => {
      updateActiveTabBounds();
      floatingModal.syncBounds();
      mainWindowState.persist(true);
    }, 50);
  });

  mainWindow.on('closed', () => {
    mainWindowState.clearPending();
    tabDragGhost.hide();
    tabDragGhost.stopFollow();
    floatingModal.destroy();
    tabDragGhost.destroy();
    mainWindow = null;
  });
  
  // Modificar el comportamiento al cerrar la ventana
  mainWindow.on('close', (event) => {
    mainWindowState.persist(true);

    // En lugar de cerrar, ocultar la ventana si el tray está activo
    if (tray && !app.isQuitting) {
      event.preventDefault();
      floatingModal.close();
      mainWindow.hide();
    } else {
      // Comportamiento normal de cierre si no hay tray o si se está saliendo
      return true;
    }
  });
  
  // Abrir links externos en el navegador predeterminado
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') {
      return { action: 'deny' };
    }

    if (isOfficeAppLaunchUrl(url)) {
      createTab(normalizeInternalAppUrl(url), true);
      return { action: 'deny' };
    }

    if (shouldAllowNativePopup(url)) {
      return buildInternalPopupOptions(APP_SESSION_PARTITION);
    }

    if (shouldOpenInternally(url)) {
      createTab(url, true);
      return { action: 'deny' };
    }

    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('did-create-window', (window) => {
    popupWindowService.track(window);
  });
}

function attachTabViewToMainWindow(view) {
  if (!mainWindow || !view || view.__attachedToMainWindow) return;

  mainWindow.contentView.addChildView(view);
  view.__attachedToMainWindow = true;
  activeMainContentView = view;
}

function detachTabViewFromMainWindow(view) {
  if (!mainWindow || !view || !view.__attachedToMainWindow) return;

  mainWindow.contentView.removeChildView(view);
  view.__attachedToMainWindow = false;

  if (activeMainContentView === view) {
    activeMainContentView = null;
  }
}

// Función auxiliar para crear una WebContentsView
function createWebContentsView(options = {}) {
  const userAgent = getEffectiveUserAgent();
  const appId = options.appId || null;
  const partition = options.partition || APP_SESSION_PARTITION;
  const isPrimary = Boolean(options.isPrimary);
  
  const view = new WebContentsView({
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true,
      webSecurity: true,
      nativeWindowOpen: true,
    },
  });
  
  // Establecer un user agent personalizado si está configurado
  view.webContents.setUserAgent(userAgent);
  applyMicrosoftAppLauncherHiding(view.webContents, logger.child({ module: 'content-customization' }));

  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const key = String(input.key || '').toLowerCase();

    if (input.shift && key === 'insert') {
      event.preventDefault();
      view.webContents.paste();
      return;
    }

    if (input.shift && key === 'delete') {
      event.preventDefault();
      view.webContents.cut();
    }
  });
  
  // Configurar menú contextual mejorado para enlaces
  view.webContents.on('context-menu', async (event, params) => {
    const menuTemplateItems = [];
    const { linkURL, mediaType, srcURL } = params;
    
    // Opciones generales siempre disponibles
    // Opción para inspeccionar elementos (solo en desarrollo)
    if (isDev) {
      menuTemplateItems.push({
        label: 'Inspeccionar elemento',
        click: () => view.webContents.inspectElement(params.x, params.y)
      });
    }
    
    // Si hay un enlace, agregar opciones específicas para enlaces
    if (linkURL) {
      // IMPORTANTE: Determinar si es un documento/archivo o enlace normal
      const fileType = detectFileType(linkURL);
      const isOfficeFile = !!fileType;
      
      // Siempre abrir en nueva pestaña
      menuTemplateItems.push({
        label: 'Abrir en nueva pestaña',
        click: () => {
          createTab(linkURL, true);
        },
      });
      
      // Si es archivo de Office, agregar opciones para aplicaciones nativas
      if (isOfficeFile) {
        try {
          // Buscar aplicaciones instaladas para este tipo de archivo
          const availableApps = await getAvailableAppsForFile(linkURL);
          
          if (availableApps.length > 0) {
            // Agregar submenú de aplicaciones
            const appMenuItems = availableApps.map(app => ({
              label: `Abrir con ${app.name}`,
              click: () => {
                downloadAndOpenWithApp(linkURL, app.command);
              }
            }));
            
            menuTemplateItems.push({
              label: `Abrir ${fileType} con aplicación`,
              submenu: appMenuItems
            });
          }
        } catch (error) {
          console.error("Error al obtener aplicaciones:", error);
        }
      }
      
      // Opción para abrir en navegador externo
      menuTemplateItems.push({
        label: 'Abrir en navegador externo',
        click: () => {
          shell.openExternal(linkURL);
        },
      });
      
      // Separador y opción para copiar
      menuTemplateItems.push(
        { type: 'separator' },
        {
          label: 'Copiar dirección del enlace',
          click: () => {
            clipboard.writeText(linkURL);
          },
        }
      );
    }
    // Si hay una imagen, agregar opciones para imágenes
    else if (params.mediaType === 'image') {
      menuTemplateItems.push(
        {
          label: 'Copiar imagen',
          click: () => view.webContents.copyImageAt(params.x, params.y)
        },
        {
          label: 'Guardar imagen como...',
          click: () => {
            // Descargar imagen
            view.webContents.downloadURL(params.srcURL);
          }
        }
      );
    }
    // Opciones básicas de página
    else {
      menuTemplateItems.push(
        {
          label: 'Recargar página',
          click: () => view.webContents.reload()
        },
        { type: 'separator' },
        {
          label: 'Copiar',
          click: () => view.webContents.copy(),
          enabled: params.editFlags.canCopy
        },
        {
          label: 'Pegar',
          click: () => view.webContents.paste(),
          enabled: params.editFlags.canPaste
        }
      );
    }
    
    // Mostrar el menú contextual
    const menu = Menu.buildFromTemplate(menuTemplateItems);
    menu.popup();
  });

  view.webContents.setWindowOpenHandler(({ url, features, disposition }) => {
    const openerUrl = view.webContents.getURL();

    if (isPrimary) {
      logPrimaryFlow('window-open', {
        url,
        openerUrl,
        disposition,
        features,
        isOfficeAppLaunch: isOfficeAppLaunchUrl(url),
        isOfficeDocument: isOfficeDocumentUrl(url),
        allowNativePopup: shouldAllowNativePopup(url),
        allowOutlookPopup: shouldAllowNativeOutlookPopup(url, openerUrl, features, disposition),
        shouldOpenInternal: shouldOpenInternally(url)
      });
    }

    if (shouldAllowNativeOutlookPopup(url, openerUrl, features, disposition)) {
      if (isPrimary) {
        logPrimaryFlow('window-open-result', {
          url,
          action: 'allow-native-outlook-popup'
        });
      }
      return buildInternalPopupOptions(partition);
    }

    if (!url || url === 'about:blank') {
      if (isPrimary) {
        logPrimaryFlow('window-open-result', {
          url,
          action: 'deny-about-blank'
        });
      }
      return { action: 'deny' };
    }

    if (isOfficeAppLaunchUrl(url)) {
      if (isPrimary) {
        logPrimaryFlow('window-open-result', {
          url,
          action: 'create-tab-office-app',
          normalizedUrl: normalizeInternalAppUrl(url)
        });
      }
      createTab({ url: normalizeInternalAppUrl(url), partition, appId }, true);
      return { action: 'deny' };
    }

    if (shouldAllowNativePopup(url)) {
      if (isPrimary) {
        logPrimaryFlow('window-open-result', {
          url,
          action: 'allow-native-popup'
        });
      }
      return buildInternalPopupOptions(partition);
    }

    if (shouldOpenInternally(url)) {
      if (isPrimary) {
        logPrimaryFlow('window-open-result', {
          url,
          action: 'create-tab-internal'
        });
      }
      createTab({ url, partition, appId }, true);
      return { action: 'deny' };
    }

    if (isPrimary) {
      logPrimaryFlow('window-open-result', {
        url,
        action: 'open-external'
      });
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  view.webContents.on('did-create-window', (window) => {
    if (isPrimary) {
      logPrimaryFlow('did-create-window', {
        id: window && window.webContents ? window.webContents.id : null
      });
    }
    popupWindowService.track(window);
  });
  
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && validatedURL === 'about:blank') {
      event.preventDefault();
    }
  });
  
  return view;
}

// Actualiza el área de la pestaña activa según el tamaño de la ventana
function updateActiveTabBounds() {
  if (mainWindow && tabManager.activeTabId) {
    let activeTab = tabManager.tabs.find(tab => tab.id === tabManager.activeTabId);
    if (activeTab) {
      let bounds = mainWindow.getContentBounds();
      const tabBarHeight = 32; // Altura de la barra de pestañas (32px)
      activeTab.view.setBounds({
        x: 0,
        y: tabBarHeight,
        width: bounds.width,
        height: bounds.height - tabBarHeight,
      });
    }
  }
}

// Crea una nueva pestaña (WebContentsView) con la URL indicada
function createTab(urlOrConfig, makeActive = false) {
  if (!mainWindow) return null;

  const tabConfig = typeof urlOrConfig === 'string'
    ? { url: urlOrConfig }
    : (urlOrConfig || {});
  const url = normalizeInternalAppUrl(tabConfig.url);
  const appId = tabConfig.appId || null;
  const partition = tabConfig.partition || APP_SESSION_PARTITION;
  const isPrimary = Boolean(tabConfig.isPrimary);
  const restoredAtStartup = Boolean(tabConfig.restoredAtStartup);

  // Evitar crear pestañas para about:blank
  if (url === 'about:blank') {
    return null;
  }

  
  const view = createWebContentsView({ partition, appId, isPrimary });

  let bounds = mainWindow.getContentBounds();
  const tabBarHeight = 32; // Altura de la barra de pesta\u00f1as (32px)
  view.setBounds({
    x: 0,
    y: tabBarHeight,
    width: bounds.width,
    height: bounds.height - tabBarHeight,
  });
  
  // Asignar ID de pestaña primero
  const tabId = tabManager.nextTabId++;
  
  // Crear el objeto de pestaña
  const tab = { 
    id: tabId, 
    view, 
    url, 
    restorableUrl: sanitizeRestorableUrl(url),
    title: url,
    fullTitle: url,
    partition,
    appId,
    isPrimary
  };
  
  // Añadir a la lista de pestañas
  if (isPrimary) {
    tabManager.tabs.unshift(tab);
  } else {
    tabManager.tabs.push(tab);
  }
  
  // Si es la pestaña activa, ponerla en primer plano inmediatamente
  if (makeActive) {
    switchTab(tabId);
  }
  
  // Cargar la URL
  view.webContents.loadURL(url);

  const updateTabUrl = (nextUrl) => {
    if (!nextUrl || nextUrl === 'about:blank') return;
    const previousUrls = [tab.url, tab.restorableUrl];
    const sanitizedUrl = sanitizeRestorableUrl(nextUrl);
    tab.url = sanitizedUrl;

    if (isOfficeDocumentUrl(nextUrl)) {
      tab.restorableUrl = sanitizedUrl;
      updateFavoriteEntryForTab(tab, previousUrls);
      return;
    }

    if (!tab.restorableUrl || !isOfficeDocumentUrl(tab.restorableUrl)) {
      tab.restorableUrl = sanitizedUrl;
    }

    updateFavoriteEntryForTab(tab, previousUrls);
  };
  
  // Intercepta eventos de navegación
  view.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isPrimary) {
      logPrimaryFlow('will-navigate', {
        currentUrl: view.webContents.getURL(),
        navigationUrl,
        isOfficeAppLaunch: isOfficeAppLaunchUrl(navigationUrl),
        isOfficeDocument: isOfficeDocumentUrl(navigationUrl),
        shouldOpenInternal: shouldOpenInternally(navigationUrl),
        allowNativePopup: shouldAllowNativePopup(navigationUrl)
      });
    }

    if (navigationUrl === 'about:blank') {
      event.preventDefault();
      return;
    }

    const normalizedNavigationUrl = normalizeInternalAppUrl(navigationUrl);

    if (isOfficeAppLaunchUrl(navigationUrl) && normalizedNavigationUrl !== navigationUrl) {
      if (isPrimary) {
        logPrimaryFlow('will-navigate-result', {
          navigationUrl,
          action: 'create-tab-office-app',
          normalizedUrl: normalizedNavigationUrl
        });
      }
      event.preventDefault();
      createTab({ url: normalizedNavigationUrl, partition, appId }, true);
      return;
    }

    const currentURL = view.webContents.getURL();
    try {
      if (shouldOpenInternally(currentURL) && !shouldOpenInternally(navigationUrl)) {
        if (isPrimary) {
          logPrimaryFlow('will-navigate-result', {
            navigationUrl,
            action: 'open-external'
          });
        }
        event.preventDefault();
        shell.openExternal(navigationUrl);
        showWebNotification('Abriendo enlace externo en el navegador');
      }
    } catch (error) {
      // console.error('Error en navegación:', error);
    }
  });

  // Interceptar navegación a about:blank también en did-start-navigation
  view.webContents.on('did-start-navigation', (event, navigationUrl, isInPlace, isMainFrame) => {
    if (isMainFrame && navigationUrl === 'about:blank') {
      event.preventDefault();
      return;
    }
  });

  view.webContents.on('did-navigate', (event, navigationUrl) => {
    updateTabUrl(navigationUrl);
    sendTabsUpdate();
  });

  view.webContents.on('did-redirect-navigation', (event, navigationUrl, isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    updateTabUrl(navigationUrl);
    sendTabsUpdate();
  });
  
  // Interceptamos la actualización del título para mostrar solo la parte anterior al guion (-)
  view.webContents.on('page-title-updated', (event, title) => {
    tab.fullTitle = title;
    let shortTitle = title.split(' - ')[0];
    tab.title = shortTitle;
    updateFavoriteEntryForTab(tab);
    sendTabsUpdate();
  });
  
  // Actualizar pestañas después de cargar
  view.webContents.on('did-finish-load', () => {
    
    // Si esta pestaña debe ser activa, asegurarse de activarla de nuevo
    if (makeActive && tabManager.activeTabId === tabId) {
      attachTabViewToMainWindow(view);
      updateActiveTabBounds();
      sendTabsUpdate();
    }
  });

  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || !restoredAtStartup) return;
    if (errorCode === -3) return;

    const restoredTab = tabManager.tabs.find((existingTab) => existingTab.id === tabId);
    if (!restoredTab || restoredTab.isPrimary) return;

    closeTab(tabId);
  });
  
  // No guardamos el estado de pestañas entre sesiones
  sendTabsUpdate();
  
  return tab;
}

// Cambia la pestaña activa
function switchTab(tabId) {
  
  if (tabManager.activeTabId) {
    let current = tabManager.tabs.find(tab => tab.id === tabManager.activeTabId);
    if (current) {
      detachTabViewFromMainWindow(current.view);
    }
  }
  
  tabManager.activeTabId = tabId;
  let newActive = tabManager.tabs.find(tab => tab.id === tabId);
  
  if (newActive) {
    attachTabViewToMainWindow(newActive.view);
    updateActiveTabBounds();
  } else {
    // console.warn(`No se encontró la pestaña ${tabId}`);
  }
  
  // Guardar pestaña activa
  configManager.setActiveTabId(tabId);
  sendTabsUpdate();
}

// Cierra una pestaña y, si es la activa, cambia a otra
function closeTab(tabId) {
  let index = tabManager.tabs.findIndex(tab => tab.id === tabId);
  if (index !== -1) {
    let tab = tabManager.tabs[index];

    if (tab.isPrimary) {
      return;
    }

    if (tabManager.activeTabId === tabId) {
      let newIndex = index === 0 ? 1 : index - 1;
      if (tabManager.tabs[newIndex]) {
        switchTab(tabManager.tabs[newIndex].id);
      } else {
        tabManager.activeTabId = null;
      }
    }
    detachTabViewFromMainWindow(tab.view);
    tab.view.webContents.destroy();
    tabManager.tabs.splice(index, 1);
    
    // Si no quedan pestañas, crear una nueva
    if (tabManager.tabs.length === 0) {
      const mainUrl = configManager.getMainUrl();
      createTab({ url: mainUrl, isPrimary: true }, true);
    }
    
    // No guardamos pestañas entre sesiones
    sendTabsUpdate();
  }
}

// Recarga la pestaña especificada
function reloadTab(tabId) {
  let tab = tabManager.tabs.find(tab => tab.id === tabId);
  if (tab) {
    tab.view.webContents.reload();
  }
}

function moveTab(tabId, targetIndex) {
  const sourceIndex = tabManager.tabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex === -1) return false;

  const sourceTab = tabManager.tabs[sourceIndex];
  if (!sourceTab || sourceTab.isPrimary) return false;

  const minIndex = tabManager.tabs[0] && tabManager.tabs[0].isPrimary ? 1 : 0;
  const maxIndex = tabManager.tabs.length - 1;
  let nextIndex = Math.max(minIndex, Math.min(Number(targetIndex), maxIndex));

  if (Number.isNaN(nextIndex) || nextIndex === sourceIndex) {
    return false;
  }

  if (sourceIndex < nextIndex) {
    nextIndex -= 1;
  }

  if (nextIndex === sourceIndex) {
    return false;
  }

  tabManager.tabs.splice(sourceIndex, 1);
  tabManager.tabs.splice(nextIndex, 0, sourceTab);
  sendTabsUpdate();
  return true;
}

function reorderTabs(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length !== tabManager.tabs.length) {
    return false;
  }

  const tabById = new Map(tabManager.tabs.map((tab) => [tab.id, tab]));
  const reorderedTabs = orderedIds
    .map((id) => tabById.get(Number(id)))
    .filter(Boolean);

  if (reorderedTabs.length !== tabManager.tabs.length) {
    return false;
  }

  const primaryIndex = reorderedTabs.findIndex((tab) => tab.isPrimary);
  if (primaryIndex > 0) {
    const [primaryTab] = reorderedTabs.splice(primaryIndex, 1);
    reorderedTabs.unshift(primaryTab);
  }

  tabManager.tabs = reorderedTabs;
  sendTabsUpdate();
  return true;
}

function detachTabToWindow(tabId) {
  const index = tabManager.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return false;

  const tab = tabManager.tabs[index];
  if (!tab || tab.isPrimary) return false;

  const targetUrl = tab.view?.webContents?.isDestroyed()
    ? tab.url
    : (tab.view.webContents.getURL() || tab.url);

  const popupWindow = popupWindowService.open(targetUrl, tab.partition || APP_SESSION_PARTITION);
  if (!popupWindow) return false;

  closeTab(tabId);
  return true;
}

// Envía al renderer la información actualizada de las pestañas para actualizar la UI
function sendTabsUpdate() {
  if (mainWindow) {
    let tabsForUI = tabManager.tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      fullTitle: tab.fullTitle || tab.title,
      url: tab.url,
      isPrimary: Boolean(tab.isPrimary),
      isFavorite: isFavoriteTab(tab)
    }));
    mainWindow.webContents.send('tabs-updated', { tabs: tabsForUI, activeTabId: tabManager.activeTabId });
  }

  persistRestorableTabs();
}

registerIpcHandlers({
  app,
  ipcMain,
  configManager,
  floatingModal,
  tabDragGhost,
  getMainWindow: () => mainWindow,
  getTabs: () => tabManager.tabs,
  getActiveTabId: () => tabManager.activeTabId,
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
});

// Función para mostrar notificaciones en la interfaz web
function showWebNotification(message, type = 'info') {
  if (mainWindow) {
    mainWindow.webContents.send('show-notification', { message, type });
  }
}

// Crear el icono de la bandeja del sistema
function createTray() {
  tray = trayManager.create();
  return tray;
}

// --- PREVENIR MÚLTIPLES INSTANCIAS ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Otra instancia está corriendo, salir inmediatamente
  app.quit();
} else {
  // Si se intenta abrir una segunda instancia, enfocar la ventana existente
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Asegurar que el tray esté activo (solo uno)
    if (!tray) {
      createTray();
    }
  });

  // Iniciar la aplicación una vez que esté lista
  app.whenReady().then(() => {
    const appSession = session.fromPartition(APP_SESSION_PARTITION);
    configureAppSession({
      appSession,
      desktopCapturer,
      shell,
      shouldOpenInternally
    });

    createMainWindow();
    if (!tray) createTray(); // Solo crear tray si no existe
    
    // Registrar protocolo deep-link personalizado (ms365://)
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('ms365', process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient('ms365');
    }
    
    // Mostrar información de configuración en la consola (solo en desarrollo)
  });

  // Manejar el evento before-quit para asegurar la salida correcta
  app.on('before-quit', () => {
    app.isQuitting = true;
  });

  // Solo en macOS: volver a crear ventana al hacer clic en el dock
  app.on('activate', () => {
    // Si no hay ventanas abiertas y el dock es clickeado, mostrar la ventana principal
    if (BrowserWindow.getAllWindows().length === 0) {
       if (mainWindow) {
         mainWindow.show();
       } else {
         createMainWindow();
       }
    } else if (mainWindow) {
       mainWindow.show(); // Asegura que la ventana se muestre si estaba oculta
    }
  });

  // Cerrar la aplicación solo si no estamos en macOS o si se fuerza la salida
  app.on('window-all-closed', () => {
    // En macOS, la aplicación generalmente permanece activa hasta que el usuario la cierra explícitamente
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
