define([
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/util',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../generic/xhr',
    '../generic/fetch',
    '../generic/file_index'
], function (file_system, api_error, file_flag, util, node_fs_stats, preload_file, xhr, fetch, file_index) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { ActionType }  = file_flag;
    const { copyingSlice }  = util;
    const  {Stats} = node_fs_stats;
    const { NoSyncFile }  = preload_file;
    const { xhrIsAvailable, asyncDownloadFile, syncDownloadFile, getFileSizeAsync, getFileSizeSync }  = xhr;
    const { fetchIsAvailable, fetchFileAsync, fetchFileSizeAsync }  = fetch;
    const { FileIndex, isFileInode, isDirInode }  = file_index;
    /**
     * Try to convert the given buffer into a string, and pass it to the callback.
     * Optimization that removes the needed try/catch into a helper function, as
     * this is an uncommon case.
     * @hidden
     */
    function tryToString(buff, encoding, cb) {
        try {
            cb(null, buff.toString(encoding));
        }
        catch (e) {
            cb(e);
        }
    }
    function syncNotAvailableError() {
        throw new ApiError(ErrorCode.ENOTSUP, `Synchronous HTTP download methods are not available in this environment.`);
    }
    /**
     * A simple filesystem backed by HTTP downloads. You must create a directory listing using the
     * `make_http_index` tool provided by BrowserFS.
     *
     * If you install BrowserFS globally with `npm i -g browserfs`, you can generate a listing by
     * running `make_http_index` in your terminal in the directory you would like to index:
     *
     * ```
     * make_http_index > index.json
     * ```
     *
     * Listings objects look like the following:
     *
     * ```json
     * {
     *   "home": {
     *     "jvilk": {
     *       "someFile.txt": null,
     *       "someDir": {
     *         // Empty directory
     *       }
     *     }
     *   }
     * }
     * ```
     *
     * *This example has the folder `/home/jvilk` with subfile `someFile.txt` and subfolder `someDir`.*
     */
    class HTTPRequest extends BaseFileSystem {
        constructor(index, prefixUrl = '', preferXHR = false) {
            super();
            // prefix_url must end in a directory separator.
            if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
                prefixUrl = prefixUrl + '/';
            }
            this.prefixUrl = prefixUrl;
            this._index = FileIndex.fromListing(index);
            if (fetchIsAvailable && (!preferXHR || !xhrIsAvailable)) {
                this._requestFileAsyncInternal = fetchFileAsync;
                this._requestFileSizeAsyncInternal = fetchFileSizeAsync;
            }
            else {
                this._requestFileAsyncInternal = asyncDownloadFile;
                this._requestFileSizeAsyncInternal = getFileSizeAsync;
            }
            if (xhrIsAvailable) {
                this._requestFileSyncInternal = syncDownloadFile;
                this._requestFileSizeSyncInternal = getFileSizeSync;
            }
            else {
                this._requestFileSyncInternal = syncNotAvailableError;
                this._requestFileSizeSyncInternal = syncNotAvailableError;
            }
        }
        /**
         * Construct an HTTPRequest file system backend with the given options.
         */
        static Create(opts, cb) {
            if (opts.index === undefined) {
                opts.index = `index.json`;
            }
            if (typeof (opts.index) === "string") {
                asyncDownloadFile(opts.index, "json", (e, data) => {
                    if (e) {
                        cb(e);
                    }
                    else {
                        cb(null, new HTTPRequest(data, opts.baseUrl));
                    }
                });
            }
            else {
                cb(null, new HTTPRequest(opts.index, opts.baseUrl));
            }
        }
        static isAvailable() {
            return xhrIsAvailable || fetchIsAvailable;
        }
        empty() {
            this._index.fileIterator(function (file) {
                file.fileData = null;
            });
        }
        getName() {
            return HTTPRequest.Name;
        }
        diskSpace(path, cb) {
            // Read-only file system. We could calculate the total space, but that's not
            // important right now.
            cb(0, 0);
        }
        isReadOnly() {
            return true;
        }
        supportsLinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            // Synchronous operations are only available via the XHR interface for now.
            return xhrIsAvailable;
        }
        /**
         * Special HTTPFS function: Preload the given file into the index.
         * @param [String] path
         * @param [BrowserFS.Buffer] buffer
         */
        preloadFile(path, buffer) {
            const inode = this._index.getInode(path);
            if (isFileInode(inode)) {
                if (inode === null) {
                    throw ApiError.ENOENT(path);
                }
                const stats = inode.getData();
                stats.size = buffer.length;
                stats.fileData = buffer;
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        stat(path, isLstat, cb) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                return cb(ApiError.ENOENT(path));
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData();
                // At this point, a non-opened file will still have default stats from the listing.
                if (stats.size < 0) {
                    this._requestFileSizeAsync(path, function (e, size) {
                        if (e) {
                            return cb(e);
                        }
                        stats.size = size;
                        cb(null, Stats.clone(stats));
                    });
                }
                else {
                    cb(null, Stats.clone(stats));
                }
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
                cb(null, stats);
            }
            else {
                cb(ApiError.FileError(ErrorCode.EINVAL, path));
            }
        }
        statSync(path, isLstat) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData();
                // At this point, a non-opened file will still have default stats from the listing.
                if (stats.size < 0) {
                    stats.size = this._requestFileSizeSync(path);
                }
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
            }
            else {
                throw ApiError.FileError(ErrorCode.EINVAL, path);
            }
            return stats;
        }
        open(path, flags, mode, cb) {
            // INVARIANT: You can't write to files on this file system.
            if (flags.isWriteable()) {
                return cb(new ApiError(ErrorCode.EPERM, path));
            }
            const self = this;
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (inode === null) {
                return cb(ApiError.ENOENT(path));
            }
            if (isFileInode(inode)) {
                const stats = inode.getData();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        return cb(ApiError.EEXIST(path));
                    case ActionType.NOP:
                        // Use existing file contents.
                        // XXX: Uh, this maintains the previously-used flag.
                        if (stats.fileData) {
                            return cb(null, new NoSyncFile(self, path, flags, Stats.clone(stats), stats.fileData));
                        }
                        // @todo be lazier about actually requesting the file
                        this._requestFileAsync(path, 'buffer', function (err, buffer) {
                            if (err) {
                                return cb(err);
                            }
                            // we don't initially have file sizes
                            stats.size = buffer.length;
                            stats.fileData = buffer;
                            return cb(null, new NoSyncFile(self, path, flags, Stats.clone(stats), buffer));
                        });
                        break;
                    default:
                        return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.'));
                }
            }
            else {
                return cb(ApiError.EISDIR(path));
            }
        }
        openSync(path, flags, mode) {
            // INVARIANT: You can't write to files on this file system.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, path);
            }
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            if (isFileInode(inode)) {
                const stats = inode.getData();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(path);
                    case ActionType.NOP:
                        // Use existing file contents.
                        // XXX: Uh, this maintains the previously-used flag.
                        if (stats.fileData) {
                            return new NoSyncFile(this, path, flags, Stats.clone(stats), stats.fileData);
                        }
                        // @todo be lazier about actually requesting the file
                        const buffer = this._requestFileSync(path, 'buffer');
                        // we don't initially have file sizes
                        stats.size = buffer.length;
                        stats.fileData = buffer;
                        return new NoSyncFile(this, path, flags, Stats.clone(stats), buffer);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        readdir(path, cb) {
            try {
                cb(null, this.readdirSync(path));
            }
            catch (e) {
                cb(e);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            else if (isDirInode(inode)) {
                return inode.getListing();
            }
            else {
                throw ApiError.ENOTDIR(path);
            }
        }
        /**
         * We have the entire file as a buffer; optimize readFile.
         */
        readFile(fname, encoding, flag, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err, arg) {
                    fd.close(function (err2) {
                        if (!err) {
                            err = err2;
                        }
                        return oldCb(err, arg);
                    });
                };
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    cb(err, copyingSlice(fdBuff));
                }
                else {
                    tryToString(fdBuff, encoding, cb);
                }
            });
        }
        /**
         * Specially-optimized readfile.
         */
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    return copyingSlice(fdBuff);
                }
                return fdBuff.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
        _getHTTPPath(filePath) {
            if (filePath.charAt(0) === '/') {
                filePath = filePath.slice(1);
            }
            return this.prefixUrl + filePath;
        }
        _requestFileAsync(p, type, cb) {
            this._requestFileAsyncInternal(this._getHTTPPath(p), type, cb);
        }
        _requestFileSync(p, type) {
            return this._requestFileSyncInternal(this._getHTTPPath(p), type);
        }
        /**
         * Only requests the HEAD content, for the file size.
         */
        _requestFileSizeAsync(path, cb) {
            this._requestFileSizeAsyncInternal(this._getHTTPPath(path), cb);
        }
        _requestFileSizeSync(path) {
            return this._requestFileSizeSyncInternal(this._getHTTPPath(path));
        }
    }
    HTTPRequest.Name = "HTTPRequest";
    HTTPRequest.Options = {
        index: {
            type: ["string", "object"],
            optional: true,
            description: "URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script. Defaults to `index.json`."
        },
        baseUrl: {
            type: "string",
            optional: true,
            description: "Used as the URL prefix for fetched files. Default: Fetch files relative to the index."
        },
        preferXHR: {
            type: "boolean",
            optional: true,
            description: "Whether to prefer XmlHttpRequest or fetch for async operations if both are available. Default: false"
        }
    };

    return HTTPRequest;
});