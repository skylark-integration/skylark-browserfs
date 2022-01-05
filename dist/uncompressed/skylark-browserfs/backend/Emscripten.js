define([
    '../core/file_system',
    '../core/node_fs_stats',
    '../core/file',
    '../core/util',
    '../core/api_error'
], function (file_system, node_fs_stats, file, util, api_error) {
    'use strict';

    const { SynchronousFileSystem } = file_system;
    const { Stats, FileType } = node_fs_stats;
    const { BaseFile } = file;
    const { uint8Array2Buffer, buffer2Uint8array } = util;
    const { ApiError, ErrorCode, ErrorStrings } = api_error;

    /**
     * @hidden
     */
    function convertError(e, path = '') {
        const errno = e.errno;
        let parent = e.node;
        const paths = [];
        while (parent) {
            paths.unshift(parent.name);
            if (parent === parent.parent) {
                break;
            }
            parent = parent.parent;
        }
        return new ApiError(errno, ErrorStrings[errno], paths.length > 0 ? '/' + paths.join('/') : path);
    }
    class EmscriptenFile extends BaseFile {
        constructor(_fs, _FS, _path, _stream) {
            super();
            this._fs = _fs;
            this._FS = _FS;
            this._path = _path;
            this._stream = _stream;
        }
        getPos() {
            return undefined;
        }
        close(cb) {
            let err = null;
            try {
                this.closeSync();
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        closeSync() {
            try {
                this._FS.close(this._stream);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        stat(cb) {
            try {
                cb(null, this.statSync());
            }
            catch (e) {
                cb(e);
            }
        }
        statSync() {
            try {
                return this._fs.statSync(this._path, false);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        truncate(len, cb) {
            let err = null;
            try {
                this.truncateSync(len);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        truncateSync(len) {
            try {
                this._FS.ftruncate(this._stream.fd, len);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        write(buffer, offset, length, position, cb) {
            try {
                cb(null, this.writeSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        writeSync(buffer, offset, length, position) {
            try {
                const u8 = buffer2Uint8array(buffer);
                // Emscripten is particular about what position is set to.
                const emPosition = position === null ? undefined : position;
                return this._FS.write(this._stream, u8, offset, length, emPosition);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        read(buffer, offset, length, position, cb) {
            try {
                cb(null, this.readSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        readSync(buffer, offset, length, position) {
            try {
                const u8 = buffer2Uint8array(buffer);
                // Emscripten is particular about what position is set to.
                const emPosition = position === null ? undefined : position;
                return this._FS.read(this._stream, u8, offset, length, emPosition);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        sync(cb) {
            // NOP.
            cb();
        }
        syncSync() {
            // NOP.
        }
        chown(uid, gid, cb) {
            let err = null;
            try {
                this.chownSync(uid, gid);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        chownSync(uid, gid) {
            try {
                this._FS.fchown(this._stream.fd, uid, gid);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        chmod(mode, cb) {
            let err = null;
            try {
                this.chmodSync(mode);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        chmodSync(mode) {
            try {
                this._FS.fchmod(this._stream.fd, mode);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        utimes(atime, mtime, cb) {
            let err = null;
            try {
                this.utimesSync(atime, mtime);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        utimesSync(atime, mtime) {
            this._fs.utimesSync(this._path, atime, mtime);
        }
    }
    /**
     * Mounts an Emscripten file system into the BrowserFS file system.
     */
    class EmscriptenFileSystem extends SynchronousFileSystem {
        constructor(_FS) {
            super();
            this._FS = _FS;
        }
        /**
         * Create an EmscriptenFileSystem instance with the given options.
         */
        static Create(opts, cb) {
            cb(null, new EmscriptenFileSystem(opts.FS));
        }
        static isAvailable() { return true; }
        getName() { return this._FS.DB_NAME(); }
        isReadOnly() { return false; }
        supportsLinks() { return true; }
        supportsProps() { return true; }
        supportsSynch() { return true; }
        renameSync(oldPath, newPath) {
            try {
                this._FS.rename(oldPath, newPath);
            }
            catch (e) {
                if (e.errno === ErrorCode.ENOENT) {
                    throw convertError(e, this.existsSync(oldPath) ? newPath : oldPath);
                }
                else {
                    throw convertError(e);
                }
            }
        }
        statSync(p, isLstat) {
            try {
                const stats = isLstat ? this._FS.lstat(p) : this._FS.stat(p);
                const itemType = this.modeToFileType(stats.mode);
                return new Stats(itemType, stats.size, stats.mode, stats.atime.getTime(), stats.mtime.getTime(), stats.ctime.getTime());
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        openSync(p, flag, mode) {
            try {
                const stream = this._FS.open(p, flag.getFlagString(), mode);
                if (this._FS.isDir(stream.node.mode)) {
                    this._FS.close(stream);
                    throw ApiError.EISDIR(p);
                }
                return new EmscriptenFile(this, this._FS, p, stream);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        unlinkSync(p) {
            try {
                this._FS.unlink(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        rmdirSync(p) {
            try {
                this._FS.rmdir(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        mkdirSync(p, mode) {
            try {
                this._FS.mkdir(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        readdirSync(p) {
            try {
                // Emscripten returns items for '.' and '..'. Node does not.
                return this._FS.readdir(p).filter((p) => p !== '.' && p !== '..');
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        truncateSync(p, len) {
            try {
                this._FS.truncate(p, len);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        readFileSync(p, encoding, flag) {
            try {
                const data = this._FS.readFile(p, { flags: flag.getFlagString() });
                const buff = uint8Array2Buffer(data);
                if (encoding) {
                    return buff.toString(encoding);
                }
                else {
                    return buff;
                }
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        writeFileSync(p, data, encoding, flag, mode) {
            try {
                if (encoding) {
                    data = Buffer.from(data, encoding);
                }
                const u8 = buffer2Uint8array(data);
                this._FS.writeFile(p, u8, { flags: flag.getFlagString(), encoding: 'binary' });
                this._FS.chmod(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        chmodSync(p, isLchmod, mode) {
            try {
                isLchmod ? this._FS.lchmod(p, mode) : this._FS.chmod(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        chownSync(p, isLchown, uid, gid) {
            try {
                isLchown ? this._FS.lchown(p, uid, gid) : this._FS.chown(p, uid, gid);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        symlinkSync(srcpath, dstpath, type) {
            try {
                this._FS.symlink(srcpath, dstpath);
            }
            catch (e) {
                throw convertError(e);
            }
        }
        readlinkSync(p) {
            try {
                return this._FS.readlink(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        utimesSync(p, atime, mtime) {
            try {
                this._FS.utime(p, atime.getTime(), mtime.getTime());
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        modeToFileType(mode) {
            if (this._FS.isDir(mode)) {
                return FileType.DIRECTORY;
            }
            else if (this._FS.isFile(mode)) {
                return FileType.FILE;
            }
            else if (this._FS.isLink(mode)) {
                return FileType.SYMLINK;
            }
            else {
                throw ApiError.EPERM(`Invalid mode: ${mode}`);
            }
        }
    }
    EmscriptenFileSystem.Name = "EmscriptenFileSystem";
    EmscriptenFileSystem.Options = {
        FS: {
            type: "object",
            description: "The Emscripten file system to use (the `FS` variable)"
        }
    };

    EmscriptenFileSystem.EmscriptenFile = EmscriptenFile;

    return EmscriptenFileSystem;
});