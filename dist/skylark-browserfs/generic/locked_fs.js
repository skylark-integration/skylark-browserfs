/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["./mutex"],function(i){"use strict";return class{constructor(s){this._fs=s,this._mu=new i}getName(){return"LockedFS<"+this._fs.getName()+">"}getFSUnlocked(){return this._fs}diskSpace(i,s){this._fs.diskSpace(i,s)}isReadOnly(){return this._fs.isReadOnly()}supportsLinks(){return this._fs.supportsLinks()}supportsProps(){return this._fs.supportsProps()}supportsSynch(){return this._fs.supportsSynch()}rename(i,s,t){this._mu.lock(()=>{this._fs.rename(i,s,i=>{this._mu.unlock(),t(i)})})}renameSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.renameSync(i,s)}stat(i,s,t){this._mu.lock(()=>{this._fs.stat(i,s,(i,s)=>{this._mu.unlock(),t(i,s)})})}statSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.statSync(i,s)}open(i,s,t,n){this._mu.lock(()=>{this._fs.open(i,s,t,(i,s)=>{this._mu.unlock(),n(i,s)})})}openSync(i,s,t){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.openSync(i,s,t)}unlink(i,s){this._mu.lock(()=>{this._fs.unlink(i,i=>{this._mu.unlock(),s(i)})})}unlinkSync(i){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.unlinkSync(i)}rmdir(i,s){this._mu.lock(()=>{this._fs.rmdir(i,i=>{this._mu.unlock(),s(i)})})}rmdirSync(i){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.rmdirSync(i)}mkdir(i,s,t){this._mu.lock(()=>{this._fs.mkdir(i,s,i=>{this._mu.unlock(),t(i)})})}mkdirSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.mkdirSync(i,s)}readdir(i,s){this._mu.lock(()=>{this._fs.readdir(i,(i,t)=>{this._mu.unlock(),s(i,t)})})}readdirSync(i){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.readdirSync(i)}exists(i,s){this._mu.lock(()=>{this._fs.exists(i,i=>{this._mu.unlock(),s(i)})})}existsSync(i){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.existsSync(i)}realpath(i,s,t){this._mu.lock(()=>{this._fs.realpath(i,s,(i,s)=>{this._mu.unlock(),t(i,s)})})}realpathSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.realpathSync(i,s)}truncate(i,s,t){this._mu.lock(()=>{this._fs.truncate(i,s,i=>{this._mu.unlock(),t(i)})})}truncateSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.truncateSync(i,s)}readFile(i,s,t,n){this._mu.lock(()=>{this._fs.readFile(i,s,t,(i,s)=>{this._mu.unlock(),n(i,s)})})}readFileSync(i,s,t){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.readFileSync(i,s,t)}writeFile(i,s,t,n,r,c){this._mu.lock(()=>{this._fs.writeFile(i,s,t,n,r,i=>{this._mu.unlock(),c(i)})})}writeFileSync(i,s,t,n,r){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.writeFileSync(i,s,t,n,r)}appendFile(i,s,t,n,r,c){this._mu.lock(()=>{this._fs.appendFile(i,s,t,n,r,i=>{this._mu.unlock(),c(i)})})}appendFileSync(i,s,t,n,r){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.appendFileSync(i,s,t,n,r)}chmod(i,s,t,n){this._mu.lock(()=>{this._fs.chmod(i,s,t,i=>{this._mu.unlock(),n(i)})})}chmodSync(i,s,t){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.chmodSync(i,s,t)}chown(i,s,t,n,r){this._mu.lock(()=>{this._fs.chown(i,s,t,n,i=>{this._mu.unlock(),r(i)})})}chownSync(i,s,t,n){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.chownSync(i,s,t,n)}utimes(i,s,t,n){this._mu.lock(()=>{this._fs.utimes(i,s,t,i=>{this._mu.unlock(),n(i)})})}utimesSync(i,s,t){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.utimesSync(i,s,t)}link(i,s,t){this._mu.lock(()=>{this._fs.link(i,s,i=>{this._mu.unlock(),t(i)})})}linkSync(i,s){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.linkSync(i,s)}symlink(i,s,t,n){this._mu.lock(()=>{this._fs.symlink(i,s,t,i=>{this._mu.unlock(),n(i)})})}symlinkSync(i,s,t){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.symlinkSync(i,s,t)}readlink(i,s){this._mu.lock(()=>{this._fs.readlink(i,(i,t)=>{this._mu.unlock(),s(i,t)})})}readlinkSync(i){if(this._mu.isLocked())throw new Error("invalid sync call");return this._fs.readlinkSync(i)}}});
//# sourceMappingURL=../sourcemaps/generic/locked_fs.js.map
