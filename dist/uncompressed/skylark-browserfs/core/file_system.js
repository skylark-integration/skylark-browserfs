define([
    './api_error',
    './file_flag',
    '../libs/path',
    './util'
], function (api_error, file_flag, path, util) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { FileFlag, ActionType } = file_flag;
    const { fail } = util;

    /**
     * Basic filesystem class. Most filesystems should extend this class, as it
     * provides default implementations for a handful of methods.
     */
    class BaseFileSystem {
        supportsLinks() {
            return false;
        }
        diskSpace(p, cb) {
            cb(0, 0);
        }
        /**
         * Opens the file at path p with the given flag. The file must exist.
         * @param p The path to open.
         * @param flag The flag to use when opening the file.
         */
        openFile(p, flag, cb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Create the file at path p with the given mode. Then, open it with the given
         * flag.
         */
        createFile(p, flag, mode, cb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        open(p, flag, mode, cb) {
            const mustBeFile = (e, stats) => {
                if (e) {
                    // File does not exist.
                    switch (flag.pathNotExistsAction()) {
                        case ActionType.CREATE_FILE:
                            // Ensure parent exists.
                            return this.stat(path.dirname(p), false, (e, parentStats) => {
                                if (e) {
                                    cb(e);
                                }
                                else if (parentStats && !parentStats.isDirectory()) {
                                    cb(ApiError.ENOTDIR(path.dirname(p)));
                                }
                                else {
                                    this.createFile(p, flag, mode, cb);
                                }
                            });
                        case ActionType.THROW_EXCEPTION:
                            return cb(ApiError.ENOENT(p));
                        default:
                            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                    }
                }
                else {
                    // File exists.
                    if (stats && stats.isDirectory()) {
                        return cb(ApiError.EISDIR(p));
                    }
                    switch (flag.pathExistsAction()) {
                        case ActionType.THROW_EXCEPTION:
                            return cb(ApiError.EEXIST(p));
                        case ActionType.TRUNCATE_FILE:
                            // NOTE: In a previous implementation, we deleted the file and
                            // re-created it. However, this created a race condition if another
                            // asynchronous request was trying to read the file, as the file
                            // would not exist for a small period of time.
                            return this.openFile(p, flag, (e, fd) => {
                                if (e) {
                                    cb(e);
                                }
                                else if (fd) {
                                    fd.truncate(0, () => {
                                        fd.sync(() => {
                                            cb(null, fd);
                                        });
                                    });
                                }
                                else {
                                    fail();
                                }
                            });
                        case ActionType.NOP:
                            return this.openFile(p, flag, cb);
                        default:
                            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                    }
                }
            };
            this.stat(p, false, mustBeFile);
        }
        rename(oldPath, newPath, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        renameSync(oldPath, newPath) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        stat(p, isLstat, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        statSync(p, isLstat) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Opens the file at path p with the given flag. The file must exist.
         * @param p The path to open.
         * @param flag The flag to use when opening the file.
         * @return A File object corresponding to the opened file.
         */
        openFileSync(p, flag, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Create the file at path p with the given mode. Then, open it with the given
         * flag.
         */
        createFileSync(p, flag, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        openSync(p, flag, mode) {
            // Check if the path exists, and is a file.
            let stats;
            try {
                stats = this.statSync(p, false);
            }
            catch (e) {
                // File does not exist.
                switch (flag.pathNotExistsAction()) {
                    case ActionType.CREATE_FILE:
                        // Ensure parent exists.
                        const parentStats = this.statSync(path.dirname(p), false);
                        if (!parentStats.isDirectory()) {
                            throw ApiError.ENOTDIR(path.dirname(p));
                        }
                        return this.createFileSync(p, flag, mode);
                    case ActionType.THROW_EXCEPTION:
                        throw ApiError.ENOENT(p);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
                }
            }
            // File exists.
            if (stats.isDirectory()) {
                throw ApiError.EISDIR(p);
            }
            switch (flag.pathExistsAction()) {
                case ActionType.THROW_EXCEPTION:
                    throw ApiError.EEXIST(p);
                case ActionType.TRUNCATE_FILE:
                    // Delete file.
                    this.unlinkSync(p);
                    // Create file. Use the same mode as the old file.
                    // Node itself modifies the ctime when this occurs, so this action
                    // will preserve that behavior if the underlying file system
                    // supports those properties.
                    return this.createFileSync(p, flag, stats.mode);
                case ActionType.NOP:
                    return this.openFileSync(p, flag, mode);
                default:
                    throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
            }
        }
        unlink(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        unlinkSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        rmdir(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        rmdirSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        mkdir(p, mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        mkdirSync(p, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        readdir(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        readdirSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        exists(p, cb) {
            this.stat(p, null, function (err) {
                cb(!err);
            });
        }
        existsSync(p) {
            try {
                this.statSync(p, true);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        realpath(p, cache, cb) {
            if (this.supportsLinks()) {
                // The path could contain symlinks. Split up the path,
                // resolve any symlinks, return the resolved string.
                const splitPath = p.split(path.sep);
                // TODO: Simpler to just pass through file, find sep and such.
                for (let i = 0; i < splitPath.length; i++) {
                    const addPaths = splitPath.slice(0, i + 1);
                    splitPath[i] = path.join.apply(null, addPaths);
                }
            }
            else {
                // No symlinks. We just need to verify that it exists.
                this.exists(p, function (doesExist) {
                    if (doesExist) {
                        cb(null, p);
                    }
                    else {
                        cb(ApiError.ENOENT(p));
                    }
                });
            }
        }
        realpathSync(p, cache) {
            if (this.supportsLinks()) {
                // The path could contain symlinks. Split up the path,
                // resolve any symlinks, return the resolved string.
                const splitPath = p.split(path.sep);
                // TODO: Simpler to just pass through file, find sep and such.
                for (let i = 0; i < splitPath.length; i++) {
                    const addPaths = splitPath.slice(0, i + 1);
                    splitPath[i] = path.join.apply(path, addPaths);
                }
                return splitPath.join(path.sep);
            }
            else {
                // No symlinks. We just need to verify that it exists.
                if (this.existsSync(p)) {
                    return p;
                }
                else {
                    throw ApiError.ENOENT(p);
                }
            }
        }
        truncate(p, len, cb) {
            this.open(p, FileFlag.getFileFlag('r+'), 0x1a4, (function (er, fd) {
                if (er) {
                    return cb(er);
                }
                fd.truncate(len, (function (er) {
                    fd.close((function (er2) {
                        cb(er || er2);
                    }));
                }));
            }));
        }
        truncateSync(p, len) {
            const fd = this.openSync(p, FileFlag.getFileFlag('r+'), 0x1a4);
            // Need to safely close FD, regardless of whether or not truncate succeeds.
            try {
                fd.truncateSync(len);
            }
            catch (e) {
                throw e;
            }
            finally {
                fd.closeSync();
            }
        }
        readFile(fname, encoding, flag, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, (err, fd) => {
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
                fd.stat((err, stat) => {
                    if (err) {
                        return cb(err);
                    }
                    // Allocate buffer.
                    const buf = Buffer.alloc(stat.size);
                    fd.read(buf, 0, stat.size, 0, (err) => {
                        if (err) {
                            return cb(err);
                        }
                        else if (encoding === null) {
                            return cb(err, buf);
                        }
                        try {
                            cb(null, buf.toString(encoding));
                        }
                        catch (e) {
                            cb(e);
                        }
                    });
                });
            });
        }
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const stat = fd.statSync();
                // Allocate buffer.
                const buf = Buffer.alloc(stat.size);
                fd.readSync(buf, 0, stat.size, 0);
                fd.closeSync();
                if (encoding === null) {
                    return buf;
                }
                return buf.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err) {
                    fd.close(function (err2) {
                        oldCb(err ? err : err2);
                    });
                };
                try {
                    if (typeof data === 'string') {
                        data = Buffer.from(data, encoding);
                    }
                }
                catch (e) {
                    return cb(e);
                }
                // Write into file.
                fd.write(data, 0, data.length, 0, cb);
            });
        }
        writeFileSync(fname, data, encoding, flag, mode) {
            // Get file.
            const fd = this.openSync(fname, flag, mode);
            try {
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                // Write into file.
                fd.writeSync(data, 0, data.length, 0);
            }
            finally {
                fd.closeSync();
            }
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            this.open(fname, flag, mode, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err) {
                    fd.close(function (err2) {
                        oldCb(err ? err : err2);
                    });
                };
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                fd.write(data, 0, data.length, null, cb);
            });
        }
        appendFileSync(fname, data, encoding, flag, mode) {
            const fd = this.openSync(fname, flag, mode);
            try {
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                fd.writeSync(data, 0, data.length, null);
            }
            finally {
                fd.closeSync();
            }
        }
        chmod(p, isLchmod, mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chmodSync(p, isLchmod, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        chown(p, isLchown, uid, gid, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chownSync(p, isLchown, uid, gid) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        utimes(p, atime, mtime, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        utimesSync(p, atime, mtime) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        link(srcpath, dstpath, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        linkSync(srcpath, dstpath) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        symlink(srcpath, dstpath, type, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        symlinkSync(srcpath, dstpath, type) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        readlink(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        readlinkSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
    }
    /**
     * Implements the asynchronous API in terms of the synchronous API.
     * @class SynchronousFileSystem
     */
    class SynchronousFileSystem extends BaseFileSystem {
        supportsSynch() {
            return true;
        }
        rename(oldPath, newPath, cb) {
            try {
                this.renameSync(oldPath, newPath);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        stat(p, isLstat, cb) {
            try {
                cb(null, this.statSync(p, isLstat));
            }
            catch (e) {
                cb(e);
            }
        }
        open(p, flags, mode, cb) {
            try {
                cb(null, this.openSync(p, flags, mode));
            }
            catch (e) {
                cb(e);
            }
        }
        unlink(p, cb) {
            try {
                this.unlinkSync(p);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        rmdir(p, cb) {
            try {
                this.rmdirSync(p);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        mkdir(p, mode, cb) {
            try {
                this.mkdirSync(p, mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        readdir(p, cb) {
            try {
                cb(null, this.readdirSync(p));
            }
            catch (e) {
                cb(e);
            }
        }
        chmod(p, isLchmod, mode, cb) {
            try {
                this.chmodSync(p, isLchmod, mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        chown(p, isLchown, uid, gid, cb) {
            try {
                this.chownSync(p, isLchown, uid, gid);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        utimes(p, atime, mtime, cb) {
            try {
                this.utimesSync(p, atime, mtime);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        link(srcpath, dstpath, cb) {
            try {
                this.linkSync(srcpath, dstpath);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        symlink(srcpath, dstpath, type, cb) {
            try {
                this.symlinkSync(srcpath, dstpath, type);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        readlink(p, cb) {
            try {
                cb(null, this.readlinkSync(p));
            }
            catch (e) {
                cb(e);
            }
        }
    }


    return {
        BaseFileSystem: BaseFileSystem,
        SynchronousFileSystem: SynchronousFileSystem
    };
});