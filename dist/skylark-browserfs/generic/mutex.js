/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../generic/setImmediate"],function(t){"use strict";return class{constructor(){this._locked=!1,this._waiters=[]}lock(t){this._locked?this._waiters.push(t):(this._locked=!0,t())}unlock(){if(!this._locked)throw new Error("unlock of a non-locked mutex");const e=this._waiters.shift();e?t(e):this._locked=!1}tryLock(){return!this._locked&&(this._locked=!0,!0)}isLocked(){return this._locked}}});
//# sourceMappingURL=../sourcemaps/generic/mutex.js.map
