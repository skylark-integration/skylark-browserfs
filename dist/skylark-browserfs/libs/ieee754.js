/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define([],function(){"use strict";var exports={read:function(t,a,o,r,h){var M,f,e=8*h-r-1,i=(1<<e)-1,n=i>>1,w=-7,p=o?h-1:0,u=o?-1:1,N=t[a+p];for(p+=u,M=N&(1<<-w)-1,N>>=-w,w+=e;w>0;M=256*M+t[a+p],p+=u,w-=8);for(f=M&(1<<-w)-1,M>>=-w,w+=r;w>0;f=256*f+t[a+p],p+=u,w-=8);if(0===M)M=1-n;else{if(M===i)return f?NaN:1/0*(N?-1:1);f+=Math.pow(2,r),M-=n}return(N?-1:1)*f*Math.pow(2,M-r)},write:function(t,a,o,r,h,M){var f,e,i,n=8*M-h-1,w=(1<<n)-1,p=w>>1,u=23===h?Math.pow(2,-24)-Math.pow(2,-77):0,N=r?0:M-1,s=r?1:-1,c=a<0||0===a&&1/a<0?1:0;for(a=Math.abs(a),isNaN(a)||a===1/0?(e=isNaN(a)?1:0,f=w):(f=Math.floor(Math.log(a)/Math.LN2),a*(i=Math.pow(2,-f))<1&&(f--,i*=2),(a+=f+p>=1?u/i:u*Math.pow(2,1-p))*i>=2&&(f++,i/=2),f+p>=w?(e=0,f=w):f+p>=1?(e=(a*i-1)*Math.pow(2,h),f+=p):(e=a*Math.pow(2,p-1)*Math.pow(2,h),f=0));h>=8;t[o+N]=255&e,N+=s,e/=256,h-=8);for(f=f<<h|e,n+=h;n>0;t[o+N]=255&f,N+=s,f/=256,n-=8);t[o+N-s]|=128*c}};return exports});
//# sourceMappingURL=../sourcemaps/libs/ieee754.js.map
