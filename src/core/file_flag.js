define(['./api_error'], function (api_error) {
    'use strict';

  const { ErrorCode, ApiError } = api_error;

  var ActionType;
  (function (ActionType) {
      // Indicates that the code should not do anything.
      ActionType[ActionType["NOP"] = 0] = "NOP";
      // Indicates that the code should throw an exception.
      ActionType[ActionType["THROW_EXCEPTION"] = 1] = "THROW_EXCEPTION";
      // Indicates that the code should truncate the file, but only if it is a file.
      ActionType[ActionType["TRUNCATE_FILE"] = 2] = "TRUNCATE_FILE";
      // Indicates that the code should create the file.
      ActionType[ActionType["CREATE_FILE"] = 3] = "CREATE_FILE";
  })(ActionType || (ActionType = {}));
  /**
   * Represents one of the following file flags. A convenience object.
   *
   * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
   * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
   * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
   * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
   * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx'` - Like 'w' but opens the file in exclusive mode.
   * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
   * * `'a'` - Open file for appending. The file is created if it does not exist.
   * * `'ax'` - Like 'a' but opens the file in exclusive mode.
   * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
   * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
   *
   * Exclusive mode ensures that the file path is newly created.
   */
  class FileFlag {
      /**
       * This should never be called directly.
       * @param modeStr The string representing the mode
       * @throw when the mode string is invalid
       */
      constructor(flagStr) {
          this.flagStr = flagStr;
          if (FileFlag.validFlagStrs.indexOf(flagStr) < 0) {
              throw new ApiError(ErrorCode.EINVAL, "Invalid flag: " + flagStr);
          }
      }
      /**
       * Get an object representing the given file flag.
       * @param modeStr The string representing the flag
       * @return The FileFlag object representing the flag
       * @throw when the flag string is invalid
       */
      static getFileFlag(flagStr) {
          // Check cache first.
          if (FileFlag.flagCache.hasOwnProperty(flagStr)) {
              return FileFlag.flagCache[flagStr];
          }
          return FileFlag.flagCache[flagStr] = new FileFlag(flagStr);
      }
      /**
       * Get the underlying flag string for this flag.
       */
      getFlagString() {
          return this.flagStr;
      }
      /**
       * Returns true if the file is readable.
       */
      isReadable() {
          return this.flagStr.indexOf('r') !== -1 || this.flagStr.indexOf('+') !== -1;
      }
      /**
       * Returns true if the file is writeable.
       */
      isWriteable() {
          return this.flagStr.indexOf('w') !== -1 || this.flagStr.indexOf('a') !== -1 || this.flagStr.indexOf('+') !== -1;
      }
      /**
       * Returns true if the file mode should truncate.
       */
      isTruncating() {
          return this.flagStr.indexOf('w') !== -1;
      }
      /**
       * Returns true if the file is appendable.
       */
      isAppendable() {
          return this.flagStr.indexOf('a') !== -1;
      }
      /**
       * Returns true if the file is open in synchronous mode.
       */
      isSynchronous() {
          return this.flagStr.indexOf('s') !== -1;
      }
      /**
       * Returns true if the file is open in exclusive mode.
       */
      isExclusive() {
          return this.flagStr.indexOf('x') !== -1;
      }
      /**
       * Returns one of the static fields on this object that indicates the
       * appropriate response to the path existing.
       */
      pathExistsAction() {
          if (this.isExclusive()) {
              return ActionType.THROW_EXCEPTION;
          }
          else if (this.isTruncating()) {
              return ActionType.TRUNCATE_FILE;
          }
          else {
              return ActionType.NOP;
          }
      }
      /**
       * Returns one of the static fields on this object that indicates the
       * appropriate response to the path not existing.
       */
      pathNotExistsAction() {
          if ((this.isWriteable() || this.isAppendable()) && this.flagStr !== 'r+') {
              return ActionType.CREATE_FILE;
          }
          else {
              return ActionType.THROW_EXCEPTION;
          }
      }
  }
  // Contains cached FileMode instances.
  FileFlag.flagCache = {};
  // Array of valid mode strings.
  FileFlag.validFlagStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];



    return {
        ActionType: ActionType,
        FileFlag: FileFlag
    };
});