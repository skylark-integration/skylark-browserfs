define([
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