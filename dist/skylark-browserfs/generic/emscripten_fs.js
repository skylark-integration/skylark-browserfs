/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["../core/node_fs","../core/util"],function(t,r){"use strict";const{uint8Array2Buffer:s}=r;class e{constructor(t){this.fs=t,this.nodefs=t.getNodeFS(),this.FS=t.getFS(),this.PATH=t.getPATH(),this.ERRNO_CODES=t.getERRNO_CODES()}open(t){const r=this.fs.realPath(t.node),s=this.FS;try{s.isFile(t.node.mode)&&(t.nfd=this.nodefs.openSync(r,this.fs.flagsToPermissionString(t.flags)))}catch(t){if(!t.code)throw t;throw new s.ErrnoError(this.ERRNO_CODES[t.code])}}close(t){const r=this.FS;try{r.isFile(t.node.mode)&&t.nfd&&this.nodefs.closeSync(t.nfd)}catch(t){if(!t.code)throw t;throw new r.ErrnoError(this.ERRNO_CODES[t.code])}}read(t,r,e,o,i){try{return this.nodefs.readSync(t.nfd,s(r),e,o,i)}catch(t){throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}write(t,r,e,o,i){try{return this.nodefs.writeSync(t.nfd,s(r),e,o,i)}catch(t){throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}llseek(t,r,s){let e=r;if(1===s)e+=t.position;else if(2===s&&this.FS.isFile(t.node.mode))try{e+=this.nodefs.fstatSync(t.nfd).size}catch(t){throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}if(e<0)throw new this.FS.ErrnoError(this.ERRNO_CODES.EINVAL);return t.position=e,e}}class o{constructor(t){this.fs=t,this.nodefs=t.getNodeFS(),this.FS=t.getFS(),this.PATH=t.getPATH(),this.ERRNO_CODES=t.getERRNO_CODES()}getattr(t){const r=this.fs.realPath(t);let s;try{s=this.nodefs.lstatSync(r)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}return{dev:s.dev,ino:s.ino,mode:s.mode,nlink:s.nlink,uid:s.uid,gid:s.gid,rdev:s.rdev,size:s.size,atime:s.atime,mtime:s.mtime,ctime:s.ctime,blksize:s.blksize,blocks:s.blocks}}setattr(t,r){const s=this.fs.realPath(t);try{if(void 0!==r.mode&&(this.nodefs.chmodSync(s,r.mode),t.mode=r.mode),void 0!==r.timestamp){const t=new Date(r.timestamp);this.nodefs.utimesSync(s,t,t)}}catch(t){if(!t.code)throw t;if("ENOTSUP"!==t.code)throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}if(void 0!==r.size)try{this.nodefs.truncateSync(s,r.size)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}lookup(t,r){const s=this.PATH.join2(this.fs.realPath(t),r),e=this.fs.getMode(s);return this.fs.createNode(t,r,e)}mknod(t,r,s,e){const o=this.fs.createNode(t,r,s,e),i=this.fs.realPath(o);try{this.FS.isDir(o.mode)?this.nodefs.mkdirSync(i,o.mode):this.nodefs.writeFileSync(i,"",{mode:o.mode})}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}return o}rename(t,r,s){const e=this.fs.realPath(t),o=this.PATH.join2(this.fs.realPath(r),s);try{this.nodefs.renameSync(e,o),t.name=s,t.parent=r}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}unlink(t,r){const s=this.PATH.join2(this.fs.realPath(t),r);try{this.nodefs.unlinkSync(s)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}rmdir(t,r){const s=this.PATH.join2(this.fs.realPath(t),r);try{this.nodefs.rmdirSync(s)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}readdir(t){const r=this.fs.realPath(t);try{const t=this.nodefs.readdirSync(r);return t.push(".",".."),t}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}symlink(t,r,s){const e=this.PATH.join2(this.fs.realPath(t),r);try{this.nodefs.symlinkSync(s,e)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}readlink(t){const r=this.fs.realPath(t);try{return this.nodefs.readlinkSync(r)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}}}return class{constructor(r=self.FS,s=self.PATH,i=self.ERRNO_CODES,n=t){this.flagsToPermissionStringMap={0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},this.nodefs=n,this.FS=r,this.PATH=s,this.ERRNO_CODES=i,this.node_ops=new o(this),this.stream_ops=new e(this)}mount(t){return this.createNode(null,"/",this.getMode(t.opts.root),0)}createNode(t,r,s,e){const o=this.FS;if(!o.isDir(s)&&!o.isFile(s)&&!o.isLink(s))throw new o.ErrnoError(this.ERRNO_CODES.EINVAL);const i=o.createNode(t,r,s);return i.node_ops=this.node_ops,i.stream_ops=this.stream_ops,i}getMode(t){let r;try{r=this.nodefs.lstatSync(t)}catch(t){if(!t.code)throw t;throw new this.FS.ErrnoError(this.ERRNO_CODES[t.code])}return r.mode}realPath(t){const r=[];for(;t.parent!==t;)r.push(t.name),t=t.parent;return r.push(t.mount.opts.root),r.reverse(),this.PATH.join.apply(null,r)}flagsToPermissionString(t){let r="string"==typeof t?parseInt(t,10):t;return(r&=8191)in this.flagsToPermissionStringMap?this.flagsToPermissionStringMap[r]:t}getNodeFS(){return this.nodefs}getFS(){return this.FS}getPATH(){return this.PATH}getERRNO_CODES(){return this.ERRNO_CODES}}});
//# sourceMappingURL=../sourcemaps/generic/emscripten_fs.js.map