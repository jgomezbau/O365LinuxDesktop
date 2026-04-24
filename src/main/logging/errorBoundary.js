function safeIpcOn(ipcMain, channel, handler, logger) {
  ipcMain.on(channel, async (event, ...args) => {
    try {
      await handler(event, ...args);
    } catch (error) {
      logger.error(`IPC event failed: ${channel}`, error, { channel });
    }
  });
}

function safeIpcHandle(ipcMain, channel, handler, logger) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger.error(`IPC handler failed: ${channel}`, error, { channel });
      return {
        ok: false,
        error: {
          code: 'IPC_HANDLER_FAILED',
          message: error.message || 'Error interno'
        }
      };
    }
  });
}

module.exports = {
  safeIpcHandle,
  safeIpcOn
};
