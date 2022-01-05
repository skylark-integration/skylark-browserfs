define([
    "skylark-langx-async",
    '../generic/preload_file',
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/node_fs_stats',
    '../libs/path',
    '../core/global',
    '../core/util'
], function (async,preload_file, file_system, api_error, file_flag, node_fs_stats, path, global, util) {
    'use strict';
    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { ActionType } = file_flag;
    const { Stats, FileType } = node_fs_stats;
    const asyncEach = async.each;
    const { buffer2ArrayBuffer, arrayBuffer2Buffer } = util;

    const { PreloadFile} = preload_file;

    /**
     * @hidden
     */
    function isDirectoryEntry(entry) {
        return entry.isDirectory;
    }
    /**
     * @hidden
     */
    const _getFS = global.webkitRequestFileSystem || global.requestFileSystem || null;
    /**
     * @hidden
     */
    function _requestQuota(type, size, success, errorCallback) {
        // We cast navigator and window to '<any>' because everything here is
        // nonstandard functionality, despite the fact that Chrome has the only
        // implementation of the HTML5FS and is likely driving the standardization
        // process. Thus, these objects defined off of navigator and window are not
        // present in the DefinitelyTyped TypeScript typings for FileSystem.
        if (typeof navigator['webkitPersistentStorage'] !== 'undefined') {
            switch (type) {
                case global.PERSISTENT:
                    navigator.webkitPersistentStorage.requestQuota(size, success, errorCallback);
                    break;
                case global.TEMPORARY:
                    navigator.webkitTemporaryStorage.requestQuota(size, success, errorCallback);
                    break;
                default:
                    errorCallback(new TypeError(`Invalid storage type: ${type}`));
                    break;
            }
        }
        else {
            global.webkitStorageInfo.requestQuota(type, size, success, errorCallback);
        }
    }
    /**
     * @hidden
     */
    function _toArray(list) {
        return Array.prototype.slice.call(list || [], 0);
    }
    /**
     * Converts the given DOMError into an appropriate ApiError.
     * @url https://developer.mozilla.org/en-US/docs/Web/API/DOMError
     * @hidden
     */
    function convertError(err, p, expectedDir) {
        switch (err.name) {
            /* The user agent failed to create a file or directory due to the existence of a file or
                directory with the same path.  */
            case "PathExistsError":
                return ApiError.EEXIST(p);
            /* The operation failed because it would cause the application to exceed its storage quota.  */
            case 'QuotaExceededError':
                return ApiError.FileError(ErrorCode.ENOSPC, p);
            /*  A required file or directory could not be found at the time an operation was processed.   */
            case 'NotFoundError':
                return ApiError.ENOENT(p);
            /* This is a security error code to be used in situations not covered by any other error codes.
                - A required file was unsafe for access within a Web application
                - Too many calls are being made on filesystem resources */
            case 'SecurityError':
                return ApiError.FileError(ErrorCode.EACCES, p);
            /* The modification requested was illegal. Examples of invalid modifications include moving a
                directory into its own child, moving a file into its parent directory without changing its name,
                or copying a directory to a path occupied by a file.  */
            case 'InvalidModificationError':
                return ApiError.FileError(ErrorCode.EPERM, p);
            /* The user has attempted to look up a file or directory, but the Entry found is of the wrong type
                [e.g. is a DirectoryEntry when the user requested a FileEntry].  */
            case 'TypeMismatchError':
                return ApiError.FileError(expectedDir ? ErrorCode.ENOTDIR : ErrorCode.EISDIR, p);
            /* A path or URL supplied to the API was malformed.  */
            case "EncodingError":
            /* An operation depended on state cached in an interface object, but that state that has changed
                since it was read from disk.  */
            case "InvalidStateError":
            /* The user attempted to write to a file or directory which could not be modified due to the state
                of the underlying filesystem.  */
            case "NoModificationAllowedError":
            default:
                return ApiError.FileError(ErrorCode.EINVAL, p);
        }
    }
    // A note about getFile and getDirectory options:
    // These methods are called at numerous places in this file, and are passed
    // some combination of these two options:
    //   - create: If true, the entry will be created if it doesn't exist.
    //             If false, an error will be thrown if it doesn't exist.
    //   - exclusive: If true, only create the entry if it doesn't already exist,
    //                and throw an error if it does.
    class HTML5FSFile extends PreloadFile {
        constructor(fs, entry, path, flag, stat, contents) {
            super(fs, path, flag, stat, contents);
            this._entry = entry;
        }
        sync(cb) {
            if (!this.isDirty()) {
                return cb();
            }
            this._entry.createWriter((writer) => {
                const buffer = this.getBuffer();
                const blob = new Blob([buffer2ArrayBuffer(buffer)]);
                const length = blob.size;
                writer.onwriteend = (err) => {
                    writer.onwriteend = null;
                    writer.onerror = null;
                    writer.truncate(length);
                    this.resetDirty();
                    cb();
                };
                writer.onerror = (err) => {
                    cb(convertError(err, this.getPath(), false));
                };
                writer.write(blob);
            });
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * A read-write filesystem backed by the HTML5 FileSystem API.
     *
     * As the HTML5 FileSystem is only implemented in Blink, this interface is
     * only available in Chrome.
     */
    class HTML5FS extends BaseFileSystem {
        /**
         * @param size storage quota to request, in megabytes. Allocated value may be less.
         * @param type window.PERSISTENT or window.TEMPORARY. Defaults to PERSISTENT.
         */
        constructor(size = 5, type = global.PERSISTENT) {
            super();
            // Convert MB to bytes.
            this.size = 1024 * 1024 * size;
            this.type = type;
        }
        /**
         * Creates an HTML5FS instance with the given options.
         */
        static Create(opts, cb) {
            const fs = new HTML5FS(opts.size, opts.type);
            fs._allocate((e) => e ? cb(e) : cb(null, fs));
        }
        static isAvailable() {
            return !!_getFS;
        }
        getName() {
            return HTML5FS.Name;
        }
        isReadOnly() {
            return false;
        }
        supportsSymlinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return false;
        }
        /**
         * Deletes everything in the FS. Used for testing.
         * Karma clears the storage after you quit it but not between runs of the test
         * suite, and the tests expect an empty FS every time.
         */
        empty(mainCb) {
            // Get a list of all entries in the root directory to delete them
            this._readdir('/', (err, entries) => {
                if (err) {
                    mainCb(err);
                }
                else {
                    // Called when every entry has been operated on
                    const finished = (er) => {
                        if (err) {
                            mainCb(err);
                        }
                        else {
                            mainCb();
                        }
                    };
                    // Removes files and recursively removes directories
                    const deleteEntry = (entry, cb) => {
                        const succ = () => {
                            cb();
                        };
                        const error = (err) => {
                            cb(convertError(err, entry.fullPath, !entry.isDirectory));
                        };
                        if (isDirectoryEntry(entry)) {
                            entry.removeRecursively(succ, error);
                        }
                        else {
                            entry.remove(succ, error);
                        }
                    };
                    // Loop through the entries and remove them, then call the callback
                    // when they're all finished.
                    asyncEach(entries, deleteEntry, finished);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            let semaphore = 2;
            let successCount = 0;
            const root = this.fs.root;
            let currentPath = oldPath;
            const error = (err) => {
                if (--semaphore <= 0) {
                    cb(convertError(err, currentPath, false));
                }
            };
            const success = (file) => {
                if (++successCount === 2) {
                    return cb(new ApiError(ErrorCode.EINVAL, "Something was identified as both a file and a directory. This should never happen."));
                }
                // SPECIAL CASE: If newPath === oldPath, and the path exists, then
                // this operation trivially succeeds.
                if (oldPath === newPath) {
                    return cb();
                }
                // Get the new parent directory.
                currentPath = path.dirname(newPath);
                root.getDirectory(currentPath, {}, (parentDir) => {
                    currentPath = path.basename(newPath);
                    file.moveTo(parentDir, currentPath, (entry) => { cb(); }, (err) => {
                        // SPECIAL CASE: If oldPath is a directory, and newPath is a
                        // file, rename should delete the file and perform the move.
                        if (file.isDirectory) {
                            currentPath = newPath;
                            // Unlink only works on files. Try to delete newPath.
                            this.unlink(newPath, (e) => {
                                if (e) {
                                    // newPath is probably a directory.
                                    error(err);
                                }
                                else {
                                    // Recur, now that newPath doesn't exist.
                                    this.rename(oldPath, newPath, cb);
                                }
                            });
                        }
                        else {
                            error(err);
                        }
                    });
                }, error);
            };
            // We don't know if oldPath is a *file* or a *directory*, and there's no
            // way to stat items. So launch both requests, see which one succeeds.
            root.getFile(oldPath, {}, success, error);
            root.getDirectory(oldPath, {}, success, error);
        }
        stat(path, isLstat, cb) {
            // Throw an error if the entry doesn't exist, because then there's nothing
            // to stat.
            const opts = {
                create: false
            };
            // Called when the path has been successfully loaded as a file.
            const loadAsFile = (entry) => {
                const fileFromEntry = (file) => {
                    const stat = new Stats(FileType.FILE, file.size);
                    cb(null, stat);
                };
                entry.file(fileFromEntry, failedToLoad);
            };
            // Called when the path has been successfully loaded as a directory.
            const loadAsDir = (dir) => {
                // Directory entry size can't be determined from the HTML5 FS API, and is
                // implementation-dependant anyway, so a dummy value is used.
                const size = 4096;
                const stat = new Stats(FileType.DIRECTORY, size);
                cb(null, stat);
            };
            // Called when the path couldn't be opened as a directory or a file.
            const failedToLoad = (err) => {
                cb(convertError(err, path, false /* Unknown / irrelevant */));
            };
            // Called when the path couldn't be opened as a file, but might still be a
            // directory.
            const failedToLoadAsFile = () => {
                this.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
            };
            // No method currently exists to determine whether a path refers to a
            // directory or a file, so this implementation tries both and uses the first
            // one that succeeds.
            this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
        }
        open(p, flags, mode, cb) {
            // XXX: err is a DOMError
            const error = (err) => {
                if (err.name === 'InvalidModificationError' && flags.isExclusive()) {
                    cb(ApiError.EEXIST(p));
                }
                else {
                    cb(convertError(err, p, false));
                }
            };
            this.fs.root.getFile(p, {
                create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
                exclusive: flags.isExclusive()
            }, (entry) => {
                // Try to fetch corresponding file.
                entry.file((file) => {
                    const reader = new FileReader();
                    reader.onloadend = (event) => {
                        const bfsFile = this._makeFile(p, entry, flags, file, reader.result);
                        cb(null, bfsFile);
                    };
                    reader.onerror = (ev) => {
                        error(reader.error);
                    };
                    reader.readAsArrayBuffer(file);
                }, error);
            }, error);
        }
        unlink(path, cb) {
            this._remove(path, cb, true);
        }
        rmdir(path, cb) {
            // Check if directory is non-empty, first.
            this.readdir(path, (e, files) => {
                if (e) {
                    cb(e);
                }
                else if (files.length > 0) {
                    cb(ApiError.ENOTEMPTY(path));
                }
                else {
                    this._remove(path, cb, false);
                }
            });
        }
        mkdir(path, mode, cb) {
            // Create the directory, but throw an error if it already exists, as per
            // mkdir(1)
            const opts = {
                create: true,
                exclusive: true
            };
            const success = (dir) => {
                cb();
            };
            const error = (err) => {
                cb(convertError(err, path, true));
            };
            this.fs.root.getDirectory(path, opts, success, error);
        }
        /**
         * Map _readdir's list of `FileEntry`s to their names and return that.
         */
        readdir(path, cb) {
            this._readdir(path, (e, entries) => {
                if (entries) {
                    const rv = [];
                    for (const entry of entries) {
                        rv.push(entry.name);
                    }
                    cb(null, rv);
                }
                else {
                    return cb(e);
                }
            });
        }
        /**
         * Returns a BrowserFS object representing a File.
         */
        _makeFile(path, entry, flag, stat, data = new ArrayBuffer(0)) {
            const stats = new Stats(FileType.FILE, stat.size);
            const buffer = arrayBuffer2Buffer(data);
            return new HTML5FSFile(this, entry, path, flag, stats, buffer);
        }
        /**
         * Returns an array of `FileEntry`s. Used internally by empty and readdir.
         */
        _readdir(path, cb) {
            const error = (err) => {
                cb(convertError(err, path, true));
            };
            // Grab the requested directory.
            this.fs.root.getDirectory(path, { create: false }, (dirEntry) => {
                const reader = dirEntry.createReader();
                let entries = [];
                // Call the reader.readEntries() until no more results are returned.
                const readEntries = () => {
                    reader.readEntries(((results) => {
                        if (results.length) {
                            entries = entries.concat(_toArray(results));
                            readEntries();
                        }
                        else {
                            cb(null, entries);
                        }
                    }), error);
                };
                readEntries();
            }, error);
        }
        /**
         * Requests a storage quota from the browser to back this FS.
         */
        _allocate(cb) {
            const success = (fs) => {
                this.fs = fs;
                cb();
            };
            const error = (err) => {
                cb(convertError(err, "/", true));
            };
            if (this.type === global.PERSISTENT) {
                _requestQuota(this.type, this.size, (granted) => {
                    _getFS(this.type, granted, success, error);
                }, error);
            }
            else {
                _getFS(this.type, this.size, success, error);
            }
        }
        /**
         * Delete a file or directory from the file system
         * isFile should reflect which call was made to remove the it (`unlink` or
         * `rmdir`). If this doesn't match what's actually at `path`, an error will be
         * returned
         */
        _remove(path, cb, isFile) {
            const success = (entry) => {
                const succ = () => {
                    cb();
                };
                const err = (err) => {
                    cb(convertError(err, path, !isFile));
                };
                entry.remove(succ, err);
            };
            const error = (err) => {
                cb(convertError(err, path, !isFile));
            };
            // Deleting the entry, so don't create it
            const opts = {
                create: false
            };
            if (isFile) {
                this.fs.root.getFile(path, opts, success, error);
            }
            else {
                this.fs.root.getDirectory(path, opts, success, error);
            }
        }
    }
    HTML5FS.Name = "HTML5FS";
    HTML5FS.Options = {
        size: {
            type: "number",
            optional: true,
            description: "Storage quota to request, in megabytes. Allocated value may be less. Defaults to 5."
        },
        type: {
            type: "number",
            optional: true,
            description: "window.PERSISTENT or window.TEMPORARY. Defaults to PERSISTENT."
        }
    };

    HTML5FS.HTML5FSFile = HTML5FSFile;

    return HTML5FS;
});