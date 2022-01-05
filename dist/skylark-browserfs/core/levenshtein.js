/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(function(){"use strict";function t(t,e,r,o,n){return t<e||r<e?t>r?r+1:t+1:o===n?e:e+1}return function(e,r){if(e===r)return 0;if(e.length>r.length){const t=e;e=r,r=t}let o=e.length,n=r.length;for(;o>0&&e.charCodeAt(o-1)===r.charCodeAt(n-1);)o--,n--;let c=0;for(;c<o&&e.charCodeAt(c)===r.charCodeAt(c);)c++;if(n-=c,0==(o-=c)||1===n)return n;const f=new Array(o<<1);for(let t=0;t<o;)f[o+t]=e.charCodeAt(c+t),f[t]=++t;let h,l,a,d,A;for(h=0;h+3<n;){const e=r.charCodeAt(c+(l=h)),n=r.charCodeAt(c+(a=h+1)),C=r.charCodeAt(c+(d=h+2)),u=r.charCodeAt(c+(A=h+3));let i=h+=4;for(let r=0;r<o;){const c=f[o+r],h=f[r];i=t(d=t(a=t(l=t(h,l,a,e,c),a,d,n,c),d,A,C,c),A,i,u,c),f[r++]=i,A=d,d=a,a=l,l=h}}let C=0;for(;h<n;){const t=r.charCodeAt(c+(l=h));C=++h;for(let e=0;e<o;e++){const r=f[e];f[e]=C=r<l||C<l?r>C?C+1:r+1:t===f[o+e]?l:l+1,l=r}}return C}});
//# sourceMappingURL=../sourcemaps/core/levenshtein.js.map
