define([
    '../libs/process',
    '../libs/buffer',
    './node_fs',
    '../libs/path',
    '../generic/emscripten_fs',
    './backends',
    './util',
    './api_error',
    '../generic/setImmediate'
], function (process,buffer, fs, path, EmscriptenFS, Backends, BFSUtils, Errors, setImmediate) {
    'use strict';

    const {Buffer} = buffer;
    
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

    return {
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
    };
});