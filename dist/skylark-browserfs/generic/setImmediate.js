/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../core/global"],function(e){"use strict";let s;if("undefined"!=typeof setImmediate)s=setImmediate;else{const t=e,n=[],o="zero-timeout-message";if(function(){if(void 0!==t.importScripts||!t.postMessage)return!1;let e=!0;const s=t.onmessage;return t.onmessage=function(){e=!1},t.postMessage("","*"),t.onmessage=s,e}()){s=function(e){n.push(e),t.postMessage(o,"*")};const e=function(e){if(e.source===self&&e.data===o&&(e.stopPropagation?e.stopPropagation():e.cancelBubble=!0,n.length>0)){return n.shift()()}};t.addEventListener?t.addEventListener("message",e,!0):t.attachEvent("onmessage",e)}else if(t.MessageChannel){const e=new t.MessageChannel;e.port1.onmessage=(e=>{if(n.length>0)return n.shift()()}),s=(s=>{n.push(s),e.port2.postMessage("")})}else s=function(e){return setTimeout(e,0)}}return s});
//# sourceMappingURL=../sourcemaps/generic/setImmediate.js.map
