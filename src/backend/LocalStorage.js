define([
    '../libs/buffers',
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global'
], function (buffers,key_value_filesystem, api_error, global) {
    'use strict';

    const { SyncKeyValueFileSystem, SimpleSyncRWTransaction } = key_value_filesystem;
    const { ApiError, ErrorCode } = api_error;

    const { Buffer} = buffers;

    /**
     * Some versions of FF and all versions of IE do not support the full range of
     * 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
     * @url http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
     * @hidden
     */
    let supportsBinaryString = false, binaryEncoding;
    try {
        global.localStorage.setItem("__test__", String.fromCharCode(0xD800));
        supportsBinaryString = global.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
    }
    catch (e) {
        // IE throws an exception.
        supportsBinaryString = false;
    }
    binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';
    if (!Buffer.isEncoding(binaryEncoding)) {
        // Fallback for non BrowserFS implementations of buffer that lack a
        // binary_string format.
        binaryEncoding = "base64";
    }
    /**
     * A synchronous key-value store backed by localStorage.
     */
    class LocalStorageStore {
        name() {
            return LocalStorageFileSystem.Name;
        }
        clear() {
            global.localStorage.clear();
        }
        beginTransaction(type) {
            // No need to differentiate.
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            try {
                const data = global.localStorage.getItem(key);
                if (data !== null) {
                    return Buffer.from(data, binaryEncoding);
                }
            }
            catch (e) {
                // Do nothing.
            }
            // Key doesn't exist, or a failure occurred.
            return undefined;
        }
        put(key, data, overwrite) {
            try {
                if (!overwrite && global.localStorage.getItem(key) !== null) {
                    // Don't want to overwrite the key!
                    return false;
                }
                global.localStorage.setItem(key, data.toString(binaryEncoding));
                return true;
            }
            catch (e) {
                throw new ApiError(ErrorCode.ENOSPC, "LocalStorage is full.");
            }
        }
        del(key) {
            try {
                global.localStorage.removeItem(key);
            }
            catch (e) {
                throw new ApiError(ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
            }
        }
    }
    /**
     * A synchronous file system backed by localStorage. Connects our
     * LocalStorageStore to our SyncKeyValueFileSystem.
     */
    class LocalStorageFileSystem extends SyncKeyValueFileSystem {
        /**
         * Creates a new LocalStorage file system using the contents of `localStorage`.
         */
        constructor() { super({ store: new LocalStorageStore() }); }
        /**
         * Creates a LocalStorageFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new LocalStorageFileSystem());
        }
        static isAvailable() {
            return typeof global.localStorage !== 'undefined';
        }
    }
    LocalStorageFileSystem.Name = "LocalStorage";
    LocalStorageFileSystem.Options = {};
    
    LocalStorageFileSystem.LocalStorageStore = LocalStorageStore;

    return LocalStorageFileSystem;
});