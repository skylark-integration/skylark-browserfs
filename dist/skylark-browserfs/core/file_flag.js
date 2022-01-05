/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
define(["./api_error"],function(t){"use strict";const{ErrorCode:r,ApiError:i}=t;var a;!function(t){t[t.NOP=0]="NOP",t[t.THROW_EXCEPTION=1]="THROW_EXCEPTION",t[t.TRUNCATE_FILE=2]="TRUNCATE_FILE",t[t.CREATE_FILE=3]="CREATE_FILE"}(a||(a={}));class e{constructor(t){if(this.flagStr=t,e.validFlagStrs.indexOf(t)<0)throw new i(r.EINVAL,"Invalid flag: "+t)}static getFileFlag(t){return e.flagCache.hasOwnProperty(t)?e.flagCache[t]:e.flagCache[t]=new e(t)}getFlagString(){return this.flagStr}isReadable(){return-1!==this.flagStr.indexOf("r")||-1!==this.flagStr.indexOf("+")}isWriteable(){return-1!==this.flagStr.indexOf("w")||-1!==this.flagStr.indexOf("a")||-1!==this.flagStr.indexOf("+")}isTruncating(){return-1!==this.flagStr.indexOf("w")}isAppendable(){return-1!==this.flagStr.indexOf("a")}isSynchronous(){return-1!==this.flagStr.indexOf("s")}isExclusive(){return-1!==this.flagStr.indexOf("x")}pathExistsAction(){return this.isExclusive()?a.THROW_EXCEPTION:this.isTruncating()?a.TRUNCATE_FILE:a.NOP}pathNotExistsAction(){return(this.isWriteable()||this.isAppendable())&&"r+"!==this.flagStr?a.CREATE_FILE:a.THROW_EXCEPTION}}return e.flagCache={},e.validFlagStrs=["r","r+","rs","rs+","w","wx","w+","wx+","a","ax","a+","ax+"],{ActionType:a,FileFlag:e}});
//# sourceMappingURL=../sourcemaps/core/file_flag.js.map
