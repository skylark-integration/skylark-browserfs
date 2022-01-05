define([
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../generic/preload_file',
    '../libs/path'
], function (file_system, api_error, file_flag, preload_file, path) {
    'use strict';


    const  { SynchronousFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { FileFlag } = file_flag;
    const { PreloadFile} = preload_file;

    /**
     * We define our own file to interpose on syncSync() for mirroring purposes.
     */
    class MirrorFile extends PreloadFile {
        constructor(fs, path, flag, stat, data) {
            super(fs, path, flag, stat, data);
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this);
                this.resetDirty();
            }
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * AsyncMirrorFS mirrors a synchronous filesystem into an asynchronous filesystem
     * by:
     *
     * * Performing operations over the in-memory copy, while asynchronously pipelining them
     *   to the backing store.
     * * During application loading, the contents of the async file system can be reloaded into
     *   the synchronous store, if desired.
     *
     * The two stores will be kept in sync. The most common use-case is to pair a synchronous
     * in-memory filesystem with an asynchronous backing store.
     *
     * Example: Mirroring an IndexedDB file system to an in memory file system. Now, you can use
     * IndexedDB synchronously.
     *
     * ```javascript
     * BrowserFS.configure({
     *   fs: "AsyncMirror",
     *   options: {
     *     sync: { fs: "InMemory" },
     *     async: { fs: "IndexedDB" }
     *   }
     * }, function(e) {
     *   // BrowserFS is initialized and ready-to-use!
     * });
     * ```
     *
     * Or, alternatively:
     *
     * ```javascript
     * BrowserFS.FileSystem.IndexedDB.Create(function(e, idbfs) {
     *   BrowserFS.FileSystem.InMemory.Create(function(e, inMemory) {
     *     BrowserFS.FileSystem.AsyncMirror({
     *       sync: inMemory, async: idbfs
     *     }, function(e, mirrored) {
     *       BrowserFS.initialize(mirrored);
     *     });
     *   });
     * });
     * ```
     */
    class AsyncMirror extends SynchronousFileSystem {
        /**
         * **Deprecated; use AsyncMirror.Create() method instead.**
         *
         * Mirrors the synchronous file system into the asynchronous file system.
         *
         * **IMPORTANT**: You must call `initialize` on the file system before it can be used.
         * @param sync The synchronous file system to mirror the asynchronous file system to.
         * @param async The asynchronous file system to mirror.
         */
        constructor(sync, async) {
            super();
            /**
             * Queue of pending asynchronous operations.
             */
            this._queue = [];
            this._queueRunning = false;
            this._isInitialized = false;
            this._initializeCallbacks = [];
            this._sync = sync;
            this._async = async;
        }
        /**
         * Constructs and initializes an AsyncMirror file system with the given options.
         */
        static Create(opts, cb) {
            try {
                const fs = new AsyncMirror(opts.sync, opts.async);
                fs._initialize((e) => {
                    if (e) {
                        cb(e);
                    }
                    else {
                        cb(null, fs);
                    }
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return true;
        }
        getName() {
            return AsyncMirror.Name;
        }
        _syncSync(fd) {
            this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, FileFlag.getFileFlag('w'), fd.getStats().mode);
            this.enqueueOp({
                apiMethod: 'writeFile',
                arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), fd.getStats().mode]
            });
        }
        isReadOnly() { return false; }
        supportsSynch() { return true; }
        supportsLinks() { return false; }
        supportsProps() { return this._sync.supportsProps() && this._async.supportsProps(); }
        renameSync(oldPath, newPath) {
            this._sync.renameSync(oldPath, newPath);
            this.enqueueOp({
                apiMethod: 'rename',
                arguments: [oldPath, newPath]
            });
        }
        statSync(p, isLstat) {
            return this._sync.statSync(p, isLstat);
        }
        openSync(p, flag, mode) {
            // Sanity check: Is this open/close permitted?
            const fd = this._sync.openSync(p, flag, mode);
            fd.closeSync();
            return new MirrorFile(this, p, flag, this._sync.statSync(p, false), this._sync.readFileSync(p, null, FileFlag.getFileFlag('r')));
        }
        unlinkSync(p) {
            this._sync.unlinkSync(p);
            this.enqueueOp({
                apiMethod: 'unlink',
                arguments: [p]
            });
        }
        rmdirSync(p) {
            this._sync.rmdirSync(p);
            this.enqueueOp({
                apiMethod: 'rmdir',
                arguments: [p]
            });
        }
        mkdirSync(p, mode) {
            this._sync.mkdirSync(p, mode);
            this.enqueueOp({
                apiMethod: 'mkdir',
                arguments: [p, mode]
            });
        }
        readdirSync(p) {
            return this._sync.readdirSync(p);
        }
        existsSync(p) {
            return this._sync.existsSync(p);
        }
        chmodSync(p, isLchmod, mode) {
            this._sync.chmodSync(p, isLchmod, mode);
            this.enqueueOp({
                apiMethod: 'chmod',
                arguments: [p, isLchmod, mode]
            });
        }
        chownSync(p, isLchown, uid, gid) {
            this._sync.chownSync(p, isLchown, uid, gid);
            this.enqueueOp({
                apiMethod: 'chown',
                arguments: [p, isLchown, uid, gid]
            });
        }
        utimesSync(p, atime, mtime) {
            this._sync.utimesSync(p, atime, mtime);
            this.enqueueOp({
                apiMethod: 'utimes',
                arguments: [p, atime, mtime]
            });
        }
        /**
         * Called once to load up files from async storage into sync storage.
         */
        _initialize(userCb) {
            const callbacks = this._initializeCallbacks;
            const end = (e) => {
                this._isInitialized = !e;
                this._initializeCallbacks = [];
                callbacks.forEach((cb) => cb(e));
            };
            if (!this._isInitialized) {
                // First call triggers initialization, the rest wait.
                if (callbacks.push(userCb) === 1) {
                    const copyDirectory = (p, mode, cb) => {
                        if (p !== '/') {
                            this._sync.mkdirSync(p, mode);
                        }
                        this._async.readdir(p, (err, files) => {
                            let i = 0;
                            // NOTE: This function must not be in a lexically nested statement,
                            // such as an if or while statement. Safari refuses to run the
                            // script since it is undefined behavior.
                            function copyNextFile(err) {
                                if (err) {
                                    cb(err);
                                }
                                else if (i < files.length) {
                                    copyItem(path.join(p, files[i]), copyNextFile);
                                    i++;
                                }
                                else {
                                    cb();
                                }
                            }
                            if (err) {
                                cb(err);
                            }
                            else {
                                copyNextFile();
                            }
                        });
                    }, copyFile = (p, mode, cb) => {
                        this._async.readFile(p, null, FileFlag.getFileFlag('r'), (err, data) => {
                            if (err) {
                                cb(err);
                            }
                            else {
                                try {
                                    this._sync.writeFileSync(p, data, null, FileFlag.getFileFlag('w'), mode);
                                }
                                catch (e) {
                                    err = e;
                                }
                                finally {
                                    cb(err);
                                }
                            }
                        });
                    }, copyItem = (p, cb) => {
                        this._async.stat(p, false, (err, stats) => {
                            if (err) {
                                cb(err);
                            }
                            else if (stats.isDirectory()) {
                                copyDirectory(p, stats.mode, cb);
                            }
                            else {
                                copyFile(p, stats.mode, cb);
                            }
                        });
                    };
                    copyDirectory('/', 0, end);
                }
            }
            else {
                userCb();
            }
        }
        enqueueOp(op) {
            this._queue.push(op);
            if (!this._queueRunning) {
                this._queueRunning = true;
                const doNextOp = (err) => {
                    if (err) {
                        throw new Error(`WARNING: File system has desynchronized. Received following error: ${err}\n$`);
                    }
                    if (this._queue.length > 0) {
                        const op = this._queue.shift(), args = op.arguments;
                        args.push(doNextOp);
                        this._async[op.apiMethod].apply(this._async, args);
                    }
                    else {
                        this._queueRunning = false;
                    }
                };
                doNextOp();
            }
        }
    }
    AsyncMirror.Name = "AsyncMirror";
    AsyncMirror.Options = {
        sync: {
            type: "object",
            description: "The synchronous file system to mirror the asynchronous file system to.",
            validator: (v, cb) => {
                if (v && typeof (v['supportsSynch']) === "function" && v.supportsSynch()) {
                    cb();
                }
                else {
                    cb(new ApiError(ErrorCode.EINVAL, `'sync' option must be a file system that supports synchronous operations`));
                }
            }
        },
        async: {
            type: "object",
            description: "The asynchronous file system to mirror."
        }
    };

    return AsyncMirror;
});