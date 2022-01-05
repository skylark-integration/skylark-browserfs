/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../generic/key_value_filesystem"],function(e){"use strict";const{SimpleSyncRWTransaction:t,SyncKeyValueFileSystem:r}=e;class s{constructor(){this.store={}}name(){return n.Name}clear(){this.store={}}beginTransaction(e){return new t(this)}get(e){return this.store[e]}put(e,t,r){return!(!r&&this.store.hasOwnProperty(e))&&(this.store[e]=t,!0)}del(e){delete this.store[e]}}class n extends r{constructor(){super({store:new s})}static Create(e,t){t(null,new n)}}return n.Name="InMemory",n.Options={},n.InMemoryStore=s,n});
//# sourceMappingURL=../sourcemaps/backend/InMemory.js.map
