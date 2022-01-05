define([
    '../libs/buffers',
    '../generic/preload_file',
    '../core/file_system',
    '../core/node_fs_stats',
    '../core/api_error',
    '../core/util',
///    'dropbox_bridge',
    '../generic/setImmediate',
    '../libs/path'
], function (buffers,preload_file, file_system, node_fs_stats, api_error, util,  setImmediate, path) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { Stats, FileType } = node_fs_stats;
    const { ApiError, ErrorCode } = api_error;
    const { arrayBuffer2Buffer, buffer2ArrayBuffer } =  util;
///    const { Dropbox } =  dropbox_bridge;
    const { dirname } =  path;

    const { PreloadFile} = preload_file;

    const {Buffer} = buffers;


    /**
     * Dropbox paths do not begin with a /, they just begin with a folder at the root node.
     * Here, we strip the `/`.
     * @param p An absolute path
     */
    function FixPath(p) {
        if (p === '/') {
            return '';
        }
        else {
            return p;
        }
    }
    /**
     * HACK: Dropbox errors are FUBAR'd sometimes.
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
     * @param e
     */
    function ExtractTheFuckingError(e) {
        const obj = e.error;
        if (obj['.tag']) {
            // Everything is OK.
            return obj;
        }
        else if (obj['error']) {
            // Terrible nested object bug.
            const obj2 = obj.error;
            if (obj2['.tag']) {
                return obj2;
            }
            else if (obj2['reason'] && obj2['reason']['.tag']) {
                return obj2.reason;
            }
            else {
                return obj2;
            }
        }
        else if (typeof (obj) === 'string') {
            // Might be a fucking JSON object error.
            try {
                const obj2 = JSON.parse(obj);
                if (obj2['error'] && obj2['error']['reason'] && obj2['error']['reason']['.tag']) {
                    return obj2.error.reason;
                }
            }
            catch (e) {
                // Nope. Give up.
            }
        }
        return obj;
    }
    /**
     * Returns a user-facing error message given an error.
     *
     * HACK: Dropbox error messages sometimes lack a `user_message` field.
     * Sometimes, they are even strings. Ugh.
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/145
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/144
     * @param err An error.
     */
    function GetErrorMessage(err) {
        if (err['user_message']) {
            return err.user_message.text;
        }
        else if (err['error_summary']) {
            return err.error_summary;
        }
        else if (typeof (err.error) === "string") {
            return err.error;
        }
        else if (typeof (err.error) === "object") {
            // DROPBOX BUG: Sometimes, error is a nested error.
            return GetErrorMessage(err.error);
        }
        else {
            throw new Error(`Dropbox's servers gave us a garbage error message: ${JSON.stringify(err)}`);
        }
    }
    function LookupErrorToError(err, p, msg) {
        switch (err['.tag']) {
            case 'malformed_path':
                return new ApiError(ErrorCode.EBADF, msg, p);
            case 'not_found':
                return ApiError.ENOENT(p);
            case 'not_file':
                return ApiError.EISDIR(p);
            case 'not_folder':
                return ApiError.ENOTDIR(p);
            case 'restricted_content':
                return ApiError.EPERM(p);
            case 'other':
            default:
                return new ApiError(ErrorCode.EIO, msg, p);
        }
    }
    function WriteErrorToError(err, p, msg) {
        switch (err['.tag']) {
            case 'malformed_path':
            case 'disallowed_name':
                return new ApiError(ErrorCode.EBADF, msg, p);
            case 'conflict':
            case 'no_write_permission':
            case 'team_folder':
                return ApiError.EPERM(p);
            case 'insufficient_space':
                return new ApiError(ErrorCode.ENOSPC, msg);
            case 'other':
            default:
                return new ApiError(ErrorCode.EIO, msg, p);
        }
    }
    function FilesDeleteWrapped(client, p, cb) {
        const arg = {
            path: FixPath(p)
        };
        client.filesDeleteV2(arg)
            .then(() => {
            cb();
        }).catch((e) => {
            const err = ExtractTheFuckingError(e);
            switch (err['.tag']) {
                case 'path_lookup':
                    cb(LookupErrorToError(err.path_lookup, p, GetErrorMessage(e)));
                    break;
                case 'path_write':
                    cb(WriteErrorToError(err.path_write, p, GetErrorMessage(e)));
                    break;
                case 'too_many_write_operations':
                    setTimeout(() => FilesDeleteWrapped(client, p, cb), 500 + (300 * (Math.random())));
                    break;
                case 'other':
                default:
                    cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                    break;
            }
        });
    }
    class DropboxFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        sync(cb) {
            this._fs._syncFile(this.getPath(), this.getBuffer(), cb);
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * A read/write file system backed by Dropbox cloud storage.
     *
     * Uses the Dropbox V2 API, and the 2.x JS SDK.
     */
    class DropboxFileSystem extends BaseFileSystem {
        constructor(client) {
            super();
            this._client = client;
        }
        /**
         * Creates a new DropboxFileSystem instance with the given options.
         * Must be given an *authenticated* Dropbox client from 2.x JS SDK.
         */
        static Create(opts, cb) {
            cb(null, new DropboxFileSystem(opts.client));
        }
        static isAvailable() {
            // Checks if the Dropbox library is loaded.
            return typeof Dropbox !== 'undefined';
        }
        getName() {
            return DropboxFileSystem.Name;
        }
        isReadOnly() {
            return false;
        }
        // Dropbox doesn't support symlinks, properties, or synchronous calls
        // TODO: does it???
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
         * Deletes *everything* in the file system. Mainly intended for unit testing!
         * @param mainCb Called when operation completes.
         */
        empty(mainCb) {
            this.readdir('/', (e, paths) => {
                if (paths) {
                    const next = (e) => {
                        if (paths.length === 0) {
                            mainCb();
                        }
                        else {
                            FilesDeleteWrapped(this._client, paths.shift(), next);
                        }
                    };
                    next();
                }
                else {
                    mainCb(e);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            // Dropbox doesn't let you rename things over existing things, but POSIX does.
            // So, we need to see if newPath exists...
            this.stat(newPath, false, (e, stats) => {
                const rename = () => {
                    const relocationArg = {
                        from_path: FixPath(oldPath),
                        to_path: FixPath(newPath)
                    };
                    this._client.filesMoveV2(relocationArg)
                        .then(() => cb())
                        .catch(function (e) {
                        const err = ExtractTheFuckingError(e);
                        switch (err['.tag']) {
                            case 'from_lookup':
                                cb(LookupErrorToError(err.from_lookup, oldPath, GetErrorMessage(e)));
                                break;
                            case 'from_write':
                                cb(WriteErrorToError(err.from_write, oldPath, GetErrorMessage(e)));
                                break;
                            case 'to':
                                cb(WriteErrorToError(err.to, newPath, GetErrorMessage(e)));
                                break;
                            case 'cant_copy_shared_folder':
                            case 'cant_nest_shared_folder':
                                cb(new ApiError(ErrorCode.EPERM, GetErrorMessage(e), oldPath));
                                break;
                            case 'cant_move_folder_into_itself':
                            case 'duplicated_or_nested_paths':
                                cb(new ApiError(ErrorCode.EBADF, GetErrorMessage(e), oldPath));
                                break;
                            case 'too_many_files':
                                cb(new ApiError(ErrorCode.ENOSPC, GetErrorMessage(e), oldPath));
                                break;
                            case 'other':
                            default:
                                cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), oldPath));
                                break;
                        }
                    });
                };
                if (e) {
                    // Doesn't exist. Proceed!
                    rename();
                }
                else if (oldPath === newPath) {
                    // NOP if the path exists. Error if it doesn't exist.
                    if (e) {
                        cb(ApiError.ENOENT(newPath));
                    }
                    else {
                        cb();
                    }
                }
                else if (stats && stats.isDirectory()) {
                    // Exists, is a directory. Cannot rename over an existing directory.
                    cb(ApiError.EISDIR(newPath));
                }
                else {
                    // Exists, is a file, and differs from oldPath. Delete and rename.
                    this.unlink(newPath, (e) => {
                        if (e) {
                            cb(e);
                        }
                        else {
                            rename();
                        }
                    });
                }
            });
        }
        stat(path, isLstat, cb) {
            if (path === '/') {
                // Dropbox doesn't support querying the root directory.
                setImmediate(function () {
                    cb(null, new Stats(FileType.DIRECTORY, 4096));
                });
                return;
            }
            const arg = {
                path: FixPath(path)
            };
            this._client.filesGetMetadata(arg).then((ref) => {
                switch (ref['.tag']) {
                    case 'file':
                        const fileMetadata = ref;
                        // TODO: Parse time fields.
                        cb(null, new Stats(FileType.FILE, fileMetadata.size));
                        break;
                    case 'folder':
                        cb(null, new Stats(FileType.DIRECTORY, 4096));
                        break;
                    case 'deleted':
                        cb(ApiError.ENOENT(path));
                        break;
                    default:
                        // Unknown.
                        break;
                }
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        cb(LookupErrorToError(err.path, path, GetErrorMessage(e)));
                        break;
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                        break;
                }
            });
        }
        openFile(path, flags, cb) {
            const downloadArg = {
                path: FixPath(path)
            };
            this._client.filesDownload(downloadArg).then((res) => {
                const b = res.fileBlob;
                const fr = new FileReader();
                fr.onload = () => {
                    const ab = fr.result;
                    cb(null, new DropboxFile(this, path, flags, new Stats(FileType.FILE, ab.byteLength), arrayBuffer2Buffer(ab)));
                };
                fr.readAsArrayBuffer(b);
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        const dpError = err;
                        cb(LookupErrorToError(dpError.path, path, GetErrorMessage(e)));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                        break;
                }
            });
        }
        createFile(p, flags, mode, cb) {
            const fileData = Buffer.alloc(0);
            const blob = new Blob([buffer2ArrayBuffer(fileData)], { type: "octet/stream" });
            const commitInfo = {
                contents: blob,
                path: FixPath(p)
            };
            this._client.filesUpload(commitInfo).then((metadata) => {
                cb(null, new DropboxFile(this, p, flags, new Stats(FileType.FILE, 0), fileData));
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                // HACK: Casting to 'any' since tag can be 'too_many_write_operations'.
                switch (err['.tag']) {
                    case 'path':
                        const upError = err;
                        cb(WriteErrorToError(upError.path.reason, p, GetErrorMessage(e)));
                        break;
                    case 'too_many_write_operations':
                        // Retry in (500, 800) ms.
                        setTimeout(() => this.createFile(p, flags, mode, cb), 500 + (300 * (Math.random())));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                        break;
                }
            });
        }
        /**
         * Delete a file
         */
        unlink(path, cb) {
            // Must be a file. Check first.
            this.stat(path, false, (e, stat) => {
                if (stat) {
                    if (stat.isDirectory()) {
                        cb(ApiError.EISDIR(path));
                    }
                    else {
                        FilesDeleteWrapped(this._client, path, cb);
                    }
                }
                else {
                    cb(e);
                }
            });
        }
        /**
         * Delete a directory
         */
        rmdir(path, cb) {
            this.readdir(path, (e, paths) => {
                if (paths) {
                    if (paths.length > 0) {
                        cb(ApiError.ENOTEMPTY(path));
                    }
                    else {
                        FilesDeleteWrapped(this._client, path, cb);
                    }
                }
                else {
                    cb(e);
                }
            });
        }
        /**
         * Create a directory
         */
        mkdir(p, mode, cb) {
            // Dropbox's create_folder is recursive. Check if parent exists.
            const parent = dirname(p);
            this.stat(parent, false, (e, stats) => {
                if (e) {
                    cb(e);
                }
                else if (stats && !stats.isDirectory()) {
                    cb(ApiError.ENOTDIR(parent));
                }
                else {
                    const arg = {
                        path: FixPath(p)
                    };
                    this._client.filesCreateFolderV2(arg).then(() => cb()).catch((e) => {
                        const err = ExtractTheFuckingError(e);
                        if (err['.tag'] === "too_many_write_operations") {
                            // Retry in a bit.
                            setTimeout(() => this.mkdir(p, mode, cb), 500 + (300 * (Math.random())));
                        }
                        else {
                            cb(WriteErrorToError(ExtractTheFuckingError(e).path, p, GetErrorMessage(e)));
                        }
                    });
                }
            });
        }
        /**
         * Get the names of the files in a directory
         */
        readdir(path, cb) {
            const arg = {
                path: FixPath(path)
            };
            this._client.filesListFolder(arg).then((res) => {
                ContinueReadingDir(this._client, path, res, [], cb);
            }).catch((e) => {
                ProcessListFolderError(e, path, cb);
            });
        }
        /**
         * (Internal) Syncs file to Dropbox.
         */
        _syncFile(p, d, cb) {
            const blob = new Blob([buffer2ArrayBuffer(d)], { type: "octet/stream" });
            const arg = {
                contents: blob,
                path: FixPath(p),
                mode: {
                    '.tag': 'overwrite'
                }
            };
            this._client.filesUpload(arg).then(() => {
                cb();
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        const upError = err;
                        cb(WriteErrorToError(upError.path.reason, p, GetErrorMessage(e)));
                        break;
                    case 'too_many_write_operations':
                        setTimeout(() => this._syncFile(p, d, cb), 500 + (300 * (Math.random())));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                        break;
                }
            });
        }
    }
    DropboxFileSystem.Name = "DropboxV2";
    DropboxFileSystem.Options = {
        client: {
            type: "object",
            description: "An *authenticated* Dropbox client. Must be from the 2.5.x JS SDK."
        }
    };
    function ProcessListFolderError(e, path, cb) {
        const err = ExtractTheFuckingError(e);
        switch (err['.tag']) {
            case 'path':
                const pathError = err;
                cb(LookupErrorToError(pathError.path, path, GetErrorMessage(e)));
                break;
            case 'other':
            default:
                cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                break;
        }
    }
    function ContinueReadingDir(client, path, res, previousEntries, cb) {
        const newEntries = res.entries.map((e) => e.path_display).filter((p) => !!p);
        const entries = previousEntries.concat(newEntries);
        if (!res.has_more) {
            cb(null, entries);
        }
        else {
            const arg = {
                cursor: res.cursor
            };
            client.filesListFolderContinue(arg).then((res) => {
                ContinueReadingDir(client, path, res, entries, cb);
            }).catch((e) => {
                ProcessListFolderError(e, path, cb);
            });
        }
    }

    DropboxFileSystem.DropboxFile = DropboxFile;

    return  DropboxFileSystem;
    
});