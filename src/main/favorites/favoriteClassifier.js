const path = require('path');

const FAVORITE_TYPE_ORDER = ['word', 'excel', 'powerpoint', 'pdf', 'outlook', 'onedrive', 'teams', 'sharepoint', 'onenote', 'other'];

function inferFavoriteType(favorite = {}) {
  const url = String(favorite.url || '').toLowerCase();
  const title = String(favorite.title || '').toLowerCase();
  const appId = String(favorite.appId || '').toLowerCase();
  const hasAny = (values) => values.some((value) => url.includes(value) || title.includes(value) || appId.includes(value));

  if (hasAny(['.doc', '.docx', 'word', 'app=word', 'ithint=file%2cdoc', 'ithint=file,doc'])) return 'word';
  if (hasAny(['.xls', '.xlsx', '.xlsm', '.csv', 'excel', 'app=excel', 'ithint=file%2cxls', 'ithint=file,xls'])) return 'excel';
  if (hasAny(['.ppt', '.pptx', 'powerpoint', 'app=powerpoint', 'ithint=file%2cppt', 'ithint=file,ppt'])) return 'powerpoint';
  if (hasAny(['.pdf', 'pdf'])) return 'pdf';
  if (hasAny(['outlook', '/mail', 'owa'])) return 'outlook';
  if (hasAny(['onedrive', 'onedrive.live.com'])) return 'onedrive';
  if (hasAny(['teams'])) return 'teams';
  if (hasAny(['sharepoint', '/sites/'])) return 'sharepoint';
  if (hasAny(['onenote'])) return 'onenote';
  return 'other';
}

function getFavoriteServiceLabel(rawUrl = '') {
  const value = String(rawUrl || '').toLowerCase();
  if (value.includes('onedrive')) return 'OneDrive';
  if (value.includes('sharepoint')) return 'SharePoint';
  if (value.includes('outlook')) return 'Outlook';
  if (value.includes('teams')) return 'Teams';
  if (value.includes('onenote')) return 'OneNote';
  if (value.includes('excel')) return 'Excel';
  if (value.includes('powerpoint')) return 'PowerPoint';
  if (value.includes('word')) return 'Word';
  return 'Favorito';
}

function sanitizeFavoriteTitle(rawTitle = '', rawUrl = '') {
  const cleanedTitle = String(rawTitle || '')
    .trim()
    .replace(/\s*[|·-]\s*(microsoft\s*365|onedrive|sharepoint|outlook|teams|word|excel|powerpoint|onenote|office)\s*$/i, '')
    .replace(/^continue$/i, '')
    .replace(/^working\.\.\.$/i, '')
    .trim();

  if (cleanedTitle && !/^https?:\/\//i.test(cleanedTitle) && !/^file:\/\//i.test(cleanedTitle)) {
    return cleanedTitle;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol === 'file:') {
      const localPath = decodeURIComponent(parsedUrl.pathname || '');
      const localName = path.basename(localPath);
      if (localName) return localName;
    }

    const pathname = decodeURIComponent(parsedUrl.pathname || '');
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    if (lastSegment && !/^(doc|doc2|wopiframe|guestaccess)\.aspx$/i.test(lastSegment)) {
      return lastSegment;
    }
  } catch (error) {
    // Use service label fallback.
  }

  return getFavoriteServiceLabel(rawUrl);
}

function getFavoriteIconPath(type = 'other', iconsDir) {
  const iconNameByType = {
    word: 'word.png',
    excel: 'excel.png',
    powerpoint: 'powerpoint.png',
    pdf: 'icon.png',
    outlook: 'outlook.png',
    onedrive: 'onedrive.png',
    teams: 'teams.png',
    sharepoint: 'sharepoint.png',
    onenote: 'onenote.png',
    other: 'icon.png'
  };

  return path.join(iconsDir, iconNameByType[type] || iconNameByType.other);
}

module.exports = {
  FAVORITE_TYPE_ORDER,
  getFavoriteIconPath,
  getFavoriteServiceLabel,
  inferFavoriteType,
  sanitizeFavoriteTitle
};
