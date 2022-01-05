define([
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/util',
    '../core/file',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../core/global',
    '../core/node_fs'
], function (file_system, api_error, file_flag, util, file, node_fs_stats, preload_file, global, fs) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { FileFlag }  = file_flag;
    const { buffer2ArrayBuffer, arrayBuffer2Buffer, emptyBuffer }  = util;
    const { BaseFile }  = file;
    const { Stats }  = node_fs_stats;
    const {PreloadFile}  = preload_file;

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