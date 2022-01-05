/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../generic/key_value_filesystem","../core/api_error","../core/global","../libs/buffer"],function(e,t,r,a){"use strict";const{SyncKeyValueFileSystem:o,SimpleSyncRWTransaction:l}=e,{ApiError:n,ErrorCode:c}=t,{Buffer:i}=a;let s,g=!1;try{r.localStorage.setItem("__test__",String.fromCharCode(55296)),g=r.localStorage.getItem("__test__")===String.fromCharCode(55296)}catch(e){g=!1}s=g?"binary_string":"binary_string_ie",i.isEncoding(s)||(s="base64");class S{name(){return u.Name}clear(){r.localStorage.clear()}beginTransaction(e){return new l(this)}get(e){try{const t=r.localStorage.getItem(e);if(null!==t)return i.from(t,s)}catch(e){}}put(e,t,a){try{return!(!a&&null!==r.localStorage.getItem(e))&&(r.localStorage.setItem(e,t.toString(s)),!0)}catch(e){throw new n(c.ENOSPC,"LocalStorage is full.")}}del(e){try{r.localStorage.removeItem(e)}catch(t){throw new n(c.EIO,"Unable to delete key "+e+": "+t)}}}class u extends o{constructor(){super({store:new S})}static Create(e,t){t(null,new u)}static isAvailable(){return void 0!==r.localStorage}}return u.Name="LocalStorage",u.Options={},u.LocalStorageStore=S,u});
//# sourceMappingURL=../sourcemaps/backend/LocalStorage.js.map
