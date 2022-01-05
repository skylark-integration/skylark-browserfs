define(function () {
    'use strict';
    const toExport = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global;
    return toExport;
});