define([
    '../libs/buffers',
    './api_error',
    './file_flag',
    '../libs/path',
    './node_fs_stats',
    '../generic/setImmediate'
], function (buffers,api_error, file_flag, path, node_fs_stats, setImmediate) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { FileFlag } = file_flag;
    const {Stats} = node_fs_stats;
    const { Buffer } = buffers;

    /** Used for unit testing. Defaults to a NOP. */
    let wrapCbHook = function (cb, numArgs) {
        return cb;
    };
    /**
     * Wraps a callback function, ensuring it is invoked through setImmediate.
     * @hidden
     */
    function wrapCb(cb, numArgs) {
        if (typeof cb !== 'function') {
            throw new Error('Callback must be a function.');
        }
        const hookedCb = wrapCbHook(cb, numArgs);
        // We could use `arguments`, but Function.call/apply is expensive. And we only
        // need to handle 1-3 arguments
        switch (numArgs) {
            case 1:
                return function (arg1) {
                    setImmediate(function () {
                        return hookedCb(arg1);
                    });
                };
            case 2:
                return function (arg1, arg2) {
                    setImmediate(function () {
                        return hookedCb(arg1, arg2);
                    });
                };
            case 3:
                return function (arg1, arg2, arg3) {
                    setImmediate(function () {
                        return hookedCb(arg1, arg2, arg3);
                    });
                };
            default:
                throw new Error('Invalid invocation of wrapCb.');
        }
    }
    /**
     * @hidden
     */
    function assertRoot(fs) {
        if (fs) {
            return fs;
        }
        throw new ApiError(ErrorCode.EIO, `Initialize BrowserFS with a file system using BrowserFS.initialize(filesystem)`);
    }
    /**
     * @hidden
     */
    function normalizeMode(mode, def) {
        switch (typeof mode) {
            case 'number':
                // (path, flag, mode, cb?)
                return mode;
            case 'string':
                // (path, flag, modeString, cb?)
                const trueMode = parseInt(mode, 8);
                if (!isNaN(trueMode)) {
                    return trueMode;
                }
                // Invalid string.
                return def;
            default:
                return def;
        }
    }
    /**
     * @hidden
     */
    function normalizeTime(time) {
        if (time instanceof Date) {
            return time;
        }
        else if (typeof time === 'number') {
            return new Date(time * 1000);
        }
        else {
            throw new ApiError(ErrorCode.EINVAL, `Invalid time.`);
        }
    }
    /**
     * @hidden
     */
    function normalizePath(p) {
        // Node doesn't allow null characters in paths.
        if (p.indexOf('\u0000') >= 0) {
            throw new ApiError(ErrorCode.EINVAL, 'Path must be a string without null bytes.');
        }
        else if (p === '') {
            throw new ApiError(ErrorCode.EINVAL, 'Path must not be empty.');
        }
        return path.resolve(p);
    }
    /**
     * @hidden
     */
    function normalizeOptions(options, defEnc, defFlag, defMode) {
        // typeof null === 'object' so special-case handing is needed.
        switch (options === null ? 'null' : typeof options) {
            case 'object':
                return {
                    encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
                    flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
                    mode: normalizeMode(options['mode'], defMode)
                };
            case 'string':
                return {
                    encoding: options,
                    flag: defFlag,
                    mode: defMode
                };
            case 'null':
            case 'undefined':
            case 'function':
                return {
                    encoding: defEnc,
                    flag: defFlag,
                    mode: defMode
                };
            default:
                throw new TypeError(`"options" must be a string or an object, got ${typeof options} instead.`);
        }
    }
    /**
     * The default callback is a NOP.
     * @hidden
     * @private
     */
    function nopCb() {
        // NOP.
    }
    /**
     * The node frontend to all filesystems.
     * This layer handles:
     *
     * * Sanity checking inputs.
     * * Normalizing paths.
     * * Resetting stack depth for asynchronous operations which may not go through
     *   the browser by wrapping all input callbacks using `setImmediate`.
     * * Performing the requested operation through the filesystem or the file
     *   descriptor, as appropriate.
     * * Handling optional arguments and setting default arguments.
     * @see http://nodejs.org/api/fs.html
     */
    class FS {
        constructor() {
            /* tslint:enable:variable-name */
            this.F_OK = 0;
            this.R_OK = 4;
            this.W_OK = 2;
            this.X_OK = 1;
            this.root = null;
            this.fdMap = {};
            this.nextFd = 100;
        }
        initialize(rootFS) {
            if (!rootFS.constructor.isAvailable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
            }
            return this.root = rootFS;
        }
        /**
         * converts Date or number to a fractional UNIX timestamp
         * Grabbed from NodeJS sources (lib/fs.js)
         */
        _toUnixTimestamp(time) {
            if (typeof time === 'number') {
                return time;
            }
            else if (time instanceof Date) {
                return time.getTime() / 1000;
            }
            throw new Error("Cannot parse time: " + time);
        }
        /**
         * **NONSTANDARD**: Grab the FileSystem instance that backs this API.
         * @return [BrowserFS.FileSystem | null] Returns null if the file system has
         *   not been initialized.
         */
        getRootFS() {
            if (this.root) {
                return this.root;
            }
            else {
                return null;
            }
        }
        // FILE OR DIRECTORY METHODS
        /**
         * Asynchronous rename. No arguments other than a possible exception are given
         * to the completion callback.
         * @param oldPath
         * @param newPath
         * @param callback
         */
        rename(oldPath, newPath, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                assertRoot(this.root).rename(normalizePath(oldPath), normalizePath(newPath), newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous rename.
         * @param oldPath
         * @param newPath
         */
        renameSync(oldPath, newPath) {
            assertRoot(this.root).renameSync(normalizePath(oldPath), normalizePath(newPath));
        }
        /**
         * Test whether or not the given path exists by checking with the file system.
         * Then call the callback argument with either true or false.
         * @example Sample invocation
         *   fs.exists('/etc/passwd', function (exists) {
         *     util.debug(exists ? "it's there" : "no passwd!");
         *   });
         * @param path
         * @param callback
         */
        exists(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                return assertRoot(this.root).exists(normalizePath(path), newCb);
            }
            catch (e) {
                // Doesn't return an error. If something bad happens, we assume it just
                // doesn't exist.
                return newCb(false);
            }
        }
        /**
         * Test whether or not the given path exists by checking with the file system.
         * @param path
         * @return [boolean]
         */
        existsSync(path) {
            try {
                return assertRoot(this.root).existsSync(normalizePath(path));
            }
            catch (e) {
                // Doesn't return an error. If something bad happens, we assume it just
                // doesn't exist.
                return false;
            }
        }
        /**
         * Asynchronous `stat`.
         * @param path
         * @param callback
         */
        stat(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                return assertRoot(this.root).stat(normalizePath(path), false, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `stat`.
         * @param path
         * @return [BrowserFS.node.fs.Stats]
         */
        statSync(path) {
            return assertRoot(this.root).statSync(normalizePath(path), false);
        }
        /**
         * Asynchronous `lstat`.
         * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
         * then the link itself is stat-ed, not the file that it refers to.
         * @param path
         * @param callback
         */
        lstat(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                return assertRoot(this.root).stat(normalizePath(path), true, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `lstat`.
         * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
         * then the link itself is stat-ed, not the file that it refers to.
         * @param path
         * @return [BrowserFS.node.fs.Stats]
         */
        lstatSync(path) {
            return assertRoot(this.root).statSync(normalizePath(path), true);
        }
        truncate(path, arg2 = 0, cb = nopCb) {
            let len = 0;
            if (typeof arg2 === 'function') {
                cb = arg2;
            }
            else if (typeof arg2 === 'number') {
                len = arg2;
            }
            const newCb = wrapCb(cb, 1);
            try {
                if (len < 0) {
                    throw new ApiError(ErrorCode.EINVAL);
                }
                return assertRoot(this.root).truncate(normalizePath(path), len, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `truncate`.
         * @param path
         * @param len
         */
        truncateSync(path, len = 0) {
            if (len < 0) {
                throw new ApiError(ErrorCode.EINVAL);
            }
            return assertRoot(this.root).truncateSync(normalizePath(path), len);
        }
        /**
         * Asynchronous `unlink`.
         * @param path
         * @param callback
         */
        unlink(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                return assertRoot(this.root).unlink(normalizePath(path), newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `unlink`.
         * @param path
         */
        unlinkSync(path) {
            return assertRoot(this.root).unlinkSync(normalizePath(path));
        }
        open(path, flag, arg2, cb = nopCb) {
            const mode = normalizeMode(arg2, 0x1a4);
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 2);
            try {
                assertRoot(this.root).open(normalizePath(path), FileFlag.getFileFlag(flag), mode, (e, file) => {
                    if (file) {
                        newCb(e, this.getFdForFile(file));
                    }
                    else {
                        newCb(e);
                    }
                });
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous file open.
         * @see http://www.manpagez.com/man/2/open/
         * @param path
         * @param flags
         * @param mode defaults to `0644`
         * @return [BrowserFS.File]
         */
        openSync(path, flag, mode = 0x1a4) {
            return this.getFdForFile(assertRoot(this.root).openSync(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4)));
        }
        readFile(filename, arg2 = {}, cb = nopCb) {
            const options = normalizeOptions(arg2, null, 'r', null);
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 2);
            try {
                const flag = FileFlag.getFileFlag(options['flag']);
                if (!flag.isReadable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
                }
                return assertRoot(this.root).readFile(normalizePath(filename), options.encoding, flag, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        readFileSync(filename, arg2 = {}) {
            const options = normalizeOptions(arg2, null, 'r', null);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isReadable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
            }
            return assertRoot(this.root).readFileSync(normalizePath(filename), options.encoding, flag);
        }
        writeFile(filename, data, arg3 = {}, cb = nopCb) {
            const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const flag = FileFlag.getFileFlag(options.flag);
                if (!flag.isWriteable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
                }
                return assertRoot(this.root).writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        writeFileSync(filename, data, arg3) {
            const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isWriteable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
            }
            return assertRoot(this.root).writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
        }
        appendFile(filename, data, arg3, cb = nopCb) {
            const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const flag = FileFlag.getFileFlag(options.flag);
                if (!flag.isAppendable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
                }
                assertRoot(this.root).appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        appendFileSync(filename, data, arg3) {
            const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isAppendable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
            }
            return assertRoot(this.root).appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
        }
        // FILE DESCRIPTOR METHODS
        /**
         * Asynchronous `fstat`.
         * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
         * specified by the file descriptor `fd`.
         * @param fd
         * @param callback
         */
        fstat(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                const file = this.fd2file(fd);
                file.stat(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fstat`.
         * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
         * specified by the file descriptor `fd`.
         * @param fd
         * @return [BrowserFS.node.fs.Stats]
         */
        fstatSync(fd) {
            return this.fd2file(fd).statSync();
        }
        /**
         * Asynchronous close.
         * @param fd
         * @param callback
         */
        close(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).close((e) => {
                    if (!e) {
                        this.closeFd(fd);
                    }
                    newCb(e);
                });
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous close.
         * @param fd
         */
        closeSync(fd) {
            this.fd2file(fd).closeSync();
            this.closeFd(fd);
        }
        ftruncate(fd, arg2, cb = nopCb) {
            const length = typeof arg2 === 'number' ? arg2 : 0;
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const file = this.fd2file(fd);
                if (length < 0) {
                    throw new ApiError(ErrorCode.EINVAL);
                }
                file.truncate(length, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous ftruncate.
         * @param fd
         * @param len
         */
        ftruncateSync(fd, len = 0) {
            const file = this.fd2file(fd);
            if (len < 0) {
                throw new ApiError(ErrorCode.EINVAL);
            }
            file.truncateSync(len);
        }
        /**
         * Asynchronous fsync.
         * @param fd
         * @param callback
         */
        fsync(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).sync(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous fsync.
         * @param fd
         */
        fsyncSync(fd) {
            this.fd2file(fd).syncSync();
        }
        /**
         * Asynchronous fdatasync.
         * @param fd
         * @param callback
         */
        fdatasync(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).datasync(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous fdatasync.
         * @param fd
         */
        fdatasyncSync(fd) {
            this.fd2file(fd).datasyncSync();
        }
        write(fd, arg2, arg3, arg4, arg5, cb = nopCb) {
            let buffer, offset, length, position = null;
            if (typeof arg2 === 'string') {
                // Signature 1: (fd, string, [position?, [encoding?]], cb?)
                let encoding = 'utf8';
                switch (typeof arg3) {
                    case 'function':
                        // (fd, string, cb)
                        cb = arg3;
                        break;
                    case 'number':
                        // (fd, string, position, encoding?, cb?)
                        position = arg3;
                        encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                        cb = typeof arg5 === 'function' ? arg5 : cb;
                        break;
                    default:
                        // ...try to find the callback and get out of here!
                        cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
                        return cb(new ApiError(ErrorCode.EINVAL, 'Invalid arguments.'));
                }
                buffer = Buffer.from(arg2, encoding);
                offset = 0;
                length = buffer.length;
            }
            else {
                // Signature 2: (fd, buffer, offset, length, position?, cb?)
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = typeof arg5 === 'number' ? arg5 : null;
                cb = typeof arg5 === 'function' ? arg5 : cb;
            }
            const newCb = wrapCb(cb, 3);
            try {
                const file = this.fd2file(fd);
                if (position === undefined || position === null) {
                    position = file.getPos();
                }
                file.write(buffer, offset, length, position, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        writeSync(fd, arg2, arg3, arg4, arg5) {
            let buffer, offset = 0, length, position;
            if (typeof arg2 === 'string') {
                // Signature 1: (fd, string, [position?, [encoding?]])
                position = typeof arg3 === 'number' ? arg3 : null;
                const encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                offset = 0;
                buffer = Buffer.from(arg2, encoding);
                length = buffer.length;
            }
            else {
                // Signature 2: (fd, buffer, offset, length, position?)
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = typeof arg5 === 'number' ? arg5 : null;
            }
            const file = this.fd2file(fd);
            if (position === undefined || position === null) {
                position = file.getPos();
            }
            return file.writeSync(buffer, offset, length, position);
        }
        read(fd, arg2, arg3, arg4, arg5, cb = nopCb) {
            let position, offset, length, buffer, newCb;
            if (typeof arg2 === 'number') {
                // legacy interface
                // (fd, length, position, encoding, callback)
                length = arg2;
                position = arg3;
                const encoding = arg4;
                cb = typeof arg5 === 'function' ? arg5 : cb;
                offset = 0;
                buffer = Buffer.alloc(length);
                // XXX: Inefficient.
                // Wrap the cb so we shelter upper layers of the API from these
                // shenanigans.
                newCb = wrapCb((err, bytesRead, buf) => {
                    if (err) {
                        return cb(err);
                    }
                    cb(err, buf.toString(encoding), bytesRead);
                }, 3);
            }
            else {
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = arg5;
                newCb = wrapCb(cb, 3);
            }
            try {
                const file = this.fd2file(fd);
                if (position === undefined || position === null) {
                    position = file.getPos();
                }
                file.read(buffer, offset, length, position, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        readSync(fd, arg2, arg3, arg4, arg5) {
            let shenanigans = false;
            let buffer, offset, length, position, encoding = 'utf8';
            if (typeof arg2 === 'number') {
                length = arg2;
                position = arg3;
                encoding = arg4;
                offset = 0;
                buffer = Buffer.alloc(length);
                shenanigans = true;
            }
            else {
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = arg5;
            }
            const file = this.fd2file(fd);
            if (position === undefined || position === null) {
                position = file.getPos();
            }
            const rv = file.readSync(buffer, offset, length, position);
            if (!shenanigans) {
                return rv;
            }
            else {
                return [buffer.toString(encoding), rv];
            }
        }
        /**
         * Asynchronous `fchown`.
         * @param fd
         * @param uid
         * @param gid
         * @param callback
         */
        fchown(fd, uid, gid, callback = nopCb) {
            const newCb = wrapCb(callback, 1);
            try {
                this.fd2file(fd).chown(uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fchown`.
         * @param fd
         * @param uid
         * @param gid
         */
        fchownSync(fd, uid, gid) {
            this.fd2file(fd).chownSync(uid, gid);
        }
        /**
         * Asynchronous `fchmod`.
         * @param fd
         * @param mode
         * @param callback
         */
        fchmod(fd, mode, cb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
                this.fd2file(fd).chmod(numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fchmod`.
         * @param fd
         * @param mode
         */
        fchmodSync(fd, mode) {
            const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            this.fd2file(fd).chmodSync(numMode);
        }
        /**
         * Change the file timestamps of a file referenced by the supplied file
         * descriptor.
         * @param fd
         * @param atime
         * @param mtime
         * @param callback
         */
        futimes(fd, atime, mtime, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const file = this.fd2file(fd);
                if (typeof atime === 'number') {
                    atime = new Date(atime * 1000);
                }
                if (typeof mtime === 'number') {
                    mtime = new Date(mtime * 1000);
                }
                file.utimes(atime, mtime, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Change the file timestamps of a file referenced by the supplied file
         * descriptor.
         * @param fd
         * @param atime
         * @param mtime
         */
        futimesSync(fd, atime, mtime) {
            this.fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
        }
        // DIRECTORY-ONLY METHODS
        /**
         * Asynchronous `rmdir`.
         * @param path
         * @param callback
         */
        rmdir(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).rmdir(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `rmdir`.
         * @param path
         */
        rmdirSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).rmdirSync(path);
        }
        /**
         * Asynchronous `mkdir`.
         * @param path
         * @param mode defaults to `0777`
         * @param callback
         */
        mkdir(path, mode, cb = nopCb) {
            if (typeof mode === 'function') {
                cb = mode;
                mode = 0x1ff;
            }
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).mkdir(path, mode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `mkdir`.
         * @param path
         * @param mode defaults to `0777`
         */
        mkdirSync(path, mode) {
            assertRoot(this.root).mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff));
        }
        /**
         * Asynchronous `readdir`. Reads the contents of a directory.
         * The callback gets two arguments `(err, files)` where `files` is an array of
         * the names of the files in the directory excluding `'.'` and `'..'`.
         * @param path
         * @param callback
         */
        readdir(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).readdir(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `readdir`. Reads the contents of a directory.
         * @param path
         * @return [String[]]
         */
        readdirSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).readdirSync(path);
        }
        // SYMLINK METHODS
        /**
         * Asynchronous `link`.
         * @param srcpath
         * @param dstpath
         * @param callback
         */
        link(srcpath, dstpath, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                srcpath = normalizePath(srcpath);
                dstpath = normalizePath(dstpath);
                assertRoot(this.root).link(srcpath, dstpath, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `link`.
         * @param srcpath
         * @param dstpath
         */
        linkSync(srcpath, dstpath) {
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            return assertRoot(this.root).linkSync(srcpath, dstpath);
        }
        symlink(srcpath, dstpath, arg3, cb = nopCb) {
            const type = typeof arg3 === 'string' ? arg3 : 'file';
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                if (type !== 'file' && type !== 'dir') {
                    return newCb(new ApiError(ErrorCode.EINVAL, "Invalid type: " + type));
                }
                srcpath = normalizePath(srcpath);
                dstpath = normalizePath(dstpath);
                assertRoot(this.root).symlink(srcpath, dstpath, type, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `symlink`.
         * @param srcpath
         * @param dstpath
         * @param type can be either `'dir'` or `'file'` (default is `'file'`)
         */
        symlinkSync(srcpath, dstpath, type) {
            if (!type) {
                type = 'file';
            }
            else if (type !== 'file' && type !== 'dir') {
                throw new ApiError(ErrorCode.EINVAL, "Invalid type: " + type);
            }
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            return assertRoot(this.root).symlinkSync(srcpath, dstpath, type);
        }
        /**
         * Asynchronous readlink.
         * @param path
         * @param callback
         */
        readlink(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).readlink(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous readlink.
         * @param path
         * @return [String]
         */
        readlinkSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).readlinkSync(path);
        }
        // PROPERTY OPERATIONS
        /**
         * Asynchronous `chown`.
         * @param path
         * @param uid
         * @param gid
         * @param callback
         */
        chown(path, uid, gid, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).chown(path, false, uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `chown`.
         * @param path
         * @param uid
         * @param gid
         */
        chownSync(path, uid, gid) {
            path = normalizePath(path);
            assertRoot(this.root).chownSync(path, false, uid, gid);
        }
        /**
         * Asynchronous `lchown`.
         * @param path
         * @param uid
         * @param gid
         * @param callback
         */
        lchown(path, uid, gid, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).chown(path, true, uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `lchown`.
         * @param path
         * @param uid
         * @param gid
         */
        lchownSync(path, uid, gid) {
            path = normalizePath(path);
            assertRoot(this.root).chownSync(path, true, uid, gid);
        }
        /**
         * Asynchronous `chmod`.
         * @param path
         * @param mode
         * @param callback
         */
        chmod(path, mode, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = normalizeMode(mode, -1);
                if (numMode < 0) {
                    throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
                }
                assertRoot(this.root).chmod(normalizePath(path), false, numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `chmod`.
         * @param path
         * @param mode
         */
        chmodSync(path, mode) {
            const numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
            }
            path = normalizePath(path);
            assertRoot(this.root).chmodSync(path, false, numMode);
        }
        /**
         * Asynchronous `lchmod`.
         * @param path
         * @param mode
         * @param callback
         */
        lchmod(path, mode, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = normalizeMode(mode, -1);
                if (numMode < 0) {
                    throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
                }
                assertRoot(this.root).chmod(normalizePath(path), true, numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `lchmod`.
         * @param path
         * @param mode
         */
        lchmodSync(path, mode) {
            const numMode = normalizeMode(mode, -1);
            if (numMode < 1) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
            }
            assertRoot(this.root).chmodSync(normalizePath(path), true, numMode);
        }
        /**
         * Change file timestamps of the file referenced by the supplied path.
         * @param path
         * @param atime
         * @param mtime
         * @param callback
         */
        utimes(path, atime, mtime, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                assertRoot(this.root).utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Change file timestamps of the file referenced by the supplied path.
         * @param path
         * @param atime
         * @param mtime
         */
        utimesSync(path, atime, mtime) {
            assertRoot(this.root).utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime));
        }
        realpath(path, arg2, cb = nopCb) {
            const cache = typeof (arg2) === 'object' ? arg2 : {};
            cb = typeof (arg2) === 'function' ? arg2 : nopCb;
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).realpath(path, cache, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `realpath`.
         * @param path
         * @param cache An object literal of mapped paths that can be used to
         *   force a specific path resolution or avoid additional `fs.stat` calls for
         *   known real paths.
         * @return [String]
         */
        realpathSync(path, cache = {}) {
            path = normalizePath(path);
            return assertRoot(this.root).realpathSync(path, cache);
        }
        watchFile(filename, arg2, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        unwatchFile(filename, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        watch(filename, arg2, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        access(path, arg2, cb = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        accessSync(path, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        createReadStream(path, options) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        createWriteStream(path, options) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * For unit testing. Passes all incoming callbacks to cbWrapper for wrapping.
         */
        wrapCallbacks(cbWrapper) {
            wrapCbHook = cbWrapper;
        }
        getFdForFile(file) {
            const fd = this.nextFd++;
            this.fdMap[fd] = file;
            return fd;
        }
        fd2file(fd) {
            const rv = this.fdMap[fd];
            if (rv) {
                return rv;
            }
            else {
                throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
            }
        }
        closeFd(fd) {
            delete this.fdMap[fd];
        }
    }
    /* tslint:disable:variable-name */
    // Exported fs.Stats.
    FS.Stats = Stats;
    //# sourceMappingURL=FS.js.map

    return FS;
});