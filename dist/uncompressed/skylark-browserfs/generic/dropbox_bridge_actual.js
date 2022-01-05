define(['../core/global'], function (global) {
    'use strict';
    const Dropbox = global.Dropbox ? global.Dropbox.Dropbox : undefined;
    return { Dropbox: Dropbox };
});