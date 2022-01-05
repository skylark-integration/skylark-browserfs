/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["./FS"],function(t){"use strict";let e=new t;const n={},o=t.prototype;return Object.getOwnPropertyNames(o).forEach(t=>{"function"==typeof e[t]?n[t]=function(){return e[t].apply(e,arguments)}:n[t]=e[t]}),n.changeFSModule=function(t){e=t},n.getFSModule=function(){return e},n.FS=t,n.Stats=t.Stats,n});
//# sourceMappingURL=../sourcemaps/core/node_fs.js.map
