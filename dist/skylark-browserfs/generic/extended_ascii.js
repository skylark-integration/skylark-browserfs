/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(function(){"use strict";class t{static str2byte(e,n){const r=e.length>n.length?n.length:e.length;for(let s=0;s<r;s++){let r=e.charCodeAt(s);if(r>127){const n=t.extendedChars.indexOf(e.charAt(s));n>-1&&(r=n+128)}n[r]=s}return r}static byte2str(e){const n=new Array(e.length);for(let r=0;r<e.length;r++){const s=e[r];n[r]=s>127?t.extendedChars[s-128]:String.fromCharCode(s)}return n.join("")}static byteLength(t){return t.length}}return t.extendedChars=["Ç","ü","é","â","ä","à","å","ç","ê","ë","è","ï","î","ì","Ä","Å","É","æ","Æ","ô","ö","ò","û","ù","ÿ","Ö","Ü","ø","£","Ø","×","ƒ","á","í","ó","ú","ñ","Ñ","ª","º","¿","®","¬","½","¼","¡","«","»","_","_","_","¦","¦","Á","Â","À","©","¦","¦","+","+","¢","¥","+","+","-","-","+","-","+","ã","Ã","+","+","-","-","¦","-","+","¤","ð","Ð","Ê","Ë","È","i","Í","Î","Ï","+","+","_","_","¦","Ì","_","Ó","ß","Ô","Ò","õ","Õ","µ","þ","Þ","Ú","Û","Ù","ý","Ý","¯","´","­","±","_","¾","¶","§","÷","¸","°","¨","·","¹","³","²","_"," "],t});
//# sourceMappingURL=../sourcemaps/generic/extended_ascii.js.map
