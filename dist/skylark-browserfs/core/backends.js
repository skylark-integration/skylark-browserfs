/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["./util","../backend/AsyncMirror","../backend/Dropbox","../backend/Emscripten","../backend/FolderAdapter","../backend/HTML5FS","../backend/InMemory","../backend/IndexedDB","../backend/LocalStorage","../backend/MountableFileSystem","../backend/OverlayFS","../backend/WorkerFS","../backend/HTTPRequest","../backend/ZipFS","../backend/IsoFS"],function(e,n,c,o,t,r,a,d,b,s,k,i,l,F,S){"use strict";const{checkOptions:u}=e;[n,c,o,t,r,a,d,S,b,s,k,i,l,F].forEach(e=>{const n=e.Create;e.Create=function(c,o){const t="function"==typeof c,r=t?c:o,a=t?{}:c;u(e,a,function(c){c?r(c):n.call(e,a,r)})}});const p={AsyncMirror:n,Dropbox:c,Emscripten:o,FolderAdapter:t,HTML5FS:r,InMemory:a,IndexedDB:d,IsoFS:S,LocalStorage:b,MountableFileSystem:s,OverlayFS:k,WorkerFS:i,HTTPRequest:l,XmlHttpRequest:l,ZipFS:F};return p});
//# sourceMappingURL=../sourcemaps/core/backends.js.map
