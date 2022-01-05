define([
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