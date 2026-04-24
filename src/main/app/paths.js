const path = require('path');

function createAppPaths(rootDir) {
  return {
    rootDir,
    assetsDir: path.join(rootDir, 'src', 'assets'),
    iconsDir: path.join(rootDir, 'src', 'assets', 'icons'),
    mainPreload: path.join(rootDir, 'src', 'preload', 'main-preload.js'),
    modalPreload: path.join(rootDir, 'src', 'preload', 'modal-preload.js'),
    mainWindowHtml: path.join(rootDir, 'src', 'ui', 'main-window', 'index.html'),
    modalHtml: path.join(rootDir, 'src', 'ui', 'modal', 'index.html'),
    appIcon: path.join(rootDir, 'src', 'assets', 'icons', 'icon.png')
  };
}

module.exports = {
  createAppPaths
};
