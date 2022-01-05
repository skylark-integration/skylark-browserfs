define(['../generic/key_value_filesystem'], function (key_value_filesystem) {
    'use strict';

    const { SimpleSyncRWTransaction, SyncKeyValueFileSystem } = key_value_filesystem;
    /**
     * A simple in-memory key-value store backed by a JavaScript object.
     */
    class InMemoryStore {
        constructor() {
            this.store = {};
        }
        name() { return InMemoryFileSystem.Name; }
        clear() { this.store = {}; }
        beginTransaction(type) {
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            return this.store[key];
        }
        put(key, data, overwrite) {
            if (!overwrite && this.store.hasOwnProperty(key)) {
                return false;
            }
            this.store[key] = data;
            return true;
        }
        del(key) {
            delete this.store[key];
        }
    }
    /**
     * A simple in-memory file system backed by an InMemoryStore.
     * Files are not persisted across page loads.
     */
    class InMemoryFileSystem extends SyncKeyValueFileSystem {
        constructor() {
            super({ store: new InMemoryStore() });
        }
        /**
         * Creates an InMemoryFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new InMemoryFileSystem());
        }
    }
    InMemoryFileSystem.Name = "InMemory";
    InMemoryFileSystem.Options = {};

    InMemoryFileSystem.InMemoryStore = InMemoryStore;

    return InMemoryFileSystem;
});