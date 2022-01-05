/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../generic/preload_file","../core/file_system","../core/node_fs_stats","../core/api_error","../core/util","../generic/setImmediate","../libs/path"],function(e,t,r,s,a,n,o){"use strict";const{BaseFileSystem:i}=t,{Stats:c,FileType:l}=r,{ApiError:h,ErrorCode:u}=s,{arrayBuffer2Buffer:f,buffer2ArrayBuffer:p}=a,{dirname:_}=o,{PreloadFile:d}=e;function m(e){return"/"===e?"":e}function w(e){const t=e.error;if(t[".tag"])return t;if(t.error){const e=t.error;return e[".tag"]?e:e.reason&&e.reason[".tag"]?e.reason:e}if("string"==typeof t)try{const r=JSON.parse(t);if(r.error&&r.error.reason&&r.error.reason[".tag"])return r.error.reason}catch(e){}return t}function E(e){if(e.user_message)return e.user_message.text;if(e.error_summary)return e.error_summary;if("string"==typeof e.error)return e.error;if("object"==typeof e.error)return E(e.error);throw new Error(`Dropbox's servers gave us a garbage error message: ${JSON.stringify(e)}`)}function y(e,t,r){switch(e[".tag"]){case"malformed_path":return new h(u.EBADF,r,t);case"not_found":return h.ENOENT(t);case"not_file":return h.EISDIR(t);case"not_folder":return h.ENOTDIR(t);case"restricted_content":return h.EPERM(t);case"other":default:return new h(u.EIO,r,t)}}function b(e,t,r){switch(e[".tag"]){case"malformed_path":case"disallowed_name":return new h(u.EBADF,r,t);case"conflict":case"no_write_permission":case"team_folder":return h.EPERM(t);case"insufficient_space":return new h(u.ENOSPC,r);case"other":default:return new h(u.EIO,r,t)}}function g(e,t,r){const s={path:m(t)};e.filesDeleteV2(s).then(()=>{r()}).catch(s=>{const a=w(s);switch(a[".tag"]){case"path_lookup":r(y(a.path_lookup,t,E(s)));break;case"path_write":r(b(a.path_write,t,E(s)));break;case"too_many_write_operations":setTimeout(()=>g(e,t,r),500+300*Math.random());break;case"other":default:r(new h(u.EIO,E(s),t))}})}class k extends d{constructor(e,t,r,s,a){super(e,t,r,s,a)}sync(e){this._fs._syncFile(this.getPath(),this.getBuffer(),e)}close(e){this.sync(e)}}class I extends i{constructor(e){super(),this._client=e}static Create(e,t){t(null,new I(e.client))}static isAvailable(){return"undefined"!=typeof Dropbox}getName(){return I.Name}isReadOnly(){return!1}supportsSymlinks(){return!1}supportsProps(){return!1}supportsSynch(){return!1}empty(e){this.readdir("/",(t,r)=>{if(r){const t=s=>{0===r.length?e():g(this._client,r.shift(),t)};t()}else e(t)})}rename(e,t,r){this.stat(t,!1,(s,a)=>{const n=()=>{const s={from_path:m(e),to_path:m(t)};this._client.filesMoveV2(s).then(()=>r()).catch(function(s){const a=w(s);switch(a[".tag"]){case"from_lookup":r(y(a.from_lookup,e,E(s)));break;case"from_write":r(b(a.from_write,e,E(s)));break;case"to":r(b(a.to,t,E(s)));break;case"cant_copy_shared_folder":case"cant_nest_shared_folder":r(new h(u.EPERM,E(s),e));break;case"cant_move_folder_into_itself":case"duplicated_or_nested_paths":r(new h(u.EBADF,E(s),e));break;case"too_many_files":r(new h(u.ENOSPC,E(s),e));break;case"other":default:r(new h(u.EIO,E(s),e))}})};s?n():e===t?s?r(h.ENOENT(t)):r():a&&a.isDirectory()?r(h.EISDIR(t)):this.unlink(t,e=>{e?r(e):n()})})}stat(e,t,r){if("/"===e)return void n(function(){r(null,new c(l.DIRECTORY,4096))});const s={path:m(e)};this._client.filesGetMetadata(s).then(t=>{switch(t[".tag"]){case"file":const s=t;r(null,new c(l.FILE,s.size));break;case"folder":r(null,new c(l.DIRECTORY,4096));break;case"deleted":r(h.ENOENT(e))}}).catch(t=>{const s=w(t);switch(s[".tag"]){case"path":r(y(s.path,e,E(t)));break;default:r(new h(u.EIO,E(t),e))}})}openFile(e,t,r){const s={path:m(e)};this._client.filesDownload(s).then(s=>{const a=s.fileBlob,n=new FileReader;n.onload=(()=>{const s=n.result;r(null,new k(this,e,t,new c(l.FILE,s.byteLength),f(s)))}),n.readAsArrayBuffer(a)}).catch(t=>{const s=w(t);switch(s[".tag"]){case"path":r(y(s.path,e,E(t)));break;case"other":default:r(new h(u.EIO,E(t),e))}})}createFile(e,t,r,s){const a=Buffer.alloc(0),n={contents:new Blob([p(a)],{type:"octet/stream"}),path:m(e)};this._client.filesUpload(n).then(r=>{s(null,new k(this,e,t,new c(l.FILE,0),a))}).catch(a=>{const n=w(a);switch(n[".tag"]){case"path":s(b(n.path.reason,e,E(a)));break;case"too_many_write_operations":setTimeout(()=>this.createFile(e,t,r,s),500+300*Math.random());break;case"other":default:s(new h(u.EIO,E(a),e))}})}unlink(e,t){this.stat(e,!1,(r,s)=>{s?s.isDirectory()?t(h.EISDIR(e)):g(this._client,e,t):t(r)})}rmdir(e,t){this.readdir(e,(r,s)=>{s?s.length>0?t(h.ENOTEMPTY(e)):g(this._client,e,t):t(r)})}mkdir(e,t,r){const s=_(e);this.stat(s,!1,(a,n)=>{if(a)r(a);else if(n&&!n.isDirectory())r(h.ENOTDIR(s));else{const s={path:m(e)};this._client.filesCreateFolderV2(s).then(()=>r()).catch(s=>{"too_many_write_operations"===w(s)[".tag"]?setTimeout(()=>this.mkdir(e,t,r),500+300*Math.random()):r(b(w(s).path,e,E(s)))})}})}readdir(e,t){const r={path:m(e)};this._client.filesListFolder(r).then(r=>{!function e(t,r,s,a,n){const o=s.entries.map(e=>e.path_display).filter(e=>!!e);const i=a.concat(o);if(s.has_more){const a={cursor:s.cursor};t.filesListFolderContinue(a).then(s=>{e(t,r,s,i,n)}).catch(e=>{O(e,r,n)})}else n(null,i)}(this._client,e,r,[],t)}).catch(r=>{O(r,e,t)})}_syncFile(e,t,r){const s={contents:new Blob([p(t)],{type:"octet/stream"}),path:m(e),mode:{".tag":"overwrite"}};this._client.filesUpload(s).then(()=>{r()}).catch(s=>{const a=w(s);switch(a[".tag"]){case"path":r(b(a.path.reason,e,E(s)));break;case"too_many_write_operations":setTimeout(()=>this._syncFile(e,t,r),500+300*Math.random());break;case"other":default:r(new h(u.EIO,E(s),e))}})}}function O(e,t,r){const s=w(e);switch(s[".tag"]){case"path":r(y(s.path,t,E(e)));break;case"other":default:r(new h(u.EIO,E(e),t))}}return I.Name="DropboxV2",I.Options={client:{type:"object",description:"An *authenticated* Dropbox client. Must be from the 2.5.x JS SDK."}},I.DropboxFile=k,I});
//# sourceMappingURL=../sourcemaps/backend/Dropbox.js.map