/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../core/api_error"],function(e){"use strict";const{ApiError:t,ErrorCode:n}=e;return{fetchIsAvailable:"undefined"!=typeof fetch&&null!==fetch,fetchFileAsync:function(e,r,c){let s;try{s=fetch(e)}catch(e){return c(new t(n.EINVAL,e.message))}s.then(e=>{if(!e.ok)return c(new t(n.EIO,`fetch error: response returned code ${e.status}`));switch(r){case"buffer":e.arrayBuffer().then(e=>c(null,Buffer.from(e))).catch(e=>c(new t(n.EIO,e.message)));break;case"json":e.json().then(e=>c(null,e)).catch(e=>c(new t(n.EIO,e.message)));break;default:c(new t(n.EINVAL,"Invalid download type: "+r))}}).catch(e=>c(new t(n.EIO,e.message)))},fetchFileSizeAsync:function(e,r){fetch(e,{method:"HEAD"}).then(e=>e.ok?r(null,parseInt(e.headers.get("Content-Length")||"-1",10)):r(new t(n.EIO,`fetch HEAD error: response returned code ${e.status}`))).catch(e=>r(new t(n.EIO,e.message)))}}});
//# sourceMappingURL=../sourcemaps/generic/fetch.js.map
