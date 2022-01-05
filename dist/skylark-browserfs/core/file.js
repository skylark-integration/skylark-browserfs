/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["./api_error"],function(n){"use strict";const{ApiError:c,ErrorCode:e}=n;return{BaseFile:class{sync(n){n(new c(e.ENOTSUP))}syncSync(){throw new c(e.ENOTSUP)}datasync(n){this.sync(n)}datasyncSync(){return this.syncSync()}chown(n,r,s){s(new c(e.ENOTSUP))}chownSync(n,r){throw new c(e.ENOTSUP)}chmod(n,r){r(new c(e.ENOTSUP))}chmodSync(n){throw new c(e.ENOTSUP)}utimes(n,r,s){s(new c(e.ENOTSUP))}utimesSync(n,r){throw new c(e.ENOTSUP)}}}});
//# sourceMappingURL=../sourcemaps/core/file.js.map
