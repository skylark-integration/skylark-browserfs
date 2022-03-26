/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["skylark-langx-ns","../libs/process","../libs/buffers","./node_fs","../libs/path","../generic/emscripten_fs","./backends","./util","./api_error","../generic/setImmediate"],function(e,r,t,i,n,s,o,c,f,u){"use strict";const{Buffer:l}=t;function a(module){switch(module){case"fs":return i;case"path":return n;case"buffer":return buffer;case"process":return r;case"bfs_utils":return c;default:return o[module]}}function p(e){return i.initialize(e)}function b(e,r){const t=e.fs;if(!t)return r(new f.ApiError(f.ErrorCode.EPERM,'Missing "fs" property on configuration object.'));const i=e.options;let n=0,s=!1;function c(){if(!s){s=!0;const e=o[t];e?e.Create(i,r):r(new f.ApiError(f.ErrorCode.EPERM,`File system ${t} is not available in BrowserFS.`))}}if(null!==i&&"object"==typeof i){let e=!1;Object.keys(i).filter(e=>"fs"!==e).forEach(t=>{const o=i[t];null!==o&&"object"==typeof o&&o.fs&&(n++,b(o,function(o,f){if(n--,o){if(s)return;s=!0,r(o)}else i[t]=f,0===n&&e&&c()}))}),e=!0}0===n&&c()}return r.initializeTTYs&&r.initializeTTYs(),e.attach("intg.BrowserFS",{install:function(e){e.Buffer=l,e.process=r;const t=e.require?e.require:null;e.require=function(e){const r=a(e);return r||t.apply(null,Array.prototype.slice.call(arguments,0))}},registerFileSystem:function(e,r){o[e]=r},BFSRequire:a,initialize:p,configure:function(e,r){b(e,(e,t)=>{t?(p(t),r()):r(e)})},getFileSystem:b,EmscriptenFS:s,FileSystem:o,Errors:f,setImmediate:u})});
//# sourceMappingURL=../sourcemaps/core/browserfs.js.map
