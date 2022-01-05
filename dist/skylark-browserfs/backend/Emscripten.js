/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../core/file_system","../core/node_fs_stats","../core/file","../core/util","../core/api_error"],function(t,r,e,i,s){"use strict";const{SynchronousFileSystem:c}=t,{Stats:n,FileType:h}=r,{BaseFile:a}=e,{uint8Array2Buffer:o,buffer2Uint8array:y}=i,{ApiError:S,ErrorCode:l,ErrorStrings:u}=s;function _(t,r=""){const e=t.errno;let i=t.node;const s=[];for(;i&&(s.unshift(i.name),i!==i.parent);)i=i.parent;return new S(e,u[e],s.length>0?"/"+s.join("/"):r)}class m extends a{constructor(t,r,e,i){super(),this._fs=t,this._FS=r,this._path=e,this._stream=i}getPos(){}close(t){let r=null;try{this.closeSync()}catch(t){r=t}finally{t(r)}}closeSync(){try{this._FS.close(this._stream)}catch(t){throw _(t,this._path)}}stat(t){try{t(null,this.statSync())}catch(r){t(r)}}statSync(){try{return this._fs.statSync(this._path,!1)}catch(t){throw _(t,this._path)}}truncate(t,r){let e=null;try{this.truncateSync(t)}catch(t){e=t}finally{r(e)}}truncateSync(t){try{this._FS.ftruncate(this._stream.fd,t)}catch(t){throw _(t,this._path)}}write(t,r,e,i,s){try{s(null,this.writeSync(t,r,e,i),t)}catch(t){s(t)}}writeSync(t,r,e,i){try{const s=y(t),c=null===i?void 0:i;return this._FS.write(this._stream,s,r,e,c)}catch(t){throw _(t,this._path)}}read(t,r,e,i,s){try{s(null,this.readSync(t,r,e,i),t)}catch(t){s(t)}}readSync(t,r,e,i){try{const s=y(t),c=null===i?void 0:i;return this._FS.read(this._stream,s,r,e,c)}catch(t){throw _(t,this._path)}}sync(t){t()}syncSync(){}chown(t,r,e){let i=null;try{this.chownSync(t,r)}catch(t){i=t}finally{e(i)}}chownSync(t,r){try{this._FS.fchown(this._stream.fd,t,r)}catch(t){throw _(t,this._path)}}chmod(t,r){let e=null;try{this.chmodSync(t)}catch(t){e=t}finally{r(e)}}chmodSync(t){try{this._FS.fchmod(this._stream.fd,t)}catch(t){throw _(t,this._path)}}utimes(t,r,e){let i=null;try{this.utimesSync(t,r)}catch(t){i=t}finally{e(i)}}utimesSync(t,r){this._fs.utimesSync(this._path,t,r)}}class F extends c{constructor(t){super(),this._FS=t}static Create(t,r){r(null,new F(t.FS))}static isAvailable(){return!0}getName(){return this._FS.DB_NAME()}isReadOnly(){return!1}supportsLinks(){return!0}supportsProps(){return!0}supportsSynch(){return!0}renameSync(t,r){try{this._FS.rename(t,r)}catch(e){throw e.errno===l.ENOENT?_(e,this.existsSync(t)?r:t):_(e)}}statSync(t,r){try{const e=r?this._FS.lstat(t):this._FS.stat(t),i=this.modeToFileType(e.mode);return new n(i,e.size,e.mode,e.atime.getTime(),e.mtime.getTime(),e.ctime.getTime())}catch(r){throw _(r,t)}}openSync(t,r,e){try{const i=this._FS.open(t,r.getFlagString(),e);if(this._FS.isDir(i.node.mode))throw this._FS.close(i),S.EISDIR(t);return new m(this,this._FS,t,i)}catch(r){throw _(r,t)}}unlinkSync(t){try{this._FS.unlink(t)}catch(r){throw _(r,t)}}rmdirSync(t){try{this._FS.rmdir(t)}catch(r){throw _(r,t)}}mkdirSync(t,r){try{this._FS.mkdir(t,r)}catch(r){throw _(r,t)}}readdirSync(t){try{return this._FS.readdir(t).filter(t=>"."!==t&&".."!==t)}catch(r){throw _(r,t)}}truncateSync(t,r){try{this._FS.truncate(t,r)}catch(r){throw _(r,t)}}readFileSync(t,r,e){try{const i=this._FS.readFile(t,{flags:e.getFlagString()}),s=o(i);return r?s.toString(r):s}catch(r){throw _(r,t)}}writeFileSync(t,r,e,i,s){try{e&&(r=Buffer.from(r,e));const c=y(r);this._FS.writeFile(t,c,{flags:i.getFlagString(),encoding:"binary"}),this._FS.chmod(t,s)}catch(r){throw _(r,t)}}chmodSync(t,r,e){try{r?this._FS.lchmod(t,e):this._FS.chmod(t,e)}catch(r){throw _(r,t)}}chownSync(t,r,e,i){try{r?this._FS.lchown(t,e,i):this._FS.chown(t,e,i)}catch(r){throw _(r,t)}}symlinkSync(t,r,e){try{this._FS.symlink(t,r)}catch(t){throw _(t)}}readlinkSync(t){try{return this._FS.readlink(t)}catch(r){throw _(r,t)}}utimesSync(t,r,e){try{this._FS.utime(t,r.getTime(),e.getTime())}catch(r){throw _(r,t)}}modeToFileType(t){if(this._FS.isDir(t))return h.DIRECTORY;if(this._FS.isFile(t))return h.FILE;if(this._FS.isLink(t))return h.SYMLINK;throw S.EPERM(`Invalid mode: ${t}`)}}return F.Name="EmscriptenFileSystem",F.Options={FS:{type:"object",description:"The Emscripten file system to use (the `FS` variable)"}},F.EmscriptenFile=m,F});
//# sourceMappingURL=../sourcemaps/backend/Emscripten.js.map
