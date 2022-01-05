define(['./mutex'], function (Mutex) {
    'use strict';
    /**
     * This class serializes access to an underlying async filesystem.
     * For example, on an OverlayFS instance with an async lower
     * directory operations like rename and rmdir may involve multiple
     * requests involving both the upper and lower filesystems -- they
     * are not executed in a single atomic step.  OverlayFS uses this
     * LockedFS to avoid having to reason about the correctness of
     * multiple requests interleaving.
     */
    class LockedFS {
        constructor(fs) {
            this._fs = fs;
            this._mu = new Mutex();
        }
        getName() {
            return 'LockedFS<' + this._fs.getName() + '>';
        }
        getFSUnlocked() {
            return this._fs;
        }
        diskSpace(p, cb) {
            // FIXME: should this lock?
            this._fs.diskSpace(p, cb);
        }
        isReadOnly() {
            return this._fs.isReadOnly();
        }
        supportsLinks() {
            return this._fs.supportsLinks();
        }
        supportsProps() {
            return this._fs.supportsProps();
        }
        supportsSynch() {
            return this._fs.supportsSynch();
        }
        rename(oldPath, newPath, cb) {
            this._mu.lock(() => {
                this._fs.rename(oldPath, newPath, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        renameSync(oldPath, newPath) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.renameSync(oldPath, newPath);
        }
        stat(p, isLstat, cb) {
            this._mu.lock(() => {
                this._fs.stat(p, isLstat, (err, stat) => {
                    this._mu.unlock();
                    cb(err, stat);
                });
            });
        }
        statSync(p, isLstat) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.statSync(p, isLstat);
        }
        open(p, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.open(p, flag, mode, (err, fd) => {
                    this._mu.unlock();
                    cb(err, fd);
                });
            });
        }
        openSync(p, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.openSync(p, flag, mode);
        }
        unlink(p, cb) {
            this._mu.lock(() => {
                this._fs.unlink(p, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        unlinkSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.unlinkSync(p);
        }
        rmdir(p, cb) {
            this._mu.lock(() => {
                this._fs.rmdir(p, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        rmdirSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.rmdirSync(p);
        }
        mkdir(p, mode, cb) {
            this._mu.lock(() => {
                this._fs.mkdir(p, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        mkdirSync(p, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.mkdirSync(p, mode);
        }
        readdir(p, cb) {
            this._mu.lock(() => {
                this._fs.readdir(p, (err, files) => {
                    this._mu.unlock();
                    cb(err, files);
                });
            });
        }
        readdirSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readdirSync(p);
        }
        exists(p, cb) {
            this._mu.lock(() => {
                this._fs.exists(p, (exists) => {
                    this._mu.unlock();
                    cb(exists);
                });
            });
        }
        existsSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.existsSync(p);
        }
        realpath(p, cache, cb) {
            this._mu.lock(() => {
                this._fs.realpath(p, cache, (err, resolvedPath) => {
                    this._mu.unlock();
                    cb(err, resolvedPath);
                });
            });
        }
        realpathSync(p, cache) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.realpathSync(p, cache);
        }
        truncate(p, len, cb) {
            this._mu.lock(() => {
                this._fs.truncate(p, len, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        truncateSync(p, len) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.truncateSync(p, len);
        }
        readFile(fname, encoding, flag, cb) {
            this._mu.lock(() => {
                this._fs.readFile(fname, encoding, flag, (err, data) => {
                    this._mu.unlock();
                    cb(err, data);
                });
            });
        }
        readFileSync(fname, encoding, flag) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readFileSync(fname, encoding, flag);
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.writeFile(fname, data, encoding, flag, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        writeFileSync(fname, data, encoding, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.writeFileSync(fname, data, encoding, flag, mode);
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.appendFile(fname, data, encoding, flag, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        appendFileSync(fname, data, encoding, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.appendFileSync(fname, data, encoding, flag, mode);
        }
        chmod(p, isLchmod, mode, cb) {
            this._mu.lock(() => {
                this._fs.chmod(p, isLchmod, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        chmodSync(p, isLchmod, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.chmodSync(p, isLchmod, mode);
        }
        chown(p, isLchown, uid, gid, cb) {
            this._mu.lock(() => {
                this._fs.chown(p, isLchown, uid, gid, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        chownSync(p, isLchown, uid, gid) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.chownSync(p, isLchown, uid, gid);
        }
        utimes(p, atime, mtime, cb) {
            this._mu.lock(() => {
                this._fs.utimes(p, atime, mtime, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        utimesSync(p, atime, mtime) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.utimesSync(p, atime, mtime);
        }
        link(srcpath, dstpath, cb) {
            this._mu.lock(() => {
                this._fs.link(srcpath, dstpath, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        linkSync(srcpath, dstpath) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.linkSync(srcpath, dstpath);
        }
        symlink(srcpath, dstpath, type, cb) {
            this._mu.lock(() => {
                this._fs.symlink(srcpath, dstpath, type, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        symlinkSync(srcpath, dstpath, type) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.symlinkSync(srcpath, dstpath, type);
        }
        readlink(p, cb) {
            this._mu.lock(() => {
                this._fs.readlink(p, (err, linkString) => {
                    this._mu.unlock();
                    cb(err, linkString);
                });
            });
        }
        readlinkSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readlinkSync(p);
        }
    }

    return LockedFS;
});