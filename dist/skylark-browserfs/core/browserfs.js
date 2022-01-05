/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../libs/process","../libs/buffer","./node_fs","../libs/path","../generic/emscripten_fs","./backends","./util","./api_error","../generic/setImmediate"],function(e,r,i,t,n,s,o,c,f){"use strict";const{Buffer:u}=r;function l(module){switch(module){case"fs":return i;case"path":return t;case"buffer":return r;case"process":return e;case"bfs_utils":return o;default:return s[module]}}function a(e){return i.initialize(e)}function p(e,r){const i=e.fs;if(!i)return r(new c.ApiError(c.ErrorCode.EPERM,'Missing "fs" property on configuration object.'));const t=e.options;let n=0,o=!1;function f(){if(!o){o=!0;const e=s[i];e?e.Create(t,r):r(new c.ApiError(c.ErrorCode.EPERM,`File system ${i} is not available in BrowserFS.`))}}if(null!==t&&"object"==typeof t){let e=!1;Object.keys(t).filter(e=>"fs"!==e).forEach(i=>{const s=t[i];null!==s&&"object"==typeof s&&s.fs&&(n++,p(s,function(s,c){if(n--,s){if(o)return;o=!0,r(s)}else t[i]=c,0===n&&e&&f()}))}),e=!0}0===n&&f()}return e.initializeTTYs&&e.initializeTTYs(),{install:function(r){r.Buffer=u,r.process=e;const i=r.require?r.require:null;r.require=function(e){const r=l(e);return r||i.apply(null,Array.prototype.slice.call(arguments,0))}},registerFileSystem:function(e,r){s[e]=r},BFSRequire:l,initialize:a,configure:function(e,r){p(e,(e,i)=>{i?(a(i),r()):r(e)})},getFileSystem:p,EmscriptenFS:n,FileSystem:s,Errors:c,setImmediate:f}});
//# sourceMappingURL=../sourcemaps/core/browserfs.js.map
