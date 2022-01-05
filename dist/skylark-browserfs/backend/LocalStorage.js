/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../libs/buffers","../generic/key_value_filesystem","../core/api_error","../core/global"],function(e,t,r,a){"use strict";const{SyncKeyValueFileSystem:o,SimpleSyncRWTransaction:l}=t,{ApiError:n,ErrorCode:c}=r,{Buffer:s}=e;let i,g=!1;try{a.localStorage.setItem("__test__",String.fromCharCode(55296)),g=a.localStorage.getItem("__test__")===String.fromCharCode(55296)}catch(e){g=!1}i=g?"binary_string":"binary_string_ie",s.isEncoding(i)||(i="base64");class S{name(){return u.Name}clear(){a.localStorage.clear()}beginTransaction(e){return new l(this)}get(e){try{const t=a.localStorage.getItem(e);if(null!==t)return s.from(t,i)}catch(e){}}put(e,t,r){try{return!(!r&&null!==a.localStorage.getItem(e))&&(a.localStorage.setItem(e,t.toString(i)),!0)}catch(e){throw new n(c.ENOSPC,"LocalStorage is full.")}}del(e){try{a.localStorage.removeItem(e)}catch(t){throw new n(c.EIO,"Unable to delete key "+e+": "+t)}}}class u extends o{constructor(){super({store:new S})}static Create(e,t){t(null,new u)}static isAvailable(){return void 0!==a.localStorage}}return u.Name="LocalStorage",u.Options={},u.LocalStorageStore=S,u});
//# sourceMappingURL=../sourcemaps/backend/LocalStorage.js.map
