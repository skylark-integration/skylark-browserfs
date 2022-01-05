define([
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global',
    '../core/util'
], function (key_value_filesystem, api_error, global, util) {
    'use strict';
    const { AsyncKeyValueFileSystem } =  key_value_filesystem;
    const { ApiError, ErrorCode }  = api_error;
    const { arrayBuffer2Buffer, buffer2ArrayBuffer }  = util;

    /**
     * Get the indexedDB constructor for the current browser.
     * @hidden
     */
    const indexedDB = global.indexedDB ||
        global.mozIndexedDB ||
        global.webkitIndexedDB ||
        global.msIndexedDB;
    /**
     * Converts a DOMException or a DOMError from an IndexedDB event into a
     * standardized BrowserFS API error.
     * @hidden
     */
    function convertError(e, message = e.toString()) {
        switch (e.name) {
            case "NotFoundError":
                return new ApiError(ErrorCode.ENOENT, message);
            case "QuotaExceededError":
                return new ApiError(ErrorCode.ENOSPC, message);
            default:
                // The rest do not seem to map cleanly to standard error codes.
                return new ApiError(ErrorCode.EIO, message);
        }
    }
    /**
     * Produces a new onerror handler for IDB. Our errors are always fatal, so we
     * handle them generically: Call the user-supplied callback with a translated
     * version of the error, and let the error bubble up.
     * @hidden
     */
    function onErrorHandler(cb, code = ErrorCode.EIO, message = null) {
        return function (e) {
            // Prevent the error from canceling the transaction.
            e.preventDefault();
            cb(new ApiError(code, message !== null ? message : undefined));
        };
    }
    /**
     * @hidden
     */
    class IndexedDBROTransaction {
        constructor(tx, store) {
            this.tx = tx;
            this.store = store;
        }
        get(key, cb) {
            try {
                const r = this.store.get(key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    // IDB returns the value 'undefined' when you try to get keys that
                    // don't exist. The caller expects this behavior.
                    const result = event.target.result;
                    if (result === undefined) {
                        cb(null, result);
                    }
                    else {
                        // IDB data is stored as an ArrayBuffer
                        cb(null, arrayBuffer2Buffer(result));
                    }
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
    }
    /**
     * @hidden
     */
    class IndexedDBRWTransaction extends IndexedDBROTransaction {
        constructor(tx, store) {
            super(tx, store);
        }
        put(key, data, overwrite, cb) {
            try {
                const arraybuffer = buffer2ArrayBuffer(data);
                let r;
                // Note: 'add' will never overwrite an existing key.
                r = overwrite ? this.store.put(arraybuffer, key) : this.store.add(arraybuffer, key);
                // XXX: NEED TO RETURN FALSE WHEN ADD HAS A KEY CONFLICT. NO ERROR.
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb(null, true);
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        del(key, cb) {
            try {
                // NOTE: IE8 has a bug with identifiers named 'delete' unless used as a string
                // like this.
                // http://stackoverflow.com/a/26479152
                const r = this.store['delete'](key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb();
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        commit(cb) {
            // Return to the event loop to commit the transaction.
            setTimeout(cb, 0);
        }
        abort(cb) {
            let _e = null;
            try {
                this.tx.abort();
            }
            catch (e) {
                _e = convertError(e);
            }
            finally {
                cb(_e);
            }
        }
    }
    class IndexedDBStore {
        constructor(db, storeName) {
            this.db = db;
            this.storeName = storeName;
        }
        static Create(storeName, cb) {
            const openReq = indexedDB.open(storeName, 1);
            openReq.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Huh. This should never happen; we're at version 1. Why does another
                // database exist?
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                }
                db.createObjectStore(storeName);
            };
            openReq.onsuccess = (event) => {
                cb(null, new IndexedDBStore(event.target.result, storeName));
            };
            openReq.onerror = onErrorHandler(cb, ErrorCode.EACCES);
        }
        name() {
            return IndexedDBFileSystem.Name + " - " + this.storeName;
        }
        clear(cb) {
            try {
                const tx = this.db.transaction(this.storeName, 'readwrite'), objectStore = tx.objectStore(this.storeName), r = objectStore.clear();
                r.onsuccess = (event) => {
                    // Use setTimeout to commit transaction.
                    setTimeout(cb, 0);
                };
                r.onerror = onErrorHandler(cb);
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        beginTransaction(type = 'readonly') {
            const tx = this.db.transaction(this.storeName, type), objectStore = tx.objectStore(this.storeName);
            if (type === 'readwrite') {
                return new IndexedDBRWTransaction(tx, objectStore);
            }
            else if (type === 'readonly') {
                return new IndexedDBROTransaction(tx, objectStore);
            }
            else {
                throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
            }
        }
    }
    /**
     * A file system that uses the IndexedDB key value file system.
     */
    class IndexedDBFileSystem extends AsyncKeyValueFileSystem {
        constructor(cacheSize) {
            super(cacheSize);
        }
        /**
         * Constructs an IndexedDB file system with the given options.
         */
        static Create(opts = {}, cb) {
            IndexedDBStore.Create(opts.storeName ? opts.storeName : 'browserfs', (e, store) => {
                if (store) {
                    const idbfs = new IndexedDBFileSystem(typeof (opts.cacheSize) === 'number' ? opts.cacheSize : 100);
                    idbfs.init(store, (e) => {
                        if (e) {
                            cb(e);
                        }
                        else {
                            cb(null, idbfs);
                        }
                    });
                }
                else {
                    cb(e);
                }
            });
        }
        static isAvailable() {
            // In Safari's private browsing mode, indexedDB.open returns NULL.
            // In Firefox, it throws an exception.
            // In Chrome, it "just works", and clears the database when you leave the page.
            // Untested: Opera, IE.
            try {
                return typeof indexedDB !== 'undefined' && null !== indexedDB.open("__browserfs_test__");
            }
            catch (e) {
                return false;
            }
        }
    }
    IndexedDBFileSystem.Name = "IndexedDB";
    IndexedDBFileSystem.Options = {
        storeName: {
            type: "string",
            optional: true,
            description: "The name of this file system. You can have multiple IndexedDB file systems operating at once, but each must have a different name."
        },
        cacheSize: {
            type: "number",
            optional: true,
            description: "The size of the inode cache. Defaults to 100. A size of 0 or below disables caching."
        }
    };


    IndexedDBFileSystem.IndexedDBROTransaction = IndexedDBROTransaction;
    IndexedDBFileSystem.IndexedDBRWTransaction = IndexedDBRWTransaction;
    IndexedDBFileSystem.IndexedDBStore = IndexedDBStore;

    return IndexedDBFileSystem;
});