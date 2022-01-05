define(['../core/api_error'], function (api_error) {
    'use strict';

    /**
     * Contains utility methods using 'fetch'.
     */
    const { ApiError, ErrorCode }= api_error;

    const fetchIsAvailable = (typeof (fetch) !== "undefined" && fetch !== null);

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