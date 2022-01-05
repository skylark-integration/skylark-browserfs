/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define([],function(){"use strict";for(var exports={byteLength:function(r){var t=h(r),e=t[0],n=t[1];return 3*(e+n)/4-n},toByteArray:function(r){var n,o,a=h(r),u=a[0],c=a[1],i=new e(function(r,t,e){return 3*(t+e)/4-e}(0,u,c)),f=0,d=c>0?u-4:u;for(o=0;o<d;o+=4)n=t[r.charCodeAt(o)]<<18|t[r.charCodeAt(o+1)]<<12|t[r.charCodeAt(o+2)]<<6|t[r.charCodeAt(o+3)],i[f++]=n>>16&255,i[f++]=n>>8&255,i[f++]=255&n;2===c&&(n=t[r.charCodeAt(o)]<<2|t[r.charCodeAt(o+1)]>>4,i[f++]=255&n);1===c&&(n=t[r.charCodeAt(o)]<<10|t[r.charCodeAt(o+1)]<<4|t[r.charCodeAt(o+2)]>>2,i[f++]=n>>8&255,i[f++]=255&n);return i},fromByteArray:function(t){for(var e,n=t.length,o=n%3,a=[],h=0,c=n-o;h<c;h+=16383)a.push(u(t,h,h+16383>c?c:h+16383));1===o?(e=t[n-1],a.push(r[e>>2]+r[e<<4&63]+"==")):2===o&&(e=(t[n-2]<<8)+t[n-1],a.push(r[e>>10]+r[e>>4&63]+r[e<<2&63]+"="));return a.join("")}},r=[],t=[],e="undefined"!=typeof Uint8Array?Uint8Array:Array,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",o=0,a=n.length;o<a;++o)r[o]=n[o],t[n.charCodeAt(o)]=o;function h(r){var t=r.length;if(t%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var e=r.indexOf("=");return-1===e&&(e=t),[e,e===t?0:4-e%4]}function u(t,e,n){for(var o,a,h=[],u=e;u<n;u+=3)o=(t[u]<<16&16711680)+(t[u+1]<<8&65280)+(255&t[u+2]),h.push(r[(a=o)>>18&63]+r[a>>12&63]+r[a>>6&63]+r[63&a]);return h.join("")}return t["-".charCodeAt(0)]=62,t["_".charCodeAt(0)]=63,exports});
//# sourceMappingURL=../sourcemaps/libs/base64.js.map
