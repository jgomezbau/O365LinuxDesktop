const APP_SESSION_PARTITION = 'persist:o365linuxdesktop';
const FIREFOX_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0';
const IS_DEV = process.env.IS_DEV === 'true';
const DEBUG_PRIMARY_FLOW = process.env.DEBUG_PRIMARY_FLOW === 'true';

module.exports = {
  APP_SESSION_PARTITION,
  DEBUG_PRIMARY_FLOW,
  FIREFOX_USER_AGENT,
  IS_DEV
};
