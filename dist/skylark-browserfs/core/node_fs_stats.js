/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../libs/buffers"],function(e){"use strict";const{Buffer:t}=e;var i;!function(e){e[e.FILE=32768]="FILE",e[e.DIRECTORY=16384]="DIRECTORY",e[e.SYMLINK=40960]="SYMLINK"}(i||(i={}));class s{constructor(e,t,s,r,n,m,o){this.dev=0,this.ino=0,this.rdev=0,this.nlink=1,this.blksize=4096,this.uid=0,this.gid=0,this.fileData=null,this.size=t;let h=0;if("number"!=typeof r&&(r=h=Date.now()),"number"!=typeof n&&(h||(h=Date.now()),n=h),"number"!=typeof m&&(h||(h=Date.now()),m=h),"number"!=typeof o&&(h||(h=Date.now()),o=h),this.atimeMs=r,this.ctimeMs=m,this.mtimeMs=n,this.birthtimeMs=o,s)this.mode=s;else switch(e){case i.FILE:this.mode=420;break;case i.DIRECTORY:default:this.mode=511}this.blocks=Math.ceil(t/512),this.mode<4096&&(this.mode|=e)}static fromBuffer(e){const t=e.readUInt32LE(0),i=e.readUInt32LE(4),r=e.readDoubleLE(8),n=e.readDoubleLE(16),m=e.readDoubleLE(24);return new s(61440&i,t,4095&i,r,n,m)}static clone(e){return new s(61440&e.mode,e.size,4095&e.mode,e.atimeMs,e.mtimeMs,e.ctimeMs,e.birthtimeMs)}get atime(){return new Date(this.atimeMs)}get mtime(){return new Date(this.mtimeMs)}get ctime(){return new Date(this.ctimeMs)}get birthtime(){return new Date(this.birthtimeMs)}toBuffer(){const e=t.alloc(32);return e.writeUInt32LE(this.size,0),e.writeUInt32LE(this.mode,4),e.writeDoubleLE(this.atime.getTime(),8),e.writeDoubleLE(this.mtime.getTime(),16),e.writeDoubleLE(this.ctime.getTime(),24),e}isFile(){return(61440&this.mode)===i.FILE}isDirectory(){return(61440&this.mode)===i.DIRECTORY}isSymbolicLink(){return(61440&this.mode)===i.SYMLINK}chmod(e){this.mode=61440&this.mode|e}isSocket(){return!1}isBlockDevice(){return!1}isCharacterDevice(){return!1}isFIFO(){return!1}}return{FileType:i,Stats:s}});
//# sourceMappingURL=../sourcemaps/core/node_fs_stats.js.map
