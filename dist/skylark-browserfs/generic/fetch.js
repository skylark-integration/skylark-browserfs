/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../libs/buffers","../core/api_error"],function(e,t){"use strict";const{ApiError:n,ErrorCode:r}=t,s="undefined"!=typeof fetch&&null!==fetch,{Buffer:c}=e;return{fetchIsAvailable:s,fetchFileAsync:function(e,t,s){let a;try{a=fetch(e)}catch(e){return s(new n(r.EINVAL,e.message))}a.then(e=>{if(!e.ok)return s(new n(r.EIO,`fetch error: response returned code ${e.status}`));switch(t){case"buffer":e.arrayBuffer().then(e=>s(null,c.from(e))).catch(e=>s(new n(r.EIO,e.message)));break;case"json":e.json().then(e=>s(null,e)).catch(e=>s(new n(r.EIO,e.message)));break;default:s(new n(r.EINVAL,"Invalid download type: "+t))}}).catch(e=>s(new n(r.EIO,e.message)))},fetchFileSizeAsync:function(e,t){fetch(e,{method:"HEAD"}).then(e=>e.ok?t(null,parseInt(e.headers.get("Content-Length")||"-1",10)):t(new n(r.EIO,`fetch HEAD error: response returned code ${e.status}`))).catch(e=>t(new n(r.EIO,e.message)))}}});
//# sourceMappingURL=../sourcemaps/generic/fetch.js.map
