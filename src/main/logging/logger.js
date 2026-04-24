function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function write(level, context, message, details) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    module: context.module || 'app',
    message,
    ...details
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

function createLogger(context = {}) {
  return {
    child(extraContext = {}) {
      return createLogger({ ...context, ...extraContext });
    },
    debug(message, details = {}) {
      if (process.env.DEBUG_PRIMARY_FLOW !== 'true' && process.env.LOG_LEVEL !== 'debug') return;
      write('debug', context, message, details);
    },
    info(message, details = {}) {
      write('info', context, message, details);
    },
    warn(message, details = {}) {
      write('warn', context, message, details);
    },
    error(message, error, details = {}) {
      write('error', context, message, {
        ...details,
        error: serializeError(error)
      });
    }
  };
}

module.exports = {
  createLogger,
  serializeError
};
