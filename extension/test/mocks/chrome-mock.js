// Minimal in-memory shim for the chrome.storage.local + onChanged APIs, so
// extension/lib/settings.js (and eventually popup.js) can run unmodified
// inside a plain fixture page - no real extension context needed. Load
// this before any real extension source file.
(function () {
  'use strict';

  if (window.chrome && window.chrome.storage) {
    return; // already running inside a real extension context - don't shadow it
  }

  const store = {};
  const listeners = [];

  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: {
      get(keys, callback) {
        let result;
        if (keys == null) {
          result = { ...store };
        } else if (typeof keys === 'string') {
          result = { [keys]: store[keys] };
        } else if (Array.isArray(keys)) {
          result = {};
          keys.forEach((k) => (result[k] = store[k]));
        } else {
          // object form: keys with default values
          result = {};
          Object.keys(keys).forEach((k) => (result[k] = k in store ? store[k] : keys[k]));
        }
        Promise.resolve().then(() => callback && callback(result));
        return Promise.resolve(result);
      },
      set(items, callback) {
        const changes = {};
        Object.keys(items).forEach((k) => {
          changes[k] = { oldValue: store[k], newValue: items[k] };
          store[k] = items[k];
        });
        Promise.resolve().then(() => {
          callback && callback();
          listeners.forEach((fn) => fn(changes, 'local'));
        });
        return Promise.resolve();
      },
      remove(keys, callback) {
        (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
        Promise.resolve().then(() => callback && callback());
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener(fn) {
        listeners.push(fn);
      },
      removeListener(fn) {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      },
    },
  };

  // Exposed for fixtures/manual console poking, e.g.
  // window.__scMockStorage.dump() to inspect current settings.
  window.__scMockStorage = {
    dump: () => ({ ...store }),
    reset: () => Object.keys(store).forEach((k) => delete store[k]),
  };

  console.log('[SCSM mock] chrome.storage.local shim installed');
})();
