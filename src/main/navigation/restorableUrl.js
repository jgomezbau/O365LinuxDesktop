function sanitizeRestorableUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  try {
    const parsedUrl = new URL(rawUrl);
    const lowerHost = parsedUrl.hostname.toLowerCase();

    [
      'ct',
      'client-request-id',
      'wdPreviousSession',
      'wdPreviousSessionSrc',
      'wdorigin',
      'sessionid',
      'cidtoken'
    ].forEach((param) => {
      parsedUrl.searchParams.delete(param);
    });

    if (
      lowerHost.includes('onedrive.live.com') ||
      lowerHost.includes('sharepoint.com') ||
      lowerHost.includes('officeapps.live.com') ||
      lowerHost.includes('word.cloud.microsoft') ||
      lowerHost.includes('excel.cloud.microsoft') ||
      lowerHost.includes('powerpoint.cloud.microsoft')
    ) {
      return parsedUrl.toString();
    }

    return rawUrl;
  } catch (error) {
    return rawUrl;
  }
}

module.exports = {
  sanitizeRestorableUrl
};
