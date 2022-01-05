define(['./FS'], function (FS) {
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