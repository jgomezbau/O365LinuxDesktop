function shouldAllowNativePopup(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const { hostname, pathname, search } = new URL(url);
    const lowerHost = hostname.toLowerCase();
    const lowerPath = pathname.toLowerCase();
    const lowerSearch = search.toLowerCase();

    const isMicrosoftAuthHost =
      lowerHost.includes('login.microsoftonline.com') ||
      lowerHost.includes('login.live.com') ||
      lowerHost.includes('oauth') ||
      lowerHost.includes('msauth.net') ||
      lowerHost.includes('msftauth.net');

    const isPopupLikeFlow =
      lowerPath.includes('/authorize') ||
      lowerPath.includes('/oauth2/') ||
      lowerSearch.includes('prompt=') ||
      lowerSearch.includes('scope=') ||
      lowerSearch.includes('response_type=');

    return isMicrosoftAuthHost && isPopupLikeFlow;
  } catch (error) {
    return false;
  }
}

function shouldAllowNativeOutlookPopup(rawUrl, openerUrl, features = '', disposition = '') {
  const lowerFeatures = String(features || '').toLowerCase();
  const lowerDisposition = String(disposition || '').toLowerCase();
  const lowerOpenerUrl = String(openerUrl || '').toLowerCase();
  const lowerUrl = String(rawUrl || '').toLowerCase();

  const openedFromOutlook =
    lowerOpenerUrl.includes('outlook.office.com') ||
    lowerOpenerUrl.includes('outlook.live.com') ||
    lowerOpenerUrl.includes('outlook.cloud.microsoft');

  if (!openedFromOutlook) return false;
  if (lowerUrl === 'about:blank') return true;

  const isOutlookTarget =
    lowerUrl.includes('outlook.office.com') ||
    lowerUrl.includes('outlook.live.com') ||
    lowerUrl.includes('outlook.cloud.microsoft');

  const looksLikePopup =
    lowerFeatures.includes('popup') ||
    lowerFeatures.includes('width=') ||
    lowerFeatures.includes('height=') ||
    lowerDisposition === 'new-window';

  const looksLikeMailWindow =
    lowerUrl.includes('/mail/') ||
    lowerUrl.includes('/mail?') ||
    lowerUrl.includes('/mail/inbox/');

  return isOutlookTarget && (looksLikePopup || looksLikeMailWindow);
}

function buildInternalPopupOptions(partition) {
  return {
    action: 'allow',
    overrideBrowserWindowOptions: {
      show: true,
      autoHideMenuBar: true,
      backgroundColor: '#FFFFFF',
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        nativeWindowOpen: true
      }
    }
  };
}

module.exports = {
  buildInternalPopupOptions,
  shouldAllowNativeOutlookPopup,
  shouldAllowNativePopup
};
