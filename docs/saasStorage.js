/**
 * Persists the local project folder handle to IndexedDB.
 * Used by docs/index.html when user picks a folder. Apps read via shared/projectFolderStorage.
 */
(function () {
  const DB_NAME = 'SaasProjectFolder';
  const STORE_NAME = 'folder';

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () { resolve(req.result); };
      req.onupgradeneeded = function (e) {
        if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
          e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  window.SaasStorage = window.SaasStorage || { localFolderHandle: null, localFolderName: '' };

  window.SaasStorage.setConnectedLocalFolder = function (handle, name) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var entry = { id: 'handle', handle: handle, name: name || (handle && handle.name) || '' };
        var req = tx.objectStore(STORE_NAME).put(entry);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  window.SaasStorage.clearConnectedLocalFolder = function () {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var req = tx.objectStore(STORE_NAME).delete('handle');
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };
})();
