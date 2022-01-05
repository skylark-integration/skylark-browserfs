define(['../core/global'], function (global) {
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