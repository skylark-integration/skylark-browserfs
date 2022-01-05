/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../generic/key_value_filesystem","../core/api_error","../core/global","../core/util"],function(e,t,r,s){"use strict";const{AsyncKeyValueFileSystem:n}=e,{ApiError:o,ErrorCode:c}=t,{arrayBuffer2Buffer:a,buffer2ArrayBuffer:i}=s,u=r.indexedDB||r.mozIndexedDB||r.webkitIndexedDB||r.msIndexedDB;function l(e,t=e.toString()){switch(e.name){case"NotFoundError":return new o(c.ENOENT,t);case"QuotaExceededError":return new o(c.ENOSPC,t);default:return new o(c.EIO,t)}}function d(e,t=c.EIO,r=null){return function(s){s.preventDefault(),e(new o(t,null!==r?r:void 0))}}class h{constructor(e,t){this.tx=e,this.store=t}get(e,t){try{const r=this.store.get(e);r.onerror=d(t),r.onsuccess=(e=>{const r=e.target.result;t(null,void 0===r?r:a(r))})}catch(e){t(l(e))}}}class f extends h{constructor(e,t){super(e,t)}put(e,t,r,s){try{const n=i(t);let o;(o=r?this.store.put(n,e):this.store.add(n,e)).onerror=d(s),o.onsuccess=(e=>{s(null,!0)})}catch(e){s(l(e))}}del(e,t){try{const r=this.store.delete(e);r.onerror=d(t),r.onsuccess=(e=>{t()})}catch(e){t(l(e))}}commit(e){setTimeout(e,0)}abort(e){let t=null;try{this.tx.abort()}catch(e){t=l(e)}finally{e(t)}}}class m{constructor(e,t){this.db=e,this.storeName=t}static Create(e,t){const r=u.open(e,1);r.onupgradeneeded=(t=>{const r=t.target.result;r.objectStoreNames.contains(e)&&r.deleteObjectStore(e),r.createObjectStore(e)}),r.onsuccess=(r=>{t(null,new m(r.target.result,e))}),r.onerror=d(t,c.EACCES)}name(){return b.Name+" - "+this.storeName}clear(e){try{const t=this.db.transaction(this.storeName,"readwrite").objectStore(this.storeName).clear();t.onsuccess=(t=>{setTimeout(e,0)}),t.onerror=d(e)}catch(t){e(l(t))}}beginTransaction(e="readonly"){const t=this.db.transaction(this.storeName,e),r=t.objectStore(this.storeName);if("readwrite"===e)return new f(t,r);if("readonly"===e)return new h(t,r);throw new o(c.EINVAL,"Invalid transaction type.")}}class b extends n{constructor(e){super(e)}static Create(e={},t){m.Create(e.storeName?e.storeName:"browserfs",(r,s)=>{if(s){const r=new b("number"==typeof e.cacheSize?e.cacheSize:100);r.init(s,e=>{e?t(e):t(null,r)})}else t(r)})}static isAvailable(){try{return void 0!==u&&null!==u.open("__browserfs_test__")}catch(e){return!1}}}return b.Name="IndexedDB",b.Options={storeName:{type:"string",optional:!0,description:"The name of this file system. You can have multiple IndexedDB file systems operating at once, but each must have a different name."},cacheSize:{type:"number",optional:!0,description:"The size of the inode cache. Defaults to 100. A size of 0 or below disables caching."}},b.IndexedDBROTransaction=h,b.IndexedDBRWTransaction=f,b.IndexedDBStore=m,b});
//# sourceMappingURL=../sourcemaps/backend/IndexedDB.js.map