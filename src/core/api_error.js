define([
  '../libs/buffers'
],function (buffers) {
    const { Buffer } = buffers;

    /**
     * Standard libc error codes. Add more to this enum and ErrorStrings as they are
     * needed.
     * @url http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
     */
    var ErrorCode;
    (function (ErrorCode) {
        ErrorCode[ErrorCode["EPERM"] = 1] = "EPERM";
        ErrorCode[ErrorCode["ENOENT"] = 2] = "ENOENT";
        ErrorCode[ErrorCode["EIO"] = 5] = "EIO";
        ErrorCode[ErrorCode["EBADF"] = 9] = "EBADF";
        ErrorCode[ErrorCode["EACCES"] = 13] = "EACCES";
        ErrorCode[ErrorCode["EBUSY"] = 16] = "EBUSY";
        ErrorCode[ErrorCode["EEXIST"] = 17] = "EEXIST";
        ErrorCode[ErrorCode["ENOTDIR"] = 20] = "ENOTDIR";
        ErrorCode[ErrorCode["EISDIR"] = 21] = "EISDIR";
        ErrorCode[ErrorCode["EINVAL"] = 22] = "EINVAL";
        ErrorCode[ErrorCode["EFBIG"] = 27] = "EFBIG";
        ErrorCode[ErrorCode["ENOSPC"] = 28] = "ENOSPC";
        ErrorCode[ErrorCode["EROFS"] = 30] = "EROFS";
        ErrorCode[ErrorCode["ENOTEMPTY"] = 39] = "ENOTEMPTY";
        ErrorCode[ErrorCode["ENOTSUP"] = 95] = "ENOTSUP";
    })(ErrorCode || (ErrorCode = {}));

    /* tslint:disable:variable-name */
    /**
     * Strings associated with each error code.
     * @hidden
     */
    const ErrorStrings = {};
    ErrorStrings[ErrorCode.EPERM] = 'Operation not permitted.';
    ErrorStrings[ErrorCode.ENOENT] = 'No such file or directory.';
    ErrorStrings[ErrorCode.EIO] = 'Input/output error.';
    ErrorStrings[ErrorCode.EBADF] = 'Bad file descriptor.';
    ErrorStrings[ErrorCode.EACCES] = 'Permission denied.';
    ErrorStrings[ErrorCode.EBUSY] = 'Resource busy or locked.';
    ErrorStrings[ErrorCode.EEXIST] = 'File exists.';
    ErrorStrings[ErrorCode.ENOTDIR] = 'File is not a directory.';
    ErrorStrings[ErrorCode.EISDIR] = 'File is a directory.';
    ErrorStrings[ErrorCode.EINVAL] = 'Invalid argument.';
    ErrorStrings[ErrorCode.EFBIG] = 'File is too big.';
    ErrorStrings[ErrorCode.ENOSPC] = 'No space left on disk.';
    ErrorStrings[ErrorCode.EROFS] = 'Cannot modify a read-only file system.';
    ErrorStrings[ErrorCode.ENOTEMPTY] = 'Directory is not empty.';
    ErrorStrings[ErrorCode.ENOTSUP] = 'Operation is not supported.';

    /* tslint:enable:variable-name */
    /**
     * Represents a BrowserFS error. Passed back to applications after a failed
     * call to the BrowserFS API.
     */
    class ApiError extends Error {
        /**
         * Represents a BrowserFS error. Passed back to applications after a failed
         * call to the BrowserFS API.
         *
         * Error codes mirror those returned by regular Unix file operations, which is
         * what Node returns.
         * @constructor ApiError
         * @param type The type of the error.
         * @param [message] A descriptive error message.
         */
        constructor(type, message = ErrorStrings[type], path) {
            super(message);
            // Unsupported.
            this.syscall = "";
            this.errno = type;
            this.code = ErrorCode[type];
            this.path = path;
            this.stack = new Error().stack;
            this.message = `Error: ${this.code}: ${message}${this.path ? `, '${this.path}'` : ''}`;
        }
        static fromJSON(json) {
            const err = new ApiError(0);
            err.errno = json.errno;
            err.code = json.code;
            err.path = json.path;
            err.stack = json.stack;
            err.message = json.message;
            return err;
        }
        /**
         * Creates an ApiError object from a buffer.
         */
        static fromBuffer(buffer, i = 0) {
            return ApiError.fromJSON(JSON.parse(buffer.toString('utf8', i + 4, i + 4 + buffer.readUInt32LE(i))));
        }
        static FileError(code, p) {
            return new ApiError(code, ErrorStrings[code], p);
        }
        static ENOENT(path) {
            return this.FileError(ErrorCode.ENOENT, path);
        }
        static EEXIST(path) {
            return this.FileError(ErrorCode.EEXIST, path);
        }
        static EISDIR(path) {
            return this.FileError(ErrorCode.EISDIR, path);
        }
        static ENOTDIR(path) {
            return this.FileError(ErrorCode.ENOTDIR, path);
        }
        static EPERM(path) {
            return this.FileError(ErrorCode.EPERM, path);
        }
        static ENOTEMPTY(path) {
            return this.FileError(ErrorCode.ENOTEMPTY, path);
        }
        /**
         * @return A friendly error message.
         */
        toString() {
            return this.message;
        }
        toJSON() {
            return {
                errno: this.errno,
                code: this.code,
                path: this.path,
                stack: this.stack,
                message: this.message
            };
        }
        /**
         * Writes the API error into a buffer.
         */
        writeToBuffer(buffer = Buffer.alloc(this.bufferSize()), i = 0) {
            const bytesWritten = buffer.write(JSON.stringify(this.toJSON()), i + 4);
            buffer.writeUInt32LE(bytesWritten, i);
            return buffer;
        }
        /**
         * The size of the API error in buffer-form in bytes.
         */
        bufferSize() {
            // 4 bytes for string length.
            return 4 + Buffer.byteLength(JSON.stringify(this.toJSON()));
        }
    }

    return {
        ApiError,
        ErrorCode,
        ErrorStrings
    };
});