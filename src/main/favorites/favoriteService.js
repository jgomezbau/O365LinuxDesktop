const {
  FAVORITE_TYPE_ORDER,
  getFavoriteServiceLabel,
  inferFavoriteType,
  sanitizeFavoriteTitle
} = require('./favoriteClassifier');

function createFavoriteService({
  configManager,
  sanitizeRestorableUrl,
  defaultPartition,
  onFavoritesChanged = () => {}
}) {
  function getFavoriteKeyFromUrl(rawUrl = '') {
    return sanitizeRestorableUrl(rawUrl || '');
  }

  function getFavoriteUrlFromTab(tab) {
    if (!tab) return '';
    return sanitizeRestorableUrl(tab.restorableUrl || tab.url || '');
  }

  function normalizeFavoriteEntry(favorite = {}) {
    const url = sanitizeRestorableUrl(favorite.url || '');
    if (!url || url === 'about:blank') return null;

    const title = sanitizeFavoriteTitle(favorite.title || '', url);
    const type = favorite.type || inferFavoriteType({ ...favorite, url, title });

    return {
      key: favorite.key || getFavoriteKeyFromUrl(url),
      url,
      title,
      partition: favorite.partition || defaultPartition,
      appId: favorite.appId || null,
      type
    };
  }

  function getStoredFavorites() {
    const rawFavorites = configManager.getFavorites().filter((favorite) => favorite && favorite.url);
    const normalizedFavorites = rawFavorites.map(normalizeFavoriteEntry).filter(Boolean);

    if (JSON.stringify(rawFavorites) !== JSON.stringify(normalizedFavorites)) {
      configManager.setFavorites(normalizedFavorites);
    }

    return normalizedFavorites;
  }

  function setStoredFavorites(favorites) {
    const normalizedFavorites = (Array.isArray(favorites) ? favorites : [])
      .map(normalizeFavoriteEntry)
      .filter(Boolean);

    configManager.setFavorites(normalizedFavorites);
    onFavoritesChanged(normalizedFavorites);
  }

  function getFavoriteEntryFromTab(tab) {
    const url = getFavoriteUrlFromTab(tab);
    if (!url || url === 'about:blank') return null;

    return normalizeFavoriteEntry({
      key: getFavoriteKeyFromUrl(url),
      url,
      title: sanitizeFavoriteTitle(tab.fullTitle || tab.title || '', url),
      partition: tab.partition || defaultPartition,
      appId: tab.appId || null,
      type: inferFavoriteType({
        url,
        title: tab.fullTitle || tab.title || '',
        appId: tab.appId || null
      })
    });
  }

  function isFavoriteTab(tab) {
    const favoriteKey = getFavoriteKeyFromUrl(getFavoriteUrlFromTab(tab));
    if (!favoriteKey) return false;

    return getStoredFavorites().some((favorite) => (favorite.key || getFavoriteKeyFromUrl(favorite.url)) === favoriteKey);
  }

  function updateFavoriteEntryForTab(tab, candidateUrls = []) {
    const nextEntry = getFavoriteEntryFromTab(tab);
    if (!nextEntry) return false;

    const candidateKeys = new Set(
      [...candidateUrls, tab.url, tab.restorableUrl, nextEntry.url]
        .filter(Boolean)
        .map((value) => getFavoriteKeyFromUrl(value))
        .filter(Boolean)
    );

    if (!candidateKeys.size) return false;

    const favorites = getStoredFavorites();
    const index = favorites.findIndex((favorite) => candidateKeys.has(favorite.key || getFavoriteKeyFromUrl(favorite.url)));
    if (index === -1) return false;

    favorites[index] = { ...favorites[index], ...nextEntry };
    setStoredFavorites(favorites);
    return true;
  }

  function toggleFavoriteForTab(tab) {
    if (!tab || tab.isPrimary) {
      return { tabId: tab ? tab.id : null, isFavorite: false };
    }

    const nextEntry = getFavoriteEntryFromTab(tab);
    if (!nextEntry) {
      return { tabId: tab.id, isFavorite: false };
    }

    const favorites = getStoredFavorites();
    const index = favorites.findIndex((favorite) => (favorite.key || getFavoriteKeyFromUrl(favorite.url)) === nextEntry.key);
    let isFavorite = false;

    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.push(nextEntry);
      isFavorite = true;
    }

    setStoredFavorites(favorites);
    return { tabId: tab.id, isFavorite };
  }

  return {
    FAVORITE_TYPE_ORDER,
    getFavoriteServiceLabel,
    getFavoriteEntryFromTab,
    getFavoriteKeyFromUrl,
    getStoredFavorites,
    isFavoriteTab,
    normalizeFavoriteEntry,
    setStoredFavorites,
    toggleFavoriteForTab,
    updateFavoriteEntryForTab
  };
}

module.exports = {
  createFavoriteService
};
