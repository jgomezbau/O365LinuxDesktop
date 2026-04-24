const path = require('path');
const { Worker } = require('worker_threads');

function createWorkerClient(workerPath, { timeoutMs = 30000 } = {}) {
  let nextId = 1;

  function request(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const worker = new Worker(path.resolve(workerPath));
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Worker timeout: ${action}`));
      }, timeoutMs);

      worker.once('message', (message) => {
        clearTimeout(timeout);
        worker.terminate();
        if (message && message.ok) {
          resolve(message.result);
          return;
        }
        reject(new Error(message?.error?.message || `Worker failed: ${action}`));
      });

      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      worker.postMessage({ id, action, payload });
    });
  }

  return {
    request
  };
}

module.exports = {
  createWorkerClient
};
