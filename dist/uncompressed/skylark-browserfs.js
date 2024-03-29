/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
(function(factory,globals) {
  var define = globals.define,
      require = globals.require,
      isAmd = (typeof define === 'function' && define.amd),
      isCmd = (!isAmd && typeof exports !== 'undefined');

  if (!isAmd && !define) {
    var map = {};
    function absolute(relative, base) {
        if (relative[0]!==".") {
          return relative;
        }
        var stack = base.split("/"),
            parts = relative.split("/");
        stack.pop(); 
        for (var i=0; i<parts.length; i++) {
            if (parts[i] == ".")
                continue;
            if (parts[i] == "..")
                stack.pop();
            else
                stack.push(parts[i]);
        }
        return stack.join("/");
    }
    define = globals.define = function(id, deps, factory) {
        if (typeof factory == 'function') {
            map[id] = {
                factory: factory,
                deps: deps.map(function(dep){
                  return absolute(dep,id);
                }),
                resolved: false,
                exports: null
            };
            require(id);
        } else {
            map[id] = {
                factory : null,
                resolved : true,
                exports : factory
            };
        }
    };
    require = globals.require = function(id) {
        if (!map.hasOwnProperty(id)) {
            throw new Error('Module ' + id + ' has not been defined');
        }
        var module = map[id];
        if (!module.resolved) {
            var args = [];

            module.deps.forEach(function(dep){
                args.push(require(dep));
            })

            module.exports = module.factory.apply(globals, args) || null;
            module.resolved = true;
        }
        return module.exports;
    };
  }
  
  if (!define) {
     throw new Error("The module utility (ex: requirejs or skylark-utils) is not loaded!");
  }

  factory(define,require);

  if (!isAmd) {
    var skylarkjs = require("skylark-langx-ns");

    if (isCmd) {
      module.exports = skylarkjs;
    } else {
      globals.skylarkjs  = skylarkjs;
    }
  }

})(function(define,require) {

define('skylark-browserfs/libs/process',[
    "skylark-langx-executive/process"
],function(process){
  'use strict'
    return process;
});
define('skylark-browserfs/libs/buffers',[
  "skylark-langx-binary/buffer"
],function(Buffer){
  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */

  'use strict'

  return {
    Buffer
  }

});
define('skylark-browserfs/core/api_error',[
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
define('skylark-browserfs/core/file_flag',['./api_error'], function (api_error) {
    'use strict';

  const { ErrorCode, ApiError } = api_error;

  var ActionType;
  (function (ActionType) {
      // Indicates that the code should not do anything.
      ActionType[ActionType["NOP"] = 0] = "NOP";
      // Indicates that the code should throw an exception.
      ActionType[ActionType["THROW_EXCEPTION"] = 1] = "THROW_EXCEPTION";
      // Indicates that the code should truncate the file, but only if it is a file.
      ActionType[ActionType["TRUNCATE_FILE"] = 2] = "TRUNCATE_FILE";
      // Indicates that the code should create the file.
      ActionType[ActionType["CREATE_FILE"] = 3] = "CREATE_FILE";
  })(ActionType || (ActionType = {}));
  /**
   * Represents one of the following file flags. A convenience object.
   *
   * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
   * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
   * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
   * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
   * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx'` - Like 'w' but opens the file in exclusive mode.
   * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
   * * `'a'` - Open file for appending. The file is created if it does not exist.
   * * `'ax'` - Like 'a' but opens the file in exclusive mode.
   * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
   * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
   *
   * Exclusive mode ensures that the file path is newly created.
   */
  class FileFlag {
      /**
       * This should never be called directly.
       * @param modeStr The string representing the mode
       * @throw when the mode string is invalid
       */
      constructor(flagStr) {
          this.flagStr = flagStr;
          if (FileFlag.validFlagStrs.indexOf(flagStr) < 0) {
              throw new ApiError(ErrorCode.EINVAL, "Invalid flag: " + flagStr);
          }
      }
      /**
       * Get an object representing the given file flag.
       * @param modeStr The string representing the flag
       * @return The FileFlag object representing the flag
       * @throw when the flag string is invalid
       */
      static getFileFlag(flagStr) {
          // Check cache first.
          if (FileFlag.flagCache.hasOwnProperty(flagStr)) {
              return FileFlag.flagCache[flagStr];
          }
          return FileFlag.flagCache[flagStr] = new FileFlag(flagStr);
      }
      /**
       * Get the underlying flag string for this flag.
       */
      getFlagString() {
          return this.flagStr;
      }
      /**
       * Returns true if the file is readable.
       */
      isReadable() {
          return this.flagStr.indexOf('r') !== -1 || this.flagStr.indexOf('+') !== -1;
      }
      /**
       * Returns true if the file is writeable.
       */
      isWriteable() {
          return this.flagStr.indexOf('w') !== -1 || this.flagStr.indexOf('a') !== -1 || this.flagStr.indexOf('+') !== -1;
      }
      /**
       * Returns true if the file mode should truncate.
       */
      isTruncating() {
          return this.flagStr.indexOf('w') !== -1;
      }
      /**
       * Returns true if the file is appendable.
       */
      isAppendable() {
          return this.flagStr.indexOf('a') !== -1;
      }
      /**
       * Returns true if the file is open in synchronous mode.
       */
      isSynchronous() {
          return this.flagStr.indexOf('s') !== -1;
      }
      /**
       * Returns true if the file is open in exclusive mode.
       */
      isExclusive() {
          return this.flagStr.indexOf('x') !== -1;
      }
      /**
       * Returns one of the static fields on this object that indicates the
       * appropriate response to the path existing.
       */
      pathExistsAction() {
          if (this.isExclusive()) {
              return ActionType.THROW_EXCEPTION;
          }
          else if (this.isTruncating()) {
              return ActionType.TRUNCATE_FILE;
          }
          else {
              return ActionType.NOP;
          }
      }
      /**
       * Returns one of the static fields on this object that indicates the
       * appropriate response to the path not existing.
       */
      pathNotExistsAction() {
          if ((this.isWriteable() || this.isAppendable()) && this.flagStr !== 'r+') {
              return ActionType.CREATE_FILE;
          }
          else {
              return ActionType.THROW_EXCEPTION;
          }
      }
  }
  // Contains cached FileMode instances.
  FileFlag.flagCache = {};
  // Array of valid mode strings.
  FileFlag.validFlagStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];



    return {
        ActionType: ActionType,
        FileFlag: FileFlag
    };
});
define('skylark-browserfs/libs/path',[
	"skylark-langx-paths"
],function(paths){
  'use strict'
	return paths;
});
define('skylark-browserfs/core/node_fs_stats',[
    '../libs/buffers'
],function (buffers) {
    'use strict';
    const { Buffer } = buffers;

    /**
     * Indicates the type of the given file. Applied to 'mode'.
     */
    var FileType;
    (function (FileType) {
        FileType[FileType["FILE"] = 32768] = "FILE";
        FileType[FileType["DIRECTORY"] = 16384] = "DIRECTORY";
        FileType[FileType["SYMLINK"] = 40960] = "SYMLINK";
    })(FileType || (FileType = {}));

    /**
     * Emulation of Node's `fs.Stats` object.
     *
     * Attribute descriptions are from `man 2 stat'
     * @see http://nodejs.org/api/fs.html#fs_class_fs_stats
     * @see http://man7.org/linux/man-pages/man2/stat.2.html
     */
    class Stats {
        /**
         * Provides information about a particular entry in the file system.
         * @param itemType Type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
         * @param size Size of the item in bytes. For directories/symlinks,
         *   this is normally the size of the struct that represents the item.
         * @param mode Unix-style file mode (e.g. 0o644)
         * @param atimeMs time of last access, in milliseconds since epoch
         * @param mtimeMs time of last modification, in milliseconds since epoch
         * @param ctimeMs time of last time file status was changed, in milliseconds since epoch
         * @param birthtimeMs time of file creation, in milliseconds since epoch
         */
        constructor(itemType, size, mode, atimeMs, mtimeMs, ctimeMs, birthtimeMs) {
            /**
             * UNSUPPORTED ATTRIBUTES
             * I assume no one is going to need these details, although we could fake
             * appropriate values if need be.
             */
            // ID of device containing file
            this.dev = 0;
            // inode number
            this.ino = 0;
            // device ID (if special file)
            this.rdev = 0;
            // number of hard links
            this.nlink = 1;
            // blocksize for file system I/O
            this.blksize = 4096;
            // @todo Maybe support these? atm, it's a one-user filesystem.
            // user ID of owner
            this.uid = 0;
            // group ID of owner
            this.gid = 0;
            // XXX: Some file systems stash data on stats objects.
            this.fileData = null;
            this.size = size;
            let currentTime = 0;
            if (typeof (atimeMs) !== 'number') {
                currentTime = Date.now();
                atimeMs = currentTime;
            }
            if (typeof (mtimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                mtimeMs = currentTime;
            }
            if (typeof (ctimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                ctimeMs = currentTime;
            }
            if (typeof (birthtimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                birthtimeMs = currentTime;
            }
            this.atimeMs = atimeMs;
            this.ctimeMs = ctimeMs;
            this.mtimeMs = mtimeMs;
            this.birthtimeMs = birthtimeMs;
            if (!mode) {
                switch (itemType) {
                    case FileType.FILE:
                        this.mode = 0x1a4;
                        break;
                    case FileType.DIRECTORY:
                    default:
                        this.mode = 0x1ff;
                }
            }
            else {
                this.mode = mode;
            }
            // number of 512B blocks allocated
            this.blocks = Math.ceil(size / 512);
            // Check if mode also includes top-most bits, which indicate the file's
            // type.
            if (this.mode < 0x1000) {
                this.mode |= itemType;
            }
        }
        static fromBuffer(buffer) {
            const size = buffer.readUInt32LE(0), mode = buffer.readUInt32LE(4), atime = buffer.readDoubleLE(8), mtime = buffer.readDoubleLE(16), ctime = buffer.readDoubleLE(24);
            return new Stats(mode & 0xF000, size, mode & 0xFFF, atime, mtime, ctime);
        }
        /**
         * Clones the stats object.
         */
        static clone(s) {
            return new Stats(s.mode & 0xF000, s.size, s.mode & 0xFFF, s.atimeMs, s.mtimeMs, s.ctimeMs, s.birthtimeMs);
        }
        get atime() {
            return new Date(this.atimeMs);
        }
        get mtime() {
            return new Date(this.mtimeMs);
        }
        get ctime() {
            return new Date(this.ctimeMs);
        }
        get birthtime() {
            return new Date(this.birthtimeMs);
        }
        toBuffer() {
            const buffer = Buffer.alloc(32);
            buffer.writeUInt32LE(this.size, 0);
            buffer.writeUInt32LE(this.mode, 4);
            buffer.writeDoubleLE(this.atime.getTime(), 8);
            buffer.writeDoubleLE(this.mtime.getTime(), 16);
            buffer.writeDoubleLE(this.ctime.getTime(), 24);
            return buffer;
        }
        /**
         * @return [Boolean] True if this item is a file.
         */
        isFile() {
            return (this.mode & 0xF000) === FileType.FILE;
        }
        /**
         * @return [Boolean] True if this item is a directory.
         */
        isDirectory() {
            return (this.mode & 0xF000) === FileType.DIRECTORY;
        }
        /**
         * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
         */
        isSymbolicLink() {
            return (this.mode & 0xF000) === FileType.SYMLINK;
        }
        /**
         * Change the mode of the file. We use this helper function to prevent messing
         * up the type of the file, which is encoded in mode.
         */
        chmod(mode) {
            this.mode = (this.mode & 0xF000) | mode;
        }
        // We don't support the following types of files.
        isSocket() {
            return false;
        }
        isBlockDevice() {
            return false;
        }
        isCharacterDevice() {
            return false;
        }
        isFIFO() {
            return false;
        }
    }


    return {
        FileType,
        Stats
    }
});
define('skylark-browserfs/core/global',[],function () {
    'use strict';
    const toExport = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global;
    return toExport;
});
define('skylark-browserfs/generic/setImmediate',['../core/global'], function (global) {
    'use strict';
    /**
     * @hidden
     */
    let bfsSetImmediate;
    if (typeof (setImmediate) !== "undefined") {
        bfsSetImmediate = setImmediate;
    }
    else {
        const gScope = global;
        const timeouts = [];
        const messageName = "zero-timeout-message";
        const canUsePostMessage = function () {
            if (typeof gScope.importScripts !== 'undefined' || !gScope.postMessage) {
                return false;
            }
            let postMessageIsAsync = true;
            const oldOnMessage = gScope.onmessage;
            gScope.onmessage = function () {
                postMessageIsAsync = false;
            };
            gScope.postMessage('', '*');
            gScope.onmessage = oldOnMessage;
            return postMessageIsAsync;
        };
        if (canUsePostMessage()) {
            bfsSetImmediate = function (fn) {
                timeouts.push(fn);
                gScope.postMessage(messageName, "*");
            };
            const handleMessage = function (event) {
                if (event.source === self && event.data === messageName) {
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    }
                    else {
                        event.cancelBubble = true;
                    }
                    if (timeouts.length > 0) {
                        const fn = timeouts.shift();
                        return fn();
                    }
                }
            };
            if (gScope.addEventListener) {
                gScope.addEventListener('message', handleMessage, true);
            }
            else {
                gScope.attachEvent('onmessage', handleMessage);
            }
        }
        else if (gScope.MessageChannel) {
            // WebWorker MessageChannel
            const channel = new gScope.MessageChannel();
            channel.port1.onmessage = (event) => {
                if (timeouts.length > 0) {
                    return timeouts.shift()();
                }
            };
            bfsSetImmediate = (fn) => {
                timeouts.push(fn);
                channel.port2.postMessage('');
            };
        }
        else {
            bfsSetImmediate = function (fn) {
                return setTimeout(fn, 0);
            };
        }
    }

    return bfsSetImmediate;
});
define('skylark-browserfs/core/FS',[
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
define('skylark-browserfs/core/node_fs',['./FS'], function (FS) {
    'use strict';
    let fs = new FS();
    const _fsMock = {};
    const fsProto = FS.prototype;
    const keys = Object.getOwnPropertyNames(fsProto);
    keys.forEach(key => {
        if (typeof fs[key] === 'function') {
            _fsMock[key] = function () {
                return fs[key].apply(fs, arguments);
            };
        } else {
            _fsMock[key] = fs[key];
        }
    });
    _fsMock['changeFSModule'] = function (newFs) {
        fs = newFs;
    };
    _fsMock['getFSModule'] = function () {
        return fs;
    };
    _fsMock['FS'] = FS;
    _fsMock['Stats'] = FS.Stats;

    return _fsMock;
});
define('skylark-browserfs/core/levenshtein',[],function () {
    'use strict';
   
    /*
     * Levenshtein distance, from the `js-levenshtein` NPM module.
     * Copied here to avoid complexity of adding another CommonJS module dependency.
     */
    function _min(d0, d1, d2, bx, ay) {
        return d0 < d1 || d2 < d1 ? d0 > d2 ? d2 + 1 : d0 + 1 : bx === ay ? d1 : d1 + 1;
    }

    /**
     * Calculates levenshtein distance.
     * @param a
     * @param b
     */    
     function levenshtein(a, b) {
        if (a === b) {
            return 0;
        }
        if (a.length > b.length) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        let la = a.length;
        let lb = b.length;
        while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
            la--;
            lb--;
        }
        let offset = 0;
        while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
            offset++;
        }
        la -= offset;
        lb -= offset;
        if (la === 0 || lb === 1) {
            return lb;
        }
        const vector = new Array(la << 1);
        for (let y = 0; y < la;) {
            vector[la + y] = a.charCodeAt(offset + y);
            vector[y] = ++y;
        }
        let x;
        let d0;
        let d1;
        let d2;
        let d3;
        for (x = 0; x + 3 < lb;) {
            const bx0 = b.charCodeAt(offset + (d0 = x));
            const bx1 = b.charCodeAt(offset + (d1 = x + 1));
            const bx2 = b.charCodeAt(offset + (d2 = x + 2));
            const bx3 = b.charCodeAt(offset + (d3 = x + 3));
            let dd = x += 4;
            for (let y = 0; y < la;) {
                const ay = vector[la + y];
                const dy = vector[y];
                d0 = _min(dy, d0, d1, bx0, ay);
                d1 = _min(d0, d1, d2, bx1, ay);
                d2 = _min(d1, d2, d3, bx2, ay);
                dd = _min(d2, d3, dd, bx3, ay);
                vector[y++] = dd;
                d3 = d2;
                d2 = d1;
                d1 = d0;
                d0 = dy;
            }
        }
        let dd = 0;
        for (; x < lb;) {
            const bx0 = b.charCodeAt(offset + (d0 = x));
            dd = ++x;
            for (let y = 0; y < la; y++) {
                const dy = vector[y];
                vector[y] = dd = dy < d0 || dd < d0 ? dy > dd ? dd + 1 : dy + 1 : bx0 === vector[la + y] ? d0 : d0 + 1;
                d0 = dy;
            }
        }
        return dd;
    }

    return levenshtein;
});
define('skylark-browserfs/core/util',[
    '../libs/buffers',
    './api_error',
    './levenshtein',
    '../libs/path'
], function (buffers,api_error, levenshtein, path) {
    'use strict';

    const { ErrorCode, ApiError } = api_error;
    const {Buffer} = buffers;

    function deprecationMessage(print, fsName, opts) {
        if (print) {
            // tslint:disable-next-line:no-console
            console.warn(`[${fsName}] Direct file system constructor usage is deprecated for this file system, and will be removed in the next major version. Please use the '${fsName}.Create(${JSON.stringify(opts)}, callback)' method instead. See https://github.com/jvilk/BrowserFS/issues/176 for more details.`);
            // tslint:enable-next-line:no-console
        }
    }
    /**
     * Checks for any IE version, including IE11 which removed MSIE from the
     * userAgent string.
     * @hidden
     */
    const isIE = typeof navigator !== "undefined" && !!(/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) || navigator.userAgent.indexOf('Trident') !== -1);
    /**
     * Check if we're in a web worker.
     * @hidden
     */
    const isWebWorker = typeof window === "undefined";
    /**
     * Throws an exception. Called on code paths that should be impossible.
     * @hidden
     */
    function fail() {
        throw new Error("BFS has reached an impossible code path; please file a bug.");
    }
    /**
     * Synchronous recursive makedir.
     * @hidden
     */
    function mkdirpSync(p, mode, fs) {
        if (!fs.existsSync(p)) {
            mkdirpSync(path.dirname(p), mode, fs);
            fs.mkdirSync(p, mode);
        }
    }
    /**
     * Converts a buffer into an array buffer. Attempts to do so in a
     * zero-copy manner, e.g. the array references the same memory.
     * @hidden
     */
    function buffer2ArrayBuffer(buff) {
        const u8 = buffer2Uint8array(buff), u8offset = u8.byteOffset, u8Len = u8.byteLength;
        if (u8offset === 0 && u8Len === u8.buffer.byteLength) {
            return u8.buffer;
        }
        else {
            return u8.buffer.slice(u8offset, u8offset + u8Len);
        }
    }
    /**
     * Converts a buffer into a Uint8Array. Attempts to do so in a
     * zero-copy manner, e.g. the array references the same memory.
     * @hidden
     */
    function buffer2Uint8array(buff) {
        if (buff instanceof Uint8Array) {
            // BFS & Node v4.0 buffers *are* Uint8Arrays.
            return buff;
        }
        else {
            // Uint8Arrays can be constructed from arrayish numbers.
            // At this point, we assume this isn't a BFS array.
            return new Uint8Array(buff);
        }
    }
    /**
     * Converts the given arrayish object into a Buffer. Attempts to
     * be zero-copy.
     * @hidden
     */
    function arrayish2Buffer(arr) {
        if (arr instanceof Buffer) {
            return arr;
        }
        else if (arr instanceof Uint8Array) {
            return uint8Array2Buffer(arr);
        }
        else {
            return Buffer.from(arr);
        }
    }
    /**
     * Converts the given Uint8Array into a Buffer. Attempts to be zero-copy.
     * @hidden
     */
    function uint8Array2Buffer(u8) {
        if (u8 instanceof Buffer) {
            return u8;
        }
        else if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
            return arrayBuffer2Buffer(u8.buffer);
        }
        else {
            return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
        }
    }
    /**
     * Converts the given array buffer into a Buffer. Attempts to be
     * zero-copy.
     * @hidden
     */
    function arrayBuffer2Buffer(ab) {
        return Buffer.from(ab);
    }
    /**
     * Copies a slice of the given buffer
     * @hidden
     */
    function copyingSlice(buff, start = 0, end = buff.length) {
        if (start < 0 || end < 0 || end > buff.length || start > end) {
            throw new TypeError(`Invalid slice bounds on buffer of length ${buff.length}: [${start}, ${end}]`);
        }
        if (buff.length === 0) {
            // Avoid s0 corner case in ArrayBuffer case.
            return emptyBuffer();
        }
        else {
            const u8 = buffer2Uint8array(buff), s0 = buff[0], newS0 = (s0 + 1) % 0xFF;
            buff[0] = newS0;
            if (u8[0] === newS0) {
                // Same memory. Revert & copy.
                u8[0] = s0;
                return uint8Array2Buffer(u8.slice(start, end));
            }
            else {
                // Revert.
                buff[0] = s0;
                return uint8Array2Buffer(u8.subarray(start, end));
            }
        }
    }
    /**
     * @hidden
     */
    let emptyBuff = null;
    /**
     * Returns an empty buffer.
     * @hidden
     */
    function emptyBuffer() {
        if (emptyBuff) {
            return emptyBuff;
        }
        return emptyBuff = Buffer.alloc(0);
    }
    /**
     * Option validator for a Buffer file system option.
     * @hidden
     */
    function bufferValidator(v, cb) {
        if (Buffer.isBuffer(v)) {
            cb();
        }
        else {
            cb(new ApiError(ErrorCode.EINVAL, `option must be a Buffer.`));
        }
    }
    /**
     * Checks that the given options object is valid for the file system options.
     * @hidden
     */
    function checkOptions(fsType, opts, cb) {
        const optsInfo = fsType.Options;
        const fsName = fsType.Name;
        let pendingValidators = 0;
        let callbackCalled = false;
        let loopEnded = false;
        function validatorCallback(e) {
            if (!callbackCalled) {
                if (e) {
                    callbackCalled = true;
                    cb(e);
                }
                pendingValidators--;
                if (pendingValidators === 0 && loopEnded) {
                    cb();
                }
            }
        }
        // Check for required options.
        for (const optName in optsInfo) {
            if (optsInfo.hasOwnProperty(optName)) {
                const opt = optsInfo[optName];
                const providedValue = opts[optName];
                if (providedValue === undefined || providedValue === null) {
                    if (!opt.optional) {
                        // Required option, not provided.
                        // Any incorrect options provided? Which ones are close to the provided one?
                        // (edit distance 5 === close)
                        const incorrectOptions = Object.keys(opts).filter((o) => !(o in optsInfo)).map((a) => {
                            return { str: a, distance: levenshtein(optName, a) };
                        }).filter((o) => o.distance < 5).sort((a, b) => a.distance - b.distance);
                        // Validators may be synchronous.
                        if (callbackCalled) {
                            return;
                        }
                        callbackCalled = true;
                        return cb(new ApiError(ErrorCode.EINVAL, `[${fsName}] Required option '${optName}' not provided.${incorrectOptions.length > 0 ? ` You provided unrecognized option '${incorrectOptions[0].str}'; perhaps you meant to type '${optName}'.` : ''}\nOption description: ${opt.description}`));
                    }
                    // Else: Optional option, not provided. That is OK.
                }
                else {
                    // Option provided! Check type.
                    let typeMatches = false;
                    if (Array.isArray(opt.type)) {
                        typeMatches = opt.type.indexOf(typeof (providedValue)) !== -1;
                    }
                    else {
                        typeMatches = typeof (providedValue) === opt.type;
                    }
                    if (!typeMatches) {
                        // Validators may be synchronous.
                        if (callbackCalled) {
                            return;
                        }
                        callbackCalled = true;
                        return cb(new ApiError(ErrorCode.EINVAL, `[${fsName}] Value provided for option ${optName} is not the proper type. Expected ${Array.isArray(opt.type) ? `one of {${opt.type.join(", ")}}` : opt.type}, but received ${typeof (providedValue)}\nOption description: ${opt.description}`));
                    }
                    else if (opt.validator) {
                        pendingValidators++;
                        opt.validator(providedValue, validatorCallback);
                    }
                    // Otherwise: All good!
                }
            }
        }
        loopEnded = true;
        if (pendingValidators === 0 && !callbackCalled) {
            cb();
        }
    }

    return {
        deprecationMessage: deprecationMessage,
        isIE: isIE,
        isWebWorker: isWebWorker,
        fail: fail,
        mkdirpSync: mkdirpSync,
        buffer2ArrayBuffer: buffer2ArrayBuffer,
        buffer2Uint8array: buffer2Uint8array,
        arrayish2Buffer: arrayish2Buffer,
        uint8Array2Buffer: uint8Array2Buffer,
        arrayBuffer2Buffer: arrayBuffer2Buffer,
        copyingSlice: copyingSlice,
        emptyBuffer: emptyBuffer,
        bufferValidator: bufferValidator,
        checkOptions: checkOptions
    };
});
define('skylark-browserfs/generic/emscripten_fs',[
    '../core/node_fs',
    '../core/util'
], function (fs, util) {
    'use strict';
    const { uint8Array2Buffer } = util;

    class BFSEmscriptenStreamOps {
        constructor(fs) {
            this.fs = fs;
            this.nodefs = fs.getNodeFS();
            this.FS = fs.getFS();
            this.PATH = fs.getPATH();
            this.ERRNO_CODES = fs.getERRNO_CODES();
        }
        open(stream) {
            const path = this.fs.realPath(stream.node);
            const FS = this.FS;
            try {
                if (FS.isFile(stream.node.mode)) {
                    stream.nfd = this.nodefs.openSync(path, this.fs.flagsToPermissionString(stream.flags));
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        close(stream) {
            const FS = this.FS;
            try {
                if (FS.isFile(stream.node.mode) && stream.nfd) {
                    this.nodefs.closeSync(stream.nfd);
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        read(stream, buffer, offset, length, position) {
            // Avoid copying overhead by reading directly into buffer.
            try {
                return this.nodefs.readSync(stream.nfd, uint8Array2Buffer(buffer), offset, length, position);
            }
            catch (e) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        write(stream, buffer, offset, length, position) {
            // Avoid copying overhead.
            try {
                return this.nodefs.writeSync(stream.nfd, uint8Array2Buffer(buffer), offset, length, position);
            }
            catch (e) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        llseek(stream, offset, whence) {
            let position = offset;
            if (whence === 1) { // SEEK_CUR.
                position += stream.position;
            }
            else if (whence === 2) { // SEEK_END.
                if (this.FS.isFile(stream.node.mode)) {
                    try {
                        const stat = this.nodefs.fstatSync(stream.nfd);
                        position += stat.size;
                    }
                    catch (e) {
                        throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                    }
                }
            }
            if (position < 0) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES.EINVAL);
            }
            stream.position = position;
            return position;
        }
    }
    class BFSEmscriptenNodeOps {
        constructor(fs) {
            this.fs = fs;
            this.nodefs = fs.getNodeFS();
            this.FS = fs.getFS();
            this.PATH = fs.getPATH();
            this.ERRNO_CODES = fs.getERRNO_CODES();
        }
        getattr(node) {
            const path = this.fs.realPath(node);
            let stat;
            try {
                stat = this.nodefs.lstatSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return {
                dev: stat.dev,
                ino: stat.ino,
                mode: stat.mode,
                nlink: stat.nlink,
                uid: stat.uid,
                gid: stat.gid,
                rdev: stat.rdev,
                size: stat.size,
                atime: stat.atime,
                mtime: stat.mtime,
                ctime: stat.ctime,
                blksize: stat.blksize,
                blocks: stat.blocks
            };
        }
        setattr(node, attr) {
            const path = this.fs.realPath(node);
            try {
                if (attr.mode !== undefined) {
                    this.nodefs.chmodSync(path, attr.mode);
                    // update the common node structure mode as well
                    node.mode = attr.mode;
                }
                if (attr.timestamp !== undefined) {
                    const date = new Date(attr.timestamp);
                    this.nodefs.utimesSync(path, date, date);
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                // Ignore not supported errors. Emscripten does utimesSync when it
                // writes files, but never really requires the value to be set.
                if (e.code !== "ENOTSUP") {
                    throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                }
            }
            if (attr.size !== undefined) {
                try {
                    this.nodefs.truncateSync(path, attr.size);
                }
                catch (e) {
                    if (!e.code) {
                        throw e;
                    }
                    throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                }
            }
        }
        lookup(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            const mode = this.fs.getMode(path);
            return this.fs.createNode(parent, name, mode);
        }
        mknod(parent, name, mode, dev) {
            const node = this.fs.createNode(parent, name, mode, dev);
            // create the backing node for this in the fs root as well
            const path = this.fs.realPath(node);
            try {
                if (this.FS.isDir(node.mode)) {
                    this.nodefs.mkdirSync(path, node.mode);
                }
                else {
                    this.nodefs.writeFileSync(path, '', { mode: node.mode });
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return node;
        }
        rename(oldNode, newDir, newName) {
            const oldPath = this.fs.realPath(oldNode);
            const newPath = this.PATH.join2(this.fs.realPath(newDir), newName);
            try {
                this.nodefs.renameSync(oldPath, newPath);
                // This logic is missing from the original NodeFS,
                // causing Emscripten's filesystem to think that the old file still exists.
                oldNode.name = newName;
                oldNode.parent = newDir;
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        unlink(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            try {
                this.nodefs.unlinkSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        rmdir(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            try {
                this.nodefs.rmdirSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        readdir(node) {
            const path = this.fs.realPath(node);
            try {
                // Node does not list . and .. in directory listings,
                // but Emscripten expects it.
                const contents = this.nodefs.readdirSync(path);
                contents.push('.', '..');
                return contents;
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        symlink(parent, newName, oldPath) {
            const newPath = this.PATH.join2(this.fs.realPath(parent), newName);
            try {
                this.nodefs.symlinkSync(oldPath, newPath);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        readlink(node) {
            const path = this.fs.realPath(node);
            try {
                return this.nodefs.readlinkSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
    }
    class BFSEmscriptenFS {
        constructor(_FS = self['FS'], _PATH = self['PATH'], _ERRNO_CODES = self['ERRNO_CODES'], nodefs = fs) {
            // This maps the integer permission modes from http://linux.die.net/man/3/open
            // to node.js-specific file open permission strings at http://nodejs.org/api/fs.html#fs_fs_open_path_flags_mode_callback
            this.flagsToPermissionStringMap = {
                0 /*O_RDONLY*/: 'r',
                1 /*O_WRONLY*/: 'r+',
                2 /*O_RDWR*/: 'r+',
                64 /*O_CREAT*/: 'r',
                65 /*O_WRONLY|O_CREAT*/: 'r+',
                66 /*O_RDWR|O_CREAT*/: 'r+',
                129 /*O_WRONLY|O_EXCL*/: 'rx+',
                193 /*O_WRONLY|O_CREAT|O_EXCL*/: 'rx+',
                514 /*O_RDWR|O_TRUNC*/: 'w+',
                577 /*O_WRONLY|O_CREAT|O_TRUNC*/: 'w',
                578 /*O_CREAT|O_RDWR|O_TRUNC*/: 'w+',
                705 /*O_WRONLY|O_CREAT|O_EXCL|O_TRUNC*/: 'wx',
                706 /*O_RDWR|O_CREAT|O_EXCL|O_TRUNC*/: 'wx+',
                1024 /*O_APPEND*/: 'a',
                1025 /*O_WRONLY|O_APPEND*/: 'a',
                1026 /*O_RDWR|O_APPEND*/: 'a+',
                1089 /*O_WRONLY|O_CREAT|O_APPEND*/: 'a',
                1090 /*O_RDWR|O_CREAT|O_APPEND*/: 'a+',
                1153 /*O_WRONLY|O_EXCL|O_APPEND*/: 'ax',
                1154 /*O_RDWR|O_EXCL|O_APPEND*/: 'ax+',
                1217 /*O_WRONLY|O_CREAT|O_EXCL|O_APPEND*/: 'ax',
                1218 /*O_RDWR|O_CREAT|O_EXCL|O_APPEND*/: 'ax+',
                4096 /*O_RDONLY|O_DSYNC*/: 'rs',
                4098 /*O_RDWR|O_DSYNC*/: 'rs+'
            };
            this.nodefs = nodefs;
            this.FS = _FS;
            this.PATH = _PATH;
            this.ERRNO_CODES = _ERRNO_CODES;
            this.node_ops = new BFSEmscriptenNodeOps(this);
            this.stream_ops = new BFSEmscriptenStreamOps(this);
        }
        mount(m) {
            return this.createNode(null, '/', this.getMode(m.opts.root), 0);
        }
        createNode(parent, name, mode, dev) {
            const FS = this.FS;
            if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
                throw new FS.ErrnoError(this.ERRNO_CODES.EINVAL);
            }
            const node = FS.createNode(parent, name, mode);
            node.node_ops = this.node_ops;
            node.stream_ops = this.stream_ops;
            return node;
        }
        getMode(path) {
            let stat;
            try {
                stat = this.nodefs.lstatSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return stat.mode;
        }
        realPath(node) {
            const parts = [];
            while (node.parent !== node) {
                parts.push(node.name);
                node = node.parent;
            }
            parts.push(node.mount.opts.root);
            parts.reverse();
            return this.PATH.join.apply(null, parts);
        }
        flagsToPermissionString(flags) {
            let parsedFlags = (typeof flags === "string") ? parseInt(flags, 10) : flags;
            parsedFlags &= 0x1FFF;
            if (parsedFlags in this.flagsToPermissionStringMap) {
                return this.flagsToPermissionStringMap[parsedFlags];
            }
            else {
                return flags;
            }
        }
        getNodeFS() {
            return this.nodefs;
        }
        getFS() {
            return this.FS;
        }
        getPATH() {
            return this.PATH;
        }
        getERRNO_CODES() {
            return this.ERRNO_CODES;
        }
    }

    return BFSEmscriptenFS;
});
define('skylark-browserfs/core/file_system',[
    '../libs/buffers',
    './api_error',
    './file_flag',
    '../libs/path',
    './util'
], function (buffers,api_error, file_flag, path, util) {
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
define('skylark-browserfs/core/file',['./api_error'], function (api_error) {
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
define('skylark-browserfs/generic/preload_file',[
    '../libs/buffers',
    '../core/file',
    '../core/node_fs_stats',
    '../core/api_error',
    '../core/node_fs',
    '../core/util'
], function (buffers,file, Stats, api_error, fs, util) {
    'use strict';

    const { BaseFile } = file;
    const { ApiError, ErrorCode } = api_error;
    const { emptyBuffer } = util;
    const { Buffer } = buffers;

    /**
     * An implementation of the File interface that operates on a file that is
     * completely in-memory. PreloadFiles are backed by a Buffer.
     *
     * This is also an abstract class, as it lacks an implementation of 'sync' and
     * 'close'. Each filesystem that wishes to use this file representation must
     * extend this class and implement those two methods.
     * @todo 'close' lever that disables functionality once closed.
     */
    class PreloadFile extends BaseFile {
        /**
         * Creates a file with the given path and, optionally, the given contents. Note
         * that, if contents is specified, it will be mutated by the file!
         * @param _fs The file system that created the file.
         * @param _path
         * @param _mode The mode that the file was opened using.
         *   Dictates permissions and where the file pointer starts.
         * @param _stat The stats object for the given file.
         *   PreloadFile will mutate this object. Note that this object must contain
         *   the appropriate mode that the file was opened as.
         * @param contents A buffer containing the entire
         *   contents of the file. PreloadFile will mutate this buffer. If not
         *   specified, we assume it is a new file.
         */
        constructor(_fs, _path, _flag, _stat, contents) {
            super();
            this._pos = 0;
            this._dirty = false;
            this._fs = _fs;
            this._path = _path;
            this._flag = _flag;
            this._stat = _stat;
            this._buffer = contents ? contents : emptyBuffer();
            // Note: This invariant is *not* maintained once the file starts getting
            // modified.
            // Note: Only actually matters if file is readable, as writeable modes may
            // truncate/append to file.
            if (this._stat.size !== this._buffer.length && this._flag.isReadable()) {
                throw new Error(`Invalid buffer: Buffer is ${this._buffer.length} long, yet Stats object specifies that file is ${this._stat.size} long.`);
            }
        }
        /**
         * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
         */
        getBuffer() {
            return this._buffer;
        }
        /**
         * NONSTANDARD: Get underlying stats for this file. !!DO NOT MUTATE!!
         */
        getStats() {
            return this._stat;
        }
        getFlag() {
            return this._flag;
        }
        /**
         * Get the path to this file.
         * @return [String] The path to the file.
         */
        getPath() {
            return this._path;
        }
        /**
         * Get the current file position.
         *
         * We emulate the following bug mentioned in the Node documentation:
         * > On Linux, positional writes don't work when the file is opened in append
         *   mode. The kernel ignores the position argument and always appends the data
         *   to the end of the file.
         * @return [Number] The current file position.
         */
        getPos() {
            if (this._flag.isAppendable()) {
                return this._stat.size;
            }
            return this._pos;
        }
        /**
         * Advance the current file position by the indicated number of positions.
         * @param [Number] delta
         */
        advancePos(delta) {
            return this._pos += delta;
        }
        /**
         * Set the file position.
         * @param [Number] newPos
         */
        setPos(newPos) {
            return this._pos = newPos;
        }
        /**
         * **Core**: Asynchronous sync. Must be implemented by subclasses of this
         * class.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        sync(cb) {
            try {
                this.syncSync();
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * **Core**: Synchronous sync.
         */
        syncSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * **Core**: Asynchronous close. Must be implemented by subclasses of this
         * class.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        close(cb) {
            try {
                this.closeSync();
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * **Core**: Synchronous close.
         */
        closeSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Asynchronous `stat`.
         * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
         */
        stat(cb) {
            try {
                cb(null, Stats.clone(this._stat));
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Synchronous `stat`.
         */
        statSync() {
            return Stats.clone(this._stat);
        }
        /**
         * Asynchronous truncate.
         * @param [Number] len
         * @param [Function(BrowserFS.ApiError)] cb
         */
        truncate(len, cb) {
            try {
                this.truncateSync(len);
                if (this._flag.isSynchronous() && !fs.getRootFS().supportsSynch()) {
                    this.sync(cb);
                }
                cb();
            }
            catch (e) {
                return cb(e);
            }
        }
        /**
         * Synchronous truncate.
         * @param [Number] len
         */
        truncateSync(len) {
            this._dirty = true;
            if (!this._flag.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
            }
            this._stat.mtimeMs = Date.now();
            if (len > this._buffer.length) {
                const buf = Buffer.alloc(len - this._buffer.length, 0);
                // Write will set @_stat.size for us.
                this.writeSync(buf, 0, buf.length, this._buffer.length);
                if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
                    this.syncSync();
                }
                return;
            }
            this._stat.size = len;
            // Truncate buffer to 'len'.
            const newBuff = Buffer.alloc(len);
            this._buffer.copy(newBuff, 0, 0, len);
            this._buffer = newBuff;
            if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
                this.syncSync();
            }
        }
        /**
         * Write buffer to the file.
         * Note that it is unsafe to use fs.write multiple times on the same file
         * without waiting for the callback.
         * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
         *  the file.
         * @param [Number] offset Offset in the buffer to start reading data from.
         * @param [Number] length The amount of bytes to write to the file.
         * @param [Number] position Offset from the beginning of the file where this
         *   data should be written. If position is null, the data will be written at
         *   the current position.
         * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
         *   cb The number specifies the number of bytes written into the file.
         */
        write(buffer, offset, length, position, cb) {
            try {
                cb(null, this.writeSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Write buffer to the file.
         * Note that it is unsafe to use fs.writeSync multiple times on the same file
         * without waiting for the callback.
         * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
         *  the file.
         * @param [Number] offset Offset in the buffer to start reading data from.
         * @param [Number] length The amount of bytes to write to the file.
         * @param [Number] position Offset from the beginning of the file where this
         *   data should be written. If position is null, the data will be written at
         *   the current position.
         * @return [Number]
         */
        writeSync(buffer, offset, length, position) {
            this._dirty = true;
            if (position === undefined || position === null) {
                position = this.getPos();
            }
            if (!this._flag.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
            }
            const endFp = position + length;
            if (endFp > this._stat.size) {
                this._stat.size = endFp;
                if (endFp > this._buffer.length) {
                    // Extend the buffer!
                    const newBuff = Buffer.alloc(endFp);
                    this._buffer.copy(newBuff);
                    this._buffer = newBuff;
                }
            }
            const len = buffer.copy(this._buffer, position, offset, offset + length);
            this._stat.mtimeMs = Date.now();
            if (this._flag.isSynchronous()) {
                this.syncSync();
                return len;
            }
            this.setPos(position + len);
            return len;
        }
        /**
         * Read data from the file.
         * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
         *   written to.
         * @param [Number] offset The offset within the buffer where writing will
         *   start.
         * @param [Number] length An integer specifying the number of bytes to read.
         * @param [Number] position An integer specifying where to begin reading from
         *   in the file. If position is null, data will be read from the current file
         *   position.
         * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
         *   number is the number of bytes read
         */
        read(buffer, offset, length, position, cb) {
            try {
                cb(null, this.readSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Read data from the file.
         * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
         *   written to.
         * @param [Number] offset The offset within the buffer where writing will
         *   start.
         * @param [Number] length An integer specifying the number of bytes to read.
         * @param [Number] position An integer specifying where to begin reading from
         *   in the file. If position is null, data will be read from the current file
         *   position.
         * @return [Number]
         */
        readSync(buffer, offset, length, position) {
            if (!this._flag.isReadable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a readable mode.');
            }
            if (position === undefined || position === null) {
                position = this.getPos();
            }
            const endRead = position + length;
            if (endRead > this._stat.size) {
                length = this._stat.size - position;
            }
            const rv = this._buffer.copy(buffer, offset, position, position + length);
            this._stat.atimeMs = Date.now();
            this._pos = position + length;
            return rv;
        }
        /**
         * Asynchronous `fchmod`.
         * @param [Number|String] mode
         * @param [Function(BrowserFS.ApiError)] cb
         */
        chmod(mode, cb) {
            try {
                this.chmodSync(mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Asynchronous `fchmod`.
         * @param [Number] mode
         */
        chmodSync(mode) {
            if (!this._fs.supportsProps()) {
                throw new ApiError(ErrorCode.ENOTSUP);
            }
            this._dirty = true;
            this._stat.chmod(mode);
            this.syncSync();
        }
        isDirty() {
            return this._dirty;
        }
        /**
         * Resets the dirty bit. Should only be called after a sync has completed successfully.
         */
        resetDirty() {
            this._dirty = false;
        }
    }
    /**
     * File class for the InMemory and XHR file systems.
     * Doesn't sync to anything, so it works nicely for memory-only files.
     */
    class NoSyncFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        /**
         * Asynchronous sync. Doesn't do anything, simply calls the cb.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        sync(cb) {
            cb();
        }
        /**
         * Synchronous sync. Doesn't do anything.
         */
        syncSync() {
            // NOP.
        }
        /**
         * Asynchronous close. Doesn't do anything, simply calls the cb.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        close(cb) {
            cb();
        }
        /**
         * Synchronous close. Doesn't do anything.
         */
        closeSync() {
            // NOP.
        }
    }

    return {
        PreloadFile,
        NoSyncFile
    }
});
define('skylark-browserfs/backend/AsyncMirror',[
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
define('skylark-browserfs/backend/Dropbox',[
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
define('skylark-browserfs/backend/Emscripten',[
    '../libs/buffers',
    '../core/file_system',
    '../core/node_fs_stats',
    '../core/file',
    '../core/util',
    '../core/api_error'
], function (buffers,file_system, node_fs_stats, file, util, api_error) {
    'use strict';

    const { SynchronousFileSystem } = file_system;
    const { Stats, FileType } = node_fs_stats;
    const { BaseFile } = file;
    const { uint8Array2Buffer, buffer2Uint8array } = util;
    const { ApiError, ErrorCode, ErrorStrings } = api_error;
    const { Buffer } = buffers;

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
define('skylark-browserfs/backend/FolderAdapter',[
    '../core/file_system',
    '../libs/path',
    '../core/api_error'
], function (file_system, path, api_error) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError } = api_error;

    /**
     * The FolderAdapter file system wraps a file system, and scopes all interactions to a subfolder of that file system.
     *
     * Example: Given a file system `foo` with folder `bar` and file `bar/baz`...
     *
     * ```javascript
     * BrowserFS.configure({
     *   fs: "FolderAdapter",
     *   options: {
     *     folder: "bar",
     *     wrapped: foo
     *   }
     * }, function(e) {
     *   var fs = BrowserFS.BFSRequire('fs');
     *   fs.readdirSync('/'); // ['baz']
     * });
     * ```
     */
    class FolderAdapter extends BaseFileSystem {
        constructor(folder, wrapped) {
            super();
            this._folder = folder;
            this._wrapped = wrapped;
        }
        /**
         * Creates a FolderAdapter instance with the given options.
         */
        static Create(opts, cb) {
            const fa = new FolderAdapter(opts.folder, opts.wrapped);
            fa._initialize(function (e) {
                if (e) {
                    cb(e);
                }
                else {
                    cb(null, fa);
                }
            });
        }
        static isAvailable() {
            return true;
        }
        getName() { return this._wrapped.getName(); }
        isReadOnly() { return this._wrapped.isReadOnly(); }
        supportsProps() { return this._wrapped.supportsProps(); }
        supportsSynch() { return this._wrapped.supportsSynch(); }
        supportsLinks() { return false; }
        /**
         * Initialize the file system. Ensures that the wrapped file system
         * has the given folder.
         */
        _initialize(cb) {
            this._wrapped.exists(this._folder, (exists) => {
                if (exists) {
                    cb();
                }
                else if (this._wrapped.isReadOnly()) {
                    cb(ApiError.ENOENT(this._folder));
                }
                else {
                    this._wrapped.mkdir(this._folder, 0x1ff, cb);
                }
            });
        }
    }
    FolderAdapter.Name = "FolderAdapter";
    FolderAdapter.Options = {
        folder: {
            type: "string",
            description: "The folder to use as the root directory"
        },
        wrapped: {
            type: "object",
            description: "The file system to wrap"
        }
    };
    /**
     * @hidden
     */
    function translateError(folder, e) {
        if (e !== null && typeof e === 'object') {
            const err = e;
            let p = err.path;
            if (p) {
                p = '/' + path.relative(folder, p);
                err.message = err.message.replace(err.path, p);
                err.path = p;
            }
        }
        return e;
    }
    /**
     * @hidden
     */
    function wrapCallback(folder, cb) {
        if (typeof cb === 'function') {
            return function (err) {
                if (arguments.length > 0) {
                    arguments[0] = translateError(folder, err);
                }
                cb.apply(null, arguments);
            };
        }
        else {
            return cb;
        }
    }
    /**
     * @hidden
     */
    function wrapFunction(name, wrapFirst, wrapSecond) {
        if (name.slice(name.length - 4) !== 'Sync') {
            // Async function. Translate error in callback.
            return function () {
                if (arguments.length > 0) {
                    if (wrapFirst) {
                        arguments[0] = path.join(this._folder, arguments[0]);
                    }
                    if (wrapSecond) {
                        arguments[1] = path.join(this._folder, arguments[1]);
                    }
                    arguments[arguments.length - 1] = wrapCallback(this._folder, arguments[arguments.length - 1]);
                }
                return this._wrapped[name].apply(this._wrapped, arguments);
            };
        }
        else {
            // Sync function. Translate error in catch.
            return function () {
                try {
                    if (wrapFirst) {
                        arguments[0] = path.join(this._folder, arguments[0]);
                    }
                    if (wrapSecond) {
                        arguments[1] = path.join(this._folder, arguments[1]);
                    }
                    return this._wrapped[name].apply(this._wrapped, arguments);
                }
                catch (e) {
                    throw translateError(this._folder, e);
                }
            };
        }
    }
    // First argument is a path.
    ['diskSpace', 'stat', 'statSync', 'open', 'openSync', 'unlink', 'unlinkSync',
        'rmdir', 'rmdirSync', 'mkdir', 'mkdirSync', 'readdir', 'readdirSync', 'exists',
        'existsSync', 'realpath', 'realpathSync', 'truncate', 'truncateSync', 'readFile',
        'readFileSync', 'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync',
        'chmod', 'chmodSync', 'chown', 'chownSync', 'utimes', 'utimesSync', 'readlink',
        'readlinkSync'].forEach((name) => {
        FolderAdapter.prototype[name] = wrapFunction(name, true, false);
    });
    // First and second arguments are paths.
    ['rename', 'renameSync', 'link', 'linkSync', 'symlink', 'symlinkSync'].forEach((name) => {
        FolderAdapter.prototype[name] = wrapFunction(name, true, true);
    });

    return FolderAdapter;
});
define('skylark-browserfs/backend/HTML5FS',[
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
define('skylark-browserfs/generic/inode',[
    '../libs/buffers',
    '../core/node_fs_stats'
], function (buffers,node_fs_stats) {
    'use strict';

    const  { Stats, FileType } = node_fs_stats;
    const { Buffer } = buffers;

    /**
     * Generic inode definition that can easily be serialized.
     */
    class Inode {
        constructor(id, size, mode, atime, mtime, ctime) {
            this.id = id;
            this.size = size;
            this.mode = mode;
            this.atime = atime;
            this.mtime = mtime;
            this.ctime = ctime;
        }
        /**
         * Converts the buffer into an Inode.
         */
        static fromBuffer(buffer) {
            if (buffer === undefined) {
                throw new Error("NO");
            }
            return new Inode(buffer.toString('ascii', 30), buffer.readUInt32LE(0), buffer.readUInt16LE(4), buffer.readDoubleLE(6), buffer.readDoubleLE(14), buffer.readDoubleLE(22));
        }
        /**
         * Handy function that converts the Inode to a Node Stats object.
         */
        toStats() {
            return new Stats((this.mode & 0xF000) === FileType.DIRECTORY ? FileType.DIRECTORY : FileType.FILE, this.size, this.mode, this.atime, this.mtime, this.ctime);
        }
        /**
         * Get the size of this Inode, in bytes.
         */
        getSize() {
            // ASSUMPTION: ID is ASCII (1 byte per char).
            return 30 + this.id.length;
        }
        /**
         * Writes the inode into the start of the buffer.
         */
        toBuffer(buff = Buffer.alloc(this.getSize())) {
            buff.writeUInt32LE(this.size, 0);
            buff.writeUInt16LE(this.mode, 4);
            buff.writeDoubleLE(this.atime, 6);
            buff.writeDoubleLE(this.mtime, 14);
            buff.writeDoubleLE(this.ctime, 22);
            buff.write(this.id, 30, this.id.length, 'ascii');
            return buff;
        }
        /**
         * Updates the Inode using information from the stats object. Used by file
         * systems at sync time, e.g.:
         * - Program opens file and gets a File object.
         * - Program mutates file. File object is responsible for maintaining
         *   metadata changes locally -- typically in a Stats object.
         * - Program closes file. File object's metadata changes are synced with the
         *   file system.
         * @return True if any changes have occurred.
         */
        update(stats) {
            let hasChanged = false;
            if (this.size !== stats.size) {
                this.size = stats.size;
                hasChanged = true;
            }
            if (this.mode !== stats.mode) {
                this.mode = stats.mode;
                hasChanged = true;
            }
            const atimeMs = stats.atime.getTime();
            if (this.atime !== atimeMs) {
                this.atime = atimeMs;
                hasChanged = true;
            }
            const mtimeMs = stats.mtime.getTime();
            if (this.mtime !== mtimeMs) {
                this.mtime = mtimeMs;
                hasChanged = true;
            }
            const ctimeMs = stats.ctime.getTime();
            if (this.ctime !== ctimeMs) {
                this.ctime = ctimeMs;
                hasChanged = true;
            }
            return hasChanged;
        }
        // XXX: Copied from Stats. Should reconcile these two into something more
        //      compact.
        /**
         * @return [Boolean] True if this item is a file.
         */
        isFile() {
            return (this.mode & 0xF000) === FileType.FILE;
        }
        /**
         * @return [Boolean] True if this item is a directory.
         */
        isDirectory() {
            return (this.mode & 0xF000) === FileType.DIRECTORY;
        }
    }


    return Inode;
});
define('skylark-browserfs/generic/key_value_filesystem',[
    '../libs/buffers',
    '../core/file_system',
    '../core/api_error',
    '../core/node_fs_stats',
    '../libs/path',
    '../generic/inode',
    '../generic/preload_file',
    '../core/util'
], function (buffers,file_system, api_error, node_fs_stats, path, Inode, preload_file, util) {
    'use strict';

    const { BaseFileSystem, SynchronousFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { FileType } = node_fs_stats;
    const { emptyBuffer } = util;
    const { PreloadFile} = preload_file;
    const { Buffer } = buffers;


    /**
     * @hidden
     */
    const ROOT_NODE_ID = "/";
    /**
     * @hidden
     */
    let emptyDirNode = null;
    /**
     * Returns an empty directory node.
     * @hidden
     */
    function getEmptyDirNode() {
        if (emptyDirNode) {
            return emptyDirNode;
        }
        return emptyDirNode = Buffer.from("{}");
    }
    /**
     * Generates a random ID.
     * @hidden
     */
    function GenerateRandomID() {
        // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    /**
     * Helper function. Checks if 'e' is defined. If so, it triggers the callback
     * with 'e' and returns false. Otherwise, returns true.
     * @hidden
     */
    function noError(e, cb) {
        if (e) {
            cb(e);
            return false;
        }
        return true;
    }
    /**
     * Helper function. Checks if 'e' is defined. If so, it aborts the transaction,
     * triggers the callback with 'e', and returns false. Otherwise, returns true.
     * @hidden
     */
    function noErrorTx(e, tx, cb) {
        if (e) {
            tx.abort(() => {
                cb(e);
            });
            return false;
        }
        return true;
    }
    class LRUNode {
        constructor(key, value) {
            this.key = key;
            this.value = value;
            this.prev = null;
            this.next = null;
        }
    }
    // Adapted from https://chrisrng.svbtle.com/lru-cache-in-javascript
    class LRUCache {
        constructor(limit) {
            this.limit = limit;
            this.size = 0;
            this.map = {};
            this.head = null;
            this.tail = null;
        }
        /**
         * Change or add a new value in the cache
         * We overwrite the entry if it already exists
         */
        set(key, value) {
            const node = new LRUNode(key, value);
            if (this.map[key]) {
                this.map[key].value = node.value;
                this.remove(node.key);
            }
            else {
                if (this.size >= this.limit) {
                    delete this.map[this.tail.key];
                    this.size--;
                    this.tail = this.tail.prev;
                    this.tail.next = null;
                }
            }
            this.setHead(node);
        }
        /* Retrieve a single entry from the cache */
        get(key) {
            if (this.map[key]) {
                const value = this.map[key].value;
                const node = new LRUNode(key, value);
                this.remove(key);
                this.setHead(node);
                return value;
            }
            else {
                return null;
            }
        }
        /* Remove a single entry from the cache */
        remove(key) {
            const node = this.map[key];
            if (!node) {
                return;
            }
            if (node.prev !== null) {
                node.prev.next = node.next;
            }
            else {
                this.head = node.next;
            }
            if (node.next !== null) {
                node.next.prev = node.prev;
            }
            else {
                this.tail = node.prev;
            }
            delete this.map[key];
            this.size--;
        }
        /* Resets the entire cache - Argument limit is optional to be reset */
        removeAll() {
            this.size = 0;
            this.map = {};
            this.head = null;
            this.tail = null;
        }
        setHead(node) {
            node.next = this.head;
            node.prev = null;
            if (this.head !== null) {
                this.head.prev = node;
            }
            this.head = node;
            if (this.tail === null) {
                this.tail = node;
            }
            this.size++;
            this.map[node.key] = node;
        }
    }
    /**
     * A simple RW transaction for simple synchronous key-value stores.
     */
    class SimpleSyncRWTransaction {
        constructor(store) {
            this.store = store;
            /**
             * Stores data in the keys we modify prior to modifying them.
             * Allows us to roll back commits.
             */
            this.originalData = {};
            /**
             * List of keys modified in this transaction, if any.
             */
            this.modifiedKeys = [];
        }
        get(key) {
            const val = this.store.get(key);
            this.stashOldValue(key, val);
            return val;
        }
        put(key, data, overwrite) {
            this.markModified(key);
            return this.store.put(key, data, overwrite);
        }
        del(key) {
            this.markModified(key);
            this.store.del(key);
        }
        commit() { }
        abort() {
            // Rollback old values.
            for (const key of this.modifiedKeys) {
                const value = this.originalData[key];
                if (!value) {
                    // Key didn't exist.
                    this.store.del(key);
                }
                else {
                    // Key existed. Store old value.
                    this.store.put(key, value, true);
                }
            }
        }
        /**
         * Stashes given key value pair into `originalData` if it doesn't already
         * exist. Allows us to stash values the program is requesting anyway to
         * prevent needless `get` requests if the program modifies the data later
         * on during the transaction.
         */
        stashOldValue(key, value) {
            // Keep only the earliest value in the transaction.
            if (!this.originalData.hasOwnProperty(key)) {
                this.originalData[key] = value;
            }
        }
        /**
         * Marks the given key as modified, and stashes its value if it has not been
         * stashed already.
         */
        markModified(key) {
            if (this.modifiedKeys.indexOf(key) === -1) {
                this.modifiedKeys.push(key);
                if (!this.originalData.hasOwnProperty(key)) {
                    this.originalData[key] = this.store.get(key);
                }
            }
        }
    }
    class SyncKeyValueFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this.getPath(), this.getBuffer(), this.getStats());
                this.resetDirty();
            }
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * A "Synchronous key-value file system". Stores data to/retrieves data from an
     * underlying key-value store.
     *
     * We use a unique ID for each node in the file system. The root node has a
     * fixed ID.
     * @todo Introduce Node ID caching.
     * @todo Check modes.
     */
    class SyncKeyValueFileSystem extends SynchronousFileSystem {
        static isAvailable() { return true; }
        constructor(options) {
            super();
            this.store = options.store;
            // INVARIANT: Ensure that the root exists.
            this.makeRootDirectory();
        }
        getName() { return this.store.name(); }
        isReadOnly() { return false; }
        supportsSymlinks() { return false; }
        supportsProps() { return false; }
        supportsSynch() { return true; }
        /**
         * Delete all contents stored in the file system.
         */
        empty() {
            this.store.clear();
            // INVARIANT: Root always exists.
            this.makeRootDirectory();
        }
        renameSync(oldPath, newPath) {
            const tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), 
            // Remove oldPath from parent's directory listing.
            oldDirNode = this.findINode(tx, oldParent), oldDirList = this.getDirListing(tx, oldParent, oldDirNode);
            if (!oldDirList[oldName]) {
                throw ApiError.ENOENT(oldPath);
            }
            const nodeId = oldDirList[oldName];
            delete oldDirList[oldName];
            // Invariant: Can't move a folder inside itself.
            // This funny little hack ensures that the check passes only if oldPath
            // is a subpath of newParent. We append '/' to avoid matching folders that
            // are a substring of the bottom-most folder in the path.
            if ((newParent + '/').indexOf(oldPath + '/') === 0) {
                throw new ApiError(ErrorCode.EBUSY, oldParent);
            }
            // Add newPath to parent's directory listing.
            let newDirNode, newDirList;
            if (newParent === oldParent) {
                // Prevent us from re-grabbing the same directory listing, which still
                // contains oldName.
                newDirNode = oldDirNode;
                newDirList = oldDirList;
            }
            else {
                newDirNode = this.findINode(tx, newParent);
                newDirList = this.getDirListing(tx, newParent, newDirNode);
            }
            if (newDirList[newName]) {
                // If it's a file, delete it.
                const newNameNode = this.getINode(tx, newPath, newDirList[newName]);
                if (newNameNode.isFile()) {
                    try {
                        tx.del(newNameNode.id);
                        tx.del(newDirList[newName]);
                    }
                    catch (e) {
                        tx.abort();
                        throw e;
                    }
                }
                else {
                    // If it's a directory, throw a permissions error.
                    throw ApiError.EPERM(newPath);
                }
            }
            newDirList[newName] = nodeId;
            // Commit the two changed directory listings.
            try {
                tx.put(oldDirNode.id, Buffer.from(JSON.stringify(oldDirList)), true);
                tx.put(newDirNode.id, Buffer.from(JSON.stringify(newDirList)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
        }
        statSync(p, isLstat) {
            // Get the inode to the item, convert it into a Stats object.
            return this.findINode(this.store.beginTransaction('readonly'), p).toStats();
        }
        createFileSync(p, flag, mode) {
            const tx = this.store.beginTransaction('readwrite'), data = emptyBuffer(), newFile = this.commitNewFile(tx, p, FileType.FILE, mode, data);
            // Open the file.
            return new SyncKeyValueFile(this, p, flag, newFile.toStats(), data);
        }
        openFileSync(p, flag) {
            const tx = this.store.beginTransaction('readonly'), node = this.findINode(tx, p), data = tx.get(node.id);
            if (data === undefined) {
                throw ApiError.ENOENT(p);
            }
            return new SyncKeyValueFile(this, p, flag, node.toStats(), data);
        }
        unlinkSync(p) {
            this.removeEntry(p, false);
        }
        rmdirSync(p) {
            // Check first if directory is empty.
            if (this.readdirSync(p).length > 0) {
                throw ApiError.ENOTEMPTY(p);
            }
            else {
                this.removeEntry(p, true);
            }
        }
        mkdirSync(p, mode) {
            const tx = this.store.beginTransaction('readwrite'), data = Buffer.from('{}');
            this.commitNewFile(tx, p, FileType.DIRECTORY, mode, data);
        }
        readdirSync(p) {
            const tx = this.store.beginTransaction('readonly');
            return Object.keys(this.getDirListing(tx, p, this.findINode(tx, p)));
        }
        _syncSync(p, data, stats) {
            // @todo Ensure mtime updates properly, and use that to determine if a data
            //       update is required.
            const tx = this.store.beginTransaction('readwrite'), 
            // We use the _findInode helper because we actually need the INode id.
            fileInodeId = this._findINode(tx, path.dirname(p), path.basename(p)), fileInode = this.getINode(tx, p, fileInodeId), inodeChanged = fileInode.update(stats);
            try {
                // Sync data.
                tx.put(fileInode.id, data, true);
                // Sync metadata.
                if (inodeChanged) {
                    tx.put(fileInodeId, fileInode.toBuffer(), true);
                }
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
        }
        /**
         * Checks if the root directory exists. Creates it if it doesn't.
         */
        makeRootDirectory() {
            const tx = this.store.beginTransaction('readwrite');
            if (tx.get(ROOT_NODE_ID) === undefined) {
                // Create new inode.
                const currTime = (new Date()).getTime(), 
                // Mode 0666
                dirInode = new Inode(GenerateRandomID(), 4096, 511 | FileType.DIRECTORY, currTime, currTime, currTime);
                // If the root doesn't exist, the first random ID shouldn't exist,
                // either.
                tx.put(dirInode.id, getEmptyDirNode(), false);
                tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false);
                tx.commit();
            }
        }
        /**
         * Helper function for findINode.
         * @param parent The parent directory of the file we are attempting to find.
         * @param filename The filename of the inode we are attempting to find, minus
         *   the parent.
         * @return string The ID of the file's inode in the file system.
         */
        _findINode(tx, parent, filename) {
            const readDirectory = (inode) => {
                // Get the root's directory listing.
                const dirList = this.getDirListing(tx, parent, inode);
                // Get the file's ID.
                if (dirList[filename]) {
                    return dirList[filename];
                }
                else {
                    throw ApiError.ENOENT(path.resolve(parent, filename));
                }
            };
            if (parent === '/') {
                if (filename === '') {
                    // BASE CASE #1: Return the root's ID.
                    return ROOT_NODE_ID;
                }
                else {
                    // BASE CASE #2: Find the item in the root ndoe.
                    return readDirectory(this.getINode(tx, parent, ROOT_NODE_ID));
                }
            }
            else {
                return readDirectory(this.getINode(tx, parent + path.sep + filename, this._findINode(tx, path.dirname(parent), path.basename(parent))));
            }
        }
        /**
         * Finds the Inode of the given path.
         * @param p The path to look up.
         * @return The Inode of the path p.
         * @todo memoize/cache
         */
        findINode(tx, p) {
            return this.getINode(tx, p, this._findINode(tx, path.dirname(p), path.basename(p)));
        }
        /**
         * Given the ID of a node, retrieves the corresponding Inode.
         * @param tx The transaction to use.
         * @param p The corresponding path to the file (used for error messages).
         * @param id The ID to look up.
         */
        getINode(tx, p, id) {
            const inode = tx.get(id);
            if (inode === undefined) {
                throw ApiError.ENOENT(p);
            }
            return Inode.fromBuffer(inode);
        }
        /**
         * Given the Inode of a directory, retrieves the corresponding directory
         * listing.
         */
        getDirListing(tx, p, inode) {
            if (!inode.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            const data = tx.get(inode.id);
            if (data === undefined) {
                throw ApiError.ENOENT(p);
            }
            return JSON.parse(data.toString());
        }
        /**
         * Creates a new node under a random ID. Retries 5 times before giving up in
         * the exceedingly unlikely chance that we try to reuse a random GUID.
         * @return The GUID that the data was stored under.
         */
        addNewNode(tx, data) {
            const retries = 0;
            let currId;
            while (retries < 5) {
                try {
                    currId = GenerateRandomID();
                    tx.put(currId, data, false);
                    return currId;
                }
                catch (e) {
                    // Ignore and reroll.
                }
            }
            throw new ApiError(ErrorCode.EIO, 'Unable to commit data to key-value store.');
        }
        /**
         * Commits a new file (well, a FILE or a DIRECTORY) to the file system with
         * the given mode.
         * Note: This will commit the transaction.
         * @param p The path to the new file.
         * @param type The type of the new file.
         * @param mode The mode to create the new file with.
         * @param data The data to store at the file's data node.
         * @return The Inode for the new file.
         */
        commitNewFile(tx, p, type, mode, data) {
            const parentDir = path.dirname(p), fname = path.basename(p), parentNode = this.findINode(tx, parentDir), dirListing = this.getDirListing(tx, parentDir, parentNode), currTime = (new Date()).getTime();
            // Invariant: The root always exists.
            // If we don't check this prior to taking steps below, we will create a
            // file with name '' in root should p == '/'.
            if (p === '/') {
                throw ApiError.EEXIST(p);
            }
            // Check if file already exists.
            if (dirListing[fname]) {
                throw ApiError.EEXIST(p);
            }
            let fileNode;
            try {
                // Commit data.
                const dataId = this.addNewNode(tx, data);
                fileNode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                // Commit file node.
                const fileNodeId = this.addNewNode(tx, fileNode.toBuffer());
                // Update and commit parent directory listing.
                dirListing[fname] = fileNodeId;
                tx.put(parentNode.id, Buffer.from(JSON.stringify(dirListing)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
            return fileNode;
        }
        /**
         * Remove all traces of the given path from the file system.
         * @param p The path to remove from the file system.
         * @param isDir Does the path belong to a directory, or a file?
         * @todo Update mtime.
         */
        removeEntry(p, isDir) {
            const tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), parentNode = this.findINode(tx, parent), parentListing = this.getDirListing(tx, parent, parentNode), fileName = path.basename(p);
            if (!parentListing[fileName]) {
                throw ApiError.ENOENT(p);
            }
            // Remove from directory listing of parent.
            const fileNodeId = parentListing[fileName];
            delete parentListing[fileName];
            // Get file inode.
            const fileNode = this.getINode(tx, p, fileNodeId);
            if (!isDir && fileNode.isDirectory()) {
                throw ApiError.EISDIR(p);
            }
            else if (isDir && !fileNode.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            try {
                // Delete data.
                tx.del(fileNode.id);
                // Delete node.
                tx.del(fileNodeId);
                // Update directory listing.
                tx.put(parentNode.id, Buffer.from(JSON.stringify(parentListing)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            // Success.
            tx.commit();
        }
    }
    class AsyncKeyValueFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        sync(cb) {
            if (this.isDirty()) {
                this._fs._sync(this.getPath(), this.getBuffer(), this.getStats(), (e) => {
                    if (!e) {
                        this.resetDirty();
                    }
                    cb(e);
                });
            }
            else {
                cb();
            }
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * An "Asynchronous key-value file system". Stores data to/retrieves data from
     * an underlying asynchronous key-value store.
     */
    class AsyncKeyValueFileSystem extends BaseFileSystem {
        constructor(cacheSize) {
            super();
            this._cache = null;
            if (cacheSize > 0) {
                this._cache = new LRUCache(cacheSize);
            }
        }
        static isAvailable() { return true; }
        /**
         * Initializes the file system. Typically called by subclasses' async
         * constructors.
         */
        init(store, cb) {
            this.store = store;
            // INVARIANT: Ensure that the root exists.
            this.makeRootDirectory(cb);
        }
        getName() { return this.store.name(); }
        isReadOnly() { return false; }
        supportsSymlinks() { return false; }
        supportsProps() { return false; }
        supportsSynch() { return false; }
        /**
         * Delete all contents stored in the file system.
         */
        empty(cb) {
            if (this._cache) {
                this._cache.removeAll();
            }
            this.store.clear((e) => {
                if (noError(e, cb)) {
                    // INVARIANT: Root always exists.
                    this.makeRootDirectory(cb);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            // TODO: Make rename compatible with the cache.
            if (this._cache) {
                // Clear and disable cache during renaming process.
                const c = this._cache;
                this._cache = null;
                c.removeAll();
                const oldCb = cb;
                cb = (e) => {
                    // Restore empty cache.
                    this._cache = c;
                    oldCb(e);
                };
            }
            const tx = this.store.beginTransaction('readwrite');
            const oldParent = path.dirname(oldPath), oldName = path.basename(oldPath);
            const newParent = path.dirname(newPath), newName = path.basename(newPath);
            const inodes = {};
            const lists = {};
            let errorOccurred = false;
            // Invariant: Can't move a folder inside itself.
            // This funny little hack ensures that the check passes only if oldPath
            // is a subpath of newParent. We append '/' to avoid matching folders that
            // are a substring of the bottom-most folder in the path.
            if ((newParent + '/').indexOf(oldPath + '/') === 0) {
                return cb(new ApiError(ErrorCode.EBUSY, oldParent));
            }
            /**
             * Responsible for Phase 2 of the rename operation: Modifying and
             * committing the directory listings. Called once we have successfully
             * retrieved both the old and new parent's inodes and listings.
             */
            const theOleSwitcharoo = () => {
                // Sanity check: Ensure both paths are present, and no error has occurred.
                if (errorOccurred || !lists.hasOwnProperty(oldParent) || !lists.hasOwnProperty(newParent)) {
                    return;
                }
                const oldParentList = lists[oldParent], oldParentINode = inodes[oldParent], newParentList = lists[newParent], newParentINode = inodes[newParent];
                // Delete file from old parent.
                if (!oldParentList[oldName]) {
                    cb(ApiError.ENOENT(oldPath));
                }
                else {
                    const fileId = oldParentList[oldName];
                    delete oldParentList[oldName];
                    // Finishes off the renaming process by adding the file to the new
                    // parent.
                    const completeRename = () => {
                        newParentList[newName] = fileId;
                        // Commit old parent's list.
                        tx.put(oldParentINode.id, Buffer.from(JSON.stringify(oldParentList)), true, (e) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (oldParent === newParent) {
                                    // DONE!
                                    tx.commit(cb);
                                }
                                else {
                                    // Commit new parent's list.
                                    tx.put(newParentINode.id, Buffer.from(JSON.stringify(newParentList)), true, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(cb);
                                        }
                                    });
                                }
                            }
                        });
                    };
                    if (newParentList[newName]) {
                        // 'newPath' already exists. Check if it's a file or a directory, and
                        // act accordingly.
                        this.getINode(tx, newPath, newParentList[newName], (e, inode) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (inode.isFile()) {
                                    // Delete the file and continue.
                                    tx.del(inode.id, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.del(newParentList[newName], (e) => {
                                                if (noErrorTx(e, tx, cb)) {
                                                    completeRename();
                                                }
                                            });
                                        }
                                    });
                                }
                                else {
                                    // Can't overwrite a directory using rename.
                                    tx.abort((e) => {
                                        cb(ApiError.EPERM(newPath));
                                    });
                                }
                            }
                        });
                    }
                    else {
                        completeRename();
                    }
                }
            };
            /**
             * Grabs a path's inode and directory listing, and shoves it into the
             * inodes and lists hashes.
             */
            const processInodeAndListings = (p) => {
                this.findINodeAndDirListing(tx, p, (e, node, dirList) => {
                    if (e) {
                        if (!errorOccurred) {
                            errorOccurred = true;
                            tx.abort(() => {
                                cb(e);
                            });
                        }
                        // If error has occurred already, just stop here.
                    }
                    else {
                        inodes[p] = node;
                        lists[p] = dirList;
                        theOleSwitcharoo();
                    }
                });
            };
            processInodeAndListings(oldParent);
            if (oldParent !== newParent) {
                processInodeAndListings(newParent);
            }
        }
        stat(p, isLstat, cb) {
            const tx = this.store.beginTransaction('readonly');
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    cb(null, inode.toStats());
                }
            });
        }
        createFile(p, flag, mode, cb) {
            const tx = this.store.beginTransaction('readwrite'), data = emptyBuffer();
            this.commitNewFile(tx, p, FileType.FILE, mode, data, (e, newFile) => {
                if (noError(e, cb)) {
                    cb(null, new AsyncKeyValueFile(this, p, flag, newFile.toStats(), data));
                }
            });
        }
        openFile(p, flag, cb) {
            const tx = this.store.beginTransaction('readonly');
            // Step 1: Grab the file's inode.
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    // Step 2: Grab the file's data.
                    tx.get(inode.id, (e, data) => {
                        if (noError(e, cb)) {
                            if (data === undefined) {
                                cb(ApiError.ENOENT(p));
                            }
                            else {
                                cb(null, new AsyncKeyValueFile(this, p, flag, inode.toStats(), data));
                            }
                        }
                    });
                }
            });
        }
        unlink(p, cb) {
            this.removeEntry(p, false, cb);
        }
        rmdir(p, cb) {
            // Check first if directory is empty.
            this.readdir(p, (err, files) => {
                if (err) {
                    cb(err);
                }
                else if (files.length > 0) {
                    cb(ApiError.ENOTEMPTY(p));
                }
                else {
                    this.removeEntry(p, true, cb);
                }
            });
        }
        mkdir(p, mode, cb) {
            const tx = this.store.beginTransaction('readwrite'), data = Buffer.from('{}');
            this.commitNewFile(tx, p, FileType.DIRECTORY, mode, data, cb);
        }
        readdir(p, cb) {
            const tx = this.store.beginTransaction('readonly');
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    this.getDirListing(tx, p, inode, (e, dirListing) => {
                        if (noError(e, cb)) {
                            cb(null, Object.keys(dirListing));
                        }
                    });
                }
            });
        }
        _sync(p, data, stats, cb) {
            // @todo Ensure mtime updates properly, and use that to determine if a data
            //       update is required.
            const tx = this.store.beginTransaction('readwrite');
            // Step 1: Get the file node's ID.
            this._findINode(tx, path.dirname(p), path.basename(p), (e, fileInodeId) => {
                if (noErrorTx(e, tx, cb)) {
                    // Step 2: Get the file inode.
                    this.getINode(tx, p, fileInodeId, (e, fileInode) => {
                        if (noErrorTx(e, tx, cb)) {
                            const inodeChanged = fileInode.update(stats);
                            // Step 3: Sync the data.
                            tx.put(fileInode.id, data, true, (e) => {
                                if (noErrorTx(e, tx, cb)) {
                                    // Step 4: Sync the metadata (if it changed)!
                                    if (inodeChanged) {
                                        tx.put(fileInodeId, fileInode.toBuffer(), true, (e) => {
                                            if (noErrorTx(e, tx, cb)) {
                                                tx.commit(cb);
                                            }
                                        });
                                    }
                                    else {
                                        // No need to sync metadata; return.
                                        tx.commit(cb);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        /**
         * Checks if the root directory exists. Creates it if it doesn't.
         */
        makeRootDirectory(cb) {
            const tx = this.store.beginTransaction('readwrite');
            tx.get(ROOT_NODE_ID, (e, data) => {
                if (e || data === undefined) {
                    // Create new inode.
                    const currTime = (new Date()).getTime(), 
                    // Mode 0666
                    dirInode = new Inode(GenerateRandomID(), 4096, 511 | FileType.DIRECTORY, currTime, currTime, currTime);
                    // If the root doesn't exist, the first random ID shouldn't exist,
                    // either.
                    tx.put(dirInode.id, getEmptyDirNode(), false, (e) => {
                        if (noErrorTx(e, tx, cb)) {
                            tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false, (e) => {
                                if (e) {
                                    tx.abort(() => { cb(e); });
                                }
                                else {
                                    tx.commit(cb);
                                }
                            });
                        }
                    });
                }
                else {
                    // We're good.
                    tx.commit(cb);
                }
            });
        }
        /**
         * Helper function for findINode.
         * @param parent The parent directory of the file we are attempting to find.
         * @param filename The filename of the inode we are attempting to find, minus
         *   the parent.
         * @param cb Passed an error or the ID of the file's inode in the file system.
         */
        _findINode(tx, parent, filename, cb) {
            if (this._cache) {
                const id = this._cache.get(path.join(parent, filename));
                if (id) {
                    return cb(null, id);
                }
            }
            const handleDirectoryListings = (e, inode, dirList) => {
                if (e) {
                    cb(e);
                }
                else if (dirList[filename]) {
                    const id = dirList[filename];
                    if (this._cache) {
                        this._cache.set(path.join(parent, filename), id);
                    }
                    cb(null, id);
                }
                else {
                    cb(ApiError.ENOENT(path.resolve(parent, filename)));
                }
            };
            if (parent === '/') {
                if (filename === '') {
                    // BASE CASE #1: Return the root's ID.
                    if (this._cache) {
                        this._cache.set(path.join(parent, filename), ROOT_NODE_ID);
                    }
                    cb(null, ROOT_NODE_ID);
                }
                else {
                    // BASE CASE #2: Find the item in the root node.
                    this.getINode(tx, parent, ROOT_NODE_ID, (e, inode) => {
                        if (noError(e, cb)) {
                            this.getDirListing(tx, parent, inode, (e, dirList) => {
                                // handle_directory_listings will handle e for us.
                                handleDirectoryListings(e, inode, dirList);
                            });
                        }
                    });
                }
            }
            else {
                // Get the parent directory's INode, and find the file in its directory
                // listing.
                this.findINodeAndDirListing(tx, parent, handleDirectoryListings);
            }
        }
        /**
         * Finds the Inode of the given path.
         * @param p The path to look up.
         * @param cb Passed an error or the Inode of the path p.
         * @todo memoize/cache
         */
        findINode(tx, p, cb) {
            this._findINode(tx, path.dirname(p), path.basename(p), (e, id) => {
                if (noError(e, cb)) {
                    this.getINode(tx, p, id, cb);
                }
            });
        }
        /**
         * Given the ID of a node, retrieves the corresponding Inode.
         * @param tx The transaction to use.
         * @param p The corresponding path to the file (used for error messages).
         * @param id The ID to look up.
         * @param cb Passed an error or the inode under the given id.
         */
        getINode(tx, p, id, cb) {
            tx.get(id, (e, data) => {
                if (noError(e, cb)) {
                    if (data === undefined) {
                        cb(ApiError.ENOENT(p));
                    }
                    else {
                        cb(null, Inode.fromBuffer(data));
                    }
                }
            });
        }
        /**
         * Given the Inode of a directory, retrieves the corresponding directory
         * listing.
         */
        getDirListing(tx, p, inode, cb) {
            if (!inode.isDirectory()) {
                cb(ApiError.ENOTDIR(p));
            }
            else {
                tx.get(inode.id, (e, data) => {
                    if (noError(e, cb)) {
                        try {
                            cb(null, JSON.parse(data.toString()));
                        }
                        catch (e) {
                            // Occurs when data is undefined, or corresponds to something other
                            // than a directory listing. The latter should never occur unless
                            // the file system is corrupted.
                            cb(ApiError.ENOENT(p));
                        }
                    }
                });
            }
        }
        /**
         * Given a path to a directory, retrieves the corresponding INode and
         * directory listing.
         */
        findINodeAndDirListing(tx, p, cb) {
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    this.getDirListing(tx, p, inode, (e, listing) => {
                        if (noError(e, cb)) {
                            cb(null, inode, listing);
                        }
                    });
                }
            });
        }
        /**
         * Adds a new node under a random ID. Retries 5 times before giving up in
         * the exceedingly unlikely chance that we try to reuse a random GUID.
         * @param cb Passed an error or the GUID that the data was stored under.
         */
        addNewNode(tx, data, cb) {
            let retries = 0, currId;
            const reroll = () => {
                if (++retries === 5) {
                    // Max retries hit. Return with an error.
                    cb(new ApiError(ErrorCode.EIO, 'Unable to commit data to key-value store.'));
                }
                else {
                    // Try again.
                    currId = GenerateRandomID();
                    tx.put(currId, data, false, (e, committed) => {
                        if (e || !committed) {
                            reroll();
                        }
                        else {
                            // Successfully stored under 'currId'.
                            cb(null, currId);
                        }
                    });
                }
            };
            reroll();
        }
        /**
         * Commits a new file (well, a FILE or a DIRECTORY) to the file system with
         * the given mode.
         * Note: This will commit the transaction.
         * @param p The path to the new file.
         * @param type The type of the new file.
         * @param mode The mode to create the new file with.
         * @param data The data to store at the file's data node.
         * @param cb Passed an error or the Inode for the new file.
         */
        commitNewFile(tx, p, type, mode, data, cb) {
            const parentDir = path.dirname(p), fname = path.basename(p), currTime = (new Date()).getTime();
            // Invariant: The root always exists.
            // If we don't check this prior to taking steps below, we will create a
            // file with name '' in root should p == '/'.
            if (p === '/') {
                return cb(ApiError.EEXIST(p));
            }
            // Let's build a pyramid of code!
            // Step 1: Get the parent directory's inode and directory listing
            this.findINodeAndDirListing(tx, parentDir, (e, parentNode, dirListing) => {
                if (noErrorTx(e, tx, cb)) {
                    if (dirListing[fname]) {
                        // File already exists.
                        tx.abort(() => {
                            cb(ApiError.EEXIST(p));
                        });
                    }
                    else {
                        // Step 2: Commit data to store.
                        this.addNewNode(tx, data, (e, dataId) => {
                            if (noErrorTx(e, tx, cb)) {
                                // Step 3: Commit the file's inode to the store.
                                const fileInode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                                this.addNewNode(tx, fileInode.toBuffer(), (e, fileInodeId) => {
                                    if (noErrorTx(e, tx, cb)) {
                                        // Step 4: Update parent directory's listing.
                                        dirListing[fname] = fileInodeId;
                                        tx.put(parentNode.id, Buffer.from(JSON.stringify(dirListing)), true, (e) => {
                                            if (noErrorTx(e, tx, cb)) {
                                                // Step 5: Commit and return the new inode.
                                                tx.commit((e) => {
                                                    if (noErrorTx(e, tx, cb)) {
                                                        cb(null, fileInode);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
        /**
         * Remove all traces of the given path from the file system.
         * @param p The path to remove from the file system.
         * @param isDir Does the path belong to a directory, or a file?
         * @todo Update mtime.
         */
        removeEntry(p, isDir, cb) {
            // Eagerly delete from cache (harmless even if removal fails)
            if (this._cache) {
                this._cache.remove(p);
            }
            const tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), fileName = path.basename(p);
            // Step 1: Get parent directory's node and directory listing.
            this.findINodeAndDirListing(tx, parent, (e, parentNode, parentListing) => {
                if (noErrorTx(e, tx, cb)) {
                    if (!parentListing[fileName]) {
                        tx.abort(() => {
                            cb(ApiError.ENOENT(p));
                        });
                    }
                    else {
                        // Remove from directory listing of parent.
                        const fileNodeId = parentListing[fileName];
                        delete parentListing[fileName];
                        // Step 2: Get file inode.
                        this.getINode(tx, p, fileNodeId, (e, fileNode) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (!isDir && fileNode.isDirectory()) {
                                    tx.abort(() => {
                                        cb(ApiError.EISDIR(p));
                                    });
                                }
                                else if (isDir && !fileNode.isDirectory()) {
                                    tx.abort(() => {
                                        cb(ApiError.ENOTDIR(p));
                                    });
                                }
                                else {
                                    // Step 3: Delete data.
                                    tx.del(fileNode.id, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            // Step 4: Delete node.
                                            tx.del(fileNodeId, (e) => {
                                                if (noErrorTx(e, tx, cb)) {
                                                    // Step 5: Update directory listing.
                                                    tx.put(parentNode.id, Buffer.from(JSON.stringify(parentListing)), true, (e) => {
                                                        if (noErrorTx(e, tx, cb)) {
                                                            tx.commit(cb);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    }


    return {
        SimpleSyncRWTransaction: SimpleSyncRWTransaction,
        SyncKeyValueFile: SyncKeyValueFile,
        SyncKeyValueFileSystem: SyncKeyValueFileSystem,
        AsyncKeyValueFile: AsyncKeyValueFile,
        AsyncKeyValueFileSystem: AsyncKeyValueFileSystem
    };
});
define('skylark-browserfs/backend/InMemory',['../generic/key_value_filesystem'], function (key_value_filesystem) {
    'use strict';

    const { SimpleSyncRWTransaction, SyncKeyValueFileSystem } = key_value_filesystem;
    /**
     * A simple in-memory key-value store backed by a JavaScript object.
     */
    class InMemoryStore {
        constructor() {
            this.store = {};
        }
        name() { return InMemoryFileSystem.Name; }
        clear() { this.store = {}; }
        beginTransaction(type) {
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            return this.store[key];
        }
        put(key, data, overwrite) {
            if (!overwrite && this.store.hasOwnProperty(key)) {
                return false;
            }
            this.store[key] = data;
            return true;
        }
        del(key) {
            delete this.store[key];
        }
    }
    /**
     * A simple in-memory file system backed by an InMemoryStore.
     * Files are not persisted across page loads.
     */
    class InMemoryFileSystem extends SyncKeyValueFileSystem {
        constructor() {
            super({ store: new InMemoryStore() });
        }
        /**
         * Creates an InMemoryFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new InMemoryFileSystem());
        }
    }
    InMemoryFileSystem.Name = "InMemory";
    InMemoryFileSystem.Options = {};

    InMemoryFileSystem.InMemoryStore = InMemoryStore;

    return InMemoryFileSystem;
});
define('skylark-browserfs/backend/IndexedDB',[
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global',
    '../core/util'
], function (key_value_filesystem, api_error, global, util) {
    'use strict';
    const { AsyncKeyValueFileSystem } =  key_value_filesystem;
    const { ApiError, ErrorCode }  = api_error;
    const { arrayBuffer2Buffer, buffer2ArrayBuffer }  = util;

    /**
     * Get the indexedDB constructor for the current browser.
     * @hidden
     */
    const indexedDB = global.indexedDB ||
        global.mozIndexedDB ||
        global.webkitIndexedDB ||
        global.msIndexedDB;
    /**
     * Converts a DOMException or a DOMError from an IndexedDB event into a
     * standardized BrowserFS API error.
     * @hidden
     */
    function convertError(e, message = e.toString()) {
        switch (e.name) {
            case "NotFoundError":
                return new ApiError(ErrorCode.ENOENT, message);
            case "QuotaExceededError":
                return new ApiError(ErrorCode.ENOSPC, message);
            default:
                // The rest do not seem to map cleanly to standard error codes.
                return new ApiError(ErrorCode.EIO, message);
        }
    }
    /**
     * Produces a new onerror handler for IDB. Our errors are always fatal, so we
     * handle them generically: Call the user-supplied callback with a translated
     * version of the error, and let the error bubble up.
     * @hidden
     */
    function onErrorHandler(cb, code = ErrorCode.EIO, message = null) {
        return function (e) {
            // Prevent the error from canceling the transaction.
            e.preventDefault();
            cb(new ApiError(code, message !== null ? message : undefined));
        };
    }
    /**
     * @hidden
     */
    class IndexedDBROTransaction {
        constructor(tx, store) {
            this.tx = tx;
            this.store = store;
        }
        get(key, cb) {
            try {
                const r = this.store.get(key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    // IDB returns the value 'undefined' when you try to get keys that
                    // don't exist. The caller expects this behavior.
                    const result = event.target.result;
                    if (result === undefined) {
                        cb(null, result);
                    }
                    else {
                        // IDB data is stored as an ArrayBuffer
                        cb(null, arrayBuffer2Buffer(result));
                    }
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
    }
    /**
     * @hidden
     */
    class IndexedDBRWTransaction extends IndexedDBROTransaction {
        constructor(tx, store) {
            super(tx, store);
        }
        put(key, data, overwrite, cb) {
            try {
                const arraybuffer = buffer2ArrayBuffer(data);
                let r;
                // Note: 'add' will never overwrite an existing key.
                r = overwrite ? this.store.put(arraybuffer, key) : this.store.add(arraybuffer, key);
                // XXX: NEED TO RETURN FALSE WHEN ADD HAS A KEY CONFLICT. NO ERROR.
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb(null, true);
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        del(key, cb) {
            try {
                // NOTE: IE8 has a bug with identifiers named 'delete' unless used as a string
                // like this.
                // http://stackoverflow.com/a/26479152
                const r = this.store['delete'](key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb();
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        commit(cb) {
            // Return to the event loop to commit the transaction.
            setTimeout(cb, 0);
        }
        abort(cb) {
            let _e = null;
            try {
                this.tx.abort();
            }
            catch (e) {
                _e = convertError(e);
            }
            finally {
                cb(_e);
            }
        }
    }
    class IndexedDBStore {
        constructor(db, storeName) {
            this.db = db;
            this.storeName = storeName;
        }
        static Create(storeName, cb) {
            const openReq = indexedDB.open(storeName, 1);
            openReq.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Huh. This should never happen; we're at version 1. Why does another
                // database exist?
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                }
                db.createObjectStore(storeName);
            };
            openReq.onsuccess = (event) => {
                cb(null, new IndexedDBStore(event.target.result, storeName));
            };
            openReq.onerror = onErrorHandler(cb, ErrorCode.EACCES);
        }
        name() {
            return IndexedDBFileSystem.Name + " - " + this.storeName;
        }
        clear(cb) {
            try {
                const tx = this.db.transaction(this.storeName, 'readwrite'), objectStore = tx.objectStore(this.storeName), r = objectStore.clear();
                r.onsuccess = (event) => {
                    // Use setTimeout to commit transaction.
                    setTimeout(cb, 0);
                };
                r.onerror = onErrorHandler(cb);
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        beginTransaction(type = 'readonly') {
            const tx = this.db.transaction(this.storeName, type), objectStore = tx.objectStore(this.storeName);
            if (type === 'readwrite') {
                return new IndexedDBRWTransaction(tx, objectStore);
            }
            else if (type === 'readonly') {
                return new IndexedDBROTransaction(tx, objectStore);
            }
            else {
                throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
            }
        }
    }
    /**
     * A file system that uses the IndexedDB key value file system.
     */
    class IndexedDBFileSystem extends AsyncKeyValueFileSystem {
        constructor(cacheSize) {
            super(cacheSize);
        }
        /**
         * Constructs an IndexedDB file system with the given options.
         */
        static Create(opts = {}, cb) {
            IndexedDBStore.Create(opts.storeName ? opts.storeName : 'browserfs', (e, store) => {
                if (store) {
                    const idbfs = new IndexedDBFileSystem(typeof (opts.cacheSize) === 'number' ? opts.cacheSize : 100);
                    idbfs.init(store, (e) => {
                        if (e) {
                            cb(e);
                        }
                        else {
                            cb(null, idbfs);
                        }
                    });
                }
                else {
                    cb(e);
                }
            });
        }
        static isAvailable() {
            // In Safari's private browsing mode, indexedDB.open returns NULL.
            // In Firefox, it throws an exception.
            // In Chrome, it "just works", and clears the database when you leave the page.
            // Untested: Opera, IE.
            try {
                return typeof indexedDB !== 'undefined' && null !== indexedDB.open("__browserfs_test__");
            }
            catch (e) {
                return false;
            }
        }
    }
    IndexedDBFileSystem.Name = "IndexedDB";
    IndexedDBFileSystem.Options = {
        storeName: {
            type: "string",
            optional: true,
            description: "The name of this file system. You can have multiple IndexedDB file systems operating at once, but each must have a different name."
        },
        cacheSize: {
            type: "number",
            optional: true,
            description: "The size of the inode cache. Defaults to 100. A size of 0 or below disables caching."
        }
    };


    IndexedDBFileSystem.IndexedDBROTransaction = IndexedDBROTransaction;
    IndexedDBFileSystem.IndexedDBRWTransaction = IndexedDBRWTransaction;
    IndexedDBFileSystem.IndexedDBStore = IndexedDBStore;

    return IndexedDBFileSystem;
});
define('skylark-browserfs/backend/LocalStorage',[
    '../libs/buffers',
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global'
], function (buffers,key_value_filesystem, api_error, global) {
    'use strict';

    const { SyncKeyValueFileSystem, SimpleSyncRWTransaction } = key_value_filesystem;
    const { ApiError, ErrorCode } = api_error;

    const { Buffer} = buffers;

    /**
     * Some versions of FF and all versions of IE do not support the full range of
     * 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
     * @url http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
     * @hidden
     */
    let supportsBinaryString = false, binaryEncoding;
    try {
        global.localStorage.setItem("__test__", String.fromCharCode(0xD800));
        supportsBinaryString = global.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
    }
    catch (e) {
        // IE throws an exception.
        supportsBinaryString = false;
    }
    binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';
    if (!Buffer.isEncoding(binaryEncoding)) {
        // Fallback for non BrowserFS implementations of buffer that lack a
        // binary_string format.
        binaryEncoding = "base64";
    }
    /**
     * A synchronous key-value store backed by localStorage.
     */
    class LocalStorageStore {
        name() {
            return LocalStorageFileSystem.Name;
        }
        clear() {
            global.localStorage.clear();
        }
        beginTransaction(type) {
            // No need to differentiate.
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            try {
                const data = global.localStorage.getItem(key);
                if (data !== null) {
                    return Buffer.from(data, binaryEncoding);
                }
            }
            catch (e) {
                // Do nothing.
            }
            // Key doesn't exist, or a failure occurred.
            return undefined;
        }
        put(key, data, overwrite) {
            try {
                if (!overwrite && global.localStorage.getItem(key) !== null) {
                    // Don't want to overwrite the key!
                    return false;
                }
                global.localStorage.setItem(key, data.toString(binaryEncoding));
                return true;
            }
            catch (e) {
                throw new ApiError(ErrorCode.ENOSPC, "LocalStorage is full.");
            }
        }
        del(key) {
            try {
                global.localStorage.removeItem(key);
            }
            catch (e) {
                throw new ApiError(ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
            }
        }
    }
    /**
     * A synchronous file system backed by localStorage. Connects our
     * LocalStorageStore to our SyncKeyValueFileSystem.
     */
    class LocalStorageFileSystem extends SyncKeyValueFileSystem {
        /**
         * Creates a new LocalStorage file system using the contents of `localStorage`.
         */
        constructor() { super({ store: new LocalStorageStore() }); }
        /**
         * Creates a LocalStorageFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new LocalStorageFileSystem());
        }
        static isAvailable() {
            return typeof global.localStorage !== 'undefined';
        }
    }
    LocalStorageFileSystem.Name = "LocalStorage";
    LocalStorageFileSystem.Options = {};
    
    LocalStorageFileSystem.LocalStorageStore = LocalStorageStore;

    return LocalStorageFileSystem;
});
define('skylark-browserfs/backend/MountableFileSystem',[
    '../core/file_system',
    './InMemory',
    '../core/api_error',
    '../core/node_fs',
    '../libs/path',
    '../core/util'
], function (file_system, InMemory, api_error, fs, path, util) {
    'use strict';
    const { BaseFileSystem } = file_system;
    const {InMemoryFileSystem}  = InMemory;
    const { ApiError, ErrorCode }  = api_error;
    const { mkdirpSync }  = util;

    /**
     * The MountableFileSystem allows you to mount multiple backend types or
     * multiple instantiations of the same backend into a single file system tree.
     * The file systems do not need to know about each other; all interactions are
     * automatically facilitated through this interface.
     *
     * For example, if a file system is mounted at /mnt/blah, and a request came in
     * for /mnt/blah/foo.txt, the file system would see a request for /foo.txt.
     *
     * You can mount file systems when you configure the file system:
     * ```javascript
     * BrowserFS.configure({
     *   fs: "MountableFileSystem",
     *   options: {
     *     '/data': { fs: 'HTTPRequest', options: { index: "http://mysite.com/files/index.json" } },
     *     '/home': { fs: 'LocalStorage' }
     *   }
     * }, function(e) {
     *
     * });
     * ```
     *
     * For advanced users, you can also mount file systems *after* MFS is constructed:
     * ```javascript
     * BrowserFS.FileSystem.HTTPRequest.Create({
     *   index: "http://mysite.com/files/index.json"
     * }, function(e, xhrfs) {
     *   BrowserFS.FileSystem.MountableFileSystem.Create({
     *     '/data': xhrfs
     *   }, function(e, mfs) {
     *     BrowserFS.initialize(mfs);
     *
     *     // Added after-the-fact...
     *     BrowserFS.FileSystem.LocalStorage.Create(function(e, lsfs) {
     *       mfs.mount('/home', lsfs);
     *     });
     *   });
     * });
     * ```
     *
     * Since MountableFileSystem simply proxies requests to mounted file systems, it supports all of the operations that the mounted file systems support.
     *
     * With no mounted file systems, `MountableFileSystem` acts as a simple `InMemory` filesystem.
     */
    class MountableFileSystem extends BaseFileSystem {
        /**
         * Creates a new, empty MountableFileSystem.
         */
        constructor(rootFs) {
            super();
            // Contains the list of mount points in mntMap, sorted by string length in decreasing order.
            // Ensures that we scan the most specific mount points for a match first, which lets us
            // nest mount points.
            this.mountList = [];
            this.mntMap = {};
            this.rootFs = rootFs;
        }
        /**
         * Creates a MountableFileSystem instance with the given options.
         */
        static Create(opts, cb) {
            InMemoryFileSystem.Create({}, (e, imfs) => {
                if (imfs) {
                    const fs = new MountableFileSystem(imfs);
                    try {
                        Object.keys(opts).forEach((mountPoint) => {
                            fs.mount(mountPoint, opts[mountPoint]);
                        });
                    }
                    catch (e) {
                        return cb(e);
                    }
                    cb(null, fs);
                }
                else {
                    cb(e);
                }
            });
        }
        static isAvailable() {
            return true;
        }
        /**
         * Mounts the file system at the given mount point.
         */
        mount(mountPoint, fs) {
            if (mountPoint[0] !== '/') {
                mountPoint = `/${mountPoint}`;
            }
            mountPoint = path.resolve(mountPoint);
            if (this.mntMap[mountPoint]) {
                throw new ApiError(ErrorCode.EINVAL, "Mount point " + mountPoint + " is already taken.");
            }
            mkdirpSync(mountPoint, 0x1ff, this.rootFs);
            this.mntMap[mountPoint] = fs;
            this.mountList.push(mountPoint);
            this.mountList = this.mountList.sort((a, b) => b.length - a.length);
        }
        umount(mountPoint) {
            if (mountPoint[0] !== '/') {
                mountPoint = `/${mountPoint}`;
            }
            mountPoint = path.resolve(mountPoint);
            if (!this.mntMap[mountPoint]) {
                throw new ApiError(ErrorCode.EINVAL, "Mount point " + mountPoint + " is already unmounted.");
            }
            delete this.mntMap[mountPoint];
            this.mountList.splice(this.mountList.indexOf(mountPoint), 1);
            while (mountPoint !== '/') {
                if (this.rootFs.readdirSync(mountPoint).length === 0) {
                    this.rootFs.rmdirSync(mountPoint);
                    mountPoint = path.dirname(mountPoint);
                }
                else {
                    break;
                }
            }
        }
        /**
         * Returns the file system that the path points to.
         */
        _getFs(path) {
            const mountList = this.mountList, len = mountList.length;
            for (let i = 0; i < len; i++) {
                const mountPoint = mountList[i];
                // We know path is normalized, so it is a substring of the mount point.
                if (mountPoint.length <= path.length && path.indexOf(mountPoint) === 0) {
                    path = path.substr(mountPoint.length > 1 ? mountPoint.length : 0);
                    if (path === '') {
                        path = '/';
                    }
                    return { fs: this.mntMap[mountPoint], path: path, mountPoint: mountPoint };
                }
            }
            // Query our root file system.
            return { fs: this.rootFs, path: path, mountPoint: '/' };
        }
        // Global information methods
        getName() {
            return MountableFileSystem.Name;
        }
        diskSpace(path, cb) {
            cb(0, 0);
        }
        isReadOnly() {
            return false;
        }
        supportsLinks() {
            // I'm not ready for cross-FS links yet.
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return true;
        }
        /**
         * Fixes up error messages so they mention the mounted file location relative
         * to the MFS root, not to the particular FS's root.
         * Mutates the input error, and returns it.
         */
        standardizeError(err, path, realPath) {
            const index = err.message.indexOf(path);
            if (index !== -1) {
                err.message = err.message.substr(0, index) + realPath + err.message.substr(index + path.length);
                err.path = realPath;
            }
            return err;
        }
        // The following methods involve multiple file systems, and thus have custom
        // logic.
        // Note that we go through the Node API to use its robust default argument
        // processing.
        rename(oldPath, newPath, cb) {
            // Scenario 1: old and new are on same FS.
            const fs1rv = this._getFs(oldPath);
            const fs2rv = this._getFs(newPath);
            if (fs1rv.fs === fs2rv.fs) {
                return fs1rv.fs.rename(fs1rv.path, fs2rv.path, (e) => {
                    if (e) {
                        this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                    }
                    cb(e);
                });
            }
            // Scenario 2: Different file systems.
            // Read old file, write new file, delete old file.
            return fs.readFile(oldPath, function (err, data) {
                if (err) {
                    return cb(err);
                }
                fs.writeFile(newPath, data, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    fs.unlink(oldPath, cb);
                });
            });
        }
        renameSync(oldPath, newPath) {
            // Scenario 1: old and new are on same FS.
            const fs1rv = this._getFs(oldPath);
            const fs2rv = this._getFs(newPath);
            if (fs1rv.fs === fs2rv.fs) {
                try {
                    return fs1rv.fs.renameSync(fs1rv.path, fs2rv.path);
                }
                catch (e) {
                    this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                    throw e;
                }
            }
            // Scenario 2: Different file systems.
            const data = fs.readFileSync(oldPath);
            fs.writeFileSync(newPath, data);
            return fs.unlinkSync(oldPath);
        }
        readdirSync(p) {
            const fsInfo = this._getFs(p);
            // If null, rootfs did not have the directory
            // (or the target FS is the root fs).
            let rv = null;
            // Mount points are all defined in the root FS.
            // Ensure that we list those, too.
            if (fsInfo.fs !== this.rootFs) {
                try {
                    rv = this.rootFs.readdirSync(p);
                }
                catch (e) {
                    // Ignore.
                }
            }
            try {
                const rv2 = fsInfo.fs.readdirSync(fsInfo.path);
                if (rv === null) {
                    return rv2;
                }
                else {
                    // Filter out duplicates.
                    return rv2.concat(rv.filter((val) => rv2.indexOf(val) === -1));
                }
            }
            catch (e) {
                if (rv === null) {
                    throw this.standardizeError(e, fsInfo.path, p);
                }
                else {
                    // The root FS had something.
                    return rv;
                }
            }
        }
        readdir(p, cb) {
            const fsInfo = this._getFs(p);
            fsInfo.fs.readdir(fsInfo.path, (err, files) => {
                if (fsInfo.fs !== this.rootFs) {
                    try {
                        const rv = this.rootFs.readdirSync(p);
                        if (files) {
                            // Filter out duplicates.
                            files = files.concat(rv.filter((val) => files.indexOf(val) === -1));
                        }
                        else {
                            files = rv;
                        }
                    }
                    catch (e) {
                        // Root FS and target FS did not have directory.
                        if (err) {
                            return cb(this.standardizeError(err, fsInfo.path, p));
                        }
                    }
                }
                else if (err) {
                    // Root FS and target FS are the same, and did not have directory.
                    return cb(this.standardizeError(err, fsInfo.path, p));
                }
                cb(null, files);
            });
        }
        realpathSync(p, cache) {
            const fsInfo = this._getFs(p);
            try {
                const mountedPath = fsInfo.fs.realpathSync(fsInfo.path, {});
                // resolve is there to remove any trailing slash that may be present
                return path.resolve(path.join(fsInfo.mountPoint, mountedPath));
            }
            catch (e) {
                throw this.standardizeError(e, fsInfo.path, p);
            }
        }
        realpath(p, cache, cb) {
            const fsInfo = this._getFs(p);
            fsInfo.fs.realpath(fsInfo.path, {}, (err, rv) => {
                if (err) {
                    cb(this.standardizeError(err, fsInfo.path, p));
                }
                else {
                    // resolve is there to remove any trailing slash that may be present
                    cb(null, path.resolve(path.join(fsInfo.mountPoint, rv)));
                }
            });
        }
        rmdirSync(p) {
            const fsInfo = this._getFs(p);
            if (this._containsMountPt(p)) {
                throw ApiError.ENOTEMPTY(p);
            }
            else {
                try {
                    fsInfo.fs.rmdirSync(fsInfo.path);
                }
                catch (e) {
                    throw this.standardizeError(e, fsInfo.path, p);
                }
            }
        }
        rmdir(p, cb) {
            const fsInfo = this._getFs(p);
            if (this._containsMountPt(p)) {
                cb(ApiError.ENOTEMPTY(p));
            }
            else {
                fsInfo.fs.rmdir(fsInfo.path, (err) => {
                    cb(err ? this.standardizeError(err, fsInfo.path, p) : null);
                });
            }
        }
        /**
         * Returns true if the given path contains a mount point.
         */
        _containsMountPt(p) {
            const mountPoints = this.mountList, len = mountPoints.length;
            for (let i = 0; i < len; i++) {
                const pt = mountPoints[i];
                if (pt.length >= p.length && pt.slice(0, p.length) === p) {
                    return true;
                }
            }
            return false;
        }
    }
    MountableFileSystem.Name = "MountableFileSystem";
    MountableFileSystem.Options = {};
    /**
     * Tricky: Define all of the functions that merely forward arguments to the
     * relevant file system, or return/throw an error.
     * Take advantage of the fact that the *first* argument is always the path, and
     * the *last* is the callback function (if async).
     * @todo Can use numArgs to make proxying more efficient.
     * @hidden
     */
    function defineFcn(name, isSync, numArgs) {
        if (isSync) {
            return function (...args) {
                const path = args[0];
                const rv = this._getFs(path);
                args[0] = rv.path;
                try {
                    return rv.fs[name].apply(rv.fs, args);
                }
                catch (e) {
                    this.standardizeError(e, rv.path, path);
                    throw e;
                }
            };
        }
        else {
            return function (...args) {
                const path = args[0];
                const rv = this._getFs(path);
                args[0] = rv.path;
                if (typeof args[args.length - 1] === 'function') {
                    const cb = args[args.length - 1];
                    args[args.length - 1] = (...args) => {
                        if (args.length > 0 && args[0] instanceof ApiError) {
                            this.standardizeError(args[0], rv.path, path);
                        }
                        cb.apply(null, args);
                    };
                }
                return rv.fs[name].apply(rv.fs, args);
            };
        }
    }
    /**
     * @hidden
     */
    const fsCmdMap = [
        // 1 arg functions
        ['exists', 'unlink', 'readlink'],
        // 2 arg functions
        ['stat', 'mkdir', 'truncate'],
        // 3 arg functions
        ['open', 'readFile', 'chmod', 'utimes'],
        // 4 arg functions
        ['chown'],
        // 5 arg functions
        ['writeFile', 'appendFile']
    ];
    for (let i = 0; i < fsCmdMap.length; i++) {
        const cmds = fsCmdMap[i];
        for (const fnName of cmds) {
            MountableFileSystem.prototype[fnName] = defineFcn(fnName, false, i + 1);
            MountableFileSystem.prototype[fnName + 'Sync'] = defineFcn(fnName + 'Sync', true, i + 1);
        }
    }


    return MountableFileSystem;
});
define('skylark-browserfs/generic/mutex',['../generic/setImmediate'], function (setImmediate) {
    'use strict';
    /**
     * Non-recursive mutex
     * @hidden
     */
    class Mutex {
        constructor() {
            this._locked = false;
            this._waiters = [];
        }
        lock(cb) {
            if (this._locked) {
                this._waiters.push(cb);
                return;
            }
            this._locked = true;
            cb();
        }
        unlock() {
            if (!this._locked) {
                throw new Error('unlock of a non-locked mutex');
            }
            const next = this._waiters.shift();
            // don't unlock - we want to queue up next for the
            // _end_ of the current task execution, but we don't
            // want it to be called inline with whatever the
            // current stack is.  This way we still get the nice
            // behavior that an unlock immediately followed by a
            // lock won't cause starvation.
            if (next) {
                setImmediate(next);
                return;
            }
            this._locked = false;
        }
        tryLock() {
            if (this._locked) {
                return false;
            }
            this._locked = true;
            return true;
        }
        isLocked() {
            return this._locked;
        }
    }

    return Mutex;
});
define('skylark-browserfs/generic/locked_fs',['./mutex'], function (Mutex) {
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
define('skylark-browserfs/backend/OverlayFS',[
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../generic/locked_fs',
    '../libs/path'
], function (file_system, api_error, file_flag, node_fs_stats, preload_file, LockedFS, path) {

    'use strict';


    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { FileFlag, ActionType }  = file_flag;
    const { Stats }  = node_fs_stats;
    const {PreloadFile}  = preload_file;

    /**
     * @hidden
     */
    const deletionLogPath = '/.deletedFiles.log';
    /**
     * Given a read-only mode, makes it writable.
     * @hidden
     */
    function makeModeWritable(mode) {
        return 0o222 | mode;
    }
    /**
     * @hidden
     */
    function getFlag(f) {
        return FileFlag.getFileFlag(f);
    }
    /**
     * Overlays a RO file to make it writable.
     */
    class OverlayFile extends PreloadFile {
        constructor(fs, path, flag, stats, data) {
            super(fs, path, flag, stats, data);
        }
        sync(cb) {
            if (!this.isDirty()) {
                cb(null);
                return;
            }
            this._fs._syncAsync(this, (err) => {
                this.resetDirty();
                cb(err);
            });
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this);
                this.resetDirty();
            }
        }
        close(cb) {
            this.sync(cb);
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * *INTERNAL, DO NOT USE DIRECTLY!*
     *
     * Core OverlayFS class that contains no locking whatsoever. We wrap these objects
     * in a LockedFS to prevent races.
     */
    class UnlockedOverlayFS extends BaseFileSystem {
        constructor(writable, readable) {
            super();
            this._isInitialized = false;
            this._initializeCallbacks = [];
            this._deletedFiles = {};
            this._deleteLog = '';
            // If 'true', we have scheduled a delete log update.
            this._deleteLogUpdatePending = false;
            // If 'true', a delete log update is needed after the scheduled delete log
            // update finishes.
            this._deleteLogUpdateNeeded = false;
            // If there was an error updating the delete log...
            this._deleteLogError = null;
            this._writable = writable;
            this._readable = readable;
            if (this._writable.isReadOnly()) {
                throw new ApiError(ErrorCode.EINVAL, "Writable file system must be writable.");
            }
        }
        static isAvailable() {
            return true;
        }
        getOverlayedFileSystems() {
            return {
                readable: this._readable,
                writable: this._writable
            };
        }
        _syncAsync(file, cb) {
            this.createParentDirectoriesAsync(file.getPath(), (err) => {
                if (err) {
                    return cb(err);
                }
                this._writable.writeFile(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode, cb);
            });
        }
        _syncSync(file) {
            this.createParentDirectories(file.getPath());
            this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode);
        }
        getName() {
            return OverlayFS.Name;
        }
        /**
         * **INTERNAL METHOD**
         *
         * Called once to load up metadata stored on the writable file system.
         */
        _initialize(cb) {
            const callbackArray = this._initializeCallbacks;
            const end = (e) => {
                this._isInitialized = !e;
                this._initializeCallbacks = [];
                callbackArray.forEach(((cb) => cb(e)));
            };
            // if we're already initialized, immediately invoke the callback
            if (this._isInitialized) {
                return cb();
            }
            callbackArray.push(cb);
            // The first call to initialize initializes, the rest wait for it to complete.
            if (callbackArray.length !== 1) {
                return;
            }
            // Read deletion log, process into metadata.
            this._writable.readFile(deletionLogPath, 'utf8', getFlag('r'), (err, data) => {
                if (err) {
                    // ENOENT === Newly-instantiated file system, and thus empty log.
                    if (err.errno !== ErrorCode.ENOENT) {
                        return end(err);
                    }
                }
                else {
                    this._deleteLog = data;
                }
                this._reparseDeletionLog();
                end();
            });
        }
        isReadOnly() { return false; }
        supportsSynch() { return this._readable.supportsSynch() && this._writable.supportsSynch(); }
        supportsLinks() { return false; }
        supportsProps() { return this._readable.supportsProps() && this._writable.supportsProps(); }
        getDeletionLog() {
            return this._deleteLog;
        }
        restoreDeletionLog(log) {
            this._deleteLog = log;
            this._reparseDeletionLog();
            this.updateLog('');
        }
        rename(oldPath, newPath, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(oldPath, cb) || this.checkPathAsync(newPath, cb)) {
                return;
            }
            if (oldPath === deletionLogPath || newPath === deletionLogPath) {
                return cb(ApiError.EPERM('Cannot rename deletion log.'));
            }
            // nothing to do if paths match
            if (oldPath === newPath) {
                return cb();
            }
            this.stat(oldPath, false, (oldErr, oldStats) => {
                if (oldErr) {
                    return cb(oldErr);
                }
                return this.stat(newPath, false, (newErr, newStats) => {
                    const self = this;
                    // precondition: both oldPath and newPath exist and are dirs.
                    // decreases: |files|
                    // Need to move *every file/folder* currently stored on
                    // readable to its new location on writable.
                    function copyDirContents(files) {
                        const file = files.shift();
                        if (!file) {
                            return cb();
                        }
                        const oldFile = path.resolve(oldPath, file);
                        const newFile = path.resolve(newPath, file);
                        // Recursion! Should work for any nested files / folders.
                        self.rename(oldFile, newFile, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            copyDirContents(files);
                        });
                    }
                    let mode = 0o777;
                    // from linux's rename(2) manpage: oldpath can specify a
                    // directory.  In this case, newpath must either not exist, or
                    // it must specify an empty directory.
                    if (oldStats.isDirectory()) {
                        if (newErr) {
                            if (newErr.errno !== ErrorCode.ENOENT) {
                                return cb(newErr);
                            }
                            return this._writable.exists(oldPath, (exists) => {
                                // simple case - both old and new are on the writable layer
                                if (exists) {
                                    return this._writable.rename(oldPath, newPath, cb);
                                }
                                this._writable.mkdir(newPath, mode, (mkdirErr) => {
                                    if (mkdirErr) {
                                        return cb(mkdirErr);
                                    }
                                    this._readable.readdir(oldPath, (err, files) => {
                                        if (err) {
                                            return cb();
                                        }
                                        copyDirContents(files);
                                    });
                                });
                            });
                        }
                        mode = newStats.mode;
                        if (!newStats.isDirectory()) {
                            return cb(ApiError.ENOTDIR(newPath));
                        }
                        this.readdir(newPath, (readdirErr, files) => {
                            if (files && files.length) {
                                return cb(ApiError.ENOTEMPTY(newPath));
                            }
                            this._readable.readdir(oldPath, (err, files) => {
                                if (err) {
                                    return cb();
                                }
                                copyDirContents(files);
                            });
                        });
                    }
                    if (newStats && newStats.isDirectory()) {
                        return cb(ApiError.EISDIR(newPath));
                    }
                    this.readFile(oldPath, null, getFlag('r'), (err, data) => {
                        if (err) {
                            return cb(err);
                        }
                        return this.writeFile(newPath, data, null, getFlag('w'), oldStats.mode, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            return this.unlink(oldPath, cb);
                        });
                    });
                });
            });
        }
        renameSync(oldPath, newPath) {
            this.checkInitialized();
            this.checkPath(oldPath);
            this.checkPath(newPath);
            if (oldPath === deletionLogPath || newPath === deletionLogPath) {
                throw ApiError.EPERM('Cannot rename deletion log.');
            }
            // Write newPath using oldPath's contents, delete oldPath.
            const oldStats = this.statSync(oldPath, false);
            if (oldStats.isDirectory()) {
                // Optimization: Don't bother moving if old === new.
                if (oldPath === newPath) {
                    return;
                }
                let mode = 0o777;
                if (this.existsSync(newPath)) {
                    const stats = this.statSync(newPath, false);
                    mode = stats.mode;
                    if (stats.isDirectory()) {
                        if (this.readdirSync(newPath).length > 0) {
                            throw ApiError.ENOTEMPTY(newPath);
                        }
                    }
                    else {
                        throw ApiError.ENOTDIR(newPath);
                    }
                }
                // Take care of writable first. Move any files there, or create an empty directory
                // if it doesn't exist.
                if (this._writable.existsSync(oldPath)) {
                    this._writable.renameSync(oldPath, newPath);
                }
                else if (!this._writable.existsSync(newPath)) {
                    this._writable.mkdirSync(newPath, mode);
                }
                // Need to move *every file/folder* currently stored on readable to its new location
                // on writable.
                if (this._readable.existsSync(oldPath)) {
                    this._readable.readdirSync(oldPath).forEach((name) => {
                        // Recursion! Should work for any nested files / folders.
                        this.renameSync(path.resolve(oldPath, name), path.resolve(newPath, name));
                    });
                }
            }
            else {
                if (this.existsSync(newPath) && this.statSync(newPath, false).isDirectory()) {
                    throw ApiError.EISDIR(newPath);
                }
                this.writeFileSync(newPath, this.readFileSync(oldPath, null, getFlag('r')), null, getFlag('w'), oldStats.mode);
            }
            if (oldPath !== newPath && this.existsSync(oldPath)) {
                this.unlinkSync(oldPath);
            }
        }
        stat(p, isLstat, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this._writable.stat(p, isLstat, (err, stat) => {
                if (err && err.errno === ErrorCode.ENOENT) {
                    if (this._deletedFiles[p]) {
                        cb(ApiError.ENOENT(p));
                    }
                    this._readable.stat(p, isLstat, (err, stat) => {
                        if (stat) {
                            // Make the oldStat's mode writable. Preserve the topmost
                            // part of the mode, which specifies if it is a file or a
                            // directory.
                            stat = Stats.clone(stat);
                            stat.mode = makeModeWritable(stat.mode);
                        }
                        cb(err, stat);
                    });
                }
                else {
                    cb(err, stat);
                }
            });
        }
        statSync(p, isLstat) {
            this.checkInitialized();
            try {
                return this._writable.statSync(p, isLstat);
            }
            catch (e) {
                if (this._deletedFiles[p]) {
                    throw ApiError.ENOENT(p);
                }
                const oldStat = Stats.clone(this._readable.statSync(p, isLstat));
                // Make the oldStat's mode writable. Preserve the topmost part of the
                // mode, which specifies if it is a file or a directory.
                oldStat.mode = makeModeWritable(oldStat.mode);
                return oldStat;
            }
        }
        open(p, flag, mode, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(p, cb)) {
                return;
            }
            this.stat(p, false, (err, stats) => {
                if (stats) {
                    switch (flag.pathExistsAction()) {
                        case ActionType.TRUNCATE_FILE:
                            return this.createParentDirectoriesAsync(p, (err) => {
                                if (err) {
                                    return cb(err);
                                }
                                this._writable.open(p, flag, mode, cb);
                            });
                        case ActionType.NOP:
                            return this._writable.exists(p, (exists) => {
                                if (exists) {
                                    this._writable.open(p, flag, mode, cb);
                                }
                                else {
                                    // at this point we know the stats object we got is from
                                    // the readable FS.
                                    stats = Stats.clone(stats);
                                    stats.mode = mode;
                                    this._readable.readFile(p, null, getFlag('r'), (readFileErr, data) => {
                                        if (readFileErr) {
                                            return cb(readFileErr);
                                        }
                                        if (stats.size === -1) {
                                            stats.size = data.length;
                                        }
                                        const f = new OverlayFile(this, p, flag, stats, data);
                                        cb(null, f);
                                    });
                                }
                            });
                        default:
                            return cb(ApiError.EEXIST(p));
                    }
                }
                else {
                    switch (flag.pathNotExistsAction()) {
                        case ActionType.CREATE_FILE:
                            return this.createParentDirectoriesAsync(p, (err) => {
                                if (err) {
                                    return cb(err);
                                }
                                return this._writable.open(p, flag, mode, cb);
                            });
                        default:
                            return cb(ApiError.ENOENT(p));
                    }
                }
            });
        }
        openSync(p, flag, mode) {
            this.checkInitialized();
            this.checkPath(p);
            if (p === deletionLogPath) {
                throw ApiError.EPERM('Cannot open deletion log.');
            }
            if (this.existsSync(p)) {
                switch (flag.pathExistsAction()) {
                    case ActionType.TRUNCATE_FILE:
                        this.createParentDirectories(p);
                        return this._writable.openSync(p, flag, mode);
                    case ActionType.NOP:
                        if (this._writable.existsSync(p)) {
                            return this._writable.openSync(p, flag, mode);
                        }
                        else {
                            // Create an OverlayFile.
                            const buf = this._readable.readFileSync(p, null, getFlag('r'));
                            const stats = Stats.clone(this._readable.statSync(p, false));
                            stats.mode = mode;
                            return new OverlayFile(this, p, flag, stats, buf);
                        }
                    default:
                        throw ApiError.EEXIST(p);
                }
            }
            else {
                switch (flag.pathNotExistsAction()) {
                    case ActionType.CREATE_FILE:
                        this.createParentDirectories(p);
                        return this._writable.openSync(p, flag, mode);
                    default:
                        throw ApiError.ENOENT(p);
                }
            }
        }
        unlink(p, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(p, cb)) {
                return;
            }
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (writableExists) => {
                    if (writableExists) {
                        return this._writable.unlink(p, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            this.exists(p, (readableExists) => {
                                if (readableExists) {
                                    this.deletePath(p);
                                }
                                cb(null);
                            });
                        });
                    }
                    else {
                        // if this only exists on the readable FS, add it to the
                        // delete map.
                        this.deletePath(p);
                        cb(null);
                    }
                });
            });
        }
        unlinkSync(p) {
            this.checkInitialized();
            this.checkPath(p);
            if (this.existsSync(p)) {
                if (this._writable.existsSync(p)) {
                    this._writable.unlinkSync(p);
                }
                // if it still exists add to the delete log
                if (this.existsSync(p)) {
                    this.deletePath(p);
                }
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        rmdir(p, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            const rmdirLower = () => {
                this.readdir(p, (err, files) => {
                    if (err) {
                        return cb(err);
                    }
                    if (files.length) {
                        return cb(ApiError.ENOTEMPTY(p));
                    }
                    this.deletePath(p);
                    cb(null);
                });
            };
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (writableExists) => {
                    if (writableExists) {
                        this._writable.rmdir(p, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            this._readable.exists(p, (readableExists) => {
                                if (readableExists) {
                                    rmdirLower();
                                }
                                else {
                                    cb();
                                }
                            });
                        });
                    }
                    else {
                        rmdirLower();
                    }
                });
            });
        }
        rmdirSync(p) {
            this.checkInitialized();
            if (this.existsSync(p)) {
                if (this._writable.existsSync(p)) {
                    this._writable.rmdirSync(p);
                }
                if (this.existsSync(p)) {
                    // Check if directory is empty.
                    if (this.readdirSync(p).length > 0) {
                        throw ApiError.ENOTEMPTY(p);
                    }
                    else {
                        this.deletePath(p);
                    }
                }
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        mkdir(p, mode, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.exists(p, (exists) => {
                if (exists) {
                    return cb(ApiError.EEXIST(p));
                }
                // The below will throw should any of the parent directories
                // fail to exist on _writable.
                this.createParentDirectoriesAsync(p, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    this._writable.mkdir(p, mode, cb);
                });
            });
        }
        mkdirSync(p, mode) {
            this.checkInitialized();
            if (this.existsSync(p)) {
                throw ApiError.EEXIST(p);
            }
            else {
                // The below will throw should any of the parent directories fail to exist
                // on _writable.
                this.createParentDirectories(p);
                this._writable.mkdirSync(p, mode);
            }
        }
        readdir(p, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.stat(p, false, (err, dirStats) => {
                if (err) {
                    return cb(err);
                }
                if (!dirStats.isDirectory()) {
                    return cb(ApiError.ENOTDIR(p));
                }
                this._writable.readdir(p, (err, wFiles) => {
                    if (err && err.code !== 'ENOENT') {
                        return cb(err);
                    }
                    else if (err || !wFiles) {
                        wFiles = [];
                    }
                    this._readable.readdir(p, (err, rFiles) => {
                        // if the directory doesn't exist on the lower FS set rFiles
                        // here to simplify the following code.
                        if (err || !rFiles) {
                            rFiles = [];
                        }
                        // Readdir in both, check delete log on read-only file system's files, merge, return.
                        const seenMap = {};
                        const filtered = wFiles.concat(rFiles.filter((fPath) => !this._deletedFiles[`${p}/${fPath}`])).filter((fPath) => {
                            // Remove duplicates.
                            const result = !seenMap[fPath];
                            seenMap[fPath] = true;
                            return result;
                        });
                        cb(null, filtered);
                    });
                });
            });
        }
        readdirSync(p) {
            this.checkInitialized();
            const dirStats = this.statSync(p, false);
            if (!dirStats.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            // Readdir in both, check delete log on RO file system's listing, merge, return.
            let contents = [];
            try {
                contents = contents.concat(this._writable.readdirSync(p));
            }
            catch (e) {
                // NOP.
            }
            try {
                contents = contents.concat(this._readable.readdirSync(p).filter((fPath) => !this._deletedFiles[`${p}/${fPath}`]));
            }
            catch (e) {
                // NOP.
            }
            const seenMap = {};
            return contents.filter((fileP) => {
                const result = !seenMap[fileP];
                seenMap[fileP] = true;
                return result;
            });
        }
        exists(p, cb) {
            // Cannot pass an error back to callback, so throw an exception instead
            // if not initialized.
            this.checkInitialized();
            this._writable.exists(p, (existsWritable) => {
                if (existsWritable) {
                    return cb(true);
                }
                this._readable.exists(p, (existsReadable) => {
                    cb(existsReadable && this._deletedFiles[p] !== true);
                });
            });
        }
        existsSync(p) {
            this.checkInitialized();
            return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
        }
        chmod(p, isLchmod, mode, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.chmod(p, isLchmod, mode, cb);
                }
            });
        }
        chmodSync(p, isLchmod, mode) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.chmodSync(p, isLchmod, mode);
            });
        }
        chown(p, isLchmod, uid, gid, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.chown(p, isLchmod, uid, gid, cb);
                }
            });
        }
        chownSync(p, isLchown, uid, gid) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.chownSync(p, isLchown, uid, gid);
            });
        }
        utimes(p, atime, mtime, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.utimes(p, atime, mtime, cb);
                }
            });
        }
        utimesSync(p, atime, mtime) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.utimesSync(p, atime, mtime);
            });
        }
        deletePath(p) {
            this._deletedFiles[p] = true;
            this.updateLog(`d${p}\n`);
        }
        updateLog(addition) {
            this._deleteLog += addition;
            if (this._deleteLogUpdatePending) {
                this._deleteLogUpdateNeeded = true;
            }
            else {
                this._deleteLogUpdatePending = true;
                this._writable.writeFile(deletionLogPath, this._deleteLog, 'utf8', FileFlag.getFileFlag('w'), 0o644, (e) => {
                    this._deleteLogUpdatePending = false;
                    if (e) {
                        this._deleteLogError = e;
                    }
                    else if (this._deleteLogUpdateNeeded) {
                        this._deleteLogUpdateNeeded = false;
                        this.updateLog('');
                    }
                });
            }
        }
        _reparseDeletionLog() {
            this._deletedFiles = {};
            this._deleteLog.split('\n').forEach((path) => {
                // If the log entry begins w/ 'd', it's a deletion.
                this._deletedFiles[path.slice(1)] = path.slice(0, 1) === 'd';
            });
        }
        checkInitialized() {
            if (!this._isInitialized) {
                throw new ApiError(ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it.");
            }
            else if (this._deleteLogError !== null) {
                const e = this._deleteLogError;
                this._deleteLogError = null;
                throw e;
            }
        }
        checkInitAsync(cb) {
            if (!this._isInitialized) {
                cb(new ApiError(ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it."));
                return false;
            }
            else if (this._deleteLogError !== null) {
                const e = this._deleteLogError;
                this._deleteLogError = null;
                cb(e);
                return false;
            }
            return true;
        }
        checkPath(p) {
            if (p === deletionLogPath) {
                throw ApiError.EPERM(p);
            }
        }
        checkPathAsync(p, cb) {
            if (p === deletionLogPath) {
                cb(ApiError.EPERM(p));
                return true;
            }
            return false;
        }
        createParentDirectoriesAsync(p, cb) {
            let parent = path.dirname(p);
            const toCreate = [];
            const self = this;
            this._writable.stat(parent, false, statDone);
            function statDone(err, stat) {
                if (err) {
                    if (parent === "/") {
                        cb(new ApiError(ErrorCode.EBUSY, "Invariant failed: root does not exist!"));
                    }
                    else {
                        toCreate.push(parent);
                        parent = path.dirname(parent);
                        self._writable.stat(parent, false, statDone);
                    }
                }
                else {
                    createParents();
                }
            }
            function createParents() {
                if (!toCreate.length) {
                    return cb();
                }
                const dir = toCreate.pop();
                self._readable.stat(dir, false, (err, stats) => {
                    // stop if we couldn't read the dir
                    if (!stats) {
                        return cb();
                    }
                    self._writable.mkdir(dir, stats.mode, (err) => {
                        if (err) {
                            return cb(err);
                        }
                        createParents();
                    });
                });
            }
        }
        /**
         * With the given path, create the needed parent directories on the writable storage
         * should they not exist. Use modes from the read-only storage.
         */
        createParentDirectories(p) {
            let parent = path.dirname(p), toCreate = [];
            while (!this._writable.existsSync(parent)) {
                toCreate.push(parent);
                parent = path.dirname(parent);
            }
            toCreate = toCreate.reverse();
            toCreate.forEach((p) => {
                this._writable.mkdirSync(p, this.statSync(p, false).mode);
            });
        }
        /**
         * Helper function:
         * - Ensures p is on writable before proceeding. Throws an error if it doesn't exist.
         * - Calls f to perform operation on writable.
         */
        operateOnWritable(p, f) {
            if (this.existsSync(p)) {
                if (!this._writable.existsSync(p)) {
                    // File is on readable storage. Copy to writable storage before
                    // changing its mode.
                    this.copyToWritable(p);
                }
                f();
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        operateOnWritableAsync(p, cb) {
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (existsWritable) => {
                    if (existsWritable) {
                        cb();
                    }
                    else {
                        return this.copyToWritableAsync(p, cb);
                    }
                });
            });
        }
        /**
         * Copy from readable to writable storage.
         * PRECONDITION: File does not exist on writable storage.
         */
        copyToWritable(p) {
            const pStats = this.statSync(p, false);
            if (pStats.isDirectory()) {
                this._writable.mkdirSync(p, pStats.mode);
            }
            else {
                this.writeFileSync(p, this._readable.readFileSync(p, null, getFlag('r')), null, getFlag('w'), this.statSync(p, false).mode);
            }
        }
        copyToWritableAsync(p, cb) {
            this.stat(p, false, (err, pStats) => {
                if (err) {
                    return cb(err);
                }
                if (pStats.isDirectory()) {
                    return this._writable.mkdir(p, pStats.mode, cb);
                }
                // need to copy file.
                this._readable.readFile(p, null, getFlag('r'), (err, data) => {
                    if (err) {
                        return cb(err);
                    }
                    this.writeFile(p, data, null, getFlag('w'), pStats.mode, cb);
                });
            });
        }
    }
    /**
     * OverlayFS makes a read-only filesystem writable by storing writes on a second,
     * writable file system. Deletes are persisted via metadata stored on the writable
     * file system.
     */
    class OverlayFS extends LockedFS {
        /**
         * @param writable The file system to write modified files to.
         * @param readable The file system that initially populates this file system.
         */
        constructor(writable, readable) {
            super(new UnlockedOverlayFS(writable, readable));
        }
        /**
         * Constructs and initializes an OverlayFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                const fs = new OverlayFS(opts.writable, opts.readable);
                fs._initialize((e) => {
                    cb(e, fs);
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return UnlockedOverlayFS.isAvailable();
        }
        getOverlayedFileSystems() {
            return super.getFSUnlocked().getOverlayedFileSystems();
        }
        unwrap() {
            return super.getFSUnlocked();
        }
        _initialize(cb) {
            super.getFSUnlocked()._initialize(cb);
        }
    }
    OverlayFS.Name = "OverlayFS";
    OverlayFS.Options = {
        writable: {
            type: "object",
            description: "The file system to write modified files to."
        },
        readable: {
            type: "object",
            description: "The file system that initially populates this file system."
        }
    };

    return OverlayFS;
});
define('skylark-browserfs/backend/WorkerFS',[
    '../libs/buffers',
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/util',
    '../core/file',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../core/global',
    '../core/node_fs'
], function (buffers,file_system, api_error, file_flag, util, file, node_fs_stats, preload_file, global, fs) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { FileFlag }  = file_flag;
    const { buffer2ArrayBuffer, arrayBuffer2Buffer, emptyBuffer }  = util;
    const { BaseFile }  = file;
    const { Stats }  = node_fs_stats;
    const {PreloadFile}  = preload_file;
    const { Buffer } = buffers;

    /**
     * @hidden
     */
    var SpecialArgType;
    (function (SpecialArgType) {
        // Callback
        SpecialArgType[SpecialArgType["CB"] = 0] = "CB";
        // File descriptor
        SpecialArgType[SpecialArgType["FD"] = 1] = "FD";
        // API error
        SpecialArgType[SpecialArgType["API_ERROR"] = 2] = "API_ERROR";
        // Stats object
        SpecialArgType[SpecialArgType["STATS"] = 3] = "STATS";
        // Initial probe for file system information.
        SpecialArgType[SpecialArgType["PROBE"] = 4] = "PROBE";
        // FileFlag object.
        SpecialArgType[SpecialArgType["FILEFLAG"] = 5] = "FILEFLAG";
        // Buffer object.
        SpecialArgType[SpecialArgType["BUFFER"] = 6] = "BUFFER";
        // Generic Error object.
        SpecialArgType[SpecialArgType["ERROR"] = 7] = "ERROR";
    })(SpecialArgType || (SpecialArgType = {}));
    /**
     * Converts callback arguments into ICallbackArgument objects, and back
     * again.
     * @hidden
     */
    class CallbackArgumentConverter {
        constructor() {
            this._callbacks = {};
            this._nextId = 0;
        }
        toRemoteArg(cb) {
            const id = this._nextId++;
            this._callbacks[id] = cb;
            return {
                type: SpecialArgType.CB,
                id: id
            };
        }
        toLocalArg(id) {
            const cb = this._callbacks[id];
            delete this._callbacks[id];
            return cb;
        }
    }
    /**
     * @hidden
     */
    class FileDescriptorArgumentConverter {
        constructor() {
            this._fileDescriptors = {};
            this._nextId = 0;
        }
        toRemoteArg(fd, p, flag, cb) {
            const id = this._nextId++;
            let data;
            let stat;
            this._fileDescriptors[id] = fd;
            // Extract needed information asynchronously.
            fd.stat((err, stats) => {
                if (err) {
                    cb(err);
                }
                else {
                    stat = bufferToTransferrableObject(stats.toBuffer());
                    // If it's a readable flag, we need to grab contents.
                    if (flag.isReadable()) {
                        fd.read(Buffer.alloc(stats.size), 0, stats.size, 0, (err, bytesRead, buff) => {
                            if (err) {
                                cb(err);
                            }
                            else {
                                data = bufferToTransferrableObject(buff);
                                cb(null, {
                                    type: SpecialArgType.FD,
                                    id: id,
                                    data: data,
                                    stat: stat,
                                    path: p,
                                    flag: flag.getFlagString()
                                });
                            }
                        });
                    }
                    else {
                        // File is not readable, which means writing to it will append or
                        // truncate/replace existing contents. Return an empty arraybuffer.
                        cb(null, {
                            type: SpecialArgType.FD,
                            id: id,
                            data: new ArrayBuffer(0),
                            stat: stat,
                            path: p,
                            flag: flag.getFlagString()
                        });
                    }
                }
            });
        }
        applyFdAPIRequest(request, cb) {
            const fdArg = request.args[0];
            this._applyFdChanges(fdArg, (err, fd) => {
                if (err) {
                    cb(err);
                }
                else {
                    // Apply method on now-changed file descriptor.
                    fd[request.method]((e) => {
                        if (request.method === 'close') {
                            delete this._fileDescriptors[fdArg.id];
                        }
                        cb(e);
                    });
                }
            });
        }
        _applyFdChanges(remoteFd, cb) {
            const fd = this._fileDescriptors[remoteFd.id], data = transferrableObjectToBuffer(remoteFd.data), remoteStats = Stats.fromBuffer(transferrableObjectToBuffer(remoteFd.stat));
            // Write data if the file is writable.
            const flag = FileFlag.getFileFlag(remoteFd.flag);
            if (flag.isWriteable()) {
                // Appendable: Write to end of file.
                // Writeable: Replace entire contents of file.
                fd.write(data, 0, data.length, flag.isAppendable() ? fd.getPos() : 0, (e) => {
                    function applyStatChanges() {
                        // Check if mode changed.
                        fd.stat((e, stats) => {
                            if (e) {
                                cb(e);
                            }
                            else {
                                if (stats.mode !== remoteStats.mode) {
                                    fd.chmod(remoteStats.mode, (e) => {
                                        cb(e, fd);
                                    });
                                }
                                else {
                                    cb(e, fd);
                                }
                            }
                        });
                    }
                    if (e) {
                        cb(e);
                    }
                    else {
                        // If writeable & not appendable, we need to ensure file contents are
                        // identical to those from the remote FD. Thus, we truncate to the
                        // length of the remote file.
                        if (!flag.isAppendable()) {
                            fd.truncate(data.length, () => {
                                applyStatChanges();
                            });
                        }
                        else {
                            applyStatChanges();
                        }
                    }
                });
            }
            else {
                cb(null, fd);
            }
        }
    }
    /**
     * @hidden
     */
    function apiErrorLocal2Remote(e) {
        return {
            type: SpecialArgType.API_ERROR,
            errorData: bufferToTransferrableObject(e.writeToBuffer())
        };
    }
    /**
     * @hidden
     */
    function apiErrorRemote2Local(e) {
        return ApiError.fromBuffer(transferrableObjectToBuffer(e.errorData));
    }
    /**
     * @hidden
     */
    function errorLocal2Remote(e) {
        return {
            type: SpecialArgType.ERROR,
            name: e.name,
            message: e.message,
            stack: e.stack
        };
    }
    /**
     * @hidden
     */
    function errorRemote2Local(e) {
        let cnstr = global[e.name];
        if (typeof (cnstr) !== 'function') {
            cnstr = Error;
        }
        const err = new cnstr(e.message);
        err.stack = e.stack;
        return err;
    }
    /**
     * @hidden
     */
    function statsLocal2Remote(stats) {
        return {
            type: SpecialArgType.STATS,
            statsData: bufferToTransferrableObject(stats.toBuffer())
        };
    }
    /**
     * @hidden
     */
    function statsRemote2Local(stats) {
        return Stats.fromBuffer(transferrableObjectToBuffer(stats.statsData));
    }
    /**
     * @hidden
     */
    function fileFlagLocal2Remote(flag) {
        return {
            type: SpecialArgType.FILEFLAG,
            flagStr: flag.getFlagString()
        };
    }
    /**
     * @hidden
     */
    function fileFlagRemote2Local(remoteFlag) {
        return FileFlag.getFileFlag(remoteFlag.flagStr);
    }
    /**
     * @hidden
     */
    function bufferToTransferrableObject(buff) {
        return buffer2ArrayBuffer(buff);
    }
    /**
     * @hidden
     */
    function transferrableObjectToBuffer(buff) {
        return arrayBuffer2Buffer(buff);
    }
    /**
     * @hidden
     */
    function bufferLocal2Remote(buff) {
        return {
            type: SpecialArgType.BUFFER,
            data: bufferToTransferrableObject(buff)
        };
    }
    /**
     * @hidden
     */
    function bufferRemote2Local(buffArg) {
        return transferrableObjectToBuffer(buffArg.data);
    }
    /**
     * @hidden
     */
    function isAPIRequest(data) {
        return data && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
    }
    /**
     * @hidden
     */
    function isAPIResponse(data) {
        return data && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
    }
    /**
     * Represents a remote file in a different worker/thread.
     */
    class WorkerFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, remoteFdId, contents) {
            super(_fs, _path, _flag, _stat, contents);
            this._remoteFdId = remoteFdId;
        }
        getRemoteFdId() {
            return this._remoteFdId;
        }
        /**
         * @hidden
         */
        toRemoteArg() {
            return {
                type: SpecialArgType.FD,
                id: this._remoteFdId,
                data: bufferToTransferrableObject(this.getBuffer()),
                stat: bufferToTransferrableObject(this.getStats().toBuffer()),
                path: this.getPath(),
                flag: this.getFlag().getFlagString()
            };
        }
        sync(cb) {
            this._syncClose('sync', cb);
        }
        close(cb) {
            this._syncClose('close', cb);
        }
        _syncClose(type, cb) {
            if (this.isDirty()) {
                this._fs.syncClose(type, this, (e) => {
                    if (!e) {
                        this.resetDirty();
                    }
                    cb(e);
                });
            }
            else {
                cb();
            }
        }
    }
    /**
     * WorkerFS lets you access a BrowserFS instance that is running in a different
     * JavaScript context (e.g. access BrowserFS in one of your WebWorkers, or
     * access BrowserFS running on the main page from a WebWorker).
     *
     * For example, to have a WebWorker access files in the main browser thread,
     * do the following:
     *
     * MAIN BROWSER THREAD:
     *
     * ```javascript
     *   // Listen for remote file system requests.
     *   BrowserFS.FileSystem.WorkerFS.attachRemoteListener(webWorkerObject);
     * ```
     *
     * WEBWORKER THREAD:
     *
     * ```javascript
     *   // Set the remote file system as the root file system.
     *   BrowserFS.configure({ fs: "WorkerFS", options: { worker: self }}, function(e) {
     *     // Ready!
     *   });
     * ```
     *
     * Note that synchronous operations are not permitted on the WorkerFS, regardless
     * of the configuration option of the remote FS.
     */
    class WorkerFS extends BaseFileSystem {
        /**
         * Constructs a new WorkerFS instance that connects with BrowserFS running on
         * the specified worker.
         */
        constructor(worker) {
            super();
            this._callbackConverter = new CallbackArgumentConverter();
            this._isInitialized = false;
            this._isReadOnly = false;
            this._supportLinks = false;
            this._supportProps = false;
            this._worker = worker;
            this._worker.addEventListener('message', (e) => {
                const resp = e.data;
                if (isAPIResponse(resp)) {
                    let i;
                    const args = resp.args;
                    const fixedArgs = new Array(args.length);
                    // Dispatch event to correct id.
                    for (i = 0; i < fixedArgs.length; i++) {
                        fixedArgs[i] = this._argRemote2Local(args[i]);
                    }
                    this._callbackConverter.toLocalArg(resp.cbId).apply(null, fixedArgs);
                }
            });
        }
        static Create(opts, cb) {
            const fs = new WorkerFS(opts.worker);
            fs._initialize(() => {
                cb(null, fs);
            });
        }
        static isAvailable() {
            return typeof (importScripts) !== 'undefined' || typeof (Worker) !== 'undefined';
        }
        /**
         * Attaches a listener to the remote worker for file system requests.
         */
        static attachRemoteListener(worker) {
            const fdConverter = new FileDescriptorArgumentConverter();
            function argLocal2Remote(arg, requestArgs, cb) {
                switch (typeof arg) {
                    case 'object':
                        if (arg instanceof Stats) {
                            cb(null, statsLocal2Remote(arg));
                        }
                        else if (arg instanceof ApiError) {
                            cb(null, apiErrorLocal2Remote(arg));
                        }
                        else if (arg instanceof BaseFile) {
                            // Pass in p and flags from original request.
                            cb(null, fdConverter.toRemoteArg(arg, requestArgs[0], requestArgs[1], cb));
                        }
                        else if (arg instanceof FileFlag) {
                            cb(null, fileFlagLocal2Remote(arg));
                        }
                        else if (arg instanceof Buffer) {
                            cb(null, bufferLocal2Remote(arg));
                        }
                        else if (arg instanceof Error) {
                            cb(null, errorLocal2Remote(arg));
                        }
                        else {
                            cb(null, arg);
                        }
                        break;
                    default:
                        cb(null, arg);
                        break;
                }
            }
            function argRemote2Local(arg, fixedRequestArgs) {
                if (!arg) {
                    return arg;
                }
                switch (typeof arg) {
                    case 'object':
                        if (typeof arg['type'] === 'number') {
                            const specialArg = arg;
                            switch (specialArg.type) {
                                case SpecialArgType.CB:
                                    const cbId = arg.id;
                                    return function () {
                                        let i;
                                        const fixedArgs = new Array(arguments.length);
                                        let message, countdown = arguments.length;
                                        function abortAndSendError(err) {
                                            if (countdown > 0) {
                                                countdown = -1;
                                                message = {
                                                    browserfsMessage: true,
                                                    cbId: cbId,
                                                    args: [apiErrorLocal2Remote(err)]
                                                };
                                                worker.postMessage(message);
                                            }
                                        }
                                        for (i = 0; i < arguments.length; i++) {
                                            // Capture i and argument.
                                            ((i, arg) => {
                                                argLocal2Remote(arg, fixedRequestArgs, (err, fixedArg) => {
                                                    fixedArgs[i] = fixedArg;
                                                    if (err) {
                                                        abortAndSendError(err);
                                                    }
                                                    else if (--countdown === 0) {
                                                        message = {
                                                            browserfsMessage: true,
                                                            cbId: cbId,
                                                            args: fixedArgs
                                                        };
                                                        worker.postMessage(message);
                                                    }
                                                });
                                            })(i, arguments[i]);
                                        }
                                        if (arguments.length === 0) {
                                            message = {
                                                browserfsMessage: true,
                                                cbId: cbId,
                                                args: fixedArgs
                                            };
                                            worker.postMessage(message);
                                        }
                                    };
                                case SpecialArgType.API_ERROR:
                                    return apiErrorRemote2Local(specialArg);
                                case SpecialArgType.STATS:
                                    return statsRemote2Local(specialArg);
                                case SpecialArgType.FILEFLAG:
                                    return fileFlagRemote2Local(specialArg);
                                case SpecialArgType.BUFFER:
                                    return bufferRemote2Local(specialArg);
                                case SpecialArgType.ERROR:
                                    return errorRemote2Local(specialArg);
                                default:
                                    // No idea what this is.
                                    return arg;
                            }
                        }
                        else {
                            return arg;
                        }
                    default:
                        return arg;
                }
            }
            worker.addEventListener('message', (e) => {
                const request = e.data;
                if (isAPIRequest(request)) {
                    const args = request.args, fixedArgs = new Array(args.length);
                    switch (request.method) {
                        case 'close':
                        case 'sync':
                            (() => {
                                // File descriptor-relative methods.
                                const remoteCb = args[1];
                                fdConverter.applyFdAPIRequest(request, (err) => {
                                    // Send response.
                                    const response = {
                                        browserfsMessage: true,
                                        cbId: remoteCb.id,
                                        args: err ? [apiErrorLocal2Remote(err)] : []
                                    };
                                    worker.postMessage(response);
                                });
                            })();
                            break;
                        case 'probe':
                            (() => {
                                const rootFs = fs.getRootFS(), remoteCb = args[1], probeResponse = {
                                    type: SpecialArgType.PROBE,
                                    isReadOnly: rootFs.isReadOnly(),
                                    supportsLinks: rootFs.supportsLinks(),
                                    supportsProps: rootFs.supportsProps()
                                }, response = {
                                    browserfsMessage: true,
                                    cbId: remoteCb.id,
                                    args: [probeResponse]
                                };
                                worker.postMessage(response);
                            })();
                            break;
                        default:
                            // File system methods.
                            for (let i = 0; i < args.length; i++) {
                                fixedArgs[i] = argRemote2Local(args[i], fixedArgs);
                            }
                            const rootFS = fs.getRootFS();
                            rootFS[request.method].apply(rootFS, fixedArgs);
                            break;
                    }
                }
            });
        }
        getName() {
            return WorkerFS.Name;
        }
        isReadOnly() { return this._isReadOnly; }
        supportsSynch() { return false; }
        supportsLinks() { return this._supportLinks; }
        supportsProps() { return this._supportProps; }
        rename(oldPath, newPath, cb) {
            this._rpc('rename', arguments);
        }
        stat(p, isLstat, cb) {
            this._rpc('stat', arguments);
        }
        open(p, flag, mode, cb) {
            this._rpc('open', arguments);
        }
        unlink(p, cb) {
            this._rpc('unlink', arguments);
        }
        rmdir(p, cb) {
            this._rpc('rmdir', arguments);
        }
        mkdir(p, mode, cb) {
            this._rpc('mkdir', arguments);
        }
        readdir(p, cb) {
            this._rpc('readdir', arguments);
        }
        exists(p, cb) {
            this._rpc('exists', arguments);
        }
        realpath(p, cache, cb) {
            this._rpc('realpath', arguments);
        }
        truncate(p, len, cb) {
            this._rpc('truncate', arguments);
        }
        readFile(fname, encoding, flag, cb) {
            this._rpc('readFile', arguments);
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            this._rpc('writeFile', arguments);
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            this._rpc('appendFile', arguments);
        }
        chmod(p, isLchmod, mode, cb) {
            this._rpc('chmod', arguments);
        }
        chown(p, isLchown, uid, gid, cb) {
            this._rpc('chown', arguments);
        }
        utimes(p, atime, mtime, cb) {
            this._rpc('utimes', arguments);
        }
        link(srcpath, dstpath, cb) {
            this._rpc('link', arguments);
        }
        symlink(srcpath, dstpath, type, cb) {
            this._rpc('symlink', arguments);
        }
        readlink(p, cb) {
            this._rpc('readlink', arguments);
        }
        syncClose(method, fd, cb) {
            this._worker.postMessage({
                browserfsMessage: true,
                method: method,
                args: [fd.toRemoteArg(), this._callbackConverter.toRemoteArg(cb)]
            });
        }
        /**
         * Called once both local and remote sides are set up.
         */
        _initialize(cb) {
            if (!this._isInitialized) {
                const message = {
                    browserfsMessage: true,
                    method: 'probe',
                    args: [this._argLocal2Remote(emptyBuffer()), this._callbackConverter.toRemoteArg((probeResponse) => {
                            this._isInitialized = true;
                            this._isReadOnly = probeResponse.isReadOnly;
                            this._supportLinks = probeResponse.supportsLinks;
                            this._supportProps = probeResponse.supportsProps;
                            cb();
                        })]
                };
                this._worker.postMessage(message);
            }
            else {
                cb();
            }
        }
        _argRemote2Local(arg) {
            if (!arg) {
                return arg;
            }
            switch (typeof arg) {
                case 'object':
                    if (typeof arg['type'] === 'number') {
                        const specialArg = arg;
                        switch (specialArg.type) {
                            case SpecialArgType.API_ERROR:
                                return apiErrorRemote2Local(specialArg);
                            case SpecialArgType.FD:
                                const fdArg = specialArg;
                                return new WorkerFile(this, fdArg.path, FileFlag.getFileFlag(fdArg.flag), Stats.fromBuffer(transferrableObjectToBuffer(fdArg.stat)), fdArg.id, transferrableObjectToBuffer(fdArg.data));
                            case SpecialArgType.STATS:
                                return statsRemote2Local(specialArg);
                            case SpecialArgType.FILEFLAG:
                                return fileFlagRemote2Local(specialArg);
                            case SpecialArgType.BUFFER:
                                return bufferRemote2Local(specialArg);
                            case SpecialArgType.ERROR:
                                return errorRemote2Local(specialArg);
                            default:
                                return arg;
                        }
                    }
                    else {
                        return arg;
                    }
                default:
                    return arg;
            }
        }
        _rpc(methodName, args) {
            const fixedArgs = new Array(args.length);
            for (let i = 0; i < args.length; i++) {
                fixedArgs[i] = this._argLocal2Remote(args[i]);
            }
            const message = {
                browserfsMessage: true,
                method: methodName,
                args: fixedArgs
            };
            this._worker.postMessage(message);
        }
        /**
         * Converts a local argument into a remote argument. Public so WorkerFile objects can call it.
         */
        _argLocal2Remote(arg) {
            if (!arg) {
                return arg;
            }
            switch (typeof arg) {
                case "object":
                    if (arg instanceof Stats) {
                        return statsLocal2Remote(arg);
                    }
                    else if (arg instanceof ApiError) {
                        return apiErrorLocal2Remote(arg);
                    }
                    else if (arg instanceof WorkerFile) {
                        return arg.toRemoteArg();
                    }
                    else if (arg instanceof FileFlag) {
                        return fileFlagLocal2Remote(arg);
                    }
                    else if (arg instanceof Buffer) {
                        return bufferLocal2Remote(arg);
                    }
                    else if (arg instanceof Error) {
                        return errorLocal2Remote(arg);
                    }
                    else {
                        return "Unknown argument";
                    }
                case "function":
                    return this._callbackConverter.toRemoteArg(arg);
                default:
                    return arg;
            }
        }
    }
    WorkerFS.Name = "WorkerFS";
    WorkerFS.Options = {
        worker: {
            type: "object",
            description: "The target worker that you want to connect to, or the current worker if in a worker context.",
            validator: function (v, cb) {
                // Check for a `postMessage` function.
                if (v['postMessage']) {
                    cb();
                }
                else {
                    cb(new ApiError(ErrorCode.EINVAL, `option must be a Web Worker instance.`));
                }
            }
        }
    };

    return WorkerFS;
});
define('skylark-browserfs/generic/xhr',[
    '../libs/buffers',
    '../core/util',
    '../core/api_error'
], function (buffers,util, api_error) {
    'use strict';
    /**
     * Contains utility methods for performing a variety of tasks with
     * XmlHttpRequest across browsers.
     */
    const { isIE, emptyBuffer } = util;
    const { ApiError, ErrorCode } = api_error;
    const { Buffer } = buffers;

    const xhrIsAvailable = (typeof (XMLHttpRequest) !== "undefined" && XMLHttpRequest !== null);
    function asyncDownloadFileModern(p, type, cb) {
        const req = new XMLHttpRequest();
        req.open('GET', p, true);
        let jsonSupported = true;
        switch (type) {
            case 'buffer':
                req.responseType = 'arraybuffer';
                break;
            case 'json':
                // Some browsers don't support the JSON response type.
                // They either reset responseType, or throw an exception.
                // @see https://github.com/Modernizr/Modernizr/blob/master/src/testXhrType.js
                try {
                    req.responseType = 'json';
                    jsonSupported = req.responseType === 'json';
                }
                catch (e) {
                    jsonSupported = false;
                }
                break;
            default:
                return cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
        }
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            // XXX: WebKit-based browsers return *null* when XHRing an empty file.
                            return cb(null, req.response ? Buffer.from(req.response) : emptyBuffer());
                        case 'json':
                            if (jsonSupported) {
                                return cb(null, req.response);
                            }
                            else {
                                return cb(null, JSON.parse(req.responseText));
                            }
                    }
                }
                else {
                    return cb(new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`));
                }
            }
        };
        req.send();
    }
    function syncDownloadFileModern(p, type) {
        const req = new XMLHttpRequest();
        req.open('GET', p, false);
        // On most platforms, we cannot set the responseType of synchronous downloads.
        // @todo Test for this; IE10 allows this, as do older versions of Chrome/FF.
        let data = null;
        let err = null;
        // Classic hack to download binary data as a string.
        req.overrideMimeType('text/plain; charset=x-user-defined');
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            // Convert the text into a buffer.
                            const text = req.responseText;
                            data = Buffer.alloc(text.length);
                            // Throw away the upper bits of each character.
                            for (let i = 0; i < text.length; i++) {
                                // This will automatically throw away the upper bit of each
                                // character for us.
                                data[i] = text.charCodeAt(i);
                            }
                            return;
                        case 'json':
                            data = JSON.parse(req.responseText);
                            return;
                    }
                }
                else {
                    err = new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`);
                    return;
                }
            }
        };
        req.send();
        if (err) {
            throw err;
        }
        return data;
    }
    function syncDownloadFileIE10(p, type) {
        const req = new XMLHttpRequest();
        req.open('GET', p, false);
        switch (type) {
            case 'buffer':
                req.responseType = 'arraybuffer';
                break;
            case 'json':
                // IE10 does not support the JSON type.
                break;
            default:
                throw new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type);
        }
        let data;
        let err;
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            data = Buffer.from(req.response);
                            break;
                        case 'json':
                            data = JSON.parse(req.response);
                            break;
                    }
                }
                else {
                    err = new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`);
                }
            }
        };
        req.send();
        if (err) {
            throw err;
        }
        return data;
    }
    /**
     * @hidden
     */
    function getFileSize(async, p, cb) {
        const req = new XMLHttpRequest();
        req.open('HEAD', p, async);
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    try {
                        return cb(null, parseInt(req.getResponseHeader('Content-Length') || '-1', 10));
                    }
                    catch (e) {
                        // In the event that the header isn't present or there is an error...
                        return cb(new ApiError(ErrorCode.EIO, "XHR HEAD error: Could not read content-length."));
                    }
                }
                else {
                    return cb(new ApiError(ErrorCode.EIO, `XHR HEAD error: response returned code ${req.status}`));
                }
            }
        };
        req.send();
    }
    /**
     * Asynchronously download a file as a buffer or a JSON object.
     * Note that the third function signature with a non-specialized type is
     * invalid, but TypeScript requires it when you specialize string arguments to
     * constants.
     * @hidden
     */
    let asyncDownloadFile = asyncDownloadFileModern;
    /**
     * Synchronously download a file as a buffer or a JSON object.
     * Note that the third function signature with a non-specialized type is
     * invalid, but TypeScript requires it when you specialize string arguments to
     * constants.
     * @hidden
     */
    let syncDownloadFile = (isIE && typeof Blob !== 'undefined') ? syncDownloadFileIE10 : syncDownloadFileModern;
    /**
     * Synchronously retrieves the size of the given file in bytes.
     * @hidden
     */
    function getFileSizeSync(p) {
        let rv = -1;
        getFileSize(false, p, function (err, size) {
            if (err) {
                throw err;
            }
            rv = size;
        });
        return rv;
    }
    /**
     * Asynchronously retrieves the size of the given file in bytes.
     * @hidden
     */
    function getFileSizeAsync(p, cb) {
        getFileSize(true, p, cb);
    }



    return {
        xhrIsAvailable: xhrIsAvailable,
        asyncDownloadFile: asyncDownloadFile,
        syncDownloadFile: syncDownloadFile,
        getFileSizeSync: getFileSizeSync,
        getFileSizeAsync: getFileSizeAsync
    };
});
define('skylark-browserfs/generic/fetch',[
    '../libs/buffers',
    '../core/api_error'
], function (buffers,api_error) {
    'use strict';

    /**
     * Contains utility methods using 'fetch'.
     */
    const { ApiError, ErrorCode }= api_error;

    const fetchIsAvailable = (typeof (fetch) !== "undefined" && fetch !== null);
    const { Buffer } = buffers;

    function fetchFileAsync(p, type, cb) {
        let request;
        try {
            request = fetch(p);
        }
        catch (e) {
            // XXX: fetch will throw a TypeError if the URL has credentials in it
            return cb(new ApiError(ErrorCode.EINVAL, e.message));
        }
        request
            .then((res) => {
            if (!res.ok) {
                return cb(new ApiError(ErrorCode.EIO, `fetch error: response returned code ${res.status}`));
            }
            else {
                switch (type) {
                    case 'buffer':
                        res.arrayBuffer()
                            .then((buf) => cb(null, Buffer.from(buf)))
                            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
                        break;
                    case 'json':
                        res.json()
                            .then((json) => cb(null, json))
                            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
                        break;
                    default:
                        cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
                }
            }
        })
            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
    }

    /**
     * Asynchronously retrieves the size of the given file in bytes.
     * @hidden
     */

    function fetchFileSizeAsync(p, cb) {
        fetch(p, { method: 'HEAD' })
            .then((res) => {
            if (!res.ok) {
                return cb(new ApiError(ErrorCode.EIO, `fetch HEAD error: response returned code ${res.status}`));
            }
            else {
                return cb(null, parseInt(res.headers.get('Content-Length') || '-1', 10));
            }
        })
            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
    }

    return {
        fetchIsAvailable: fetchIsAvailable,
        fetchFileAsync: fetchFileAsync,
        fetchFileSizeAsync: fetchFileSizeAsync
    };
});
define('skylark-browserfs/generic/file_index',[
    '../core/node_fs_stats',
    '../libs/path'
], function (node_fs_stats, path) {
    'use strict';

    const {Stats, FileType }  = node_fs_stats;

    /**
     * A simple class for storing a filesystem index. Assumes that all paths passed
     * to it are *absolute* paths.
     *
     * Can be used as a partial or a full index, although care must be taken if used
     * for the former purpose, especially when directories are concerned.
     */
    class FileIndex {
        /**
         * Constructs a new FileIndex.
         */
        constructor() {
            // _index is a single-level key,value store that maps *directory* paths to
            // DirInodes. File information is only contained in DirInodes themselves.
            this._index = {};
            // Create the root directory.
            this.addPath('/', new DirInode());
        }
        /**
         * Static method for constructing indices from a JSON listing.
         * @param listing Directory listing generated by tools/XHRIndexer.coffee
         * @return A new FileIndex object.
         */
        static fromListing(listing) {
            const idx = new FileIndex();
            // Add a root DirNode.
            const rootInode = new DirInode();
            idx._index['/'] = rootInode;
            const queue = [['', listing, rootInode]];
            while (queue.length > 0) {
                let inode;
                const next = queue.pop();
                const pwd = next[0];
                const tree = next[1];
                const parent = next[2];
                for (const node in tree) {
                    if (tree.hasOwnProperty(node)) {
                        const children = tree[node];
                        const name = `${pwd}/${node}`;
                        if (children) {
                            idx._index[name] = inode = new DirInode();
                            queue.push([name, children, inode]);
                        }
                        else {
                            // This inode doesn't have correct size information, noted with -1.
                            inode = new FileInode(new Stats(FileType.FILE, -1, 0x16D));
                        }
                        if (parent) {
                            parent._ls[node] = inode;
                        }
                    }
                }
            }
            return idx;
        }
        /**
         * Runs the given function over all files in the index.
         */
        fileIterator(cb) {
            for (const path in this._index) {
                if (this._index.hasOwnProperty(path)) {
                    const dir = this._index[path];
                    const files = dir.getListing();
                    for (const file of files) {
                        const item = dir.getItem(file);
                        if (isFileInode(item)) {
                            cb(item.getData());
                        }
                    }
                }
            }
        }
        /**
         * Adds the given absolute path to the index if it is not already in the index.
         * Creates any needed parent directories.
         * @param path The path to add to the index.
         * @param inode The inode for the
         *   path to add.
         * @return 'True' if it was added or already exists, 'false' if there
         *   was an issue adding it (e.g. item in path is a file, item exists but is
         *   different).
         * @todo If adding fails and implicitly creates directories, we do not clean up
         *   the new empty directories.
         */
        addPath(path, inode) {
            if (!inode) {
                throw new Error('Inode must be specified');
            }
            if (path[0] !== '/') {
                throw new Error('Path must be absolute, got: ' + path);
            }
            // Check if it already exists.
            if (this._index.hasOwnProperty(path)) {
                return this._index[path] === inode;
            }
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Try to add to its parent directory first.
            let parent = this._index[dirpath];
            if (parent === undefined && path !== '/') {
                // Create parent.
                parent = new DirInode();
                if (!this.addPath(dirpath, parent)) {
                    return false;
                }
            }
            // Add myself to my parent.
            if (path !== '/') {
                if (!parent.addItem(itemname, inode)) {
                    return false;
                }
            }
            // If I'm a directory, add myself to the index.
            if (isDirInode(inode)) {
                this._index[path] = inode;
            }
            return true;
        }
        /**
         * Adds the given absolute path to the index if it is not already in the index.
         * The path is added without special treatment (no joining of adjacent separators, etc).
         * Creates any needed parent directories.
         * @param path The path to add to the index.
         * @param inode The inode for the
         *   path to add.
         * @return 'True' if it was added or already exists, 'false' if there
         *   was an issue adding it (e.g. item in path is a file, item exists but is
         *   different).
         * @todo If adding fails and implicitly creates directories, we do not clean up
         *   the new empty directories.
         */
        addPathFast(path, inode) {
            const itemNameMark = path.lastIndexOf('/');
            const parentPath = itemNameMark === 0 ? "/" : path.substring(0, itemNameMark);
            const itemName = path.substring(itemNameMark + 1);
            // Try to add to its parent directory first.
            let parent = this._index[parentPath];
            if (parent === undefined) {
                // Create parent.
                parent = new DirInode();
                this.addPathFast(parentPath, parent);
            }
            if (!parent.addItem(itemName, inode)) {
                return false;
            }
            // If adding a directory, add to the index as well.
            if (inode.isDir()) {
                this._index[path] = inode;
            }
            return true;
        }
        /**
         * Removes the given path. Can be a file or a directory.
         * @return The removed item,
         *   or null if it did not exist.
         */
        removePath(path) {
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Try to remove it from its parent directory first.
            const parent = this._index[dirpath];
            if (parent === undefined) {
                return null;
            }
            // Remove myself from my parent.
            const inode = parent.remItem(itemname);
            if (inode === null) {
                return null;
            }
            // If I'm a directory, remove myself from the index, and remove my children.
            if (isDirInode(inode)) {
                const children = inode.getListing();
                for (const child of children) {
                    this.removePath(path + '/' + child);
                }
                // Remove the directory from the index, unless it's the root.
                if (path !== '/') {
                    delete this._index[path];
                }
            }
            return inode;
        }
        /**
         * Retrieves the directory listing of the given path.
         * @return An array of files in the given path, or 'null' if it does not exist.
         */
        ls(path) {
            const item = this._index[path];
            if (item === undefined) {
                return null;
            }
            return item.getListing();
        }
        /**
         * Returns the inode of the given item.
         * @return Returns null if the item does not exist.
         */
        getInode(path) {
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Retrieve from its parent directory.
            const parent = this._index[dirpath];
            if (parent === undefined) {
                return null;
            }
            // Root case
            if (dirpath === path) {
                return parent;
            }
            return parent.getItem(itemname);
        }
        /**
         * Split into a (directory path, item name) pair
         */
        _split_path(p) {
            const dirpath = path.dirname(p);
            const itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
            return [dirpath, itemname];
        }
    }
    
    /**
     * Inode for a file. Stores an arbitrary (filesystem-specific) data payload.
     */
    class FileInode {
        constructor(data) {
            this.data = data;
        }
        isFile() { return true; }
        isDir() { return false; }
        getData() { return this.data; }
        setData(data) { this.data = data; }
    }
    /**
     * Inode for a directory. Currently only contains the directory listing.
     */
    class DirInode {
        /**
         * Constructs an inode for a directory.
         */
        constructor(data = null) {
            this.data = data;
            this._ls = {};
        }
        isFile() {
            return false;
        }
        isDir() {
            return true;
        }
        getData() { return this.data; }
        /**
         * Return a Stats object for this inode.
         * @todo Should probably remove this at some point. This isn't the
         *       responsibility of the FileIndex.
         */
        getStats() {
            return new Stats(FileType.DIRECTORY, 4096, 0x16D);
        }
        /**
         * Returns the directory listing for this directory. Paths in the directory are
         * relative to the directory's path.
         * @return The directory listing for this directory.
         */
        getListing() {
            return Object.keys(this._ls);
        }
        /**
         * Returns the inode for the indicated item, or null if it does not exist.
         * @param p Name of item in this directory.
         */
        getItem(p) {
            const item = this._ls[p];
            return item ? item : null;
        }
        /**
         * Add the given item to the directory listing. Note that the given inode is
         * not copied, and will be mutated by the DirInode if it is a DirInode.
         * @param p Item name to add to the directory listing.
         * @param inode The inode for the
         *   item to add to the directory inode.
         * @return True if it was added, false if it already existed.
         */
        addItem(p, inode) {
            if (p in this._ls) {
                return false;
            }
            this._ls[p] = inode;
            return true;
        }
        /**
         * Removes the given item from the directory listing.
         * @param p Name of item to remove from the directory listing.
         * @return Returns the item
         *   removed, or null if the item did not exist.
         */
        remItem(p) {
            const item = this._ls[p];
            if (item === undefined) {
                return null;
            }
            delete this._ls[p];
            return item;
        }
    }
    /**
     * @hidden
     */
    function isFileInode(inode) {
        return !!inode && inode.isFile();
    }
    /**
     * @hidden
     */
    function isDirInode(inode) {
        return !!inode && inode.isDir();
    }


    return {
        FileIndex: FileIndex,
        FileInode: FileInode,
        DirInode: DirInode,
        isFileInode: isFileInode,
        isDirInode: isDirInode
    };
});
define('skylark-browserfs/backend/HTTPRequest',[
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
define('skylark-browserfs/generic/extended_ascii',[],function () {
    'use strict';
    /**
     * (Nonstandard) String utility function for 8-bit ASCII with the extended
     * character set. Unlike the ASCII above, we do not mask the high bits.
     *
     * Placed into a separate file so it can be used with other Buffer implementations.
     * @see http://en.wikipedia.org/wiki/Extended_ASCII
     */
    class ExtendedASCII {
        static str2byte(str, buf) {
            const length = str.length > buf.length ? buf.length : str.length;
            for (let i = 0; i < length; i++) {
                let charCode = str.charCodeAt(i);
                if (charCode > 0x7F) {
                    // Check if extended ASCII.
                    const charIdx = ExtendedASCII.extendedChars.indexOf(str.charAt(i));
                    if (charIdx > -1) {
                        charCode = charIdx + 0x80;
                    }
                    // Otherwise, keep it as-is.
                }
                buf[charCode] = i;
            }
            return length;
        }
        static byte2str(buff) {
            const chars = new Array(buff.length);
            for (let i = 0; i < buff.length; i++) {
                const charCode = buff[i];
                if (charCode > 0x7F) {
                    chars[i] = ExtendedASCII.extendedChars[charCode - 128];
                }
                else {
                    chars[i] = String.fromCharCode(charCode);
                }
            }
            return chars.join('');
        }
        static byteLength(str) { return str.length; }
    }
    
    ExtendedASCII.extendedChars = ['\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4',
        '\u00E0', '\u00E5', '\u00E7', '\u00EA', '\u00EB', '\u00E8', '\u00EF',
        '\u00EE', '\u00EC', '\u00C4', '\u00C5', '\u00C9', '\u00E6', '\u00C6',
        '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9', '\u00FF', '\u00D6',
        '\u00DC', '\u00F8', '\u00A3', '\u00D8', '\u00D7', '\u0192', '\u00E1',
        '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1', '\u00AA', '\u00BA',
        '\u00BF', '\u00AE', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB',
        '\u00BB', '_', '_', '_', '\u00A6', '\u00A6', '\u00C1', '\u00C2', '\u00C0',
        '\u00A9', '\u00A6', '\u00A6', '+', '+', '\u00A2', '\u00A5', '+', '+', '-',
        '-', '+', '-', '+', '\u00E3', '\u00C3', '+', '+', '-', '-', '\u00A6', '-',
        '+', '\u00A4', '\u00F0', '\u00D0', '\u00CA', '\u00CB', '\u00C8', 'i',
        '\u00CD', '\u00CE', '\u00CF', '+', '+', '_', '_', '\u00A6', '\u00CC', '_',
        '\u00D3', '\u00DF', '\u00D4', '\u00D2', '\u00F5', '\u00D5', '\u00B5',
        '\u00FE', '\u00DE', '\u00DA', '\u00DB', '\u00D9', '\u00FD', '\u00DD',
        '\u00AF', '\u00B4', '\u00AD', '\u00B1', '_', '\u00BE', '\u00B6', '\u00A7',
        '\u00F7', '\u00B8', '\u00B0', '\u00A8', '\u00B7', '\u00B9', '\u00B3',
        '\u00B2', '_', ' '];

    return ExtendedASCII;
});
define('skylark-browserfs/backend/ZipFS',[
    '../core/api_error',
    '../core/node_fs_stats',
    '../core/file_system',
    '../core/file_flag',
    '../generic/preload_file',
    '../core/util',
    '../generic/extended_ascii',
    '../generic/setImmediate',
    '../generic/file_index'
], function (api_error,  node_fs_stats, file_system, file_flag, preload_file, util, ExtendedASCII, setImmediate, file_index) {
    'use strict';

    const { ApiError, ErrorCode }  = api_error;
    const { Stats, FileType }  = node_fs_stats;
    const { SynchronousFileSystem }  = file_system;
    const { ActionType }  = file_flag;
    const { NoSyncFile }  = preload_file;
    const { arrayish2Buffer, copyingSlice, bufferValidator }  = util;
    /**
     * @hidden
     */
    let inflateRaw;
    try {
        inflateRaw = require('pako/lib/inflate').inflateRaw;
    } catch (e) {
        console.warn(e);
    }
    const { FileIndex, DirInode, FileInode, isDirInode, isFileInode } = '../generic/file_index';
    /**
     * Maps CompressionMethod => function that decompresses.
     * @hidden
     */
    const decompressionMethods = {};
    /**
     * 4.4.2.2: Indicates the compatibiltiy of a file's external attributes.
     */
    var ExternalFileAttributeType;
    (function (ExternalFileAttributeType) {
        ExternalFileAttributeType[ExternalFileAttributeType["MSDOS"] = 0] = "MSDOS";
        ExternalFileAttributeType[ExternalFileAttributeType["AMIGA"] = 1] = "AMIGA";
        ExternalFileAttributeType[ExternalFileAttributeType["OPENVMS"] = 2] = "OPENVMS";
        ExternalFileAttributeType[ExternalFileAttributeType["UNIX"] = 3] = "UNIX";
        ExternalFileAttributeType[ExternalFileAttributeType["VM_CMS"] = 4] = "VM_CMS";
        ExternalFileAttributeType[ExternalFileAttributeType["ATARI_ST"] = 5] = "ATARI_ST";
        ExternalFileAttributeType[ExternalFileAttributeType["OS2_HPFS"] = 6] = "OS2_HPFS";
        ExternalFileAttributeType[ExternalFileAttributeType["MAC"] = 7] = "MAC";
        ExternalFileAttributeType[ExternalFileAttributeType["Z_SYSTEM"] = 8] = "Z_SYSTEM";
        ExternalFileAttributeType[ExternalFileAttributeType["CP_M"] = 9] = "CP_M";
        ExternalFileAttributeType[ExternalFileAttributeType["NTFS"] = 10] = "NTFS";
        ExternalFileAttributeType[ExternalFileAttributeType["MVS"] = 11] = "MVS";
        ExternalFileAttributeType[ExternalFileAttributeType["VSE"] = 12] = "VSE";
        ExternalFileAttributeType[ExternalFileAttributeType["ACORN_RISC"] = 13] = "ACORN_RISC";
        ExternalFileAttributeType[ExternalFileAttributeType["VFAT"] = 14] = "VFAT";
        ExternalFileAttributeType[ExternalFileAttributeType["ALT_MVS"] = 15] = "ALT_MVS";
        ExternalFileAttributeType[ExternalFileAttributeType["BEOS"] = 16] = "BEOS";
        ExternalFileAttributeType[ExternalFileAttributeType["TANDEM"] = 17] = "TANDEM";
        ExternalFileAttributeType[ExternalFileAttributeType["OS_400"] = 18] = "OS_400";
        ExternalFileAttributeType[ExternalFileAttributeType["OSX"] = 19] = "OSX";
    })(ExternalFileAttributeType || (ExternalFileAttributeType = {}));
    /**
     * 4.4.5
     */
    var CompressionMethod;
    (function (CompressionMethod) {
        CompressionMethod[CompressionMethod["STORED"] = 0] = "STORED";
        CompressionMethod[CompressionMethod["SHRUNK"] = 1] = "SHRUNK";
        CompressionMethod[CompressionMethod["REDUCED_1"] = 2] = "REDUCED_1";
        CompressionMethod[CompressionMethod["REDUCED_2"] = 3] = "REDUCED_2";
        CompressionMethod[CompressionMethod["REDUCED_3"] = 4] = "REDUCED_3";
        CompressionMethod[CompressionMethod["REDUCED_4"] = 5] = "REDUCED_4";
        CompressionMethod[CompressionMethod["IMPLODE"] = 6] = "IMPLODE";
        CompressionMethod[CompressionMethod["DEFLATE"] = 8] = "DEFLATE";
        CompressionMethod[CompressionMethod["DEFLATE64"] = 9] = "DEFLATE64";
        CompressionMethod[CompressionMethod["TERSE_OLD"] = 10] = "TERSE_OLD";
        CompressionMethod[CompressionMethod["BZIP2"] = 12] = "BZIP2";
        CompressionMethod[CompressionMethod["LZMA"] = 14] = "LZMA";
        CompressionMethod[CompressionMethod["TERSE_NEW"] = 18] = "TERSE_NEW";
        CompressionMethod[CompressionMethod["LZ77"] = 19] = "LZ77";
        CompressionMethod[CompressionMethod["WAVPACK"] = 97] = "WAVPACK";
        CompressionMethod[CompressionMethod["PPMD"] = 98] = "PPMD"; // PPMd version I, Rev 1
    })(CompressionMethod || (CompressionMethod = {}));
    /**
     * Converts the input time and date in MS-DOS format into a JavaScript Date
     * object.
     * @hidden
     */
    function msdos2date(time, date) {
        // MS-DOS Date
        // |0 0 0 0  0|0 0 0  0|0 0 0  0 0 0 0
        //   D (1-31)  M (1-23)  Y (from 1980)
        const day = date & 0x1F;
        // JS date is 0-indexed, DOS is 1-indexed.
        const month = ((date >> 5) & 0xF) - 1;
        const year = (date >> 9) + 1980;
        // MS DOS Time
        // |0 0 0 0  0|0 0 0  0 0 0|0  0 0 0 0
        //    Second      Minute       Hour
        const second = time & 0x1F;
        const minute = (time >> 5) & 0x3F;
        const hour = time >> 11;
        return new Date(year, month, day, hour, minute, second);
    }
    /**
     * Safely returns the string from the buffer, even if it is 0 bytes long.
     * (Normally, calling toString() on a buffer with start === end causes an
     * exception).
     * @hidden
     */
    function safeToString(buff, useUTF8, start, length) {
        if (length === 0) {
            return "";
        }
        else if (useUTF8) {
            return buff.toString('utf8', start, start + length);
        }
        else {
            return ExtendedASCII.byte2str(buff.slice(start, start + length));
        }
    }
    /*
       4.3.6 Overall .ZIP file format:

          [local file header 1]
          [encryption header 1]
          [file data 1]
          [data descriptor 1]
          .
          .
          .
          [local file header n]
          [encryption header n]
          [file data n]
          [data descriptor n]
          [archive decryption header]
          [archive extra data record]
          [central directory header 1]
          .
          .
          .
          [central directory header n]
          [zip64 end of central directory record]
          [zip64 end of central directory locator]
          [end of central directory record]
    */
    /**
     * 4.3.7  Local file header:
     *
     *     local file header signature     4 bytes  (0x04034b50)
     *     version needed to extract       2 bytes
     *     general purpose bit flag        2 bytes
     *     compression method              2 bytes
     *    last mod file time              2 bytes
     *    last mod file date              2 bytes
     *    crc-32                          4 bytes
     *    compressed size                 4 bytes
     *    uncompressed size               4 bytes
     *    file name length                2 bytes
     *    extra field length              2 bytes
     *
     *    file name (variable size)
     *    extra field (variable size)
     */
    class FileHeader {
        constructor(data) {
            this.data = data;
            if (data.readUInt32LE(0) !== 0x04034b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid Zip file: Local file header has invalid signature: " + this.data.readUInt32LE(0));
            }
        }
        versionNeeded() { return this.data.readUInt16LE(4); }
        flags() { return this.data.readUInt16LE(6); }
        compressionMethod() { return this.data.readUInt16LE(8); }
        lastModFileTime() {
            // Time and date is in MS-DOS format.
            return msdos2date(this.data.readUInt16LE(10), this.data.readUInt16LE(12));
        }
        rawLastModFileTime() {
            return this.data.readUInt32LE(10);
        }
        crc32() { return this.data.readUInt32LE(14); }
        /**
         * These two values are COMPLETELY USELESS.
         *
         * Section 4.4.9:
         *   If bit 3 of the general purpose bit flag is set,
         *   these fields are set to zero in the local header and the
         *   correct values are put in the data descriptor and
         *   in the central directory.
         *
         * So we'll just use the central directory's values.
         */
        // public compressedSize(): number { return this.data.readUInt32LE(18); }
        // public uncompressedSize(): number { return this.data.readUInt32LE(22); }
        fileNameLength() { return this.data.readUInt16LE(26); }
        extraFieldLength() { return this.data.readUInt16LE(28); }
        fileName() {
            return safeToString(this.data, this.useUTF8(), 30, this.fileNameLength());
        }
        extraField() {
            const start = 30 + this.fileNameLength();
            return this.data.slice(start, start + this.extraFieldLength());
        }
        totalSize() { return 30 + this.fileNameLength() + this.extraFieldLength(); }
        useUTF8() { return (this.flags() & 0x800) === 0x800; }
    }
    /**
     * 4.3.8  File data
     *
     *   Immediately following the local header for a file
     *   SHOULD be placed the compressed or stored data for the file.
     *   If the file is encrypted, the encryption header for the file
     *   SHOULD be placed after the local header and before the file
     *   data. The series of [local file header][encryption header]
     *   [file data][data descriptor] repeats for each file in the
     *   .ZIP archive.
     *
     *   Zero-byte files, directories, and other file types that
     *   contain no content MUST not include file data.
     */
    class FileData {
        constructor(header, record, data) {
            this.header = header;
            this.record = record;
            this.data = data;
        }
        decompress() {
            // Check the compression
            const compressionMethod = this.header.compressionMethod();
            const fcn = decompressionMethods[compressionMethod];
            if (fcn) {
                return fcn(this.data, this.record.compressedSize(), this.record.uncompressedSize(), this.record.flag());
            }
            else {
                let name = CompressionMethod[compressionMethod];
                if (!name) {
                    name = `Unknown: ${compressionMethod}`;
                }
                throw new ApiError(ErrorCode.EINVAL, `Invalid compression method on file '${this.header.fileName()}': ${name}`);
            }
        }
        getHeader() {
            return this.header;
        }
        getRecord() {
            return this.record;
        }
        getRawData() {
            return this.data;
        }
    }
    /**
     * 4.3.9  Data descriptor:
     *
     *    crc-32                          4 bytes
     *    compressed size                 4 bytes
     *    uncompressed size               4 bytes
     */
    class DataDescriptor {
        constructor(data) {
            this.data = data;
        }
        crc32() { return this.data.readUInt32LE(0); }
        compressedSize() { return this.data.readUInt32LE(4); }
        uncompressedSize() { return this.data.readUInt32LE(8); }
    }
    /*
    ` 4.3.10  Archive decryption header:

          4.3.10.1 The Archive Decryption Header is introduced in version 6.2
          of the ZIP format specification.  This record exists in support
          of the Central Directory Encryption Feature implemented as part of
          the Strong Encryption Specification as described in this document.
          When the Central Directory Structure is encrypted, this decryption
          header MUST precede the encrypted data segment.
     */
    /**
     * 4.3.11  Archive extra data record:
     *
     *      archive extra data signature    4 bytes  (0x08064b50)
     *      extra field length              4 bytes
     *      extra field data                (variable size)
     *
     *    4.3.11.1 The Archive Extra Data Record is introduced in version 6.2
     *    of the ZIP format specification.  This record MAY be used in support
     *    of the Central Directory Encryption Feature implemented as part of
     *    the Strong Encryption Specification as described in this document.
     *    When present, this record MUST immediately precede the central
     *    directory data structure.
     */
    class ArchiveExtraDataRecord {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x08064b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid archive extra data record signature: " + this.data.readUInt32LE(0));
            }
        }
        length() { return this.data.readUInt32LE(4); }
        extraFieldData() { return this.data.slice(8, 8 + this.length()); }
    }
    /**
     * 4.3.13 Digital signature:
     *
     *      header signature                4 bytes  (0x05054b50)
     *      size of data                    2 bytes
     *      signature data (variable size)
     *
     *    With the introduction of the Central Directory Encryption
     *    feature in version 6.2 of this specification, the Central
     *    Directory Structure MAY be stored both compressed and encrypted.
     *    Although not required, it is assumed when encrypting the
     *    Central Directory Structure, that it will be compressed
     *    for greater storage efficiency.  Information on the
     *    Central Directory Encryption feature can be found in the section
     *    describing the Strong Encryption Specification. The Digital
     *    Signature record will be neither compressed nor encrypted.
     */
    class DigitalSignature {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x05054b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid digital signature signature: " + this.data.readUInt32LE(0));
            }
        }
        size() { return this.data.readUInt16LE(4); }
        signatureData() { return this.data.slice(6, 6 + this.size()); }
    }
    /**
     * 4.3.12  Central directory structure:
     *
     *  central file header signature   4 bytes  (0x02014b50)
     *  version made by                 2 bytes
     *  version needed to extract       2 bytes
     *  general purpose bit flag        2 bytes
     *  compression method              2 bytes
     *  last mod file time              2 bytes
     *  last mod file date              2 bytes
     *  crc-32                          4 bytes
     *  compressed size                 4 bytes
     *  uncompressed size               4 bytes
     *  file name length                2 bytes
     *  extra field length              2 bytes
     *  file comment length             2 bytes
     *  disk number start               2 bytes
     *  internal file attributes        2 bytes
     *  external file attributes        4 bytes
     *  relative offset of local header 4 bytes
     *
     *  file name (variable size)
     *  extra field (variable size)
     *  file comment (variable size)
     */
    class CentralDirectory {
        constructor(zipData, data) {
            this.zipData = zipData;
            this.data = data;
            // Sanity check.
            if (this.data.readUInt32LE(0) !== 0x02014b50) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid Zip file: Central directory record has invalid signature: ${this.data.readUInt32LE(0)}`);
            }
            this._filename = this.produceFilename();
        }
        versionMadeBy() { return this.data.readUInt16LE(4); }
        versionNeeded() { return this.data.readUInt16LE(6); }
        flag() { return this.data.readUInt16LE(8); }
        compressionMethod() { return this.data.readUInt16LE(10); }
        lastModFileTime() {
            // Time and date is in MS-DOS format.
            return msdos2date(this.data.readUInt16LE(12), this.data.readUInt16LE(14));
        }
        rawLastModFileTime() {
            return this.data.readUInt32LE(12);
        }
        crc32() { return this.data.readUInt32LE(16); }
        compressedSize() { return this.data.readUInt32LE(20); }
        uncompressedSize() { return this.data.readUInt32LE(24); }
        fileNameLength() { return this.data.readUInt16LE(28); }
        extraFieldLength() { return this.data.readUInt16LE(30); }
        fileCommentLength() { return this.data.readUInt16LE(32); }
        diskNumberStart() { return this.data.readUInt16LE(34); }
        internalAttributes() { return this.data.readUInt16LE(36); }
        externalAttributes() { return this.data.readUInt32LE(38); }
        headerRelativeOffset() { return this.data.readUInt32LE(42); }
        produceFilename() {
            /*
              4.4.17.1 claims:
              * All slashes are forward ('/') slashes.
              * Filename doesn't begin with a slash.
              * No drive letters or any nonsense like that.
              * If filename is missing, the input came from standard input.
        
              Unfortunately, this isn't true in practice. Some Windows zip utilities use
              a backslash here, but the correct Unix-style path in file headers.
        
              To avoid seeking all over the file to recover the known-good filenames
              from file headers, we simply convert '/' to '\' here.
            */
            const fileName = safeToString(this.data, this.useUTF8(), 46, this.fileNameLength());
            return fileName.replace(/\\/g, "/");
        }
        fileName() {
            return this._filename;
        }
        rawFileName() {
            return this.data.slice(46, 46 + this.fileNameLength());
        }
        extraField() {
            const start = 44 + this.fileNameLength();
            return this.data.slice(start, start + this.extraFieldLength());
        }
        fileComment() {
            const start = 46 + this.fileNameLength() + this.extraFieldLength();
            return safeToString(this.data, this.useUTF8(), start, this.fileCommentLength());
        }
        rawFileComment() {
            const start = 46 + this.fileNameLength() + this.extraFieldLength();
            return this.data.slice(start, start + this.fileCommentLength());
        }
        totalSize() {
            return 46 + this.fileNameLength() + this.extraFieldLength() + this.fileCommentLength();
        }
        isDirectory() {
            // NOTE: This assumes that the zip file implementation uses the lower byte
            //       of external attributes for DOS attributes for
            //       backwards-compatibility. This is not mandated, but appears to be
            //       commonplace.
            //       According to the spec, the layout of external attributes is
            //       platform-dependent.
            //       If that fails, we also check if the name of the file ends in '/',
            //       which is what Java's ZipFile implementation does.
            const fileName = this.fileName();
            return (this.externalAttributes() & 0x10 ? true : false) || (fileName.charAt(fileName.length - 1) === '/');
        }
        isFile() { return !this.isDirectory(); }
        useUTF8() { return (this.flag() & 0x800) === 0x800; }
        isEncrypted() { return (this.flag() & 0x1) === 0x1; }
        getFileData() {
            // Need to grab the header before we can figure out where the actual
            // compressed data starts.
            const start = this.headerRelativeOffset();
            const header = new FileHeader(this.zipData.slice(start));
            return new FileData(header, this, this.zipData.slice(start + header.totalSize()));
        }
        getData() {
            return this.getFileData().decompress();
        }
        getRawData() {
            return this.getFileData().getRawData();
        }
        getStats() {
            return new Stats(FileType.FILE, this.uncompressedSize(), 0x16D, Date.now(), this.lastModFileTime().getTime());
        }
    }
    /**
     * 4.3.16: end of central directory record
     *  end of central dir signature    4 bytes  (0x06054b50)
     *  number of this disk             2 bytes
     *  number of the disk with the
     *  start of the central directory  2 bytes
     *  total number of entries in the
     *  central directory on this disk  2 bytes
     *  total number of entries in
     *  the central directory           2 bytes
     *  size of the central directory   4 bytes
     *  offset of start of central
     *  directory with respect to
     *  the starting disk number        4 bytes
     *  .ZIP file comment length        2 bytes
     *  .ZIP file comment       (variable size)
     */
    class EndOfCentralDirectory {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x06054b50) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid Zip file: End of central directory record has invalid signature: ${this.data.readUInt32LE(0)}`);
            }
        }
        diskNumber() { return this.data.readUInt16LE(4); }
        cdDiskNumber() { return this.data.readUInt16LE(6); }
        cdDiskEntryCount() { return this.data.readUInt16LE(8); }
        cdTotalEntryCount() { return this.data.readUInt16LE(10); }
        cdSize() { return this.data.readUInt32LE(12); }
        cdOffset() { return this.data.readUInt32LE(16); }
        cdZipCommentLength() { return this.data.readUInt16LE(20); }
        cdZipComment() {
            // Assuming UTF-8. The specification doesn't specify.
            return safeToString(this.data, true, 22, this.cdZipCommentLength());
        }
        rawCdZipComment() {
            return this.data.slice(22, 22 + this.cdZipCommentLength());
        }
    }
    /**
     * Contains the table of contents of a Zip file.
     */
    class ZipTOC {
        constructor(index, directoryEntries, eocd, data) {
            this.index = index;
            this.directoryEntries = directoryEntries;
            this.eocd = eocd;
            this.data = data;
        }
    }
    /**
     * Zip file-backed filesystem
     * Implemented according to the standard:
     * http://www.pkware.com/documents/casestudies/APPNOTE.TXT
     *
     * While there are a few zip libraries for JavaScript (e.g. JSZip and zip.js),
     * they are not a good match for BrowserFS. In particular, these libraries
     * perform a lot of unneeded data copying, and eagerly decompress every file
     * in the zip file upon loading to check the CRC32. They also eagerly decode
     * strings. Furthermore, these libraries duplicate functionality already present
     * in BrowserFS (e.g. UTF-8 decoding and binary data manipulation).
     *
     * This filesystem takes advantage of BrowserFS's Buffer implementation, which
     * efficiently represents the zip file in memory (in both ArrayBuffer-enabled
     * browsers *and* non-ArrayBuffer browsers), and which can neatly be 'sliced'
     * without copying data. Each struct defined in the standard is represented with
     * a buffer slice pointing to an offset in the zip file, and has getters for
     * each field. As we anticipate that this data will not be read often, we choose
     * not to store each struct field in the JavaScript object; instead, to reduce
     * memory consumption, we retrieve it directly from the binary data each time it
     * is requested.
     *
     * When the filesystem is instantiated, we determine the directory structure
     * of the zip file as quickly as possible. We lazily decompress and check the
     * CRC32 of files. We do not cache decompressed files; if this is a desired
     * feature, it is best implemented as a generic file system wrapper that can
     * cache data from arbitrary file systems.
     *
     * For inflation, we use `pako`'s implementation:
     * https://github.com/nodeca/pako
     *
     * Current limitations:
     * * No encryption.
     * * No ZIP64 support.
     * * Read-only.
     *   Write support would require that we:
     *   - Keep track of changed/new files.
     *   - Compress changed files, and generate appropriate metadata for each.
     *   - Update file offsets for other files in the zip file.
     *   - Stream it out to a location.
     *   This isn't that bad, so we might do this at a later date.
     */
    class ZipFS extends SynchronousFileSystem {
        constructor(input, name = '') {
            super();
            this.name = name;
            this._index = new FileIndex();
            this._directoryEntries = [];
            this._eocd = null;
            this._index = input.index;
            this._directoryEntries = input.directoryEntries;
            this._eocd = input.eocd;
            this.data = input.data;
        }
        /**
         * Constructs a ZipFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                ZipFS._computeIndex(opts.zipData, (e, zipTOC) => {
                    if (zipTOC) {
                        const fs = new ZipFS(zipTOC, opts.name);
                        cb(null, fs);
                    }
                    else {
                        cb(e);
                    }
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() { return true; }
        static RegisterDecompressionMethod(m, fcn) {
            decompressionMethods[m] = fcn;
        }
        /**
         * Locates the end of central directory record at the end of the file.
         * Throws an exception if it cannot be found.
         */
        static _getEOCD(data) {
            // Unfortunately, the comment is variable size and up to 64K in size.
            // We assume that the magic signature does not appear in the comment, and
            // in the bytes between the comment and the signature. Other ZIP
            // implementations make this same assumption, since the alternative is to
            // read thread every entry in the file to get to it. :(
            // These are *negative* offsets from the end of the file.
            const startOffset = 22;
            const endOffset = Math.min(startOffset + 0xFFFF, data.length - 1);
            // There's not even a byte alignment guarantee on the comment so we need to
            // search byte by byte. *grumble grumble*
            for (let i = startOffset; i < endOffset; i++) {
                // Magic number: EOCD Signature
                if (data.readUInt32LE(data.length - i) === 0x06054b50) {
                    return new EndOfCentralDirectory(data.slice(data.length - i));
                }
            }
            throw new ApiError(ErrorCode.EINVAL, "Invalid ZIP file: Could not locate End of Central Directory signature.");
        }
        static _addToIndex(cd, index) {
            // Paths must be absolute, yet zip file paths are always relative to the
            // zip root. So we append '/' and call it a day.
            let filename = cd.fileName();
            if (filename.charAt(0) === '/') {
                throw new ApiError(ErrorCode.EPERM, `Unexpectedly encountered an absolute path in a zip file. Please file a bug.`);
            }
            // XXX: For the file index, strip the trailing '/'.
            if (filename.charAt(filename.length - 1) === '/') {
                filename = filename.substr(0, filename.length - 1);
            }
            if (cd.isDirectory()) {
                index.addPathFast('/' + filename, new DirInode(cd));
            }
            else {
                index.addPathFast('/' + filename, new FileInode(cd));
            }
        }
        static _computeIndex(data, cb) {
            try {
                const index = new FileIndex();
                const eocd = ZipFS._getEOCD(data);
                if (eocd.diskNumber() !== eocd.cdDiskNumber()) {
                    return cb(new ApiError(ErrorCode.EINVAL, "ZipFS does not support spanned zip files."));
                }
                const cdPtr = eocd.cdOffset();
                if (cdPtr === 0xFFFFFFFF) {
                    return cb(new ApiError(ErrorCode.EINVAL, "ZipFS does not support Zip64."));
                }
                const cdEnd = cdPtr + eocd.cdSize();
                ZipFS._computeIndexResponsive(data, index, cdPtr, cdEnd, cb, [], eocd);
            }
            catch (e) {
                cb(e);
            }
        }
        static _computeIndexResponsiveTrampoline(data, index, cdPtr, cdEnd, cb, cdEntries, eocd) {
            try {
                ZipFS._computeIndexResponsive(data, index, cdPtr, cdEnd, cb, cdEntries, eocd);
            }
            catch (e) {
                cb(e);
            }
        }
        static _computeIndexResponsive(data, index, cdPtr, cdEnd, cb, cdEntries, eocd) {
            if (cdPtr < cdEnd) {
                let count = 0;
                while (count++ < 200 && cdPtr < cdEnd) {
                    const cd = new CentralDirectory(data, data.slice(cdPtr));
                    ZipFS._addToIndex(cd, index);
                    cdPtr += cd.totalSize();
                    cdEntries.push(cd);
                }
                setImmediate(() => {
                    ZipFS._computeIndexResponsiveTrampoline(data, index, cdPtr, cdEnd, cb, cdEntries, eocd);
                });
            }
            else {
                cb(null, new ZipTOC(index, cdEntries, eocd, data));
            }
        }
        getName() {
            return ZipFS.Name + (this.name !== '' ? ` ${this.name}` : '');
        }
        /**
         * Get the CentralDirectory object for the given path.
         */
        getCentralDirectoryEntry(path) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            if (isFileInode(inode)) {
                return inode.getData();
            }
            else if (isDirInode(inode)) {
                return inode.getData();
            }
            else {
                // Should never occur.
                throw ApiError.EPERM(`Invalid inode: ${inode}`);
            }
        }
        getCentralDirectoryEntryAt(index) {
            const dirEntry = this._directoryEntries[index];
            if (!dirEntry) {
                throw new RangeError(`Invalid directory index: ${index}.`);
            }
            return dirEntry;
        }
        getNumberOfCentralDirectoryEntries() {
            return this._directoryEntries.length;
        }
        getEndOfCentralDirectory() {
            return this._eocd;
        }
        diskSpace(path, cb) {
            // Read-only file system.
            cb(this.data.length, 0);
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
            return true;
        }
        statSync(path, isLstat) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData().getStats();
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
            }
            else {
                throw new ApiError(ErrorCode.EINVAL, "Invalid inode.");
            }
            return stats;
        }
        openSync(path, flags, mode) {
            // INVARIANT: Cannot write to RO file systems.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, path);
            }
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (!inode) {
                throw ApiError.ENOENT(path);
            }
            else if (isFileInode(inode)) {
                const cdRecord = inode.getData();
                const stats = cdRecord.getStats();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(path);
                    case ActionType.NOP:
                        return new NoSyncFile(this, path, flags, stats, cdRecord.getData());
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const inode = this._index.getInode(path);
            if (!inode) {
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
    }
    ZipFS.Name = "ZipFS";
    ZipFS.Options = {
        zipData: {
            type: "object",
            description: "The zip file as a Buffer object.",
            validator: bufferValidator
        },
        name: {
            type: "string",
            optional: true,
            description: "The name of the zip file (optional)."
        }
    };
    ZipFS.CompressionMethod = CompressionMethod;
    ZipFS.RegisterDecompressionMethod(CompressionMethod.DEFLATE, (data, compressedSize, uncompressedSize) => {
        return arrayish2Buffer(inflateRaw(data.slice(0, compressedSize), { chunkSize: uncompressedSize }));
    });
    ZipFS.RegisterDecompressionMethod(CompressionMethod.STORED, (data, compressedSize, uncompressedSize) => {
        return copyingSlice(data, 0, uncompressedSize);
    });

    return ZipFS;

});
define('skylark-browserfs/backend/IsoFS',[
    '../core/api_error',
    '../core/node_fs_stats',
    '../core/file_system',
    '../core/file_flag',
    '../generic/preload_file',
    '../core/util',
    '../libs/path'
], function (api_error,  node_fs_stats,file_system, file_flag, preload_file, util, path) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { Stats, FileType }  = node_fs_stats;
    const { SynchronousFileSystem }  = file_system;
    const { ActionType }  = file_flag;
    const { NoSyncFile }  = preload_file;
    const { copyingSlice, bufferValidator }  = util;

    /**
     * @hidden
     */
    const rockRidgeIdentifier = "IEEE_P1282";
    /**
     * @hidden
     */
    function getASCIIString(data, startIndex, length) {
        return data.toString('ascii', startIndex, startIndex + length).trim();
    }
    /**
     * @hidden
     */
    function getJolietString(data, startIndex, length) {
        if (length === 1) {
            // Special: Root, parent, current directory are still a single byte.
            return String.fromCharCode(data[startIndex]);
        }
        // UTF16-BE, which isn't natively supported by NodeJS Buffers.
        // Length should be even, but pessimistically floor just in case.
        const pairs = Math.floor(length / 2);
        const chars = new Array(pairs);
        for (let i = 0; i < pairs; i++) {
            const pos = startIndex + (i << 1);
            chars[i] = String.fromCharCode(data[pos + 1] | (data[pos] << 8));
        }
        return chars.join('');
    }
    /**
     * @hidden
     */
    function getDate(data, startIndex) {
        const year = parseInt(getASCIIString(data, startIndex, 4), 10);
        const mon = parseInt(getASCIIString(data, startIndex + 4, 2), 10);
        const day = parseInt(getASCIIString(data, startIndex + 6, 2), 10);
        const hour = parseInt(getASCIIString(data, startIndex + 8, 2), 10);
        const min = parseInt(getASCIIString(data, startIndex + 10, 2), 10);
        const sec = parseInt(getASCIIString(data, startIndex + 12, 2), 10);
        const hundrethsSec = parseInt(getASCIIString(data, startIndex + 14, 2), 10);
        // Last is a time-zone offset, but JavaScript dates don't support time zones well.
        return new Date(year, mon, day, hour, min, sec, hundrethsSec * 100);
    }
    /**
     * @hidden
     */
    function getShortFormDate(data, startIndex) {
        const yearsSince1900 = data[startIndex];
        const month = data[startIndex + 1];
        const day = data[startIndex + 2];
        const hour = data[startIndex + 3];
        const minute = data[startIndex + 4];
        const second = data[startIndex + 5];
        // JavaScript's Date support isn't so great; ignore timezone.
        // const offsetFromGMT = this._data[24];
        return new Date(yearsSince1900, month - 1, day, hour, minute, second);
    }
    /**
     * @hidden
     */
    function constructSystemUseEntry(bigData, i) {
        const data = bigData.slice(i);
        const sue = new SystemUseEntry(data);
        switch (sue.signatureWord()) {
            case 17221 /* CE */:
                return new CEEntry(data);
            case 20548 /* PD */:
                return new PDEntry(data);
            case 21328 /* SP */:
                return new SPEntry(data);
            case 21332 /* ST */:
                return new STEntry(data);
            case 17746 /* ER */:
                return new EREntry(data);
            case 17747 /* ES */:
                return new ESEntry(data);
            case 20568 /* PX */:
                return new PXEntry(data);
            case 20558 /* PN */:
                return new PNEntry(data);
            case 21324 /* SL */:
                return new SLEntry(data);
            case 20045 /* NM */:
                return new NMEntry(data);
            case 17228 /* CL */:
                return new CLEntry(data);
            case 20556 /* PL */:
                return new PLEntry(data);
            case 21061 /* RE */:
                return new REEntry(data);
            case 21574 /* TF */:
                return new TFEntry(data);
            case 21318 /* SF */:
                return new SFEntry(data);
            case 21074 /* RR */:
                return new RREntry(data);
            default:
                return sue;
        }
    }
    /**
     * @hidden
     */
    function constructSystemUseEntries(data, i, len, isoData) {
        // If the remaining allocated space following the last recorded System Use Entry in a System
        // Use field or Continuation Area is less than four bytes long, it cannot contain a System
        // Use Entry and shall be ignored
        len = len - 4;
        let entries = new Array();
        while (i < len) {
            const entry = constructSystemUseEntry(data, i);
            const length = entry.length();
            if (length === 0) {
                // Invalid SU section; prevent infinite loop.
                return entries;
            }
            i += length;
            if (entry instanceof STEntry) {
                // ST indicates the end of entries.
                break;
            }
            if (entry instanceof CEEntry) {
                entries = entries.concat(entry.getEntries(isoData));
            }
            else {
                entries.push(entry);
            }
        }
        return entries;
    }
    /**
     * @hidden
     */
    class VolumeDescriptor {
        constructor(data) {
            this._data = data;
        }
        type() {
            return this._data[0];
        }
        standardIdentifier() {
            return getASCIIString(this._data, 1, 5);
        }
        version() {
            return this._data[6];
        }
        data() {
            return this._data.slice(7, 2048);
        }
    }
    /**
     * @hidden
     */
    class PrimaryOrSupplementaryVolumeDescriptor extends VolumeDescriptor {
        constructor(data) {
            super(data);
            this._root = null;
        }
        systemIdentifier() {
            return this._getString32(8);
        }
        volumeIdentifier() {
            return this._getString32(40);
        }
        volumeSpaceSize() {
            return this._data.readUInt32LE(80);
        }
        volumeSetSize() {
            return this._data.readUInt16LE(120);
        }
        volumeSequenceNumber() {
            return this._data.readUInt16LE(124);
        }
        logicalBlockSize() {
            return this._data.readUInt16LE(128);
        }
        pathTableSize() {
            return this._data.readUInt32LE(132);
        }
        locationOfTypeLPathTable() {
            return this._data.readUInt32LE(140);
        }
        locationOfOptionalTypeLPathTable() {
            return this._data.readUInt32LE(144);
        }
        locationOfTypeMPathTable() {
            return this._data.readUInt32BE(148);
        }
        locationOfOptionalTypeMPathTable() {
            return this._data.readUInt32BE(152);
        }
        rootDirectoryEntry(isoData) {
            if (this._root === null) {
                this._root = this._constructRootDirectoryRecord(this._data.slice(156));
                this._root.rootCheckForRockRidge(isoData);
            }
            return this._root;
        }
        volumeSetIdentifier() {
            return this._getString(190, 128);
        }
        publisherIdentifier() {
            return this._getString(318, 128);
        }
        dataPreparerIdentifier() {
            return this._getString(446, 128);
        }
        applicationIdentifier() {
            return this._getString(574, 128);
        }
        copyrightFileIdentifier() {
            return this._getString(702, 38);
        }
        abstractFileIdentifier() {
            return this._getString(740, 36);
        }
        bibliographicFileIdentifier() {
            return this._getString(776, 37);
        }
        volumeCreationDate() {
            return getDate(this._data, 813);
        }
        volumeModificationDate() {
            return getDate(this._data, 830);
        }
        volumeExpirationDate() {
            return getDate(this._data, 847);
        }
        volumeEffectiveDate() {
            return getDate(this._data, 864);
        }
        fileStructureVersion() {
            return this._data[881];
        }
        applicationUsed() {
            return this._data.slice(883, 883 + 512);
        }
        reserved() {
            return this._data.slice(1395, 1395 + 653);
        }
        _getString32(idx) {
            return this._getString(idx, 32);
        }
    }
    /**
     * @hidden
     */
    class PrimaryVolumeDescriptor extends PrimaryOrSupplementaryVolumeDescriptor {
        constructor(data) {
            super(data);
            if (this.type() !== 1 /* PrimaryVolumeDescriptor */) {
                throw new ApiError(ErrorCode.EIO, `Invalid primary volume descriptor.`);
            }
        }
        name() {
            return "ISO9660";
        }
        _constructRootDirectoryRecord(data) {
            return new ISODirectoryRecord(data, -1);
        }
        _getString(idx, len) {
            return this._getString(idx, len);
        }
    }
    /**
     * @hidden
     */
    class SupplementaryVolumeDescriptor extends PrimaryOrSupplementaryVolumeDescriptor {
        constructor(data) {
            super(data);
            if (this.type() !== 2 /* SupplementaryVolumeDescriptor */) {
                throw new ApiError(ErrorCode.EIO, `Invalid supplementary volume descriptor.`);
            }
            const escapeSequence = this.escapeSequence();
            const third = escapeSequence[2];
            // Third character identifies what 'level' of the UCS specification to follow.
            // We ignore it.
            if (escapeSequence[0] !== 0x25 || escapeSequence[1] !== 0x2F ||
                (third !== 0x40 && third !== 0x43 && third !== 0x45)) {
                throw new ApiError(ErrorCode.EIO, `Unrecognized escape sequence for SupplementaryVolumeDescriptor: ${escapeSequence.toString()}`);
            }
        }
        name() {
            return "Joliet";
        }
        escapeSequence() {
            return this._data.slice(88, 120);
        }
        _constructRootDirectoryRecord(data) {
            return new JolietDirectoryRecord(data, -1);
        }
        _getString(idx, len) {
            return getJolietString(this._data, idx, len);
        }
    }
    /**
     * @hidden
     */
    class DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            this._suEntries = null;
            this._fileOrDir = null;
            this._data = data;
            this._rockRidgeOffset = rockRidgeOffset;
        }
        hasRockRidge() {
            return this._rockRidgeOffset > -1;
        }
        getRockRidgeOffset() {
            return this._rockRidgeOffset;
        }
        /**
         * !!ONLY VALID ON ROOT NODE!!
         * Checks if Rock Ridge is enabled, and sets the offset.
         */
        rootCheckForRockRidge(isoData) {
            const dir = this.getDirectory(isoData);
            this._rockRidgeOffset = dir.getDotEntry(isoData)._getRockRidgeOffset(isoData);
            if (this._rockRidgeOffset > -1) {
                // Wipe out directory. Start over with RR knowledge.
                this._fileOrDir = null;
            }
        }
        length() {
            return this._data[0];
        }
        extendedAttributeRecordLength() {
            return this._data[1];
        }
        lba() {
            return this._data.readUInt32LE(2) * 2048;
        }
        dataLength() {
            return this._data.readUInt32LE(10);
        }
        recordingDate() {
            return getShortFormDate(this._data, 18);
        }
        fileFlags() {
            return this._data[25];
        }
        fileUnitSize() {
            return this._data[26];
        }
        interleaveGapSize() {
            return this._data[27];
        }
        volumeSequenceNumber() {
            return this._data.readUInt16LE(28);
        }
        identifier() {
            return this._getString(33, this._data[32]);
        }
        fileName(isoData) {
            if (this.hasRockRidge()) {
                const fn = this._rockRidgeFilename(isoData);
                if (fn !== null) {
                    return fn;
                }
            }
            const ident = this.identifier();
            if (this.isDirectory(isoData)) {
                return ident;
            }
            // Files:
            // - MUST have 0x2E (.) separating the name from the extension
            // - MUST have 0x3B (;) separating the file name and extension from the version
            // Gets expanded to two-byte char in Unicode directory records.
            const versionSeparator = ident.indexOf(';');
            if (versionSeparator === -1) {
                // Some Joliet filenames lack the version separator, despite the standard
                // specifying that it should be there.
                return ident;
            }
            else if (ident[versionSeparator - 1] === '.') {
                // Empty extension. Do not include '.' in the filename.
                return ident.slice(0, versionSeparator - 1);
            }
            else {
                // Include up to version separator.
                return ident.slice(0, versionSeparator);
            }
        }
        isDirectory(isoData) {
            let rv = !!(this.fileFlags() & 2 /* Directory */);
            // If it lacks the Directory flag, it may still be a directory if we've exceeded the directory
            // depth limit. Rock Ridge marks these as files and adds a special attribute.
            if (!rv && this.hasRockRidge()) {
                rv = this.getSUEntries(isoData).filter((e) => e instanceof CLEntry).length > 0;
            }
            return rv;
        }
        isSymlink(isoData) {
            return this.hasRockRidge() && this.getSUEntries(isoData).filter((e) => e instanceof SLEntry).length > 0;
        }
        getSymlinkPath(isoData) {
            let p = "";
            const entries = this.getSUEntries(isoData);
            const getStr = this._getGetString();
            for (const entry of entries) {
                if (entry instanceof SLEntry) {
                    const components = entry.componentRecords();
                    for (const component of components) {
                        const flags = component.flags();
                        if (flags & 2 /* CURRENT */) {
                            p += "./";
                        }
                        else if (flags & 4 /* PARENT */) {
                            p += "../";
                        }
                        else if (flags & 8 /* ROOT */) {
                            p += "/";
                        }
                        else {
                            p += component.content(getStr);
                            if (!(flags & 1 /* CONTINUE */)) {
                                p += '/';
                            }
                        }
                    }
                    if (!entry.continueFlag()) {
                        // We are done with this link.
                        break;
                    }
                }
            }
            if (p.length > 1 && p[p.length - 1] === '/') {
                // Trim trailing '/'.
                return p.slice(0, p.length - 1);
            }
            else {
                return p;
            }
        }
        getFile(isoData) {
            if (this.isDirectory(isoData)) {
                throw new Error(`Tried to get a File from a directory.`);
            }
            if (this._fileOrDir === null) {
                this._fileOrDir = isoData.slice(this.lba(), this.lba() + this.dataLength());
            }
            return this._fileOrDir;
        }
        getDirectory(isoData) {
            if (!this.isDirectory(isoData)) {
                throw new Error(`Tried to get a Directory from a file.`);
            }
            if (this._fileOrDir === null) {
                this._fileOrDir = this._constructDirectory(isoData);
            }
            return this._fileOrDir;
        }
        getSUEntries(isoData) {
            if (!this._suEntries) {
                this._constructSUEntries(isoData);
            }
            return this._suEntries;
        }
        _rockRidgeFilename(isoData) {
            const nmEntries = this.getSUEntries(isoData).filter((e) => e instanceof NMEntry);
            if (nmEntries.length === 0 || nmEntries[0].flags() & (2 /* CURRENT */ | 4 /* PARENT */)) {
                return null;
            }
            let str = '';
            const getString = this._getGetString();
            for (const e of nmEntries) {
                str += e.name(getString);
                if (!(e.flags() & 1 /* CONTINUE */)) {
                    break;
                }
            }
            return str;
        }
        _constructSUEntries(isoData) {
            let i = 33 + this._data[32];
            if (i % 2 === 1) {
                // Skip padding field.
                i++;
            }
            i += this._rockRidgeOffset;
            this._suEntries = constructSystemUseEntries(this._data, i, this.length(), isoData);
        }
        /**
         * !!ONLY VALID ON FIRST ENTRY OF ROOT DIRECTORY!!
         * Returns -1 if rock ridge is not enabled. Otherwise, returns the offset
         * at which system use fields begin.
         */
        _getRockRidgeOffset(isoData) {
            // In the worst case, we get some garbage SU entries.
            // Fudge offset to 0 before proceeding.
            this._rockRidgeOffset = 0;
            const suEntries = this.getSUEntries(isoData);
            if (suEntries.length > 0) {
                const spEntry = suEntries[0];
                if (spEntry instanceof SPEntry && spEntry.checkBytesPass()) {
                    // SUSP is in use.
                    for (let i = 1; i < suEntries.length; i++) {
                        const entry = suEntries[i];
                        if (entry instanceof RREntry || (entry instanceof EREntry && entry.extensionIdentifier() === rockRidgeIdentifier)) {
                            // Rock Ridge is in use!
                            return spEntry.bytesSkipped();
                        }
                    }
                }
            }
            // Failed.
            this._rockRidgeOffset = -1;
            return -1;
        }
    }
    /**
     * @hidden
     */
    class ISODirectoryRecord extends DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            super(data, rockRidgeOffset);
        }
        _getString(i, len) {
            return getASCIIString(this._data, i, len);
        }
        _constructDirectory(isoData) {
            return new ISODirectory(this, isoData);
        }
        _getGetString() {
            return getASCIIString;
        }
    }
    /**
     * @hidden
     */
    class JolietDirectoryRecord extends DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            super(data, rockRidgeOffset);
        }
        _getString(i, len) {
            return getJolietString(this._data, i, len);
        }
        _constructDirectory(isoData) {
            return new JolietDirectory(this, isoData);
        }
        _getGetString() {
            return getJolietString;
        }
    }
    /**
     * @hidden
     */
    class SystemUseEntry {
        constructor(data) {
            this._data = data;
        }
        signatureWord() {
            return this._data.readUInt16BE(0);
        }
        signatureWordString() {
            return getASCIIString(this._data, 0, 2);
        }
        length() {
            return this._data[2];
        }
        suVersion() {
            return this._data[3];
        }
    }
    /**
     * Continuation entry.
     * @hidden
     */
    class CEEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
            this._entries = null;
        }
        /**
         * Logical block address of the continuation area.
         */
        continuationLba() {
            return this._data.readUInt32LE(4);
        }
        /**
         * Offset into the logical block.
         */
        continuationLbaOffset() {
            return this._data.readUInt32LE(12);
        }
        /**
         * Length of the continuation area.
         */
        continuationLength() {
            return this._data.readUInt32LE(20);
        }
        getEntries(isoData) {
            if (!this._entries) {
                const start = this.continuationLba() * 2048 + this.continuationLbaOffset();
                this._entries = constructSystemUseEntries(isoData, start, this.continuationLength(), isoData);
            }
            return this._entries;
        }
    }
    /**
     * Padding entry.
     * @hidden
     */
    class PDEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * Identifies that SUSP is in-use.
     * @hidden
     */
    class SPEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        checkBytesPass() {
            return this._data[4] === 0xBE && this._data[5] === 0xEF;
        }
        bytesSkipped() {
            return this._data[6];
        }
    }
    /**
     * Identifies the end of the SUSP entries.
     * @hidden
     */
    class STEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * Specifies system-specific extensions to SUSP.
     * @hidden
     */
    class EREntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        identifierLength() {
            return this._data[4];
        }
        descriptorLength() {
            return this._data[5];
        }
        sourceLength() {
            return this._data[6];
        }
        extensionVersion() {
            return this._data[7];
        }
        extensionIdentifier() {
            return getASCIIString(this._data, 8, this.identifierLength());
        }
        extensionDescriptor() {
            return getASCIIString(this._data, 8 + this.identifierLength(), this.descriptorLength());
        }
        extensionSource() {
            return getASCIIString(this._data, 8 + this.identifierLength() + this.descriptorLength(), this.sourceLength());
        }
    }
    /**
     * @hidden
     */
    class ESEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        extensionSequence() {
            return this._data[4];
        }
    }
    /**
     * RockRidge: Marks that RockRidge is in use [deprecated]
     * @hidden
     */
    class RREntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * RockRidge: Records POSIX file attributes.
     * @hidden
     */
    class PXEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        mode() {
            return this._data.readUInt32LE(4);
        }
        fileLinks() {
            return this._data.readUInt32LE(12);
        }
        uid() {
            return this._data.readUInt32LE(20);
        }
        gid() {
            return this._data.readUInt32LE(28);
        }
        inode() {
            return this._data.readUInt32LE(36);
        }
    }
    /**
     * RockRidge: Records POSIX device number.
     * @hidden
     */
    class PNEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        devTHigh() {
            return this._data.readUInt32LE(4);
        }
        devTLow() {
            return this._data.readUInt32LE(12);
        }
    }
    /**
     * RockRidge: Records symbolic link
     * @hidden
     */
    class SLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        continueFlag() {
            return this.flags() & 0x1;
        }
        componentRecords() {
            const records = new Array();
            let i = 5;
            while (i < this.length()) {
                const record = new SLComponentRecord(this._data.slice(i));
                records.push(record);
                i += record.length();
            }
            return records;
        }
    }
    /**
     * @hidden
     */
    class SLComponentRecord {
        constructor(data) {
            this._data = data;
        }
        flags() {
            return this._data[0];
        }
        length() {
            return 2 + this.componentLength();
        }
        componentLength() {
            return this._data[1];
        }
        content(getString) {
            return getString(this._data, 2, this.componentLength());
        }
    }
    /**
     * RockRidge: Records alternate file name
     * @hidden
     */
    class NMEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        name(getString) {
            return getString(this._data, 5, this.length() - 5);
        }
    }
    /**
     * RockRidge: Records child link
     * @hidden
     */
    class CLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        childDirectoryLba() {
            return this._data.readUInt32LE(4);
        }
    }
    /**
     * RockRidge: Records parent link.
     * @hidden
     */
    class PLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        parentDirectoryLba() {
            return this._data.readUInt32LE(4);
        }
    }
    /**
     * RockRidge: Records relocated directory.
     * @hidden
     */
    class REEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * RockRidge: Records file timestamps
     * @hidden
     */
    class TFEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        creation() {
            if (this.flags() & 1 /* CREATION */) {
                if (this._longFormDates()) {
                    return getDate(this._data, 5);
                }
                else {
                    return getShortFormDate(this._data, 5);
                }
            }
            else {
                return null;
            }
        }
        modify() {
            if (this.flags() & 2 /* MODIFY */) {
                const previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        access() {
            if (this.flags() & 4 /* ACCESS */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        backup() {
            if (this.flags() & 16 /* BACKUP */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        expiration() {
            if (this.flags() & 32 /* EXPIRATION */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                previousDates += (this.flags() & 16 /* BACKUP */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        effective() {
            if (this.flags() & 64 /* EFFECTIVE */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                previousDates += (this.flags() & 16 /* BACKUP */) ? 1 : 0;
                previousDates += (this.flags() & 32 /* EXPIRATION */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        _longFormDates() {
            return !!(this.flags() && 128 /* LONG_FORM */);
        }
    }
    /**
     * RockRidge: File data in sparse format.
     * @hidden
     */
    class SFEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        virtualSizeHigh() {
            return this._data.readUInt32LE(4);
        }
        virtualSizeLow() {
            return this._data.readUInt32LE(12);
        }
        tableDepth() {
            return this._data[20];
        }
    }
    /**
     * @hidden
     */
    class Directory {
        constructor(record, isoData) {
            this._fileList = [];
            this._fileMap = {};
            this._record = record;
            let i = record.lba();
            let iLimit = i + record.dataLength();
            if (!(record.fileFlags() & 2 /* Directory */)) {
                // Must have a CL entry.
                const cl = record.getSUEntries(isoData).filter((e) => e instanceof CLEntry)[0];
                i = cl.childDirectoryLba() * 2048;
                iLimit = Infinity;
            }
            while (i < iLimit) {
                const len = isoData[i];
                // Zero-padding between sectors.
                // TODO: Could optimize this to seek to nearest-sector upon
                // seeing a 0.
                if (len === 0) {
                    i++;
                    continue;
                }
                const r = this._constructDirectoryRecord(isoData.slice(i));
                const fname = r.fileName(isoData);
                // Skip '.' and '..' entries.
                if (fname !== '\u0000' && fname !== '\u0001') {
                    // Skip relocated entries.
                    if (!r.hasRockRidge() || r.getSUEntries(isoData).filter((e) => e instanceof REEntry).length === 0) {
                        this._fileMap[fname] = r;
                        this._fileList.push(fname);
                    }
                }
                else if (iLimit === Infinity) {
                    // First entry contains needed data.
                    iLimit = i + r.dataLength();
                }
                i += r.length();
            }
        }
        /**
         * Get the record with the given name.
         * Returns undefined if not present.
         */
        getRecord(name) {
            return this._fileMap[name];
        }
        getFileList() {
            return this._fileList;
        }
        getDotEntry(isoData) {
            return this._constructDirectoryRecord(isoData.slice(this._record.lba()));
        }
    }
    /**
     * @hidden
     */
    class ISODirectory extends Directory {
        constructor(record, isoData) {
            super(record, isoData);
        }
        _constructDirectoryRecord(data) {
            return new ISODirectoryRecord(data, this._record.getRockRidgeOffset());
        }
    }
    /**
     * @hidden
     */
    class JolietDirectory extends Directory {
        constructor(record, isoData) {
            super(record, isoData);
        }
        _constructDirectoryRecord(data) {
            return new JolietDirectoryRecord(data, this._record.getRockRidgeOffset());
        }
    }
    /**
     * Mounts an ISO file as a read-only file system.
     *
     * Supports:
     * * Vanilla ISO9660 ISOs
     * * Microsoft Joliet and Rock Ridge extensions to the ISO9660 standard
     */
    class IsoFS extends SynchronousFileSystem {
        /**
         * **Deprecated. Please use IsoFS.Create() method instead.**
         *
         * Constructs a read-only file system from the given ISO.
         * @param data The ISO file in a buffer.
         * @param name The name of the ISO (optional; used for debug messages / identification via getName()).
         */
        constructor(data, name = "") {
            super();
            this._data = data;
            // Skip first 16 sectors.
            let vdTerminatorFound = false;
            let i = 16 * 2048;
            const candidateVDs = new Array();
            while (!vdTerminatorFound) {
                const slice = data.slice(i);
                const vd = new VolumeDescriptor(slice);
                switch (vd.type()) {
                    case 1 /* PrimaryVolumeDescriptor */:
                        candidateVDs.push(new PrimaryVolumeDescriptor(slice));
                        break;
                    case 2 /* SupplementaryVolumeDescriptor */:
                        candidateVDs.push(new SupplementaryVolumeDescriptor(slice));
                        break;
                    case 255 /* VolumeDescriptorSetTerminator */:
                        vdTerminatorFound = true;
                        break;
                }
                i += 2048;
            }
            if (candidateVDs.length === 0) {
                throw new ApiError(ErrorCode.EIO, `Unable to find a suitable volume descriptor.`);
            }
            candidateVDs.forEach((v) => {
                // Take an SVD over a PVD.
                if (!this._pvd || this._pvd.type() !== 2 /* SupplementaryVolumeDescriptor */) {
                    this._pvd = v;
                }
            });
            this._root = this._pvd.rootDirectoryEntry(data);
            this._name = name;
        }
        /**
         * Creates an IsoFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                cb(null, new IsoFS(opts.data, opts.name));
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return true;
        }
        getName() {
            let name = `IsoFS${this._name}${this._pvd ? `-${this._pvd.name()}` : ''}`;
            if (this._root && this._root.hasRockRidge()) {
                name += `-RockRidge`;
            }
            return name;
        }
        diskSpace(path, cb) {
            // Read-only file system.
            cb(this._data.length, 0);
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
            return true;
        }
        statSync(p, isLstat) {
            const record = this._getDirectoryRecord(p);
            if (record === null) {
                throw ApiError.ENOENT(p);
            }
            return this._getStats(p, record);
        }
        openSync(p, flags, mode) {
            // INVARIANT: Cannot write to RO file systems.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, p);
            }
            // Check if the path exists, and is a file.
            const record = this._getDirectoryRecord(p);
            if (!record) {
                throw ApiError.ENOENT(p);
            }
            else if (record.isSymlink(this._data)) {
                return this.openSync(path.resolve(p, record.getSymlinkPath(this._data)), flags, mode);
            }
            else if (!record.isDirectory(this._data)) {
                const data = record.getFile(this._data);
                const stats = this._getStats(p, record);
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(p);
                    case ActionType.NOP:
                        return new NoSyncFile(this, p, flags, stats, data);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(p);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const record = this._getDirectoryRecord(path);
            if (!record) {
                throw ApiError.ENOENT(path);
            }
            else if (record.isDirectory(this._data)) {
                return record.getDirectory(this._data).getFileList().slice(0);
            }
            else {
                throw ApiError.ENOTDIR(path);
            }
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
        _getDirectoryRecord(path) {
            // Special case.
            if (path === '/') {
                return this._root;
            }
            const components = path.split('/').slice(1);
            let dir = this._root;
            for (const component of components) {
                if (dir.isDirectory(this._data)) {
                    dir = dir.getDirectory(this._data).getRecord(component);
                    if (!dir) {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
            return dir;
        }
        _getStats(p, record) {
            if (record.isSymlink(this._data)) {
                const newP = path.resolve(p, record.getSymlinkPath(this._data));
                const dirRec = this._getDirectoryRecord(newP);
                if (!dirRec) {
                    return null;
                }
                return this._getStats(newP, dirRec);
            }
            else {
                const len = record.dataLength();
                let mode = 0x16D;
                const date = record.recordingDate().getTime();
                let atime = date;
                let mtime = date;
                let ctime = date;
                if (record.hasRockRidge()) {
                    const entries = record.getSUEntries(this._data);
                    for (const entry of entries) {
                        if (entry instanceof PXEntry) {
                            mode = entry.mode();
                        }
                        else if (entry instanceof TFEntry) {
                            const flags = entry.flags();
                            if (flags & 4 /* ACCESS */) {
                                atime = entry.access().getTime();
                            }
                            if (flags & 2 /* MODIFY */) {
                                mtime = entry.modify().getTime();
                            }
                            if (flags & 1 /* CREATION */) {
                                ctime = entry.creation().getTime();
                            }
                        }
                    }
                }
                // Mask out writeable flags. This is a RO file system.
                mode = mode & 0x16D;
                return new Stats(record.isDirectory(this._data) ? FileType.DIRECTORY : FileType.FILE, len, mode, atime, mtime, ctime);
            }
        }
    }
    IsoFS.Name = "IsoFS";
    IsoFS.Options = {
        data: {
            type: "object",
            description: "The ISO file in a buffer",
            validator: bufferValidator
        }
    };


    return IsoFS;
});
define('skylark-browserfs/core/backends',[
    './util',
    '../backend/AsyncMirror',
    '../backend/Dropbox',
    '../backend/Emscripten',
    '../backend/FolderAdapter',
    '../backend/HTML5FS',
    '../backend/InMemory',
    '../backend/IndexedDB',
    '../backend/LocalStorage',
    '../backend/MountableFileSystem',
    '../backend/OverlayFS',
    '../backend/WorkerFS',
    '../backend/HTTPRequest',
    '../backend/ZipFS',
    '../backend/IsoFS'
], function (util, AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, ZipFS, IsoFS) {
    'use strict';
    const { checkOptions } = util;

    

    // Monkey-patch `Create` functions to check options before file system initialization.
    [AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, IsoFS, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, ZipFS].forEach((fsType) => {
        const create = fsType.Create;
        fsType.Create = function (opts, cb) {
            const oneArg = typeof (opts) === "function";
            const normalizedCb = oneArg ? opts : cb;
            const normalizedOpts = oneArg ? {} : opts;
            function wrappedCb(e) {
                if (e) {
                    normalizedCb(e);
                }
                else {
                    create.call(fsType, normalizedOpts, normalizedCb);
                }
            }
            checkOptions(fsType, normalizedOpts, wrappedCb);
        };
    });
    /**
     * @hidden
     */
    const Backends = { AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, IsoFS, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, XmlHttpRequest: HTTPRequest, ZipFS };
    // Make sure all backends cast to FileSystemConstructor (for type checking)
    const _ = Backends;
    // tslint:disable-next-line:no-unused-expression
    _;
    // tslint:enable-next-line:no-unused-expression
    return Backends;
});
define('skylark-browserfs/core/browserfs',[
    "skylark-langx-ns",
    '../libs/process',
    '../libs/buffers',
    './node_fs',
    '../libs/path',
    '../generic/emscripten_fs',
    './backends',
    './util',
    './api_error',
    '../generic/setImmediate'
], function (skylark,process,buffers, fs, path, EmscriptenFS, Backends, BFSUtils, Errors, setImmediate) {
    'use strict';

    const {Buffer} = buffers;
    
    /**
     * BrowserFS's main module. This is exposed in the browser via the BrowserFS global.
     * Due to limitations in typedoc, we document these functions in ./typedoc.ts.
     */
    if (process['initializeTTYs']) {
        process['initializeTTYs']();
    }
    /**
     * Installs BFSRequire as global `require`, a Node Buffer polyfill as the global `Buffer` variable,
     * and a Node process polyfill as the global `process` variable.
     */
    function install(obj) {
        obj.Buffer = Buffer;
        obj.process = process;
        const oldRequire = obj.require ? obj.require : null;
        // Monkey-patch require for Node-style code.
        obj.require = function (arg) {
            const rv = BFSRequire(arg);
            if (!rv) {
                return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0));
            }
            else {
                return rv;
            }
        };
    }
    /**
     * @hidden
     */
    function registerFileSystem(name, fs) {
        Backends[name] = fs;
    }
    function BFSRequire(module) {
        switch (module) {
            case 'fs':
                return fs;
            case 'path':
                return path;
            case 'buffer':
                // The 'buffer' module has 'Buffer' as a property.
                return buffer;
            case 'process':
                return process;
            case 'bfs_utils':
                return BFSUtils;
            default:
                return Backends[module];
        }
    }
    /**
     * Initializes BrowserFS with the given root file system.
     */
    function initialize(rootfs) {
        return fs.initialize(rootfs);
    }
    /**
     * Creates a file system with the given configuration, and initializes BrowserFS with it.
     * See the FileSystemConfiguration type for more info on the configuration object.
     */
    function configure(config, cb) {
        getFileSystem(config, (e, fs) => {
            if (fs) {
                initialize(fs);
                cb();
            }
            else {
                cb(e);
            }
        });
    }
    /**
     * Retrieve a file system with the given configuration.
     * @param config A FileSystemConfiguration object. See FileSystemConfiguration for details.
     * @param cb Called when the file system is constructed, or when an error occurs.
     */
    function getFileSystem(config, cb) {
        const fsName = config['fs'];
        if (!fsName) {
            return cb(new Errors.ApiError(Errors.ErrorCode.EPERM, 'Missing "fs" property on configuration object.'));
        }
        const options = config['options'];
        let waitCount = 0;
        let called = false;
        function finish() {
            if (!called) {
                called = true;
                const fsc = Backends[fsName];
                if (!fsc) {
                    cb(new Errors.ApiError(Errors.ErrorCode.EPERM, `File system ${fsName} is not available in BrowserFS.`));
                }
                else {
                    fsc.Create(options, cb);
                }
            }
        }
        if (options !== null && typeof (options) === "object") {
            let finishedIterating = false;
            const props = Object.keys(options).filter((k) => k !== 'fs');
            // Check recursively if other fields have 'fs' properties.
            props.forEach((p) => {
                const d = options[p];
                if (d !== null && typeof (d) === "object" && d['fs']) {
                    waitCount++;
                    getFileSystem(d, function (e, fs) {
                        waitCount--;
                        if (e) {
                            if (called) {
                                return;
                            }
                            called = true;
                            cb(e);
                        }
                        else {
                            options[p] = fs;
                            if (waitCount === 0 && finishedIterating) {
                                finish();
                            }
                        }
                    });
                }
            });
            finishedIterating = true;
        }
        if (waitCount === 0) {
            finish();
        }
    }

    return skylark.attach("intg.BrowserFS",{
        install: install,
        registerFileSystem: registerFileSystem,
        BFSRequire: BFSRequire,
        initialize: initialize,
        configure: configure,
        getFileSystem: getFileSystem,
        EmscriptenFS,
        "FileSystem" : Backends,
        Errors,
        setImmediate
    });
});
define('skylark-browserfs/main',[
    "./core/browserfs"
],function(browserfs){
    return browserfs;
});
define('skylark-browserfs', ['skylark-browserfs/main'], function (main) { return main; });


},this);
//# sourceMappingURL=sourcemaps/skylark-browserfs.js.map
