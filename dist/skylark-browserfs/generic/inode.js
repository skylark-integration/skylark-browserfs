/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../libs/buffers","../core/node_fs_stats"],function(t,e){"use strict";const{Stats:i,FileType:s}=e,{Buffer:r}=t;class m{constructor(t,e,i,s,r,m){this.id=t,this.size=e,this.mode=i,this.atime=s,this.mtime=r,this.ctime=m}static fromBuffer(t){if(void 0===t)throw new Error("NO");return new m(t.toString("ascii",30),t.readUInt32LE(0),t.readUInt16LE(4),t.readDoubleLE(6),t.readDoubleLE(14),t.readDoubleLE(22))}toStats(){return new i((61440&this.mode)===s.DIRECTORY?s.DIRECTORY:s.FILE,this.size,this.mode,this.atime,this.mtime,this.ctime)}getSize(){return 30+this.id.length}toBuffer(t=r.alloc(this.getSize())){return t.writeUInt32LE(this.size,0),t.writeUInt16LE(this.mode,4),t.writeDoubleLE(this.atime,6),t.writeDoubleLE(this.mtime,14),t.writeDoubleLE(this.ctime,22),t.write(this.id,30,this.id.length,"ascii"),t}update(t){let e=!1;this.size!==t.size&&(this.size=t.size,e=!0),this.mode!==t.mode&&(this.mode=t.mode,e=!0);const i=t.atime.getTime();this.atime!==i&&(this.atime=i,e=!0);const s=t.mtime.getTime();this.mtime!==s&&(this.mtime=s,e=!0);const r=t.ctime.getTime();return this.ctime!==r&&(this.ctime=r,e=!0),e}isFile(){return(61440&this.mode)===s.FILE}isDirectory(){return(61440&this.mode)===s.DIRECTORY}}return m});
//# sourceMappingURL=../sourcemaps/generic/inode.js.map
