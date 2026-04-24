const { getFavoriteIconPath, getFavoriteServiceLabel, FAVORITE_TYPE_ORDER } = require('../favorites/favoriteClassifier');
const path = require('path');

const TRAY_APP_ITEMS = [
  { key: 'word', label: 'Word', icon: 'word.png' },
  { key: 'excel', label: 'Excel', icon: 'excel.png' },
  { key: 'powerpoint', label: 'PowerPoint', icon: 'powerpoint.png' },
  { key: 'outlook', label: 'Outlook', icon: 'outlook.png' },
  { key: 'onedrive', label: 'OneDrive', icon: 'onedrive.png' },
  { key: 'teams', label: 'Teams', icon: 'teams.png' },
  { key: 'onenote', label: 'OneNote', icon: 'onenote.png' }
];

function createTrayManager({
  app,
  Menu,
  Tray,
  nativeImage,
  iconPath,
  iconsDir,
  getMainWindow,
  favoriteService,
  openFavorite,
  openApp
}) {
  let tray = null;

  function createMenuIcon(iconFilePath) {
    const image = nativeImage.createFromPath(iconFilePath);
    return image.isEmpty() ? undefined : image.resize({ width: 16, height: 16 });
  }

  function getFavoriteMenuIcon(type = 'other') {
    return createMenuIcon(getFavoriteIconPath(type, iconsDir));
  }

  function getAppMenuIcon(iconName) {
    return createMenuIcon(path.join(iconsDir, iconName));
  }

  function buildAppsTraySubmenu() {
    return TRAY_APP_ITEMS.map((item) => ({
      label: item.label,
      icon: getAppMenuIcon(item.icon),
      click: () => openApp(item.key)
    }));
  }

  function buildFavoritesTraySubmenu() {
    const favorites = favoriteService.getStoredFavorites();
    if (!favorites.length) {
      return [{ label: 'Sin favoritos', enabled: false }];
    }

    const groups = FAVORITE_TYPE_ORDER
      .map((type) => ({
        type,
        favorites: favorites
          .filter((favorite) => (favorite.type || 'other') === type)
          .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' }))
      }))
      .filter((group) => group.favorites.length > 0);

    const submenu = [];
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) submenu.push({ type: 'separator' });
      group.favorites.forEach((favorite) => {
        submenu.push({
          label: favorite.title || getFavoriteServiceLabel(favorite.url),
          icon: getFavoriteMenuIcon(favorite.type || 'other'),
          click: () => openFavorite(favorite)
        });
      });
    });

    return submenu;
  }

  function buildTrayMenuTemplate() {
    return [
      {
        label: 'Mostrar/Ocultar',
        click: () => {
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
          }
        }
      },
      {
        label: 'Recargar App',
        click: () => {
          const mainWindow = getMainWindow();
          if (mainWindow) mainWindow.reload();
        }
      },
      {
        label: 'Favoritos',
        submenu: buildFavoritesTraySubmenu()
      },
      {
        label: 'Aplicaciones',
        submenu: buildAppsTraySubmenu()
      },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ];
  }

  function rebuildMenu() {
    if (!tray) return;
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
  }

  function create() {
    if (tray) return tray;
    tray = new Tray(iconPath);
    tray.setToolTip('O365 Linux Desktop');
    rebuildMenu();
    tray.on('click', () => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
      }
    });
    return tray;
  }

  function getTray() {
    return tray;
  }

  return {
    create,
    getTray,
    rebuildMenu
  };
}

module.exports = {
  createTrayManager
};
