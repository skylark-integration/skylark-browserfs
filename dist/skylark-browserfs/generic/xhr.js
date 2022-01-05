/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../core/util","../core/api_error"],function(e,t){"use strict";const{isIE:n,emptyBuffer:r}=e,{ApiError:s,ErrorCode:o}=t;function a(e,t,n){const r=new XMLHttpRequest;r.open("HEAD",t,e),r.onreadystatechange=function(e){if(4===r.readyState){if(200!==r.status)return n(new s(o.EIO,`XHR HEAD error: response returned code ${r.status}`));try{return n(null,parseInt(r.getResponseHeader("Content-Length")||"-1",10))}catch(e){return n(new s(o.EIO,"XHR HEAD error: Could not read content-length."))}}},r.send()}return{xhrIsAvailable:"undefined"!=typeof XMLHttpRequest&&null!==XMLHttpRequest,asyncDownloadFile:function(e,t,n){const a=new XMLHttpRequest;a.open("GET",e,!0);let u=!0;switch(t){case"buffer":a.responseType="arraybuffer";break;case"json":try{a.responseType="json",u="json"===a.responseType}catch(e){u=!1}break;default:return n(new s(o.EINVAL,"Invalid download type: "+t))}a.onreadystatechange=function(e){if(4===a.readyState){if(200!==a.status)return n(new s(o.EIO,`XHR error: response returned code ${a.status}`));switch(t){case"buffer":return n(null,a.response?Buffer.from(a.response):r());case"json":return n(null,u?a.response:JSON.parse(a.responseText))}}},a.send()},syncDownloadFile:n&&"undefined"!=typeof Blob?function(e,t){const n=new XMLHttpRequest;switch(n.open("GET",e,!1),t){case"buffer":n.responseType="arraybuffer";break;case"json":break;default:throw new s(o.EINVAL,"Invalid download type: "+t)}let r,a;if(n.onreadystatechange=function(e){if(4===n.readyState)if(200===n.status)switch(t){case"buffer":r=Buffer.from(n.response);break;case"json":r=JSON.parse(n.response)}else a=new s(o.EIO,`XHR error: response returned code ${n.status}`)},n.send(),a)throw a;return r}:function(e,t){const n=new XMLHttpRequest;n.open("GET",e,!1);let r=null,a=null;if(n.overrideMimeType("text/plain; charset=x-user-defined"),n.onreadystatechange=function(e){if(4===n.readyState){if(200!==n.status)return void(a=new s(o.EIO,`XHR error: response returned code ${n.status}`));switch(t){case"buffer":const e=n.responseText;r=Buffer.alloc(e.length);for(let t=0;t<e.length;t++)r[t]=e.charCodeAt(t);return;case"json":return void(r=JSON.parse(n.responseText))}}},n.send(),a)throw a;return r},getFileSizeSync:function(e){let t=-1;return a(!1,e,function(e,n){if(e)throw e;t=n}),t},getFileSizeAsync:function(e,t){a(!0,e,t)}}});
//# sourceMappingURL=../sourcemaps/generic/xhr.js.map