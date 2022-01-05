define(['./api_error'], function (api_error) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    /**
     * Base class that contains shared implementations of functions for the file
     * object.
     */
    class BaseFile {
        sync(cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        syncSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        datasync(cb) {
            this.sync(cb);
        }
        datasyncSync() {
            return this.syncSync();
        }
        chown(uid, gid, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chownSync(uid, gid) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        chmod(mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chmodSync(mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        utimes(atime, mtime, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        utimesSync(atime, mtime) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
    }
    return { BaseFile: BaseFile };
});