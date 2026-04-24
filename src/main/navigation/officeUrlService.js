function getAccountModeFromMainUrl(url) {
  const normalizedUrl = (url || '').trim().toLowerCase();

  if (!normalizedUrl) return 'corporate';
  if (normalizedUrl.includes('auth=1')) return 'personal';
  if (normalizedUrl.includes('auth=2')) return 'corporate';
  if (normalizedUrl.includes('outlook.live.com') || normalizedUrl.includes('office.live.com')) return 'personal';
  if (normalizedUrl.includes('outlook.office.com')) return 'corporate';

  return 'corporate';
}

function createOfficeUrlService({ getMainUrl }) {
  function getPreferredOutlookUrl() {
    const accountMode = getAccountModeFromMainUrl(getMainUrl());
    return accountMode === 'personal'
      ? 'https://outlook.live.com/mail/'
      : 'https://outlook.office.com/mail/';
  }

  function getPreferredTeamsUrl(rawUrl = '') {
    const accountMode = getAccountModeFromMainUrl(getMainUrl());

    if (accountMode === 'personal') {
      return 'https://teams.live.com/v2/?utm_source=OfficeWeb';
    }

    try {
      const parsedUrl = new URL(rawUrl);
      const loginHintSafe = parsedUrl.searchParams.get('login_hint_safe');
      const targetUrl = new URL('https://teams.microsoft.com/v2/');

      targetUrl.searchParams.set('lm', 'deeplink');
      targetUrl.searchParams.set('lmsrc', 'officeWaffle');

      if (loginHintSafe) {
        targetUrl.searchParams.set('login_hint_safe', loginHintSafe);
      }

      return targetUrl.toString();
    } catch (error) {
      return 'https://teams.microsoft.com/v2/?lm=deeplink&lmsrc=officeWaffle';
    }
  }

  function getPreferredOneDriveUrl() {
    const accountMode = getAccountModeFromMainUrl(getMainUrl());
    return accountMode === 'personal'
      ? 'https://onedrive.live.com/?gologin=1&view=1'
      : 'https://www.microsoft365.com/launch/onedrive';
  }

  function getPreferredOneNoteUrl() {
    return 'https://www.onenote.com/notebooks';
  }

  function getPreferredSharePointUrl() {
    return 'https://www.microsoft365.com/launch/sharepoint';
  }

  function isOfficeAppLaunchUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;

    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const path = parsedUrl.pathname.toLowerCase();

      const isTeamsHost =
        host === 'teams.microsoft.com' ||
        host.endsWith('.teams.microsoft.com') ||
        host === 'teams.live.com' ||
        host.endsWith('.teams.live.com') ||
        host === 'teams.cloud.microsoft' ||
        host.endsWith('.teams.cloud.microsoft');

      return (
        (host === 'www.microsoft365.com' && (
          path === '/launch/outlook' ||
          path === '/launch/teams' ||
          path === '/launch/onedrive' ||
          path === '/launch/onenote' ||
          path === '/launch/sharepoint'
        )) ||
        (host === 'aka.ms' && path === '/mstfw') ||
        (host === 'office.live.com' && (
          path === '/start/outlook.aspx' ||
          path === '/start/teams.aspx' ||
          path === '/start/onedrive.aspx' ||
          path === '/start/onenote.aspx' ||
          path === '/start/sharepoint.aspx'
        )) ||
        host.includes('outlook.office.com') ||
        host.includes('outlook.live.com') ||
        isTeamsHost ||
        host.includes('onenote.com') ||
        host.includes('sharepoint.com')
      );
    } catch (error) {
      return false;
    }
  }

  function normalizeInternalAppUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const path = parsedUrl.pathname.toLowerCase();

      const isOutlookLauncherUrl =
        (host === 'www.microsoft365.com' && path === '/launch/outlook') ||
        (host === 'office.live.com' && path === '/start/outlook.aspx');

      const isTeamsLauncherUrl =
        (host === 'www.microsoft365.com' && path === '/launch/teams') ||
        (host === 'aka.ms' && path === '/mstfw') ||
        (host === 'office.live.com' && path === '/start/teams.aspx') ||
        host === 'teams.microsoft.com' ||
        host.endsWith('.teams.microsoft.com') ||
        host === 'teams.live.com' ||
        host.endsWith('.teams.live.com') ||
        host === 'teams.cloud.microsoft' ||
        host.endsWith('.teams.cloud.microsoft');

      const isOneDriveLauncherUrl =
        (host === 'www.microsoft365.com' && path === '/launch/onedrive') ||
        (host === 'office.live.com' && path === '/start/onedrive.aspx');

      const isOneNoteLauncherUrl =
        (host === 'www.microsoft365.com' && path === '/launch/onenote') ||
        (host === 'office.live.com' && path === '/start/onenote.aspx') ||
        host.includes('onenote.com');

      const isSharePointLauncherUrl =
        (host === 'www.microsoft365.com' && path === '/launch/sharepoint') ||
        (host === 'office.live.com' && path === '/start/sharepoint.aspx');

      if (isOutlookLauncherUrl) return getPreferredOutlookUrl();
      if (isTeamsLauncherUrl) return getPreferredTeamsUrl(rawUrl);
      if (isOneDriveLauncherUrl) return getPreferredOneDriveUrl();
      if (isOneNoteLauncherUrl) return getPreferredOneNoteUrl();
      if (isSharePointLauncherUrl) return getPreferredSharePointUrl();

      return rawUrl;
    } catch (error) {
      return rawUrl;
    }
  }

  function isOfficeDocumentUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;

    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const pathname = parsedUrl.pathname.toLowerCase();
      const search = parsedUrl.search.toLowerCase();

      if (isOfficeAppLaunchUrl(rawUrl)) return false;

      const hasOfficeExtension = [
        '.doc', '.docx', '.dot', '.dotx',
        '.xls', '.xlsx', '.xlsm', '.xltx',
        '.ppt', '.pptx', '.pot', '.potx',
        '.pdf'
      ].some((extension) => pathname.endsWith(extension));

      const isWopiDocumentFlow =
        pathname.includes('/_layouts/15/wopiframe.aspx') ||
        pathname.includes('/_layouts/15/doc.aspx') ||
        pathname.includes('/_layouts/15/guestaccess.aspx');

      const hasDocumentMarkers =
        pathname.includes('/:w:/') ||
        pathname.includes('/:x:/') ||
        pathname.includes('/:p:/') ||
        search.includes('sourcedoc=') ||
        search.includes('mobileredirect=true');

      const isDocumentViewerRoute =
        (
          host.includes('word.cloud.microsoft') ||
          host.includes('excel.cloud.microsoft') ||
          host.includes('powerpoint.cloud.microsoft') ||
          host.includes('word-edit.officeapps.live.com') ||
          host.includes('excel.officeapps.live.com') ||
          host.includes('powerpoint.officeapps.live.com') ||
          host.includes('officeapps.live.com')
        ) &&
        (
          search.includes('sourcedoc=') ||
          pathname.includes('/we/') ||
          pathname.includes('/wv/') ||
          pathname.includes('/x/_layouts/') ||
          pathname.includes('/p/_layouts/')
        );

      return hasOfficeExtension || isWopiDocumentFlow || hasDocumentMarkers || isDocumentViewerRoute;
    } catch (error) {
      return false;
    }
  }

  return {
    getAccountModeFromMainUrl,
    getPreferredOneDriveUrl,
    getPreferredOneNoteUrl,
    getPreferredOutlookUrl,
    getPreferredSharePointUrl,
    getPreferredTeamsUrl,
    isOfficeAppLaunchUrl,
    isOfficeDocumentUrl,
    normalizeInternalAppUrl
  };
}

module.exports = {
  createOfficeUrlService,
  getAccountModeFromMainUrl
};
