define([
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