/**
 * skylark-browserfs - A version of browserfs that ported to running on skylarkjs.
 * @author 
 * @version v0.9.0
 * @link 
 * @license MIT
 */
(function(factory,globals) {
  var define = globals.define,
      require = globals.require,
      isAmd = (typeof define === 'function' && define.amd),
      isCmd = (!isAmd && typeof exports !== 'undefined');

  if (!isAmd && !define) {
    var map = {};
    function absolute(relative, base) {
        if (relative[0]!==".") {
          return relative;
        }
        var stack = base.split("/"),
            parts = relative.split("/");
        stack.pop(); 
        for (var i=0; i<parts.length; i++) {
            if (parts[i] == ".")
                continue;
            if (parts[i] == "..")
                stack.pop();
            else
                stack.push(parts[i]);
        }
        return stack.join("/");
    }
    define = globals.define = function(id, deps, factory) {
        if (typeof factory == 'function') {
            map[id] = {
                factory: factory,
                deps: deps.map(function(dep){
                  return absolute(dep,id);
                }),
                resolved: false,
                exports: null
            };
            require(id);
        } else {
            map[id] = {
                factory : null,
                resolved : true,
                exports : factory
            };
        }
    };
    require = globals.require = function(id) {
        if (!map.hasOwnProperty(id)) {
            throw new Error('Module ' + id + ' has not been defined');
        }
        var module = map[id];
        if (!module.resolved) {
            var args = [];

            module.deps.forEach(function(dep){
                args.push(require(dep));
            })

            module.exports = module.factory.apply(globals, args) || null;
            module.resolved = true;
        }
        return module.exports;
    };
  }
  
  if (!define) {
     throw new Error("The module utility (ex: requirejs or skylark-utils) is not loaded!");
  }

  factory(define,require);

  if (!isAmd) {
    var skylarkjs = require("skylark-langx-ns");

    if (isCmd) {
      module.exports = skylarkjs;
    } else {
      globals.skylarkjs  = skylarkjs;
    }
  }

})(function(define,require) {

define('skylark-langx-ns/_attach',[],function(){
    return  function attach(obj1,path,obj2) {
        if (typeof path == "string") {
            path = path.split(".");//[path]
        };
        var length = path.length,
            ns=obj1,
            i=0,
            name = path[i++];

        while (i < length) {
            ns = ns[name] = ns[name] || {};
            name = path[i++];
        }

        if (ns[name]) {
            if (obj2) {
                throw new Error("This namespace already exists:" + path);
            }

        } else {
            ns[name] = obj2 || {};
        }
        return ns[name];
    }
});
define('skylark-langx-ns/ns',[
    "./_attach"
], function(_attach) {
    var root = {
    	attach : function(path,obj) {
    		return _attach(root,path,obj);
    	}
    };
    return root;
});

define('skylark-langx-ns/main',[
	"./ns"
],function(skylark){
	return skylark;
});
define('skylark-langx-ns', ['skylark-langx-ns/main'], function (main) { return main; });

define('skylark-langx-executive/executive',[
    "skylark-langx-ns"
],function(skylark){
	return skylark.attach("langx.executive");
});
define('skylark-langx-executive/process',[
    "./executive"
],function(executive){
    // shim for using process in browser
    var process = {};

    // cached from whatever global is present so that test runners that stub it
    // don't break things.  But we need to wrap it in a try catch in case it is
    // wrapped in strict mode code which doesn't define any globals.  It's inside a
    // function because try/catches deoptimize in certain engines.

    var cachedSetTimeout;
    var cachedClearTimeout;

    function defaultSetTimeout() {
        throw new Error('setTimeout has not been defined');
    }

    function defaultClearTimeout () {
        throw new Error('clearTimeout has not been defined');
    }

    (function () {
        try {
            if (typeof setTimeout === 'function') {
                cachedSetTimeout = setTimeout;
            } else {
                cachedSetTimeout = defaultSetTimeout;
            }
        } catch (e) {
            cachedSetTimeout = defaultSetTimeout;
        }
        try {
            if (typeof clearTimeout === 'function') {
                cachedClearTimeout = clearTimeout;
            } else {
                cachedClearTimeout = defaultClearTimeout;
            }
        } catch (e) {
            cachedClearTimeout = defaultClearTimeout;
        }
    } ())

    function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
            //normal enviroments in sane situations
            return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimeout || !cachedSetTimeout) && setTimeout) {
            cachedSetTimeout = setTimeout;
            return setTimeout(fun, 0);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedSetTimeout(fun, 0);
        } catch(e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0);
            } catch(e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0);
            }
        }
    }

    function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
            //normal enviroments in sane situations
            return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
            cachedClearTimeout = clearTimeout;
            return clearTimeout(marker);
        }
        try {
            // when when somebody has screwed with setTimeout but no I.E. maddness
            return cachedClearTimeout(marker);
        } catch (e){
            try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker);
            } catch (e){
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker);
            }
        }
    }
    
    var queue = [];
    var draining = false;
    var currentQueue;
    var queueIndex = -1;

    function cleanUpNextTick() {
        if (!draining || !currentQueue) {
            return;
        }
        draining = false;
        if (currentQueue.length) {
            queue = currentQueue.concat(queue);
        } else {
            queueIndex = -1;
        }
        if (queue.length) {
            drainQueue();
        }
    }

    function drainQueue() {
        if (draining) {
            return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while(len) {
            currentQueue = queue;
            queue = [];
            while (++queueIndex < len) {
                if (currentQueue) {
                    currentQueue[queueIndex].run();
                }
            }
            queueIndex = -1;
            len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
    }

    process.nextTick = function (fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
            for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
            runTimeout(drainQueue);
        }
    };

    // v8 likes predictible objects
    function Item(fun, array) {
        this.fun = fun;
        this.array = array;
    }
    Item.prototype.run = function () {
        this.fun.apply(null, this.array);
    };
    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];
    process.version = ''; // empty string to avoid regexp issues
    process.versions = {};

    function noop() {}

    process.on = noop;
    process.addListener = noop;
    process.once = noop;
    process.off = noop;
    process.removeListener = noop;
    process.removeAllListeners = noop;
    process.emit = noop;
    process.prependListener = noop;
    process.prependOnceListener = noop;

    process.listeners = function (name) { return [] }

    process.binding = function (name) {
        throw new Error('process.binding is not supported');
    };

    process.cwd = function () { return '/' };
    process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
    };
    process.umask = function() { return 0; };

    return executive.process = process;  

});
define('skylark-browserfs/libs/process',[
    "skylark-langx-executive/process"
],function(process){
  'use strict'
    return process;
});
define('skylark-langx-binary/binary',[
  "skylark-langx-ns",
],function(skylark){
	"use strict";


	/**
	 * Create arraybuffer from binary string
	 *
	 * @method fromBinaryString
	 * @param {String} str
	 * @return {Arraybuffer} data
	 */
	function fromBinaryString(str) {
		var length = str.length;
		var arraybuffer = new ArrayBuffer(length);
		var view = new Uint8Array(arraybuffer);

		for(var i = 0; i < length; i++)
		{
			view[i] = str.charCodeAt(i);
		}

		return arraybuffer;
	}

	/**
	 * Create arraybuffer from base64 string
	 *
	 * @method fromBase64
	 * @param {String} base64
	 * @return {Arraybuffer} data
	 */
	function fromBase64(str){
		var encoding = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var length = str.length / 4 * 3;
		var arraybuffer = new ArrayBuffer(length);
		var view = new Uint8Array(arraybuffer);

		var a, b, c, d;

		for(var i = 0, j = 0; i < length; i += 3)
		{
			a = encoding.indexOf(str.charAt(j++));
			b = encoding.indexOf(str.charAt(j++));
			c = encoding.indexOf(str.charAt(j++));
			d = encoding.indexOf(str.charAt(j++));

			view[i] = (a << 2) | (b >> 4);
			if(c !== 64)
			{
				view[i+1] = ((b & 15) << 4) | (c >> 2);
			}
			if(d !== 64)
			{
				view[i+2] = ((c & 3) << 6) | d;
			}
		}

		return arraybuffer;
	}

	/**
	 * Create arraybuffer from Nodejs buffer
	 *
	 * @method fromBuffer
	 * @param {Buffer} buffer
	 * @return {Arraybuffer} data
	 */
	function fromBuffer(buffer)	{
		var array = new ArrayBuffer(buffer.length);
		var view = new Uint8Array(array);

		for(var i = 0; i < buffer.length; i++)
		{
			view[i] = buffer[i];
		}

		return array;

		//Faster but the results is failing the "instanceof ArrayBuffer" test
		//return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
	}

    function readInt8(data, offset) {
        return data[offset] << 24 >> 24;
    }
    function readUint16(data, offset) {
        return data[offset] << 8 | data[offset + 1];
    }
    function readUint32(data, offset) {
        return (data[offset] << 24 | data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3]) >>> 0;
    }


	return skylark.attach("langx.binary",{
		fromBase64,
		fromBinaryString,
		fromBuffer,
		readInt8,
		readUint16,
		readUint32
	});
});
define('skylark-langx-binary/base64',[],function(){
  'use strict'
  var exports = {};

  exports.byteLength = byteLength
  exports.toByteArray = toByteArray
  exports.fromByteArray = fromByteArray

  var lookup = []
  var revLookup = []
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  // Support decoding URL-safe base64 strings, as Node.js does.
  // See: https://en.wikipedia.org/wiki/Base64#URL_applications
  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63

  function getLens (b64) {
    var len = b64.length

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // Trim off extra bytes after placeholder bytes are found
    // See: https://github.com/beatgammit/base64-js/issues/42
    var validLen = b64.indexOf('=')
    if (validLen === -1) validLen = len

    var placeHoldersLen = validLen === len
      ? 0
      : 4 - (validLen % 4)

    return [validLen, placeHoldersLen]
  }

  // base64 is 4/3 + up to two characters of the original data
  function byteLength (b64) {
    var lens = getLens(b64)
    var validLen = lens[0]
    var placeHoldersLen = lens[1]
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function _byteLength (b64, validLen, placeHoldersLen) {
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function toByteArray (b64) {
    var tmp
    var lens = getLens(b64)
    var validLen = lens[0]
    var placeHoldersLen = lens[1]

    var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

    var curByte = 0

    // if there are placeholders, only get up to the last complete 4 chars
    var len = placeHoldersLen > 0
      ? validLen - 4
      : validLen

    var i
    for (i = 0; i < len; i += 4) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 18) |
        (revLookup[b64.charCodeAt(i + 1)] << 12) |
        (revLookup[b64.charCodeAt(i + 2)] << 6) |
        revLookup[b64.charCodeAt(i + 3)]
      arr[curByte++] = (tmp >> 16) & 0xFF
      arr[curByte++] = (tmp >> 8) & 0xFF
      arr[curByte++] = tmp & 0xFF
    }

    if (placeHoldersLen === 2) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 2) |
        (revLookup[b64.charCodeAt(i + 1)] >> 4)
      arr[curByte++] = tmp & 0xFF
    }

    if (placeHoldersLen === 1) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 10) |
        (revLookup[b64.charCodeAt(i + 1)] << 4) |
        (revLookup[b64.charCodeAt(i + 2)] >> 2)
      arr[curByte++] = (tmp >> 8) & 0xFF
      arr[curByte++] = tmp & 0xFF
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] +
      lookup[num >> 12 & 0x3F] +
      lookup[num >> 6 & 0x3F] +
      lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp
    var output = []
    for (var i = start; i < end; i += 3) {
      tmp =
        ((uint8[i] << 16) & 0xFF0000) +
        ((uint8[i + 1] << 8) & 0xFF00) +
        (uint8[i + 2] & 0xFF)
      output.push(tripletToBase64(tmp))
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    var tmp
    var len = uint8.length
    var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
    var parts = []
    var maxChunkLength = 16383 // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(
        uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
      ))
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1]
      parts.push(
        lookup[tmp >> 2] +
        lookup[(tmp << 4) & 0x3F] +
        '=='
      )
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1]
      parts.push(
        lookup[tmp >> 10] +
        lookup[(tmp >> 4) & 0x3F] +
        lookup[(tmp << 2) & 0x3F] +
        '='
      )
    }

    return parts.join('')
  }

  return exports;
});
define('skylark-langx-binary/ieee754',[],function(){
  'use strict'
  var exports = {};

  exports.read = function (buffer, offset, isLE, mLen, nBytes) {
    var e, m
    var eLen = (nBytes * 8) - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var nBits = -7
    var i = isLE ? (nBytes - 1) : 0
    var d = isLE ? -1 : 1
    var s = buffer[offset + i]

    i += d

    e = s & ((1 << (-nBits)) - 1)
    s >>= (-nBits)
    nBits += eLen
    for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1)
    e >>= (-nBits)
    nBits += mLen
    for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen)
      e = e - eBias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c
    var eLen = (nBytes * 8) - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
    var i = isLE ? 0 : (nBytes - 1)
    var d = isLE ? 1 : -1
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

    value = Math.abs(value)

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0
      e = eMax
    } else {
      e = Math.floor(Math.log(value) / Math.LN2)
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--
        c *= 2
      }
      if (e + eBias >= 1) {
        value += rt / c
      } else {
        value += rt * Math.pow(2, 1 - eBias)
      }
      if (value * c >= 2) {
        e++
        c /= 2
      }

      if (e + eBias >= eMax) {
        m = 0
        e = eMax
      } else if (e + eBias >= 1) {
        m = ((value * c) - 1) * Math.pow(2, mLen)
        e = e + eBias
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
        e = 0
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m
    eLen += mLen
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128
  }

  return exports;
});

define('skylark-langx-binary/buffer',[
  "./binary",
  "./base64",
  "./ieee754"
],function(binary,base64,ieee754){
  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */

  'use strict'


  Buffer.INSPECT_MAX_BYTES = 50

  var K_MAX_LENGTH = 0x7fffffff
  Buffer.kMaxLength = K_MAX_LENGTH

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Print warning and recommend using `buffer` v4.x which has an Object
   *               implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * We report that the browser does not support typed arrays if the are not subclassable
   * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
   * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
   * for __proto__ and has a buggy typed array implementation.
   */
  Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

  if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
      typeof console.error === 'function') {
    console.error(
      'This browser lacks typed array (Uint8Array) support which is required by ' +
      '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
    )
  }

  function typedArraySupport () {
    // Can typed array instances can be augmented?
    try {
      var arr = new Uint8Array(1)
      arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
      return arr.foo() === 42
    } catch (e) {
      return false
    }
  }

  Object.defineProperty(Buffer.prototype, 'parent', {
    get: function () {
      if (!(this instanceof Buffer)) {
        return undefined
      }
      return this.buffer
    }
  })

  Object.defineProperty(Buffer.prototype, 'offset', {
    get: function () {
      if (!(this instanceof Buffer)) {
        return undefined
      }
      return this.byteOffset
    }
  })

  function createBuffer (length) {
    if (length > K_MAX_LENGTH) {
      throw new RangeError('Invalid typed array length')
    }
    // Return an augmented `Uint8Array` instance
    var buf = new Uint8Array(length)
    buf.__proto__ = Buffer.prototype
    return buf
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer (arg, encodingOrOffset, length) {
    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(arg)
    }
    return from(arg, encodingOrOffset, length)
  }

  // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true,
      enumerable: false,
      writable: false
    })
  }

  Buffer.poolSize = 8192 // not used by this implementation

  function from (value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
      return fromArrayBuffer(value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(value, encodingOrOffset)
    }

    return fromObject(value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer.from = function (value, encodingOrOffset, length) {
    return from(value, encodingOrOffset, length)
  }

  // Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
  // https://github.com/feross/buffer/pull/148
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array

  function assertSize (size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be of type number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc (size, fill, encoding) {
    assertSize(size)
    if (size <= 0) {
      return createBuffer(size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(size).fill(fill, encoding)
        : createBuffer(size).fill(fill)
    }
    return createBuffer(size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer.alloc = function (size, fill, encoding) {
    return alloc(size, fill, encoding)
  }

  function allocUnsafe (size) {
    assertSize(size)
    return createBuffer(size < 0 ? 0 : checked(size) | 0)
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer.allocUnsafe = function (size) {
    return allocUnsafe(size)
  }
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer.allocUnsafeSlow = function (size) {
    return allocUnsafe(size)
  }

  function fromString (string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8'
    }

    if (!Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }

    var length = byteLength(string, encoding) | 0
    var buf = createBuffer(length)

    var actual = buf.write(string, encoding)

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      buf = buf.slice(0, actual)
    }

    return buf
  }

  function fromArrayLike (array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0
    var buf = createBuffer(length)
    for (var i = 0; i < length; i += 1) {
      buf[i] = array[i] & 255
    }
    return buf
  }

  function fromArrayBuffer (array, byteOffset, length) {
    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('"offset" is outside of buffer bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('"length" is outside of buffer bounds')
    }

    var buf
    if (byteOffset === undefined && length === undefined) {
      buf = new Uint8Array(array)
    } else if (length === undefined) {
      buf = new Uint8Array(array, byteOffset)
    } else {
      buf = new Uint8Array(array, byteOffset, length)
    }

    // Return an augmented `Uint8Array` instance
    buf.__proto__ = Buffer.prototype
    return buf
  }

  function fromObject (obj) {
    if (Buffer.isBuffer(obj)) {
      var len = checked(obj.length) | 0
      var buf = createBuffer(len)

      if (buf.length === 0) {
        return buf
      }

      obj.copy(buf, 0, 0, len)
      return buf
    }

    if (obj) {
      if (ArrayBuffer.isView(obj) || 'length' in obj) {
        if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
          return createBuffer(0)
        }
        return fromArrayLike(obj)
      }

      if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data)
      }
    }

    throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
  }

  function checked (length) {
    // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= K_MAX_LENGTH) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                           'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
    }
    return length | 0
  }

  function SlowBuffer (length) {
    if (+length != length) { // eslint-disable-line eqeqeq
      length = 0
    }
    return Buffer.alloc(+length)
  }

  Buffer.isBuffer = function isBuffer (b) {
    return b != null && b._isBuffer === true
  }

  Buffer.compare = function compare (a, b) {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length
    var y = b.length

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i]
        y = b[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  Buffer.isEncoding = function isEncoding (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  }

  Buffer.concat = function concat (list, length) {
    if (!Array.isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer.alloc(0)
    }

    var i
    if (length === undefined) {
      length = 0
      for (i = 0; i < list.length; ++i) {
        length += list[i].length
      }
    }

    var buffer = Buffer.allocUnsafe(length)
    var pos = 0
    for (i = 0; i < list.length; ++i) {
      var buf = list[i]
      if (ArrayBuffer.isView(buf)) {
        buf = Buffer.from(buf)
      }
      if (!Buffer.isBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos)
      pos += buf.length
    }
    return buffer
  }

  function byteLength (string, encoding) {
    if (Buffer.isBuffer(string)) {
      return string.length
    }
    if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string
    }

    var len = string.length
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }
  Buffer.byteLength = byteLength

  function slowToString (encoding, start, end) {
    var loweredCase = false

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0
    start >>>= 0

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8'

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase()
          loweredCase = true
      }
    }
  }

  // This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
  // to detect a Buffer instance. It's not possible to use `instanceof Buffer`
  // reliably in a browserify context because there could be multiple different
  // copies of the 'buffer' package in use. This method works even for Buffer
  // instances that were created from another copy of the `buffer` package.
  // See: https://github.com/feross/buffer/issues/154
  Buffer.prototype._isBuffer = true

  function swap (b, n, m) {
    var i = b[n]
    b[n] = b[m]
    b[m] = i
  }

  Buffer.prototype.swap16 = function swap16 () {
    var len = this.length
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1)
    }
    return this
  }

  Buffer.prototype.swap32 = function swap32 () {
    var len = this.length
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3)
      swap(this, i + 1, i + 2)
    }
    return this
  }

  Buffer.prototype.swap64 = function swap64 () {
    var len = this.length
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7)
      swap(this, i + 1, i + 6)
      swap(this, i + 2, i + 5)
      swap(this, i + 3, i + 4)
    }
    return this
  }

  Buffer.prototype.toString = function toString () {
    var length = this.length
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  }

  Buffer.prototype.toLocaleString = Buffer.prototype.toString

  Buffer.prototype.equals = function equals (b) {
    if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer.compare(this, b) === 0
  }

  Buffer.prototype.inspect = function inspect () {
    var str = ''
    var max = Buffer.INSPECT_MAX_BYTES
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
      if (this.length > max) str += ' ... '
    }
    return '<Buffer ' + str + '>'
  }

  Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    if (!Buffer.isBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0
    }
    if (end === undefined) {
      end = target ? target.length : 0
    }
    if (thisStart === undefined) {
      thisStart = 0
    }
    if (thisEnd === undefined) {
      thisEnd = this.length
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0
    end >>>= 0
    thisStart >>>= 0
    thisEnd >>>= 0

    if (this === target) return 0

    var x = thisEnd - thisStart
    var y = end - start
    var len = Math.min(x, y)

    var thisCopy = this.slice(thisStart, thisEnd)
    var targetCopy = target.slice(start, end)

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i]
        y = targetCopy[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset
      byteOffset = 0
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000
    }
    byteOffset = +byteOffset  // Coerce to Number.
    if (numberIsNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : (buffer.length - 1)
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding)
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (Buffer.isBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xFF // Search for a byte value [0-255]
      if (typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    var indexSize = 1
    var arrLength = arr.length
    var valLength = val.length

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase()
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2
        arrLength /= 2
        valLength /= 2
        byteOffset /= 2
      }
    }

    function read (buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i
    if (dir) {
      var foundIndex = -1
      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex
          foundIndex = -1
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
      for (i = byteOffset; i >= 0; i--) {
        var found = true
        for (var j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  }

  Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  }

  Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  }

  function hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0
    var remaining = buf.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }

    var strLen = string.length

    if (length > strLen / 2) {
      length = strLen / 2
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16)
      if (numberIsNaN(parsed)) return i
      buf[offset + i] = parsed
    }
    return i
  }

  function utf8Write (buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  }

  function asciiWrite (buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write (buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write (buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write (buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  }

  Buffer.prototype.write = function write (string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8'
      length = this.length
      offset = 0
    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset
      length = this.length
      offset = 0
    // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset >>> 0
      if (isFinite(length)) {
        length = length >>> 0
        if (encoding === undefined) encoding = 'utf8'
      } else {
        encoding = length
        length = undefined
      }
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset
    if (length === undefined || length > remaining) length = remaining

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8'

    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }

  Buffer.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  }

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return base64.fromByteArray(buf)
    } else {
      return base64.fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice (buf, start, end) {
    end = Math.min(buf.length, end)
    var res = []

    var i = start
    while (i < end) {
      var firstByte = buf[i]
      var codePoint = null
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
        : 1

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte
            }
            break
          case 2:
            secondByte = buf[i + 1]
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint
              }
            }
            break
          case 3:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint
              }
            }
            break
          case 4:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            fourthByte = buf[i + 3]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD
        bytesPerSequence = 1
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000
        res.push(codePoint >>> 10 & 0x3FF | 0xD800)
        codePoint = 0xDC00 | codePoint & 0x3FF
      }

      res.push(codePoint)
      i += bytesPerSequence
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000

  function decodeCodePointsArray (codePoints) {
    var len = codePoints.length
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = ''
    var i = 0
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      )
    }
    return res
  }

  function asciiSlice (buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F)
    }
    return ret
  }

  function latin1Slice (buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i])
    }
    return ret
  }

  function hexSlice (buf, start, end) {
    var len = buf.length

    if (!start || start < 0) start = 0
    if (!end || end < 0 || end > len) end = len

    var out = ''
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i])
    }
    return out
  }

  function utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end)
    var res = ''
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
    }
    return res
  }

  Buffer.prototype.slice = function slice (start, end) {
    var len = this.length
    start = ~~start
    end = end === undefined ? len : ~~end

    if (start < 0) {
      start += len
      if (start < 0) start = 0
    } else if (start > len) {
      start = len
    }

    if (end < 0) {
      end += len
      if (end < 0) end = 0
    } else if (end > len) {
      end = len
    }

    if (end < start) end = start

    var newBuf = this.subarray(start, end)
    // Return an augmented `Uint8Array` instance
    newBuf.__proto__ = Buffer.prototype
    return newBuf
  }

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset (offset, ext, length) {
    if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }

    return val
  }

  Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length)
    }

    var val = this[offset + --byteLength]
    var mul = 1
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul
    }

    return val
  }

  Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 1, this.length)
    return this[offset]
  }

  Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 2, this.length)
    return this[offset] | (this[offset + 1] << 8)
  }

  Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 2, this.length)
    return (this[offset] << 8) | this[offset + 1]
  }

  Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  }

  Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  }

  Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var i = byteLength
    var mul = 1
    var val = this[offset + --i]
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 1, this.length)
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  }

  Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset] | (this[offset + 1] << 8)
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  }

  Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset + 1] | (this[offset] << 8)
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  }

  Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  }

  Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  }

  Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)
    return ieee754.read(this, offset, true, 23, 4)
  }

  Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 4, this.length)
    return ieee754.read(this, offset, false, 23, 4)
  }

  Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 8, this.length)
    return ieee754.read(this, offset, true, 52, 8)
  }

  Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    offset = offset >>> 0
    if (!noAssert) checkOffset(offset, 8, this.length)
    return ieee754.read(this, offset, false, 52, 8)
  }

  function checkInt (buf, value, offset, ext, max, min) {
    if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var mul = 1
    var i = 0
    this[offset] = value & 0xFF
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset >>> 0
    byteLength = byteLength >>> 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var i = byteLength - 1
    var mul = 1
    this[offset + i] = value & 0xFF
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
    this[offset] = (value & 0xff)
    return offset + 1
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    return offset + 2
  }

  Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
    return offset + 2
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
    return offset + 4
  }

  Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
    return offset + 4
  }

  Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) {
      var limit = Math.pow(2, (8 * byteLength) - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = 0
    var mul = 1
    var sub = 0
    this[offset] = value & 0xFF
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) {
      var limit = Math.pow(2, (8 * byteLength) - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = byteLength - 1
    var mul = 1
    var sub = 0
    this[offset + i] = value & 0xFF
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
    if (value < 0) value = 0xff + value + 1
    this[offset] = (value & 0xff)
    return offset + 1
  }

  Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    return offset + 2
  }

  Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
    return offset + 2
  }

  Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
    return offset + 4
  }

  Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    if (value < 0) value = 0xffffffff + value + 1
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
    return offset + 4
  }

  function checkIEEE754 (buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat (buf, value, offset, littleEndian, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
    }
    ieee754.write(buf, value, offset, littleEndian, 23, 4)
    return offset + 4
  }

  Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  }

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    value = +value
    offset = offset >>> 0
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
    }
    ieee754.write(buf, value, offset, littleEndian, 52, 8)
    return offset + 8
  }

  Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  }

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function copy (target, targetStart, start, end) {
    if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
    if (!start) start = 0
    if (!end && end !== 0) end = this.length
    if (targetStart >= target.length) targetStart = target.length
    if (!targetStart) targetStart = 0
    if (end > 0 && end < start) end = start

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start
    }

    var len = end - start

    if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
      // Use built-in when available, missing from IE11
      this.copyWithin(targetStart, start, end)
    } else if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (var i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start]
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, end),
        targetStart
      )
    }

    return len
  }

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer.prototype.fill = function fill (val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start
        start = 0
        end = this.length
      } else if (typeof end === 'string') {
        encoding = end
        end = this.length
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0)
        if ((encoding === 'utf8' && code < 128) ||
            encoding === 'latin1') {
          // Fast path: If `val` fits into a single byte, use that numeric value.
          val = code
        }
      }
    } else if (typeof val === 'number') {
      val = val & 255
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0
    end = end === undefined ? this.length : end >>> 0

    if (!val) val = 0

    var i
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val
      }
    } else {
      var bytes = Buffer.isBuffer(val)
        ? val
        : new Buffer(val, encoding)
      var len = bytes.length
      if (len === 0) {
        throw new TypeError('The value "' + val +
          '" is invalid for argument "value"')
      }
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len]
      }
    }

    return this
  }

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

  function base64clean (str) {
    // Node takes equal signs as end of the Base64 encoding
    str = str.split('=')[0]
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = str.trim().replace(INVALID_BASE64_RE, '')
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '='
    }
    return str
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (string, units) {
    units = units || Infinity
    var codePoint
    var length = string.length
    var leadSurrogate = null
    var bytes = []

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i)

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            continue
          }

          // valid lead
          leadSurrogate = codePoint

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      }

      leadSurrogate = null

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint)
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push(
          codePoint >> 0x6 | 0xC0,
          codePoint & 0x3F | 0x80
        )
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          codePoint >> 0xC | 0xE0,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        )
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          codePoint >> 0x12 | 0xF0,
          codePoint >> 0xC & 0x3F | 0x80,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        )
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes (str) {
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF)
    }
    return byteArray
  }

  function utf16leToBytes (str, units) {
    var c, hi, lo
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i)
      hi = c >> 8
      lo = c % 256
      byteArray.push(lo)
      byteArray.push(hi)
    }

    return byteArray
  }

  function base64ToBytes (str) {
    return base64.toByteArray(base64clean(str))
  }

  function blitBuffer (src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if ((i + offset >= dst.length) || (i >= src.length)) break
      dst[i + offset] = src[i]
    }
    return i
  }

  // ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
  // but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
  function isArrayBuffer (obj) {
    return obj instanceof ArrayBuffer ||
      (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
        typeof obj.byteLength === 'number')
  }

  function numberIsNaN (obj) {
    return obj !== obj // eslint-disable-line no-self-compare
  }

  return binary.Buffer = Buffer;

});
define('skylark-browserfs/libs/buffers',[
  "skylark-langx-binary/buffer"
],function(Buffer){
  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */

  'use strict'

  return {
    Buffer
  }

});
define('skylark-browserfs/core/api_error',[
  '../libs/buffers'
],function (buffers) {
    const { Buffer } = buffers;

    /**
     * Standard libc error codes. Add more to this enum and ErrorStrings as they are
     * needed.
     * @url http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
     */
    var ErrorCode;
    (function (ErrorCode) {
        ErrorCode[ErrorCode["EPERM"] = 1] = "EPERM";
        ErrorCode[ErrorCode["ENOENT"] = 2] = "ENOENT";
        ErrorCode[ErrorCode["EIO"] = 5] = "EIO";
        ErrorCode[ErrorCode["EBADF"] = 9] = "EBADF";
        ErrorCode[ErrorCode["EACCES"] = 13] = "EACCES";
        ErrorCode[ErrorCode["EBUSY"] = 16] = "EBUSY";
        ErrorCode[ErrorCode["EEXIST"] = 17] = "EEXIST";
        ErrorCode[ErrorCode["ENOTDIR"] = 20] = "ENOTDIR";
        ErrorCode[ErrorCode["EISDIR"] = 21] = "EISDIR";
        ErrorCode[ErrorCode["EINVAL"] = 22] = "EINVAL";
        ErrorCode[ErrorCode["EFBIG"] = 27] = "EFBIG";
        ErrorCode[ErrorCode["ENOSPC"] = 28] = "ENOSPC";
        ErrorCode[ErrorCode["EROFS"] = 30] = "EROFS";
        ErrorCode[ErrorCode["ENOTEMPTY"] = 39] = "ENOTEMPTY";
        ErrorCode[ErrorCode["ENOTSUP"] = 95] = "ENOTSUP";
    })(ErrorCode || (ErrorCode = {}));

    /* tslint:disable:variable-name */
    /**
     * Strings associated with each error code.
     * @hidden
     */
    const ErrorStrings = {};
    ErrorStrings[ErrorCode.EPERM] = 'Operation not permitted.';
    ErrorStrings[ErrorCode.ENOENT] = 'No such file or directory.';
    ErrorStrings[ErrorCode.EIO] = 'Input/output error.';
    ErrorStrings[ErrorCode.EBADF] = 'Bad file descriptor.';
    ErrorStrings[ErrorCode.EACCES] = 'Permission denied.';
    ErrorStrings[ErrorCode.EBUSY] = 'Resource busy or locked.';
    ErrorStrings[ErrorCode.EEXIST] = 'File exists.';
    ErrorStrings[ErrorCode.ENOTDIR] = 'File is not a directory.';
    ErrorStrings[ErrorCode.EISDIR] = 'File is a directory.';
    ErrorStrings[ErrorCode.EINVAL] = 'Invalid argument.';
    ErrorStrings[ErrorCode.EFBIG] = 'File is too big.';
    ErrorStrings[ErrorCode.ENOSPC] = 'No space left on disk.';
    ErrorStrings[ErrorCode.EROFS] = 'Cannot modify a read-only file system.';
    ErrorStrings[ErrorCode.ENOTEMPTY] = 'Directory is not empty.';
    ErrorStrings[ErrorCode.ENOTSUP] = 'Operation is not supported.';

    /* tslint:enable:variable-name */
    /**
     * Represents a BrowserFS error. Passed back to applications after a failed
     * call to the BrowserFS API.
     */
    class ApiError extends Error {
        /**
         * Represents a BrowserFS error. Passed back to applications after a failed
         * call to the BrowserFS API.
         *
         * Error codes mirror those returned by regular Unix file operations, which is
         * what Node returns.
         * @constructor ApiError
         * @param type The type of the error.
         * @param [message] A descriptive error message.
         */
        constructor(type, message = ErrorStrings[type], path) {
            super(message);
            // Unsupported.
            this.syscall = "";
            this.errno = type;
            this.code = ErrorCode[type];
            this.path = path;
            this.stack = new Error().stack;
            this.message = `Error: ${this.code}: ${message}${this.path ? `, '${this.path}'` : ''}`;
        }
        static fromJSON(json) {
            const err = new ApiError(0);
            err.errno = json.errno;
            err.code = json.code;
            err.path = json.path;
            err.stack = json.stack;
            err.message = json.message;
            return err;
        }
        /**
         * Creates an ApiError object from a buffer.
         */
        static fromBuffer(buffer, i = 0) {
            return ApiError.fromJSON(JSON.parse(buffer.toString('utf8', i + 4, i + 4 + buffer.readUInt32LE(i))));
        }
        static FileError(code, p) {
            return new ApiError(code, ErrorStrings[code], p);
        }
        static ENOENT(path) {
            return this.FileError(ErrorCode.ENOENT, path);
        }
        static EEXIST(path) {
            return this.FileError(ErrorCode.EEXIST, path);
        }
        static EISDIR(path) {
            return this.FileError(ErrorCode.EISDIR, path);
        }
        static ENOTDIR(path) {
            return this.FileError(ErrorCode.ENOTDIR, path);
        }
        static EPERM(path) {
            return this.FileError(ErrorCode.EPERM, path);
        }
        static ENOTEMPTY(path) {
            return this.FileError(ErrorCode.ENOTEMPTY, path);
        }
        /**
         * @return A friendly error message.
         */
        toString() {
            return this.message;
        }
        toJSON() {
            return {
                errno: this.errno,
                code: this.code,
                path: this.path,
                stack: this.stack,
                message: this.message
            };
        }
        /**
         * Writes the API error into a buffer.
         */
        writeToBuffer(buffer = Buffer.alloc(this.bufferSize()), i = 0) {
            const bytesWritten = buffer.write(JSON.stringify(this.toJSON()), i + 4);
            buffer.writeUInt32LE(bytesWritten, i);
            return buffer;
        }
        /**
         * The size of the API error in buffer-form in bytes.
         */
        bufferSize() {
            // 4 bytes for string length.
            return 4 + Buffer.byteLength(JSON.stringify(this.toJSON()));
        }
    }

    return {
        ApiError,
        ErrorCode,
        ErrorStrings
    };
});
define('skylark-browserfs/core/file_flag',['./api_error'], function (api_error) {
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
define('skylark-langx-paths/paths',[
	"skylark-langx-ns"
],function(skylark){
	var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;

	function posixSplitPath(filename) {
	    var out = splitPathRe.exec(filename);
	    out.shift();
	    return out;
	}
	/**
	 * Emulates Node's `path` module. This module contains utilities for handling and
	 * transforming file paths. **All** of these methods perform only string
	 * transformations. The file system is not consulted to check whether paths are
	 * valid.
	 * @see http://nodejs.org/api/path.html
	 * @class
	 */
	var paths = {};


    /**
     * Unknown. Undocumented.
     */
    paths._makeLong = function (p) {
        return p;
    };


    paths._removeDuplicateSeps = function (p) {
        p = p.replace(this._replaceRegex, this.sep);
        return p;
    };

    // The platform-specific file separator. BrowserFS uses `/`.
    paths.sep = '/';
    paths._replaceRegex = new RegExp("//+", 'g');
    // The platform-specific path delimiter. BrowserFS uses `:`.
    paths.delimiter = ':';
    paths.posix = paths;
    // XXX: Typing hack. We don't actually support win32.
    paths.win32 = paths;


	return skylark.attach("langx.paths",paths);
});
define('skylark-langx-paths/normalize',[
	"./paths"
],function(paths){
    /**
     * Normalize a string path, taking care of '..' and '.' parts.
     *
     * When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows backslashes are used.
     * @example Usage example
     *   paths.normalize('/foo/bar//baz/asdf/quux/..')
     *   // returns
     *   '/foo/bar/baz/asdf'
     * @param [String] p The path to normalize.
     * @return [String]
     */
     function normalize(p) {
        // Special case: '' -> '.'
        if (p === '') {
            p = '.';
        }
        // It's very important to know if the path is relative or not, since it
        // changes how we process .. and reconstruct the split string.
        var absolute = p.charAt(0) === paths.sep;
        // Remove repeated //s
        p = paths._removeDuplicateSeps(p);
        // Try to remove as many '../' as possible, and remove '.' completely.
        var components = p.split(paths.sep);
        var goodComponents = [];
        for (var idx = 0; idx < components.length; idx++) {
            var c = components[idx];
            if (c === '.') {
                continue;
            }
            else if (c === '..' && (absolute || (!absolute && goodComponents.length > 0 && goodComponents[0] !== '..'))) {
                // In the absolute case: Path is relative to root, so we may pop even if
                // goodComponents is empty (e.g. /../ => /)
                // In the relative case: We're getting rid of a directory that preceded
                // it (e.g. /foo/../bar -> /bar)
                goodComponents.pop();
            }
            else {
                goodComponents.push(c);
            }
        }
        // Add in '.' when it's a relative path with no other nonempty components.
        // Possible results: '.' and './' (input: [''] or [])
        // @todo Can probably simplify this logic.
        if (!absolute && goodComponents.length < 2) {
            switch (goodComponents.length) {
                case 1:
                    if (goodComponents[0] === '') {
                        goodComponents.unshift('.');
                    }
                    break;
                default:
                    goodComponents.push('.');
            }
        }
        p = goodComponents.join(paths.sep);
        if (absolute && p.charAt(0) !== paths.sep) {
            p = paths.sep + p;
        }
        return p;
    }

    return paths.normalize = normalize;
});
define('skylark-langx-paths/basename',[
	"./paths",
    "./normalize"
],function(paths,normalize){
    /**
     * Return the last portion of a path. Similar to the Unix basename command.
     * @example Usage example
     *   paths.basename('/foo/bar/baz/asdf/quux.html')
     *   // returns
     *   'quux.html'
     *
     *   paths.basename('/foo/bar/baz/asdf/quux.html', '.html')
     *   // returns
     *   'quux'
     * @param [String] p
     * @param [String?] ext
     * @return [String]
     */
    function basename(p, ext) {
        if (ext === void 0) { ext = ""; }
        // Special case: Normalize will modify this to '.'
        if (p === '') {
            return p;
        }
        // Normalize the string first to remove any weirdness.
        p = normalize(p);
        // Get the last part of the string.
        var sections = p.split(paths.sep);
        var lastPart = sections[sections.length - 1];
        // Special case: If it's empty, then we have a string like so: foo/
        // Meaning, 'foo' is guaranteed to be a directory.
        if (lastPart === '' && sections.length > 1) {
            return sections[sections.length - 2];
        }
        // Remove the extension, if need be.
        if (ext.length > 0) {
            var lastPartExt = lastPart.substr(lastPart.length - ext.length);
            if (lastPartExt === ext) {
                return lastPart.substr(0, lastPart.length - ext.length);
            }
        }
        return lastPart;
    }

    return paths.basename = basename;
});
define('skylark-langx-paths/dirname',[
	"./paths"
],function(paths){
    /**
     * Return the directory name of a path. Similar to the Unix `dirname` command.
     *
     * Note that BrowserFS does not validate if the path is actually a valid
     * directory.
     * @example Usage example
     *   paths.dirname('/foo/bar/baz/asdf/quux')
     *   // returns
     *   '/foo/bar/baz/asdf'
     * @param [String] p The path to get the directory name of.
     * @return [String]
     */
    function dirname(p) {
        // We get rid of //, but we don't modify anything else (e.g. any extraneous .
        // and ../ are kept intact)
        p = paths._removeDuplicateSeps(p);
        var absolute = p.charAt(0) === paths.sep;
        var sections = p.split(paths.sep);
        // Do 1 if it's /foo/bar, 2 if it's /foo/bar/
        if (sections.pop() === '' && sections.length > 0) {
            sections.pop();
        }
        // # of sections needs to be > 1 if absolute, since the first section is '' for '/'.
        // If not absolute, the first section is the first part of the path, and is OK
        // to return.
        if (sections.length > 1 || (sections.length === 1 && !absolute)) {
            return sections.join(paths.sep);
        }
        else if (absolute) {
            return paths.sep;
        }
        else {
            return '.';
        }
    }

    return paths.dirname = dirname;
});
define('skylark-langx-paths/extname',[
	"./paths",
    "./normalize"
],function(paths,normalize){
    /**
     * Return the extension of the path, from the last '.' to end of string in the
     * last portion of the path. If there is no '.' in the last portion of the path
     * or the first character of it is '.', then it returns an empty string.
     * @example Usage example
     *   paths.extname('index.html')
     *   // returns
     *   '.html'
     *
     *   paths.extname('index.')
     *   // returns
     *   '.'
     *
     *   paths.extname('index')
     *   // returns
     *   ''
     * @param [String] p
     * @return [String]
     */
    function extname(p) {
        p = normalize(p);
        var sections = p.split(paths.sep);
        p = sections.pop();
        // Special case: foo/file.ext/ should return '.ext'
        if (p === '' && sections.length > 0) {
            p = sections.pop();
        }
        if (p === '..') {
            return '';
        }
        var i = p.lastIndexOf('.');
        if (i === -1 || i === 0) {
            return '';
        }
        return p.substr(i);
    }

    return paths.extname = extname;
});
define('skylark-langx-paths/format',[
	"./paths"
],function(paths){
    function format(pathObject) {
        if (pathObject === null || typeof pathObject !== 'object') {
            throw new TypeError("Parameter 'pathObject' must be an object, not " + typeof pathObject);
        }
        var root = pathObject.root || '';
        if (typeof root !== 'string') {
            throw new TypeError("'pathObject.root' must be a string or undefined, not " +
                typeof pathObject.root);
        }
        var dir = pathObject.dir ? pathObject.dir + paths.sep : '';
        var base = pathObject.base || '';
        return dir + base;
    }

    return paths.format = format;
});
define('skylark-langx-paths/is-absolute',[
	"./paths"
],function(paths){

    /**
     * Checks if the given path is an absolute path.
     *
     * Despite not being documented, this is a tested part of Node's path API.
     * @param [String] p
     * @return [Boolean] True if the path appears to be an absolute path.
     */
    function isAbsolute(p) {
        return p.length > 0 && p.charAt(0) === paths.sep;
    }

    return paths.isAbsolute = isAbsolute;

});
define('skylark-langx-paths/join',[
	"./paths",
    "./normalize"
],function(paths,normalize){
    /**
     * Join all arguments together and normalize the resulting path.
     *
     * Arguments must be strings.
     * @example Usage
     *   paths.join('/foo', 'bar', 'baz/asdf', 'quux', '..')
     *   // returns
     *   '/foo/bar/baz/asdf'
     *
     *   paths.join('foo', {}, 'bar')
     *   // throws exception
     *   TypeError: Arguments to paths.join must be strings
     * @param [String,...] segs Each component of the path
     * @return [String]
     */
    function join() {
        var segs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            segs[_i - 0] = arguments[_i];
        }
        // Required: Prune any non-strings from the path. I also prune empty segments
        // so we can do a simple join of the array.
        var processed = [];
        for (var i = 0; i < segs.length; i++) {
            var segment = segs[i];
            if (typeof segment !== 'string') {
                throw new TypeError("Invalid argument type to segs.join: " + (typeof segment));
            }
            else if (segment !== '') {
                processed.push(segment);
            }
        }
        return normalize(processed.join(paths.sep));
    }

    return paths.join = join;
});
define('skylark-langx-types/types',[
    "skylark-langx-ns"
],function(skylark){
    var nativeIsArray = Array.isArray, 
        toString = {}.toString;
    
    var type = (function() {
        var class2type = {};

        // Populate the class2type map
        "Boolean Number String Function Array Date RegExp Object Error Symbol".split(" ").forEach(function(name) {
            class2type["[object " + name + "]"] = name.toLowerCase();
        });

        return function type(obj) {
            return obj == null ? String(obj) :
                class2type[toString.call(obj)] || "object";
        };
    })();

 
    var  isArray = nativeIsArray || function(obj) {
        return object && object.constructor === Array;
    };


    /**
     * Checks if `value` is array-like. A value is considered array-like if it's
     * not a function/string/element and has a `value.length` that's an integer greater than or
     * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
     *
     * @category Lang
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
     * @example
     *
     * isArrayLike([1, 2, 3])
     * // => true
     *
     * isArrayLike(document.body.children)
     * // => false
     *
     * isArrayLike('abc')
     * // => true
     *
     * isArrayLike(Function)
     * // => false
     */    
    function isArrayLike(obj) {
        return !isString(obj) && !isHtmlNode(obj) && typeof obj.length == 'number' && !isFunction(obj);
    }

    /**
     * Checks if `value` is classified as a boolean primitive or object.
     *
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
     * @example
     *
     * isBoolean(false)
     * // => true
     *
     * isBoolean(null)
     * // => false
     */
    function isBoolean(obj) {
       return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
       //return typeof(obj) === "boolean";
    }

    function isDefined(obj) {
        return typeof obj !== 'undefined';
    }

    function isDocument(obj) {
        return obj != null && obj.nodeType == obj.DOCUMENT_NODE;
    }

   // Is a given value a DOM element?
    function isElement(obj) {
        return !!(obj && obj.nodeType === 1);
    }   

    function isEmptyObject(obj) {
        var name;
        for (name in obj) {
            if (obj[name] !== null) {
                return false;
            }
        }
        return true;
    }


    /**
     * Checks if `value` is classified as a `Function` object.
     *
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a function, else `false`.
     * @example
     *
     * isFunction(parseInt)
     * // => true
     *
     * isFunction(/abc/)
     * // => false
     */
    function isFunction(value) {
        return type(value) == "function";
    }



    function isHtmlNode(obj) {
        return obj && obj.nodeType; // obj instanceof Node; //Consider the elements in IFRAME
    }

    function isInstanceOf( /*Object*/ value, /*Type*/ type) {
        //Tests whether the value is an instance of a type.
        if (value === undefined) {
            return false;
        } else if (value === null || type == Object) {
            return true;
        } else if (typeof value === "number") {
            return type === Number;
        } else if (typeof value === "string") {
            return type === String;
        } else if (typeof value === "boolean") {
            return type === Boolean;
        } else if (typeof value === "string") {
            return type === String;
        } else {
            return (value instanceof type) || (value && value.isInstanceOf ? value.isInstanceOf(type) : false);
        }
    }

    function isNull(obj) {
        return obj === null;
    }

    function isNumber(obj) {
        return typeof obj == 'number';
    }

    function isObject(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;        
        //return type(obj) == "object";
    }

    function isPlainObject(obj) {
        return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype;
    }

    function isString(obj) {
        return typeof obj === 'string';
    }

    function isWindow(obj) {
        return obj && obj == obj.window;
    }

    function isSameOrigin(href) {
        if (href) {
            var origin = location.protocol + '//' + location.hostname;
            if (location.port) {
                origin += ':' + location.port;
            }
            return href.startsWith(origin);
        }
    }

    /**
     * Checks if `value` is classified as a `Symbol` primitive or object.
     *
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
     * @example
     *
     * _.isSymbol(Symbol.iterator);
     * // => true
     *
     * _.isSymbol('abc');
     * // => false
     */
    function isSymbol(value) {
      return typeof value == 'symbol' ;
       //|| (isObjectLike(value) && objectToString.call(value) == symbolTag); // modified by lwf
    }

    // Is a given variable undefined?
    function isUndefined(obj) {
        return obj === void 0;
    }


    var INFINITY = 1 / 0,
        MAX_SAFE_INTEGER = 9007199254740991,
        MAX_INTEGER = 1.7976931348623157e+308,
        NAN = 0 / 0;

    /** Used to match leading and trailing whitespace. */
    var reTrim = /^\s+|\s+$/g;

    /** Used to detect bad signed hexadecimal string values. */
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

    /** Used to detect binary string values. */
    var reIsBinary = /^0b[01]+$/i;

    /** Used to detect octal string values. */
    var reIsOctal = /^0o[0-7]+$/i;

    /** Used to detect unsigned integer values. */
    var reIsUint = /^(?:0|[1-9]\d*)$/;

    /** Built-in method references without a dependency on `root`. */
    var freeParseInt = parseInt;

    /**
     * Converts `value` to a finite number.
     *
     * @static
     * @memberOf _
     * @since 4.12.0
     * @category Lang
     * @param {*} value The value to convert.
     * @returns {number} Returns the converted number.
     * @example
     *
     * _.toFinite(3.2);
     * // => 3.2
     *
     * _.toFinite(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toFinite(Infinity);
     * // => 1.7976931348623157e+308
     *
     * _.toFinite('3.2');
     * // => 3.2
     */
    function toFinite(value) {
      if (!value) {
        return value === 0 ? value : 0;
      }
      value = toNumber(value);
      if (value === INFINITY || value === -INFINITY) {
        var sign = (value < 0 ? -1 : 1);
        return sign * MAX_INTEGER;
      }
      return value === value ? value : 0;
    }

    /**
     * Converts `value` to an integer.
     *
     * **Note:** This method is loosely based on
     * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
     *
     * @static
     * @memberOf _
     * @param {*} value The value to convert.
     * @returns {number} Returns the converted integer.
     * @example
     *
     * _.toInteger(3.2);
     * // => 3
     *
     * _.toInteger(Number.MIN_VALUE);
     * // => 0
     *
     * _.toInteger(Infinity);
     * // => 1.7976931348623157e+308
     *
     * _.toInteger('3.2');
     * // => 3
     */
    function toInteger(value) {
      var result = toFinite(value),
          remainder = result % 1;

      return result === result ? (remainder ? result - remainder : result) : 0;
    }   

    /**
     * Converts `value` to a number.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value The value to process.
     * @returns {number} Returns the number.
     * @example
     *
     * _.toNumber(3.2);
     * // => 3.2
     *
     * _.toNumber(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toNumber(Infinity);
     * // => Infinity
     *
     * _.toNumber('3.2');
     * // => 3.2
     */
    function toNumber(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
        value = isObject(other) ? (other + '') : other;
      }
      if (typeof value != 'string') {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, '');
      var isBinary = reIsBinary.test(value);
      return (isBinary || reIsOctal.test(value))
        ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
        : (reIsBadHex.test(value) ? NAN : +value);
    }





    return skylark.attach("langx.types",{

        isArray: isArray,

        isArrayLike: isArrayLike,

        isBoolean: isBoolean,

        isDefined: isDefined,

        isDocument: isDocument,

        isElement,

        isEmpty : isEmptyObject,

        isEmptyObject: isEmptyObject,

        isFunction: isFunction,

        isHtmlNode: isHtmlNode,

        isNaN : function (obj) {
            return isNaN(obj);
        },

        isNull: isNull,


        isNumber: isNumber,

        isNumeric: isNumber,

        isObject: isObject,

        isPlainObject: isPlainObject,

        isString: isString,

        isSameOrigin: isSameOrigin,

        isSymbol : isSymbol,

        isUndefined: isUndefined,

        isWindow: isWindow,

        type: type,

        toFinite : toFinite,
        toNumber : toNumber,
        toInteger : toInteger
        
    });

});
define('skylark-langx-types/main',[
	"./types"
],function(types){
	return types;
});
define('skylark-langx-types', ['skylark-langx-types/main'], function (main) { return main; });

define('skylark-langx-constructs/constructs',[
  "skylark-langx-ns"
],function(skylark){

    return skylark.attach("langx.constructs",{});
});
define('skylark-langx-constructs/inherit',[
	"./constructs"
],function(constructs){

    function inherit(ctor,base) {
        ///var f = function() {};
        ///f.prototype = base.prototype;
        ///
        ///ctor.prototype = new f();

	    if ((typeof base !== "function") && base) {
	      throw new TypeError("Super expression must either be null or a function");
	    }

	    ctor.prototype = Object.create(base && base.prototype, {
	      constructor: {
	        value: ctor,
	        writable: true,
	        configurable: true
	      }
	    });

	    if (base) {
	    	//tor.__proto__ = base;
	    	Object.setPrototypeOf(ctor, base);
	    } 
    }

    return constructs.inherit = inherit
});
define('skylark-langx-objects/objects',[
    "skylark-langx-ns",
    "skylark-langx-types"
],function(skylark,types){

    return skylark.attach("langx.objects",{
        attach : skylark.attach
    });

});
define('skylark-langx-objects/all-keys',[
    "skylark-langx-types",
    "./objects"
],function(types,objects){

    // Retrieve all the property names of an object.
    function allKeys(obj) {
        if (!types.isObject(obj)) return [];
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    }

    return objects.allKeys = allKeys;

});
define('skylark-langx-objects/assign',[
	"skylark-langx-types",
	"./objects"
],function(types,objects) {

	return objects.assign = Object.assign;
});
define('skylark-langx-objects/to-key',[
	"skylark-langx-types",
	"./objects"
],function(types,objects) {

	const isSymbol = types.isSymbol,
		  isString = types.isString;

	/** Used as references for various `Number` constants. */
	const INFINITY = 1 / 0

	/**
	 * Converts `value` to a string key if it's not a string or symbol.
	 *
	 * @private
	 * @param {*} value The value to inspect.
	 * @returns {string|symbol} Returns the key.
	 */
	function toKey(value) {
	  if (isString(value) || isSymbol(value)) {
	    return value
	  }
	  const result = `${value}`
	  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result
	}

	return objects.toKey = toKey;

});
define('skylark-langx-objects/is-key',[
	"skylark-langx-types",
	"./objects"
],function(types,objects) {

	const isSymbol = types.isSymbol,
		  isArray = types.isArray;

	/** Used to match property names within property paths. */
	const reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/
	const reIsPlainProp = /^\w*$/

	/**
	 * Checks if `value` is a property name and not a property path.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {Object} [object] The object to query keys on.
	 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
	 */
	function isKey(value, object) {
	  if (isArray(value)) {
	    return false
	  }
	  const type = typeof value
	  if (type === 'number' || type === 'boolean' || value == null || isSymbol(value)) {
	    return true
	  }
	  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
	    (object != null && value in Object(object))
	}

	return objects.isKey = isKey;
});
define('skylark-langx-objects/_cast_path',[
	"skylark-langx-types",
	"./objects",
	"./is-key"
],function(types,objects,isKey) {
	const charCodeOfDot = '.'.charCodeAt(0)
	const reEscapeChar = /\\(\\)?/g
	const rePropName = RegExp(
	  // Match anything that isn't a dot or bracket.
	  '[^.[\\]]+' + '|' +
	  // Or match property names within brackets.
	  '\\[(?:' +
	    // Match a non-string expression.
	    '([^"\'][^[]*)' + '|' +
	    // Or match strings (supports escaping characters).
	    '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' +
	  ')\\]'+ '|' +
	  // Or match "" as the space between consecutive dots or empty brackets.
	  '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))'
	  , 'g')

	/**
	 * Converts `string` to a property path array.
	 *
	 * @private
	 * @param {string} string The string to convert.
	 * @returns {Array} Returns the property path array.
	 */
	const stringToPath = ((string) => {
	  const result = []
	  if (string.charCodeAt(0) === charCodeOfDot) {
	    result.push('')
	  }
	  string.replace(rePropName, (match, expression, quote, subString) => {
	    let key = match
	    if (quote) {
	      key = subString.replace(reEscapeChar, '$1')
	    }
	    else if (expression) {
	      key = expression.trim()
	    }
	    result.push(key)
	  })
	  return result
	});

	/**
	 * Casts `value` to a path array if it's not one.
	 *
	 * @private
	 * @param {*} value The value to inspect.
	 * @param {Object} [object] The object to query keys on.
	 * @returns {Array} Returns the cast property path array.
	 */
	function castPath(value, object) {
	  if (types.isArray(value)) {
	    return value
	  }
	  return isKey(value, object) ? [value] : stringToPath(value)
	}

	return castPath;
});
define('skylark-langx-objects/get',[
	"skylark-langx-types",
	"./objects",
	"./to-key",
	"./_cast_path"
],function(types,objects,toKey,castPath) {

	/**
	 * The base implementation of `get` without support for default values.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array|string} path The path of the property to get.
	 * @returns {*} Returns the resolved value.
	 */
	function baseGet(object, path) {
	  path = castPath(path, object)

	  let index = 0
	  const length = path.length

	  while (object != null && index < length) {
	    object = object[toKey(path[index++])]
	  }
	  return (index && index == length) ? object : undefined
	}


	/**
	 * Gets the value at `path` of `object`. If the resolved value is
	 * `undefined`, the `defaultValue` is returned in its place.
	 *
	 * @since 3.7.0
	 * @category Object
	 * @param {Object} object The object to query.
	 * @param {Array|string} path The path of the property to get.
	 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
	 * @returns {*} Returns the resolved value.
	 * @see has, hasIn, set, unset
	 * @example
	 *
	 * const object = { 'a': [{ 'b': { 'c': 3 } }] }
	 *
	 * get(object, 'a[0].b.c')
	 * // => 3
	 *
	 * get(object, ['a', '0', 'b', 'c'])
	 * // => 3
	 *
	 * get(object, 'a.b.c', 'default')
	 * // => 'default'
	 */
	function get(object, path, defaultValue) {
	  const result = object == null ? undefined : baseGet(object, path)
	  return result === undefined ? defaultValue : result
	}

	return objects.get = get;
});
define('skylark-langx-objects/base-at',[
	"./objects",
	"./get"
],function(objects,get) {

	/**
	 * The base implementation of `at` without support for individual paths.
	 *
	 * @param {Object} object The object to iterate over.
	 * @param {string[]} paths The property paths to pick.
	 * @returns {Array} Returns the picked elements.
	 */
	function baseAt(object, paths) {
	  let index = -1
	  const length = paths.length
	  const result = new Array(length)
	  const skip = object == null

	  while (++index < length) {
	    result[index] = skip ? undefined : get(object, paths[index])
	  }
	  return result
	}

	return objects.baseAt = baseAt;
});
define('skylark-langx-objects/clone',[
    "skylark-langx-types",
    "./objects"
],function(types,objects) {
    var isPlainObject = types.isPlainObject,
        isArray = types.isArray;

    function clone( /*anything*/ src,checkCloneMethod) {
        var copy;
        if (src === undefined || src === null) {
            copy = src;
        } else if (checkCloneMethod && src.clone) {
            copy = src.clone();
        } else if (isArray(src)) {
            copy = [];
            for (var i = 0; i < src.length; i++) {
                copy.push(clone(src[i]));
            }
        } else if (isPlainObject(src)) {
            copy = {};
            for (var key in src) {
                copy[key] = clone(src[key]);
            }
        } else {
            copy = src;
        }

        return copy;

    }

    return objects.clone = clone;
});
define('skylark-langx-objects/defaults',[
    "./objects",
    "./all-keys"
],function(objects,allKeys){
  // An internal function for creating assigner functions.
  function createAssigner(keysFunc, defaults) {
      return function(obj) {
        var length = arguments.length;
        if (defaults) obj = Object(obj);  
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
          var source = arguments[index],
              keys = keysFunc(source),
              l = keys.length;
          for (var i = 0; i < l; i++) {
            var key = keys[i];
            if (!defaults || obj[key] === void 0) obj[key] = source[key];
          }
        }
        return obj;
     };
  }
  
  return objects.defaults = createAssigner(allKeys, true);
});
define('skylark-langx-objects/each',[
    "./objects"
],function(objects) {

    function each(obj, callback,isForEach) {
        var length, key, i, undef, value;

        if (obj) {
            length = obj.length;

            if (length === undef) {
                // Loop object items
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        value = obj[key];
                        if ((isForEach ? callback.call(value, value, key) : callback.call(value, key, value) ) === false) {
                            break;
                        }
                    }
                }
            } else {
                // Loop array items
                for (i = 0; i < length; i++) {
                    value = obj[i];
                    if ((isForEach ? callback.call(value, value, i) : callback.call(value, i, value) )=== false) {
                        break;
                    }
                }
            }
        }

        return this;
    }

    return objects.each = each;
});
define('skylark-langx-objects/_mixin',[
    "skylark-langx-types",
    "./objects"
],function(types,objects) {

    var isPlainObject = types.isPlainObject;

    function _mixin(target, source, deep, safe) {
        for (var key in source) {
            //if (!source.hasOwnProperty(key)) {
            //    continue;
            //}
            if (safe && target[key] !== undefined) {
                continue;
            }
            // if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
            //    if (isPlainObject(source[key]) && !isPlainObject(target[key])) {
            if (deep && isPlainObject(source[key])) {
                if (!isPlainObject(target[key])) {
                    target[key] = {};
                }
                //if (isArray(source[key]) && !isArray(target[key])) {
                //    target[key] = [];
                //}
                _mixin(target[key], source[key], deep, safe);
            } else if (source[key] !== undefined) {
                target[key] = source[key]
            }
        }
        return target;
    }

    return _mixin;
});
define('skylark-langx-objects/_parse_mixin_args',[
    "skylark-langx-types",
    "./objects"
],function(types,objects) {

    var slice = Array.prototype.slice,
        isBoolean = types.isBoolean;

    function _parseMixinArgs(args) {
        var params = slice.call(arguments, 0),
            target = params.shift(),
            deep = false;
        if (isBoolean(params[params.length - 1])) {
            deep = params.pop();
        }

        return {
            target: target,
            sources: params,
            deep: deep
        };
    }
    
    return _parseMixinArgs;
});
define('skylark-langx-objects/mixin',[
	"skylark-langx-types",
	"./objects",
  "./_mixin",
  "./_parse_mixin_args"
],function(types,objects,_mixin,_parseMixinArgs) {


    function mixin() {
        var args = _parseMixinArgs.apply(this, arguments);

        args.sources.forEach(function(source) {
            _mixin(args.target, source, args.deep, false);
        });
        return args.target;
    }


    return objects.mixin = mixin;
	
});
define('skylark-langx-objects/extend',[
    "./objects",
    "./mixin"
],function(objects,mixin) {
    var slice = Array.prototype.slice;

    function extend(target) {
        var deep, args = slice.call(arguments, 1);
        if (typeof target == 'boolean') {
            deep = target
            target = args.shift()
        }
        if (args.length == 0) {
            args = [target];
            target = this;
        }
        args.forEach(function(arg) {
            mixin(target, arg, deep);
        });
        return target;
    }

    return objects.extend = extend;
});
define('skylark-langx-objects/for-each',[
 	"./objects",
 	"./each"
],function(objects,each){

    function forEach (obj, fn) {
    	if (!obj) {
    		return;
    	}
     	if (obj.forEach) {
     		obj.forEach(fn);
     	} else {
     		each(obj,fn,true);
     	}
    }

	return objects.forEach = forEach;
});
define('skylark-langx-objects/has',[
    "skylark-langx-types",
    "./objects"
],function(types,objects){
    var hasOwnProperty = Object.prototype.hasOwnProperty;

    function has(obj, path) {
        if (!types.isArray(path)) {
            return obj != null && hasOwnProperty.call(obj, path);
        }
        var length = path.length;
        for (var i = 0; i < length; i++) {
            var key = path[i];
            if (obj == null || !hasOwnProperty.call(obj, key)) {
                return false;
            }
            obj = obj[key];
        }
        return !!length;
    }

    return objects.has = has;
});
define('skylark-langx-objects/includes',[
    "./objects"
],function(objects) {

    /**
     * Checks if `value` is in `collection`. If `collection` is a string, it's
     * checked for a substring of `value`, otherwise
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * is used for equality comparisons. If `fromIndex` is negative, it's used as
     * the offset from the end of `collection`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object|string} collection The collection to inspect.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=0] The index to search from.
     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
     * @returns {boolean} Returns `true` if `value` is found, else `false`.
     * @example
     *
     * _.includes([1, 2, 3], 1);
     * // => true
     *
     * _.includes([1, 2, 3], 1, 2);
     * // => false
     *
     * _.includes({ 'a': 1, 'b': 2 }, 1);
     * // => true
     *
     * _.includes('abcd', 'bc');
     * // => true
     */
    function includes(collection, value, fromIndex, guard) {
      collection = isArrayLike(collection) ? collection : values(collection);
      fromIndex = (fromIndex && !guard) ? toInteger(fromIndex) : 0;

      var length = collection.length;
      if (fromIndex < 0) {
        fromIndex = nativeMax(length + fromIndex, 0);
      }
      return isString(collection)
        ? (fromIndex <= length && collection.indexOf(value, fromIndex) > -1)
        : (!!length && baseIndexOf(collection, value, fromIndex) > -1);
    }



    return objects.includes = includes;
});
define('skylark-langx-objects/is-equal',[
	"skylark-langx-types",
	"./objects"
],function(types,objects) {
    var isFunction = types.isFunction;


    // Internal recursive comparison function for `isEqual`.
    var eq, deepEq;
    var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

    eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
        if (a === b) return a !== 0 || 1 / a === 1 / b;
        // `null` or `undefined` only equal to itself (strict comparison).
        if (a == null || b == null) return false;
        // `NaN`s are equivalent, but non-reflexive.
        if (a !== a) return b !== b;
        // Exhaust primitive checks
        var type = typeof a;
        if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
        return deepEq(a, b, aStack, bStack);
    };

    // Internal recursive comparison function for `isEqual`.
    deepEq = function(a, b, aStack, bStack) {
        // Unwrap any wrapped objects.
        //if (a instanceof _) a = a._wrapped;
        //if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className !== toString.call(b)) return false;
        switch (className) {
            // Strings, numbers, regular expressions, dates, and booleans are compared by value.
            case '[object RegExp]':
            // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                return '' + a === '' + b;
            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive.
                // Object(NaN) is equivalent to NaN.
                if (+a !== +a) return +b !== +b;
                // An `egal` comparison is performed for other numeric values.
                return +a === 0 ? 1 / +a === 1 / b : +a === +b;
            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a === +b;
            case '[object Symbol]':
                return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
        }

        var areArrays = className === '[object Array]';
        if (!areArrays) {
            if (typeof a != 'object' || typeof b != 'object') return false;
            // Objects with different constructors are not equivalent, but `Object`s or `Array`s
            // from different frames are.
            var aCtor = a.constructor, bCtor = b.constructor;
            if (aCtor !== bCtor && !(isFunction(aCtor) && aCtor instanceof aCtor &&
                               isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
                return false;
            }
        }
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

        // Initializing stack of traversed objects.
        // It's done here since we only need them for objects and arrays comparison.
        aStack = aStack || [];
        bStack = bStack || [];
        var length = aStack.length;
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] === a) return bStack[length] === b;
        }

        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);

        // Recursively compare objects and arrays.
        if (areArrays) {
            // Compare array lengths to determine if a deep comparison is necessary.
            length = a.length;
            if (length !== b.length) return false;
            // Deep compare the contents, ignoring non-numeric properties.
            while (length--) {
                if (!eq(a[length], b[length], aStack, bStack)) return false;
            }
        } else {
            // Deep compare objects.
            var keys = Object.keys(a), key;
            length = keys.length;
            // Ensure that both objects contain the same number of properties before comparing deep equality.
            if (Object.keys(b).length !== length) return false;
            while (length--) {
                // Deep compare each member
                key = keys[length];
                if (!(b[key]!==undefined && eq(a[key], b[key], aStack, bStack))) return false;
            }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return true;
    };


   // Perform a deep comparison to check if two objects are equal.
    function isEqual(a, b) {
        return eq(a, b);
    }

    return objects.isEqual = isEqual;
	
});
define('skylark-langx-objects/keys',[
    "skylark-langx-types",
    "./objects",
    "./has"
],function(types,objects,has){

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`.
    function keys(obj) {
        if (!types.isObject(obj)) return [];  
        var keys = [];
        for (var key in obj) if (has(obj, key)) keys.push(key);
        return keys;
    }

    return objects.keys = keys;
});
define('skylark-langx-objects/is-match',[
    "skylark-langx-types",
    "./objects",
    "./keys"
],function(types,objects,keys) {

    // Returns whether an object has a given set of `key:value` pairs.
    function isMatch(object, attrs) {
        var keys = keys(attrs), length = keys.length;
        if (object == null) return !length;
        var obj = Object(object);
        for (var i = 0; i < length; i++) {
          var key = keys[i];
          if (attrs[key] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    }    

    return objects.isMatch = isMatch;
});
define('skylark-langx-objects/omit',[
    "./objects",
    "./mixin"
],function(objects,mixin) {

   // Return a copy of the object without the blacklisted properties.
    function omit(obj, prop1,prop2) {
        if (!obj) {
            return null;
        }
        var result = mixin({},obj);
        for(var i=1;i<arguments.length;i++) {
            var pn = arguments[i];
            if (pn in obj) {
                delete result[pn];
            }
        }
        return result;

    }
    
    return objects.omit = omit;
});
define('skylark-langx-objects/pick',[
    "./objects"
],function(objects) {

   // Return a copy of the object only containing the whitelisted properties.
    function pick(obj,prop1,prop2) {
        if (!obj) {
            return null;
        }
        var result = {};
        for(var i=1;i<arguments.length;i++) {
            var pn = arguments[i];
            if (pn in obj) {
                result[pn] = obj[pn];
            }
        }
        return result;
    }
    
    return objects.pick = pick;
});
define('skylark-langx-objects/remove-items',[
    "skylark-langx-types",
    "./objects"
],function(types,objects){
    function removeItem(items, item) {
        if (types.isArray(items)) {
            var idx = items.indexOf(item);
            if (idx != -1) {
                items.splice(idx, 1);
            }
        } else if (types.isPlainObject(items)) {
            for (var key in items) {
                if (items[key] == item) {
                    delete items[key];
                    break;
                }
            }
        }

        return this;
    }

    return objects.removeItem = removeItem;
});
define('skylark-langx-objects/result',[
  "skylark-langx-types",
  "./objects",
  "./to-key",
  "./_cast_path"
],function(types,objects,toKey,castPath) {
	var isArray = types.isArray,
		isFunction = types.isFunction;

  /**
   * This method is like `get` except that if the resolved value is a
   * function it's invoked with the `this` binding of its parent object and
   * its result is returned.
   *
   * @since 0.1.0
   * @category Object
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to resolve.
   * @param {*} [defaultValue] The value returned for `undefined` resolved values.
   * @returns {*} Returns the resolved value.
   * @example
   *
   * const object = { 'a': [{ 'b': { 'c1': 3, 'c2': () => 4 } }] }
   *
   * result(object, 'a[0].b.c1')
   * // => 3
   *
   * result(object, 'a[0].b.c2')
   * // => 4
   *
   * result(object, 'a[0].b.c3', 'default')
   * // => 'default'
   *
   * result(object, 'a[0].b.c3', () => 'default')
   * // => 'default'
   */
  function result(object, path, defaultValue) {
    path = castPath(path, object)

    let index = -1
    let length = path.length

    // Ensure the loop is entered when path is empty.
    if (!length) {
      length = 1
      object = undefined
    }
    while (++index < length) {
      let value = object == null ? undefined : object[toKey(path[index])]
      if (value === undefined) {
        index = length
        value = defaultValue
      }
      object = isFunction(value) ? value.call(object) : value
    }
    return object
  }

  return objects.result = result;	
});
define('skylark-langx-objects/safe-mixin',[
	"./objects",
  "./_mixin",
  "./_parse_mixin_args"
],function(objects,_mixin,_parseMixinArgs) {

    function safeMixin() {
        var args = _parseMixinArgs.apply(this, arguments);

        args.sources.forEach(function(source) {
            _mixin(args.target, source, args.deep, true);
        });
        return args.target;
    }

    return objects.safeMixin = safeMixin;
});
define('skylark-langx-objects/scall',[
    "./objects"
],function(objects) {
    const  slice = Array.prototype.slice;

    function scall(obj,method,arg1,arg2) {
        if (obj && obj[method]) {
            var args = slice.call(arguments, 2);

            return obj[method].apply(obj,args);
        }
    }

    return objects.scall = scall;
});
define('skylark-langx-objects/is-index',[
	"skylark-langx-types",
	"./objects"
],function(types,objects) {
	/** Used as references for various `Number` constants. */
	const MAX_SAFE_INTEGER = 9007199254740991

	/** Used to detect unsigned integer values. */
	const reIsUint = /^(?:0|[1-9]\d*)$/

	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  const type = typeof value
	  length = length == null ? MAX_SAFE_INTEGER : length

	  return !!length &&
	    (type === 'number' ||
	      (type !== 'symbol' && reIsUint.test(value))) &&
	        (value > -1 && value % 1 == 0 && value < length)
	}

	return objects.isIndex = isIndex;
});
define('skylark-langx-objects/set',[
	"skylark-langx-types",
	"./objects",
	"./_cast_path",
	"./is-index",
	"./to-key"
],function(types,objects,castPath,isIndex,toKey) {
	/**
	 * The base implementation of `set`.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {Array|string} path The path of the property to set.
	 * @param {*} value The value to set.
	 * @param {Function} [customizer] The function to customize path creation.
	 * @returns {Object} Returns `object`.
	 */
	function baseSet(object, path, value, customizer) {
	  if (!types.isObject(object)) {
	    return object
	  }
	  path = castPath(path, object)

	  const length = path.length
	  const lastIndex = length - 1

	  let index = -1
	  let nested = object

	  while (nested != null && ++index < length) {
	    const key = toKey(path[index])
	    let newValue = value

	    if (index != lastIndex) {
	      const objValue = nested[key]
	      newValue = customizer ? customizer(objValue, key, nested) : undefined
	      if (newValue === undefined) {
	        newValue = types.isObject(objValue)
	          ? objValue
	          : (isIndex(path[index + 1]) ? [] : {})
	      }
	    }
	    nested[key] = newValue; //  assignValues() lwf
	    nested = nested[key];
	  }
	  return object
	}

	/**
	 * Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
	 * it's created. Arrays are created for missing index properties while objects
	 * are created for all other missing properties. Use `setWith` to customize
	 * `path` creation.
	 *
	 * **Note:** This method mutates `object`.
	 *
	 * @since 3.7.0
	 * @category Object
	 * @param {Object} object The object to modify.
	 * @param {Array|string} path The path of the property to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns `object`.
	 * @see has, hasIn, get, unset
	 * @example
	 *
	 * const object = { 'a': [{ 'b': { 'c': 3 } }] }
	 *
	 * set(object, 'a[0].b.c', 4)
	 * console.log(object.a[0].b.c)
	 * // => 4
	 *
	 * set(object, ['x', '0', 'y', 'z'], 5)
	 * console.log(object.x[0].y.z)
	 * // => 5
	 */
	function set(object, path, value) {
	  return object == null ? object : baseSet(object, path, value)
	}


	return objects.set = set;

});
 define('skylark-langx-objects/shadow',[
	"./objects"
],function(objects) {

    function shadow(obj, prop, value) {
        Object.defineProperty(obj, prop, {
            value,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return value;
    }

    return objects.shadow = shadow;
});
define('skylark-langx-objects/unset',[
	"skylark-langx-types",
	"./objects",
	"./set"
],function(types,objects,set) {

	/**
	 * Removes the property at `path` of `object`.
	 *
	 * **Note:** This method mutates `object`.
	 *
	 * @since 4.0.0
	 * @category Object
	 * @param {Object} object The object to modify.
	 * @param {Array|string} path The path of the property to unset.
	 * @returns {boolean} Returns `true` if the property is deleted, else `false`.
	 * @see get, has, set
	 * @example
	 *
	 * const object = { 'a': [{ 'b': { 'c': 7 } }] }
	 * unset(object, 'a[0].b.c')
	 * // => true
	 *
	 * console.log(object)
	 * // => { 'a': [{ 'b': {} }] }
	 *
	 * unset(object, ['a', '0', 'b', 'c'])
	 * // => true
	 *
	 * console.log(object)
	 * // => { 'a': [{ 'b': {} }] }
	 */
	function unset(object, path) {
	  return object == null ? true : set(object, path,undefined)
	}

	return objects.unset = unset;
});
define('skylark-langx-objects/values',[
    "skylark-langx-types",
    "./objects",
    "./all-keys"
],function(types,objects,allKeys){
    // Retrieve the values of an object's properties.
    function values(obj) {
        var keys = allKeys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    }

    return objects.values = values;
});
define('skylark-langx-objects/main',[
	"./objects",
	"./all-keys",
	"./assign",
	"./base-at",
	"./clone",
	"./defaults",
	"./each",
	"./extend",
	"./for-each",
	"./get",
	"./has",
	"./includes",
	"./is-equal",
	"./is-key",
	"./is-match",
	"./keys",
	"./mixin",
	"./omit",
	"./pick",
	"./remove-items",
	"./result",
	"./safe-mixin",
	"./scall",
	"./set",
	"./shadow",
	"./to-key",
	"./unset",
	"./values"
],function(objects){
	return objects;
});
define('skylark-langx-objects', ['skylark-langx-objects/main'], function (main) { return main; });

define('skylark-langx-arrays/arrays',[
  "skylark-langx-ns"
],function(skylark){
    return skylark.attach("langx.arrays");
});
define('skylark-langx-arrays/base-find-index',[
  "./arrays"
],function(arrays){
    /**
     * The base implementation of `_.findIndex` and `_.findLastIndex` without
     * support for iteratee shorthands.
     *
     * @param {Array} array The array to inspect.
     * @param {Function} predicate The function invoked per iteration.
     * @param {number} fromIndex The index to search from.
     * @param {boolean} [fromRight] Specify iterating from right to left.
     * @returns {number} Returns the index of the matched value, else `-1`.
     */
    function baseFindIndex(array, predicate, fromIndex, fromRight) {
      var length = array.length,
          index = fromIndex + (fromRight ? 1 : -1);

      while ((fromRight ? index-- : ++index < length)) {
        if (predicate(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    return arrays.baseFindIndex = baseFindIndex;
});
define('skylark-langx-arrays/base-indexof',[
  "./arrays",
  "./base-find-index"
],function(arrays,baseFindIndex){

    /**
     * The base implementation of `isNaN` without support for number objects.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
     */
    function baseIsNaN(value) {
      return value !== value;
    }

    /**
     * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
     *
     * @param {Array} array The array to inspect.
     * @param {*} value The value to search for.
     * @param {number} fromIndex The index to search from.
     * @returns {number} Returns the index of the matched value, else `-1`.
     */
    function baseIndexOf(array, value, fromIndex) {
      if (value !== value) {
        return baseFindIndex(array, baseIsNaN, fromIndex);
      }
      var index = fromIndex - 1,
          length = array.length;

      while (++index < length) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }
	
	return arrays.baseIndexOf = baseIndexOf;
});
define('skylark-langx-arrays/filter',[
  "./arrays"
],function(arrays){
   var _filter = Array.prototype.filter;
 
    function filter(array,func) {
      return _filter.call(array,func);
    }

    return arrays.filter = filter;
	
});
define('skylark-langx-arrays/compact',[
  "./arrays",
  "./filter"
],function(arrays,filter){

    function compact(array) {
        return filter(array, function(item) {
            return item != null;
        });
    }

    return arrays.compact = compact;
});
define('skylark-langx-arrays/in-array',[
  "./arrays"
],function(arrays){
    function inArray(item, array) {
        if (!array) {
            return -1;
        }
        var i;

        if (array.indexOf) {
            return array.indexOf(item);
        }

        i = array.length;
        while (i--) {
            if (array[i] === item) {
                return i;
            }
        }

        return -1;
    }

    return arrays.inArray = inArray;
	
});
define('skylark-langx-arrays/contains',[
  "./arrays",
  "./in-array"
],function(arrays,inArray){

    function contains(array,item) {
      return inArray(item,array);
    }
	
	return arrays.contains = contains;
});
define('skylark-langx-funcs/funcs',[
  "skylark-langx-ns",
],function(skylark,types,objects){
        



    function noop() {
    }




    return skylark.attach("langx.funcs",{
        noop : noop,

        returnTrue: function() {
            return true;
        },

        returnFalse: function() {
            return false;
        }

    });
});
define('skylark-langx-funcs/rest-arguments',[
	"./funcs"
],function(funcs){

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  function restArguments(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  }

  return funcs.restArguments = restArguments;	
});
define('skylark-langx-funcs/bind-all',[
	"./funcs",
	"./rest-arguments"
],function(funcs,restArguments){

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  return funcs.bindAll = restArguments(function(obj, keys) {
    ///keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = obj[key].bind(obj);
    }
  });

});

define('skylark-langx-funcs/defer',[
    "skylark-langx-types",
    "./funcs"
],function(types,funcs){

    function defer(fn,trigger,args,context) {
        var ret = {
            cancel : null
        },
        fn1 = fn;

        if (!types.isNumber(trigger) && !types.isFunction(trigger)) {
            context = args;
            args = trigger;
            trigger = 0;
        }

        if (args) {
            fn1 = function() {
                fn.apply(context,args);
            };
        }

        if (types.isFunction(trigger)) {
            var canceled = false;
            trigger(function(){
                if (!canceled) {
                    fn1();
                }
            });

            ret.cancel = function() {
                canceled = true;
            }

        } else {
            var  id;
            if (trigger == 0 && requestAnimationFrame) {
                id = requestAnimationFrame(fn1);
                ret.cancel = function() {
                    return cancelAnimationFrame(id);
                };
            } else {
                id = setTimeout(fn1,trigger);
                ret.cancel = function() {
                    return clearTimeout(id);
                };
            }            
        }

        return ret;
    }

    return funcs.defer = defer;
});
define('skylark-langx-funcs/debounce',[
	"./funcs",
    "./defer"
],function(funcs,defer){
   
    function debounce(fn, wait,useAnimationFrame) {
        var timeout,
            defered,
            debounced = function () {
                var context = this, args = arguments;
                var later = function () {
                    timeout = null;
                    if (useAnimationFrame) {
                        defered = defer(fn,args,context);
                    } else {
                        fn.apply(context, args);
                    }
                };

                cancel();
                timeout = setTimeout(later, wait);

                return {
                    cancel 
                };
            },
            cancel = debounced.cancel = function () {
                if (timeout) {
                    clearTimeout(timeout);
                }
                if (defered) {
                    defered.cancel();
                }
                timeout = void 0;
                defered = void 0;
            };

        return debounced;
    }

    return funcs.debounce = debounce;

});
define('skylark-langx-funcs/delegate',[
  "skylark-langx-objects",
  "./funcs"
],function(objects,funcs){
	var mixin = objects.mixin;

    var delegate = (function() {
        // boodman/crockford delegation w/ cornford optimization
        function TMP() {}
        return function(obj, props) {
            TMP.prototype = obj;
            var tmp = new TMP();
            TMP.prototype = null;
            if (props) {
                mixin(tmp, props);
            }
            return tmp; // Object
        };
    })();

    return funcs.delegate = delegate;

});
define('skylark-langx-funcs/loop',[
	"./funcs"
],function(funcs){

	/**
	 * Animation timer is a special type of timer that uses the requestAnimationFrame method.
	 *
	 * This timer calls the method with the same rate as the screen refesh rate.
	 * 
	 * Loop time can be changed dinamically.
	 *
	 * @class AnimationTimer
	 * @param {Function} callback Timer callback function.
	 */
	function AnimationTimer(callback)
	{
		this.callback = callback;

		this.running = false;
		this.id = -1;
	}

	/**
	 * Start timer, is the timer is already running dosen't do anything.
	 * 
	 * @method start
	 */
	AnimationTimer.prototype.start = function()
	{
		if(this.running)
		{
			return;
		}

		this.running = true;

		var self = this;
		function run()
		{
			self.callback();

			if(self.running)
			{
				self.id = requestAnimationFrame(run);
			}
		}

		run();
	};

	/**
	 * Stop animation timer.
	 * 
	 * @method stop
	 */
	AnimationTimer.prototype.stop = function()
	{
		this.running = false;
		cancelAnimationFrame(this.id);
	};

	function loop(fn) {
		return new AnimationTimer(fn);
    }

    return funcs.loop = loop;
});
define('skylark-langx-funcs/negate',[
	"./funcs"
],function(funcs){
   
    /**
     * Creates a function that negates the result of the predicate `func`. The
     * `func` predicate is invoked with the `this` binding and arguments of the
     * created function.
     * @category Function
     * @param {Function} predicate The predicate to negate.
     * @returns {Function} Returns the new negated function.
     * @example
     *
     * function isEven(n) {
     *   return n % 2 == 0
     * }
     *
     * filter([1, 2, 3, 4, 5, 6], negate(isEven))
     * // => [1, 3, 5]
     */
    function negate(predicate) {
      if (typeof predicate !== 'function') {
        throw new TypeError('Expected a function')
      }
      return function(...args) {
        return !predicate.apply(this, args)
      }
    }


    return funcs.negate = negate;

});
define('skylark-langx-funcs/proxy',[
  "skylark-langx-types",
	"./funcs"
],function(types,funcs){
    var slice = Array.prototype.slice,
        isFunction = types.isFunction,
        isString = types.isString;

    function proxy(fn, context) {
        var args = (2 in arguments) && slice.call(arguments, 2)
        if (isFunction(fn)) {
            var proxyFn = function() {
                return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments);
            }
            return proxyFn;
        } else if (isString(context)) {
            if (args) {
                args.unshift(fn[context], fn)
                return proxy.apply(null, args)
            } else {
                return proxy(fn[context], fn);
            }
        } else {
            throw new TypeError("expected function");
        }
    }

    return funcs.bind = funcs.proxy = proxy;

});
define('skylark-langx-funcs/template',[
  "skylark-langx-objects",
  "./funcs",
  "./proxy"
],function(objects,funcs,proxy){
    //ref : underscore
    var slice = Array.prototype.slice;
   
    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    var templateSettings = {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;


    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
      "'":      "'",
      '\\':     '\\',
      '\r':     'r',
      '\n':     'n',
      '\t':     't',
      '\u2028': 'u2028',
      '\u2029': 'u2029'
    };

    var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;


    function template(text, data, settings) {
        var render;
        settings = objects.defaults({}, settings,templateSettings);

        // Combine delimiters into one regular expression via alternation.
        var matcher = RegExp([
          (settings.escape || noMatch).source,
          (settings.interpolate || noMatch).source,
          (settings.evaluate || noMatch).source
        ].join('|') + '|$', 'g');

        // Compile the template source, escaping string literals appropriately.
        var index = 0;
        var source = "__p+='";
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
          source += text.slice(index, offset)
              .replace(escaper, function(match) { return '\\' + escapes[match]; });

          if (escape) {
            source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
          }
          if (interpolate) {
            source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
          }
          if (evaluate) {
            source += "';\n" + evaluate + "\n__p+='";
          }
          index = offset + match.length;
          return match;
        });
        source += "';\n";

        // If a variable is not specified, place data values in local scope.
        if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

        source = "var __t,__p='',__j=Array.prototype.join," +
          "print=function(){__p+=__j.call(arguments,'');};\n" +
          source + 'return __p;\n';

        try {
          render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
          e.source = source;
          throw e;
        }

        if (data) {
          return render(data,this)
        }
        var template = proxy(function(data) {
          return render.call(this, data,this);
        },this);

        // Provide the compiled source as a convenience for precompilation.
        var argument = settings.variable || 'obj';
        template.source = 'function(' + argument + '){\n' + source + '}';

        return template;
    }

    template.templateSettings = funcs.templateSettings = templateSettings;

    return funcs.template = template;

});
define('skylark-langx-funcs/throttle',[
  "./funcs"
],function(funcs){

    const throttle = function (fn, wait) {
        let last = window.performance.now();
        const throttled = function (...args) {
            const now = window.performance.now();
            if (now - last >= wait) {
                fn(...args);
                last = now;
            }
        };
        return throttled;
    };

    /*
    function throttle(func, delay) {
        var timer = null;

        return function() {
            var context = this,
                args = arguments;

            if ( timer === null ) {
                timer = setTimeout(function() {
                    func.apply(context, args);
                    timer = null;
                }, delay);
            }
        };
    }
    */


    return funcs.throttle = throttle;
});
define('skylark-langx-funcs/main',[
	"./funcs",
	"./bind-all",
	"./debounce",
	"./defer",
	"./delegate",
	"./loop",
	"./negate",
	"./proxy",
	"./rest-arguments",
	"./template",
	"./throttle"
],function(funcs){
	return funcs;
});
define('skylark-langx-funcs', ['skylark-langx-funcs/main'], function (main) { return main; });

define('skylark-langx-arrays/flatten',[
  "skylark-langx-types",
  "./arrays"
],function(types,arrays){

    function flatten(array) {
        if (types.isArrayLike(array)) {
            var result = [];
            for (var i = 0; i < array.length; i++) {
                var item = array[i];
                if (types.isArrayLike(item)) {
                    for (var j = 0; j < item.length; j++) {
                        result.push(item[j]);
                    }
                } else {
                    result.push(item);
                }
            }
            return result;
        } else {
            return array;
        }
        //return array.length > 0 ? concat.apply([], array) : array;
    }

    return arrays.flatten = flatten;
});
define('skylark-langx-arrays/difference',[
  "skylark-langx-funcs",
  "./arrays",
  "./flatten",
  "./filter",
  "./contains"
],function(funcs,arrays,flatten,filter,contains){
   // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    var difference  = funcs.restArguments(function(array, rest) {
      rest = flatten(rest, true, true);
      return filter(array, function(value){
        return !contains(rest, value);
      });
    });

    return arrays.difference = difference;
	
});
define('skylark-langx-arrays/find',[
  "./arrays"
],function(arrays){
    var _find = Array.prototype.find;

    function find(array,func) {
      return _find.call(array,func);
    }

    return arrays.find = find;
});
define('skylark-langx-arrays/first',[
  "./arrays"
],function(arrays){
    function first(items,n) {
      if (n) {
          return items.slice(0,n);
      } else {
          return items[0];
      }
    }

    return arrays.first = first;
});
define('skylark-langx-arrays/grep',[
  "skylark-langx-objects",
  "./arrays"
],function(objects,arrays){
    function grep(array, callback) {
        var out = [];

        objects.each(array, function(i, item) {
            if (callback(item, i)) {
                out.push(item);
            }
        });

        return out;
    }

    return arrays.grep = grep;
});
define('skylark-langx-arrays/indexof',[
  "./arrays"
],function(arrays){

    function indexOf(array,item) {
      return array.indexOf(item);
    }

    return arrays.indexOf = indexOf;
});
define('skylark-langx-arrays/last',[
  "./arrays"
],function(arrays){
    // Get the last element of an array. 
    function last(arr) {
        return arr[arr.length - 1];     
    }

    return arrays.last = last;
});
define('skylark-langx-arrays/make-array',[
	"skylark-langx-types",
 	"./arrays"
],function(types,arrays){
    function makeArray(obj, offset, startWith) {
       if (types.isArrayLike(obj) ) {
        return (startWith || []).concat(Array.prototype.slice.call(obj, offset || 0));
      }

      // array of single index
      return [ obj ];             
    }

	return arrays.makeArray = makeArray;	
});
define('skylark-langx-arrays/map',[
	"skylark-langx-types",
  	"./arrays",
  	"./flatten"
],function(types,arrays,flatten){
    function map(elements, callback) {
        var value, values = [],
            i, key
        if (types.isArrayLike(elements))
            for (i = 0; i < elements.length; i++) {
                value = callback.call(elements[i], elements[i], i);
                if (value != null) values.push(value)
            }
        else
            for (key in elements) {
                value = callback.call(elements[key], elements[key], key);
                if (value != null) values.push(value)
            }
        return flatten(values)
    }

    return arrays.map = map;
});
define('skylark-langx-arrays/merge',[
  "./arrays"
],function(arrays){

    function merge( first, second ) {
      var l = second.length,
          i = first.length,
          j = 0;

      if ( typeof l === "number" ) {
        for ( ; j < l; j++ ) {
          first[ i++ ] = second[ j ];
        }
      } else {
        while ( second[j] !== undefined ) {
          first[ i++ ] = second[ j++ ];
        }
      }

      first.length = i;

      return first;
    }

    return arrays.merge = merge;
	
});
define('skylark-langx-arrays/pull-at',[
  "skylark-langx-types",
  "skylark-langx-objects",
  "./arrays"
],function(types,objects,arrays){

	/**
	 * Removes elements from `array` corresponding to `indexes` and returns an
	 * array of removed elements.
	 *
	 * **Note:** Unlike `at`, this method mutates `array`.
	 *
	 * @category Array
	 * @param {Array} array The array to modify.
	 * @param {...(number|number[])} [indexes] The indexes of elements to remove.
	 * @returns {Array} Returns the new array of removed elements.
	 * @see pull, pullAll, pullAllBy, pullAllWith, remove, reject
	 * @example
	 *
	 * const array = ['a', 'b', 'c', 'd']
	 * const pulled = pullAt(array, [1, 3])
	 *
	 * console.log(array)
	 * // => ['a', 'c']
	 *
	 * console.log(pulled)
	 * // => ['b', 'd']
	 */
	function pullAt(array, ...indexes) {
	  const length = array == null ? 0 : array.length
	  const result = objects.baseAt(array, indexes)

	  indexes.sort(function(a, b) {
  		return a - b;
	  });

	  for (let i= indexes.length-1;i>=0;i--) {
	  	array.slice(indexes[i],1);
	  }

	  return result
	}

	return arrays.pullAt = pullAt;
});

define('skylark-langx-arrays/reduce',[
  "./arrays"
],function(arrays){

    function reduce(array,callback,initialValue) {
        return Array.prototype.reduce.call(array,callback,initialValue);
    }

    return arrays.reduce = reduce;	
});
define('skylark-langx-arrays/uniq',[
  "./arrays",
  "./filter"
],function(arrays,filter){

    function uniq(array) {
        return filter(array, function(item, idx) {
            return array.indexOf(item) == idx;
        })
    }
	
	return arrays.uniq = uniq;
});
define('skylark-langx-arrays/without',[
	"skylark-langx-funcs",
  "./arrays",
  "./difference"
],function(funcs,arrays,difference){

    // Return a version of the array that does not contain the specified value(s).
    var without = funcs.restArguments(function(array, otherArrays) {
      return difference(array, otherArrays);
    });

    return arrays.without = without;
});
define('skylark-langx-arrays/main',[
	"./arrays",
	"./base-find-index",
	"./base-indexof",
	"./compact",
	"./contains",
	"./difference",
	"./filter",
	"./find",
	"./first",
	"./flatten",
	"./grep",
	"./in-array",
	"./indexof",
	"./last",
	"./make-array",
	"./map",
	"./merge",
	"./pull-at",
	"./reduce",
	"./uniq",
	"./without"
],function(arrays){
	return arrays;
});
define('skylark-langx-arrays', ['skylark-langx-arrays/main'], function (main) { return main; });

define('skylark-langx-constructs/klass',[
  "skylark-langx-ns",
  "skylark-langx-types",
  "skylark-langx-objects",
  "skylark-langx-arrays",
  "./constructs",
  "./inherit"
],function(skylark,types,objects,arrays,constructs,inherit){
    var uniq = arrays.uniq,
        has = objects.has,
        mixin = objects.mixin,
        isArray = types.isArray,
        isDefined = types.isDefined;

/* for reference 
 function klass(props,parent) {
    var ctor = function(){
        this._construct();
    };
    ctor.prototype = props;
    if (parent) {
        ctor._proto_ = parent;
        props.__proto__ = parent.prototype;
    }
    return ctor;
}

// Type some JavaScript code here.
let animal = klass({
  _construct(){
      this.name = this.name + ",hi";
  },
    
  name: "Animal",
  eat() {         // [[HomeObject]] == animal
    alert(`${this.name} eats.`);
  }
    
    
});


let rabbit = klass({
  name: "Rabbit",
  _construct(){
      super._construct();
  },
  eat() {         // [[HomeObject]] == rabbit
    super.eat();
  }
},animal);

let longEar = klass({
  name: "Long Ear",
  eat() {         // [[HomeObject]] == longEar
    super.eat();
  }
},rabbit);
*/
    


    var f1 = function() {
        function extendClass(ctor, props, options) {
            // Copy the properties to the prototype of the class.
            var proto = ctor.prototype,
                _super = ctor.superclass.prototype,
                noOverrided = options && options.noOverrided,
                overrides = options && options.overrides || {};

            for (var name in props) {
                if (name === "constructor") {
                    continue;
                }

                // Check if we're overwriting an existing function
                var prop = props[name];
                if (typeof props[name] == "function") {
                    proto[name] =  !prop._constructor && !noOverrided && typeof _super[name] == "function" ?
                          (function(name, fn, superFn) {
                            return function() {
                                var tmp = this.overrided;

                                // Add a new ._super() method that is the same method
                                // but on the super-class
                                this.overrided = superFn;

                                // The method only need to be bound temporarily, so we
                                // remove it when we're done executing
                                var ret = fn.apply(this, arguments);

                                this.overrided = tmp;

                                return ret;
                            };
                        })(name, prop, _super[name]) :
                        prop;
                } else if (types.isPlainObject(prop) && prop!==null && (prop.get)) {
                    Object.defineProperty(proto,name,prop);
                } else {
                    proto[name] = prop;
                }
            }
            return ctor;
        }

        function serialMixins(ctor,mixins) {
            var result = [];

            mixins.forEach(function(mixin){
                if (has(mixin,"__mixins__")) {
                     throw new Error("nested mixins");
                }
                var clss = [];
                while (mixin) {
                    clss.unshift(mixin);
                    mixin = mixin.superclass;
                }
                result = result.concat(clss);
            });

            result = uniq(result);

            result = result.filter(function(mixin){
                var cls = ctor;
                while (cls) {
                    if (mixin === cls) {
                        return false;
                    }
                    if (has(cls,"__mixins__")) {
                        var clsMixines = cls["__mixins__"];
                        for (var i=0; i<clsMixines.length;i++) {
                            if (clsMixines[i]===mixin) {
                                return false;
                            }
                        }
                    }
                    cls = cls.superclass;
                }
                return true;
            });

            if (result.length>0) {
                return result;
            } else {
                return false;
            }
        }

        function mergeMixins(ctor,mixins) {
            var newCtor =ctor;
            for (var i=0;i<mixins.length;i++) {
                var xtor = new Function();

                inherit(xtor,newCtor)
                //xtor.prototype = Object.create(newCtor.prototype);
                //xtor.__proto__ = newCtor;
                xtor.superclass = null;
                mixin(xtor.prototype,mixins[i].prototype);
                xtor.prototype.__mixin__ = mixins[i];
                newCtor = xtor;
            }

            return newCtor;
        }

        function _constructor ()  {
            if (this._construct) {
                return this._construct.apply(this, arguments);
            } else  if (this.init) {
                return this.init.apply(this, arguments);
            }
        }

        return function createClass(props, parent, mixins,options) {
            if (isArray(parent)) {
                options = mixins;
                mixins = parent;
                parent = null;
            }
            parent = parent || Object;

            if (isDefined(mixins) && !isArray(mixins)) {
                options = mixins;
                mixins = false;
            }

            var innerParent = parent;

            if (mixins) {
                mixins = serialMixins(innerParent,mixins);
            }

            if (mixins) {
                innerParent = mergeMixins(innerParent,mixins);
            }

            var klassName = props.klassName || "",
                ctor = new Function(
                    "return function " + klassName + "() {" +
                    "var inst = this," +
                    " ctor = arguments.callee;" +
                    "if (!(inst instanceof ctor)) {" +
                    "inst = Object.create(ctor.prototype);" +
                    "}" +
                    "return ctor._constructor.apply(inst, arguments) || inst;" + 
                    "}"
                )();


            // Populate our constructed prototype object
            ///ctor.prototype = Object.create(innerParent.prototype);

            // Enforce the constructor to be what we expect
            ///ctor.prototype.constructor = ctor;
  
            // And make this class extendable
            ///ctor.__proto__ = innerParent;

            inherit(ctor,innerParent);

            ctor.superclass = parent;

            if (!ctor._constructor) {
                ctor._constructor = _constructor;
            } 

            if (mixins) {
                ctor.__mixins__ = mixins;
            }

            if (!ctor.partial) {
                ctor.partial = function(props, options) {
                    return extendClass(this, props, options);
                };
            }
            if (!ctor.inherit) {
                ctor.inherit = function(props, mixins,options) {
                    return createClass(props, this, mixins,options);
                };
            }

            ctor.partial(props, options);

            return ctor;
        };
    }

    var createClass = f1();

    return constructs.klass = createClass;
});
define('skylark-langx-constructs/main',[
	"./constructs",
	"./inherit",
	"./klass"
],function(constructs){
	return constructs;
});
define('skylark-langx-constructs', ['skylark-langx-constructs/main'], function (main) { return main; });

define('skylark-langx-paths/path',[
    "skylark-langx-types",
    "skylark-langx-constructs",
    "./paths"
], function(types,constructs,paths) {

    /**
     * @class Path
     * @constructor
     */
    var Path =   constructs.klass({
        _construct : function() {
            var _ = this._ = {
                segments : null,
                hasLeading : false,
                hasTrailing : false
            };
            if (arguments.length == 1 && types.isString(arguments[0])) {
                  this._parse(arguments[0]);
            } else  if (types.isArray(arguments[0])){
                _.segments = arguments[0];
                _.hasLeading = arguments[1] || false;
                _.hasTrailing = arguments[2] || false;
                this._canonicalize();                
            }
        },

        _canonicalize: function() {
            var doIt;
            var segments = this._.segments;
            for (var i = 0; i < segments.length; i++) {
                if (segments[i] == "." || segments[i] == "..") {
                    doIt = true;
                    break;
                }
            }
            if (doIt) {
                var stack = [];
                for (var i = 0; i < segments.length; i++) {
                    if (segments[i] == "..") {
                        if (stack.length == 0) {
                            // if the stack is empty we are going out of our scope
                            // so we need to accumulate segments.  But only if the original
                            // path is relative.  If it is absolute then we can't go any higher than
                            // root so simply toss the .. references.
                            if (!this.hasLeading) {
                                stack.push(segments[i]); //stack push
                            }
                        } else {
                            // if the top is '..' then we are accumulating segments so don't pop
                            if (".." == stack[stack.length - 1]) {
                                stack.push("..");
                            } else {
                                stack.pop();
                            }
                        }
                        //collapse current references
                    } else if (segments[i] != "." || segments.length == 1) {
                        stack.push(segments[i]); //stack push
                    }
                }
                //if the number of segments hasn't changed, then no modification needed
                if (stack.length == segments.length) {
                    return;
                }
                this._.segments = stack;
            }
        },

        _length: function(anotherPath) {
            return this._.segments.length;
        },


        _parse : function( /*String*/ path) {
            if (!path) {
                path = ".";
            }
            var _ = this._,
                segments = path.split("/");

            if (path.charAt(0) == "/") {
                _.hasLeading = true;
                segments.shift();
            }
            if (path.charAt(path.length - 1) == "/") {
                _.hasTrailing = true;
                // If the path ends in '/', split() will create an array whose last element
                // is an empty string. Remove that here.
                segments.pop();
            }
            _.segments = segments;
            _.path = path;

            this._canonicalize()
        },

        /*
         *
         *@method append
         *@parameter {Path|String}tail
         *@return {Path}
         */
        append: /*Path*/ function( /*Path*/ tail) {
            if (types.isString(tail)) {
                return this.appendPathStr(tail);
            } else {
                return this.appendPath(tail);
            }
        },

        /*
         *
         *@method appendPath
         *@parameter {Path}tail
         *@return {Path}
         */
        appendPath: /*Path*/ function( /*Path*/ tail) {
            if (tail.isAbsolute()) {
                return tail;
            }
            var mySegments = this.segments,
                tailSegments = tail.segments,
                newSegments = mySegments.concat(tailSegments),
                result = new Path(newSegments, this.hasLeading, tail.hasTrailing);
            return result;
        },

        /*
         *
         *@method appendPathStr
         *@parameter {String}tail
         *@return {Path}
         */
        appendPathStr: function( /*String*/ tail) {
            tail = new Path(tail || "");
            return this.appendPath(tail);
        },

        /*
         *
         *@method clone
         *@return {Path}
         */
        "clone": function() {
            return new Path(this.segments, this.hasLeading, this.hasTrailing);
        },

        /*
         *Tests if this path ends with the given path.
         *@method endsWidth
         *@parameter {String}tail
         *@return {Boolean}
         */
        "endsWith": /*Boolean*/ function( /*String*/ tail) {
            var segments = this.segments;
            var tailSegments = (new Path(tail)).segments;
            while (tailSegments.length > 0 && segments.length > 0) {
                if (tailSegments.pop() != segments.pop()) {
                    return false;
                }
            }
            return true;
        },

        /*
         *Tests this path for equality with the given object.
         *@method equals
         *@parameter {Path}another
         *@return {Boolean}
         */
        "equals": /*Boolean*/ function( /*Path*/ another) {
            var segments = this._.segments,
                anotherSegments = another._.segments;
            if (segments.length != anotherSegments.length) {
                return false;
            }
            for (var i = 0; i < segments.length; i++) {
                if (anotherSegments[i] != segments[i]) {
                    return false;
                };
            }
            return true;
        },

        /*
         *
         *@method firstSegment
         *@parameter {Number}length
         *@return {String}
         */
        firstSegment: /*String*/ function( /*Number*/ length) {
            var segments = this._.segments;
            return segments[length || 0];
        },

        /*
         *
         *@method getExtension
         *@return {String}
         */
        getExtension: function() {
            var extension = this._.extension,
                path = this._.path;
            if (!textension) {
                extension = this._.extension = path.substr(path.lastIndexOf('.') + 1);
            }
            return extension;
        },

        /*
         *
         *@method getSegments
         *@return {Array}
         */
        getSegments: /*Array*/ function() {
            return this.segments;
        },

        /*
         *Returns the parent path, or null if this path does not have a parent.
         *@method getParentPath
         *@return {Path}
         */
        getParentPath: /*Path*/ function() {
            var parentPath = this._.parentPath;
            if (!parentPath) {
                var parentSegments = this.segments;
                parentSegments.pop();
                parentPath = this._.parentPath = new Path(parentSegments, this.hasLeading);
            }
            return parentPath;
        },


        /*
         *Returns the root component of this path as a Path object, or null if this path does not have a root component.
         *@method getRoot
         *@return {Path}
         */
        "getRoot": /*Path*/ function() {
            //TODO: will be implemented
        },

        /*
         *Tells whether or not this path is absolute.
         *@method isAbsolute
         *@return {Boolean}
         */
        isAbsolute: /*Boolean*/ function() {
            return this.hasLeading;
        },


        /*
         *
         *@method lastSegment
         *@ return {String}
         */
        lastSegment: /*String*/ function() {
            var segments = this._.segments;
            return segments[segments.length - 1];
        },

        /*
         *
         *@method matchingFirstSegments
         *@parameter {Path}another
         *@return {Number}
         */
        matchingFirstSegments: /*Number*/ function( /*Path*/ another) {
            var mySegments = this.segments;
            var pathSegments = another.segments;
            var max = Math.min(mySegments.length, pathSegments.length);
            var count = 0;
            for (var i = 0; i < max; i++) {
                if (mySegments[i] != pathSegments[i]) {
                    return count;
                }
                count++;
            }
            return count;
        },

        /*
         *Returns a path that is this path with redundant name elements eliminated.
         *@method normalize
         *@return {Path}
         */
        "normalize": /*Path*/ function() {
            //TODO: will be implemented
        },


        /*
         *
         *@method removeFirstSegments
         *@parameter {Number}count
         *@return {Path}
         */
        removeFirstSegments: /*Path*/ function( /*Number*/ count) {
            var segments = this._.segments,
                hasLeading = this._.hasLeading;
            hasTrailing = this._.hasTrailing;

            return new Path(segments.slice(count, segments.length), hasLeading, hasTrailing);
        },

        /*
         *
         *@method removeLastSegments
         *@parameter {Number}count
         *@return {Path}
         */
        removeLastSegments: /*Path*/ function( /*Number?*/ count) {
            var segments = this._.segments,
                hasLeading = this._.hasLeading;
            hasTrailing = this._.hasTrailing;

            if (!count) {
                count = 1;
            }

            return new Path(segments.slice(0, segments.length - count), hasLeading, hasTrailing);
        },

        /*
         *
         *@method removeMatchingFirstSegments
         *@parameter {Path}another
         *@return {Path}
         */
        removeMatchingFirstSegments: /*Path*/ function( /*Path*/ another) {
            var match = this.matchingFirstSegments(another);
            return this.removeFirstSegments(match);
        },

        /*
         *
         *@method removeMatchingLastSegments
         *@parameter {Path}another
         *@return {Path}
         */
        removeMatchingLastSegments: /*Path*/ function( /*Path*/ another) {
            var match = this.matchingFirstSegments(anotherPath);
            return this.removeLastSegments(match);
        },

        /*
         *
         *@method removeRelative
         *@return {Path}
         */
        removeRelative: function() {
            var segs = this.segments;
            if (segs.length > 0 && segs[1] == ".")
                return this.removeFirstSegments(1);
            return this;
        },

        /*
         *Constructs a relative path between this path and a given path.
         *@method relativeTo
         *@parameter {Path}base
         *@return {Path}
         */
        relativeTo: /*Path*/ function( /*Path|String*/ base, /*Boolean*/ ignoreFilename) {
            if (typeof base == 'string') {
                base = new Path(base);
            }
            var mySegments = this.segments;
            if (this.isAbsolute()) {
                return this;
            }
            var baseSegments = base.segments;
            var commonLength = this.matchingFirstSegments(base);
            var baseSegmentLength = baseSegments.length;
            if (ignoreFilename) {
                baseSegmentLength = baseSegmentLength - 1;
            }
            var differenceLength = baseSegmentLength - commonLength;
            var newSegmentLength = differenceLength + mySegments.length - commonLength;
            if (newSegmentLength == 0) {
                return Path.EMPTY;
            }
            var newSegments = [];
            for (var i = 0; i < differenceLength; i++) {
                newSegments.push('..');
            }
            for (var i = commonLength; i < mySegments.length; i++) {
                newSegments.push(mySegments[i]);
            }
            return new Path(newSegments, false, this.hasTrailing);
        },

        /*
         *
         *@method segment
         *@parameter {Number}index
         *@return {String}
         */
        segment: /*String*/ function( /*Number*/ index) {
            var segments = this._.segments;
            if (segments.length < index) return null;
            return segments[index];
        },

        /*
         *
         *@method startsWith
         *@parameter {Path}index
         *@return {Boolean}
         */
        startsWith: /*Boolean*/ function( /*Path*/ another) {
            var count = this.matchingFirstSegments(another);
            return another._length() == count;
        },

        /*
         *
         *@method toString
         *@return {String}
         */
        toString: function() {
            var result = [],
                segments = this._.segments;
            if (this.hasLeading) {
                result.push("/");
            }
            for (var i = 0; i < segments.length; i++) {
                if (i > 0) {
                    result.push("/");
                }
                result.push(segments[i]);
            }
            if (this.hasTrailing) {
                result.push("/");
            }
            return result.join("");
        },

        hasLeading : {
            get : function() {
                return this._.hasLeading
            }
        },

        hasTrailing : {
            get : function() {
                return this._.hasTrailing
            }
        }

    });


    Path.EMPTY = new Path("");

    return paths.Path = Path;
});

define('skylark-langx-paths/resolve',[
    "./paths",
    "./normalize"
],function(paths,normalize){
    /**
     * Resolves to to an absolute path.
     *
     * If to isn't already absolute from arguments are prepended in right to left
     * order, until an absolute path is found. If after using all from paths still
     * no absolute path is found, the current working directory is used as well.
     * The resulting path is normalized, and trailing slashes are removed unless
     * the path gets resolved to the root directory. Non-string arguments are
     * ignored.
     *
     * Another way to think of it is as a sequence of cd commands in a shell.
     *
     *     paths.resolve('foo/bar', '/tmp/file/', '..', 'a/../subfile')
     *
     * Is similar to:
     *
     *     cd foo/bar
     *     cd /tmp/file/
     *     cd ..
     *     cd a/../subfile
     *     pwd
     *
     * The difference is that the different paths don't need to exist and may also
     * be files.
     * @example Usage example
     *   paths.resolve('/foo/bar', './baz')
     *   // returns
     *   '/foo/bar/baz'
     *
     *   paths.resolve('/foo/bar', '/tmp/file/')
     *   // returns
     *   '/tmp/file'
     *
     *   paths.resolve('wwwroot', 'static_files/png/', '../gif/image.gif')
     *   // if currently in /home/myself/node, it returns
     *   '/home/myself/node/wwwroot/static_files/gif/image.gif'
     * @param [String,...] segs
     * @return [String]
     */
    function resolve() {
        var segs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            segs[_i - 0] = arguments[_i];
        }
        // Monitor for invalid segs, throw out empty segs, and look for the *last*
        // absolute path that we see.
        var processed = [];
        for (var i = 0; i < segs.length; i++) {
            var p = segs[i];
            if (typeof p !== 'string') {
                throw new TypeError("Invalid argument type to paths.join: " + (typeof p));
            }
            else if (p !== '') {
                // Remove anything that has occurred before this absolute path, as it
                // doesn't matter.
                if (p.charAt(0) === paths.sep) {
                    processed = [];
                }
                processed.push(p);
            }
        }
        // Special: Remove trailing slash unless it's the root
        var resolved = normalize(processed.join(paths.sep));
        if (resolved.length > 1 && resolved.charAt(resolved.length - 1) === paths.sep) {
            return resolved.substr(0, resolved.length - 1);
        }
        /*
        /// 
        // Special: If it doesn't start with '/', it's relative and we need to append
        // the current directory.
        if (resolved.charAt(0) !== paths.sep) {
            // Remove ./, since we're going to append the current directory.
            if (resolved.charAt(0) === '.' && (resolved.length === 1 || resolved.charAt(1) === paths.sep)) {
                resolved = resolved.length === 1 ? '' : resolved.substr(2);
            }
            // Append the current directory, which *must* be an absolute path.
            var cwd = process.cwd();
            if (resolved !== '') {
                // cwd will never end in a /... unless it's the root.
                resolved = normalize(cwd + (cwd !== '/' ? paths.sep : '') + resolved);
            }
            else {
                resolved = cwd;
            }
        }
        */
        return resolved;
    }

    return paths.resolve = resolve;
});
define('skylark-langx-paths/relative',[
	"./paths",
	"./resolve"
],function(paths,resolve){

    /**
     * Solve the relative path from from to to.
     *
     * At times we have two absolute paths, and we need to derive the relative path
     * from one to the other. This is actually the reverse transform of
     * paths.resolve, which means we see that:
     *
     *    paths.resolve(from, paths.relative(from, to)) == paths.resolve(to)
     *
     * @example Usage example
     *   paths.relative('C:\\orandea\\test\\aaa', 'C:\\orandea\\impl\\bbb')
     *   // returns
     *   '..\\..\\impl\\bbb'
     *
     *   paths.relative('/data/orandea/test/aaa', '/data/orandea/impl/bbb')
     *   // returns
     *   '../../impl/bbb'
     * @param [String] from
     * @param [String] to
     * @return [String]
     */
    function relative(from, to) {
        var i;
        // Alright. Let's resolve these two to absolute paths and remove any
        // weirdness.
        from = resolve(from);
        to = resolve(to);
        var fromSegs = from.split(paths.sep);
        var toSegs = to.split(paths.sep);
        // Remove the first segment on both, as it's '' (both are absolute paths)
        toSegs.shift();
        fromSegs.shift();
        // There are two segments to this path:
        // * Going *up* the directory hierarchy with '..'
        // * Going *down* the directory hierarchy with foo/baz/bat.
        var upCount = 0;
        var downSegs = [];
        // Figure out how many things in 'from' are shared with 'to'.
        for (i = 0; i < fromSegs.length; i++) {
            var seg = fromSegs[i];
            if (seg === toSegs[i]) {
                continue;
            }
            // The rest of 'from', including the current element, indicates how many
            // directories we need to go up.
            upCount = fromSegs.length - i;
            break;
        }
        // The rest of 'to' indicates where we need to change to. We place this
        // outside of the loop, as toSegs.length may be greater than fromSegs.length.
        downSegs = toSegs.slice(i);
        // Special case: If 'from' is '/'
        if (fromSegs.length === 1 && fromSegs[0] === '') {
            upCount = 0;
        }
        // upCount can't be greater than the number of fromSegs
        // (cd .. from / is still /)
        if (upCount > fromSegs.length) {
            upCount = fromSegs.length;
        }
        // Create the final string!
        var rv = '';
        for (i = 0; i < upCount; i++) {
            rv += '../';
        }
        rv += downSegs.join(paths.sep);
        // Special case: Remove trailing '/'. Happens if it's all up and no down.
        if (rv.length > 1 && rv.charAt(rv.length - 1) === paths.sep) {
            rv = rv.substr(0, rv.length - 1);
        }
        return rv;
    }

    return paths.relative =  relative;
});
define('skylark-langx-paths/main',[
	"./paths",
	"./basename",
	"./dirname",
	"./extname",
	"./format",
	"./is-absolute",
	"./join",
	"./normalize",
	"./path",
	"./relative",
	"./resolve"
],function(paths){
	return paths;
});
define('skylark-langx-paths', ['skylark-langx-paths/main'], function (main) { return main; });

define('skylark-browserfs/libs/path',[
	"skylark-langx-paths"
],function(paths){
  'use strict'
	return paths;
});
define('skylark-browserfs/core/node_fs_stats',[
    '../libs/buffers'
],function (buffers) {
    'use strict';
    const { Buffer } = buffers;

    /**
     * Indicates the type of the given file. Applied to 'mode'.
     */
    var FileType;
    (function (FileType) {
        FileType[FileType["FILE"] = 32768] = "FILE";
        FileType[FileType["DIRECTORY"] = 16384] = "DIRECTORY";
        FileType[FileType["SYMLINK"] = 40960] = "SYMLINK";
    })(FileType || (FileType = {}));

    /**
     * Emulation of Node's `fs.Stats` object.
     *
     * Attribute descriptions are from `man 2 stat'
     * @see http://nodejs.org/api/fs.html#fs_class_fs_stats
     * @see http://man7.org/linux/man-pages/man2/stat.2.html
     */
    class Stats {
        /**
         * Provides information about a particular entry in the file system.
         * @param itemType Type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
         * @param size Size of the item in bytes. For directories/symlinks,
         *   this is normally the size of the struct that represents the item.
         * @param mode Unix-style file mode (e.g. 0o644)
         * @param atimeMs time of last access, in milliseconds since epoch
         * @param mtimeMs time of last modification, in milliseconds since epoch
         * @param ctimeMs time of last time file status was changed, in milliseconds since epoch
         * @param birthtimeMs time of file creation, in milliseconds since epoch
         */
        constructor(itemType, size, mode, atimeMs, mtimeMs, ctimeMs, birthtimeMs) {
            /**
             * UNSUPPORTED ATTRIBUTES
             * I assume no one is going to need these details, although we could fake
             * appropriate values if need be.
             */
            // ID of device containing file
            this.dev = 0;
            // inode number
            this.ino = 0;
            // device ID (if special file)
            this.rdev = 0;
            // number of hard links
            this.nlink = 1;
            // blocksize for file system I/O
            this.blksize = 4096;
            // @todo Maybe support these? atm, it's a one-user filesystem.
            // user ID of owner
            this.uid = 0;
            // group ID of owner
            this.gid = 0;
            // XXX: Some file systems stash data on stats objects.
            this.fileData = null;
            this.size = size;
            let currentTime = 0;
            if (typeof (atimeMs) !== 'number') {
                currentTime = Date.now();
                atimeMs = currentTime;
            }
            if (typeof (mtimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                mtimeMs = currentTime;
            }
            if (typeof (ctimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                ctimeMs = currentTime;
            }
            if (typeof (birthtimeMs) !== 'number') {
                if (!currentTime) {
                    currentTime = Date.now();
                }
                birthtimeMs = currentTime;
            }
            this.atimeMs = atimeMs;
            this.ctimeMs = ctimeMs;
            this.mtimeMs = mtimeMs;
            this.birthtimeMs = birthtimeMs;
            if (!mode) {
                switch (itemType) {
                    case FileType.FILE:
                        this.mode = 0x1a4;
                        break;
                    case FileType.DIRECTORY:
                    default:
                        this.mode = 0x1ff;
                }
            }
            else {
                this.mode = mode;
            }
            // number of 512B blocks allocated
            this.blocks = Math.ceil(size / 512);
            // Check if mode also includes top-most bits, which indicate the file's
            // type.
            if (this.mode < 0x1000) {
                this.mode |= itemType;
            }
        }
        static fromBuffer(buffer) {
            const size = buffer.readUInt32LE(0), mode = buffer.readUInt32LE(4), atime = buffer.readDoubleLE(8), mtime = buffer.readDoubleLE(16), ctime = buffer.readDoubleLE(24);
            return new Stats(mode & 0xF000, size, mode & 0xFFF, atime, mtime, ctime);
        }
        /**
         * Clones the stats object.
         */
        static clone(s) {
            return new Stats(s.mode & 0xF000, s.size, s.mode & 0xFFF, s.atimeMs, s.mtimeMs, s.ctimeMs, s.birthtimeMs);
        }
        get atime() {
            return new Date(this.atimeMs);
        }
        get mtime() {
            return new Date(this.mtimeMs);
        }
        get ctime() {
            return new Date(this.ctimeMs);
        }
        get birthtime() {
            return new Date(this.birthtimeMs);
        }
        toBuffer() {
            const buffer = Buffer.alloc(32);
            buffer.writeUInt32LE(this.size, 0);
            buffer.writeUInt32LE(this.mode, 4);
            buffer.writeDoubleLE(this.atime.getTime(), 8);
            buffer.writeDoubleLE(this.mtime.getTime(), 16);
            buffer.writeDoubleLE(this.ctime.getTime(), 24);
            return buffer;
        }
        /**
         * @return [Boolean] True if this item is a file.
         */
        isFile() {
            return (this.mode & 0xF000) === FileType.FILE;
        }
        /**
         * @return [Boolean] True if this item is a directory.
         */
        isDirectory() {
            return (this.mode & 0xF000) === FileType.DIRECTORY;
        }
        /**
         * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
         */
        isSymbolicLink() {
            return (this.mode & 0xF000) === FileType.SYMLINK;
        }
        /**
         * Change the mode of the file. We use this helper function to prevent messing
         * up the type of the file, which is encoded in mode.
         */
        chmod(mode) {
            this.mode = (this.mode & 0xF000) | mode;
        }
        // We don't support the following types of files.
        isSocket() {
            return false;
        }
        isBlockDevice() {
            return false;
        }
        isCharacterDevice() {
            return false;
        }
        isFIFO() {
            return false;
        }
    }


    return {
        FileType,
        Stats
    }
});
define('skylark-browserfs/core/global',[],function () {
    'use strict';
    const toExport = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global;
    return toExport;
});
define('skylark-browserfs/generic/setImmediate',['../core/global'], function (global) {
    'use strict';
    /**
     * @hidden
     */
    let bfsSetImmediate;
    if (typeof (setImmediate) !== "undefined") {
        bfsSetImmediate = setImmediate;
    }
    else {
        const gScope = global;
        const timeouts = [];
        const messageName = "zero-timeout-message";
        const canUsePostMessage = function () {
            if (typeof gScope.importScripts !== 'undefined' || !gScope.postMessage) {
                return false;
            }
            let postMessageIsAsync = true;
            const oldOnMessage = gScope.onmessage;
            gScope.onmessage = function () {
                postMessageIsAsync = false;
            };
            gScope.postMessage('', '*');
            gScope.onmessage = oldOnMessage;
            return postMessageIsAsync;
        };
        if (canUsePostMessage()) {
            bfsSetImmediate = function (fn) {
                timeouts.push(fn);
                gScope.postMessage(messageName, "*");
            };
            const handleMessage = function (event) {
                if (event.source === self && event.data === messageName) {
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    }
                    else {
                        event.cancelBubble = true;
                    }
                    if (timeouts.length > 0) {
                        const fn = timeouts.shift();
                        return fn();
                    }
                }
            };
            if (gScope.addEventListener) {
                gScope.addEventListener('message', handleMessage, true);
            }
            else {
                gScope.attachEvent('onmessage', handleMessage);
            }
        }
        else if (gScope.MessageChannel) {
            // WebWorker MessageChannel
            const channel = new gScope.MessageChannel();
            channel.port1.onmessage = (event) => {
                if (timeouts.length > 0) {
                    return timeouts.shift()();
                }
            };
            bfsSetImmediate = (fn) => {
                timeouts.push(fn);
                channel.port2.postMessage('');
            };
        }
        else {
            bfsSetImmediate = function (fn) {
                return setTimeout(fn, 0);
            };
        }
    }

    return bfsSetImmediate;
});
define('skylark-browserfs/core/FS',[
    '../libs/buffers',
    './api_error',
    './file_flag',
    '../libs/path',
    './node_fs_stats',
    '../generic/setImmediate'
], function (buffers,api_error, file_flag, path, node_fs_stats, setImmediate) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { FileFlag } = file_flag;
    const {Stats} = node_fs_stats;
    const { Buffer } = buffers;

    /** Used for unit testing. Defaults to a NOP. */
    let wrapCbHook = function (cb, numArgs) {
        return cb;
    };
    /**
     * Wraps a callback function, ensuring it is invoked through setImmediate.
     * @hidden
     */
    function wrapCb(cb, numArgs) {
        if (typeof cb !== 'function') {
            throw new Error('Callback must be a function.');
        }
        const hookedCb = wrapCbHook(cb, numArgs);
        // We could use `arguments`, but Function.call/apply is expensive. And we only
        // need to handle 1-3 arguments
        switch (numArgs) {
            case 1:
                return function (arg1) {
                    setImmediate(function () {
                        return hookedCb(arg1);
                    });
                };
            case 2:
                return function (arg1, arg2) {
                    setImmediate(function () {
                        return hookedCb(arg1, arg2);
                    });
                };
            case 3:
                return function (arg1, arg2, arg3) {
                    setImmediate(function () {
                        return hookedCb(arg1, arg2, arg3);
                    });
                };
            default:
                throw new Error('Invalid invocation of wrapCb.');
        }
    }
    /**
     * @hidden
     */
    function assertRoot(fs) {
        if (fs) {
            return fs;
        }
        throw new ApiError(ErrorCode.EIO, `Initialize BrowserFS with a file system using BrowserFS.initialize(filesystem)`);
    }
    /**
     * @hidden
     */
    function normalizeMode(mode, def) {
        switch (typeof mode) {
            case 'number':
                // (path, flag, mode, cb?)
                return mode;
            case 'string':
                // (path, flag, modeString, cb?)
                const trueMode = parseInt(mode, 8);
                if (!isNaN(trueMode)) {
                    return trueMode;
                }
                // Invalid string.
                return def;
            default:
                return def;
        }
    }
    /**
     * @hidden
     */
    function normalizeTime(time) {
        if (time instanceof Date) {
            return time;
        }
        else if (typeof time === 'number') {
            return new Date(time * 1000);
        }
        else {
            throw new ApiError(ErrorCode.EINVAL, `Invalid time.`);
        }
    }
    /**
     * @hidden
     */
    function normalizePath(p) {
        // Node doesn't allow null characters in paths.
        if (p.indexOf('\u0000') >= 0) {
            throw new ApiError(ErrorCode.EINVAL, 'Path must be a string without null bytes.');
        }
        else if (p === '') {
            throw new ApiError(ErrorCode.EINVAL, 'Path must not be empty.');
        }
        return path.resolve(p);
    }
    /**
     * @hidden
     */
    function normalizeOptions(options, defEnc, defFlag, defMode) {
        // typeof null === 'object' so special-case handing is needed.
        switch (options === null ? 'null' : typeof options) {
            case 'object':
                return {
                    encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
                    flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
                    mode: normalizeMode(options['mode'], defMode)
                };
            case 'string':
                return {
                    encoding: options,
                    flag: defFlag,
                    mode: defMode
                };
            case 'null':
            case 'undefined':
            case 'function':
                return {
                    encoding: defEnc,
                    flag: defFlag,
                    mode: defMode
                };
            default:
                throw new TypeError(`"options" must be a string or an object, got ${typeof options} instead.`);
        }
    }
    /**
     * The default callback is a NOP.
     * @hidden
     * @private
     */
    function nopCb() {
        // NOP.
    }
    /**
     * The node frontend to all filesystems.
     * This layer handles:
     *
     * * Sanity checking inputs.
     * * Normalizing paths.
     * * Resetting stack depth for asynchronous operations which may not go through
     *   the browser by wrapping all input callbacks using `setImmediate`.
     * * Performing the requested operation through the filesystem or the file
     *   descriptor, as appropriate.
     * * Handling optional arguments and setting default arguments.
     * @see http://nodejs.org/api/fs.html
     */
    class FS {
        constructor() {
            /* tslint:enable:variable-name */
            this.F_OK = 0;
            this.R_OK = 4;
            this.W_OK = 2;
            this.X_OK = 1;
            this.root = null;
            this.fdMap = {};
            this.nextFd = 100;
        }
        initialize(rootFS) {
            if (!rootFS.constructor.isAvailable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
            }
            return this.root = rootFS;
        }
        /**
         * converts Date or number to a fractional UNIX timestamp
         * Grabbed from NodeJS sources (lib/fs.js)
         */
        _toUnixTimestamp(time) {
            if (typeof time === 'number') {
                return time;
            }
            else if (time instanceof Date) {
                return time.getTime() / 1000;
            }
            throw new Error("Cannot parse time: " + time);
        }
        /**
         * **NONSTANDARD**: Grab the FileSystem instance that backs this API.
         * @return [BrowserFS.FileSystem | null] Returns null if the file system has
         *   not been initialized.
         */
        getRootFS() {
            if (this.root) {
                return this.root;
            }
            else {
                return null;
            }
        }
        // FILE OR DIRECTORY METHODS
        /**
         * Asynchronous rename. No arguments other than a possible exception are given
         * to the completion callback.
         * @param oldPath
         * @param newPath
         * @param callback
         */
        rename(oldPath, newPath, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                assertRoot(this.root).rename(normalizePath(oldPath), normalizePath(newPath), newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous rename.
         * @param oldPath
         * @param newPath
         */
        renameSync(oldPath, newPath) {
            assertRoot(this.root).renameSync(normalizePath(oldPath), normalizePath(newPath));
        }
        /**
         * Test whether or not the given path exists by checking with the file system.
         * Then call the callback argument with either true or false.
         * @example Sample invocation
         *   fs.exists('/etc/passwd', function (exists) {
         *     util.debug(exists ? "it's there" : "no passwd!");
         *   });
         * @param path
         * @param callback
         */
        exists(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                return assertRoot(this.root).exists(normalizePath(path), newCb);
            }
            catch (e) {
                // Doesn't return an error. If something bad happens, we assume it just
                // doesn't exist.
                return newCb(false);
            }
        }
        /**
         * Test whether or not the given path exists by checking with the file system.
         * @param path
         * @return [boolean]
         */
        existsSync(path) {
            try {
                return assertRoot(this.root).existsSync(normalizePath(path));
            }
            catch (e) {
                // Doesn't return an error. If something bad happens, we assume it just
                // doesn't exist.
                return false;
            }
        }
        /**
         * Asynchronous `stat`.
         * @param path
         * @param callback
         */
        stat(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                return assertRoot(this.root).stat(normalizePath(path), false, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `stat`.
         * @param path
         * @return [BrowserFS.node.fs.Stats]
         */
        statSync(path) {
            return assertRoot(this.root).statSync(normalizePath(path), false);
        }
        /**
         * Asynchronous `lstat`.
         * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
         * then the link itself is stat-ed, not the file that it refers to.
         * @param path
         * @param callback
         */
        lstat(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                return assertRoot(this.root).stat(normalizePath(path), true, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `lstat`.
         * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
         * then the link itself is stat-ed, not the file that it refers to.
         * @param path
         * @return [BrowserFS.node.fs.Stats]
         */
        lstatSync(path) {
            return assertRoot(this.root).statSync(normalizePath(path), true);
        }
        truncate(path, arg2 = 0, cb = nopCb) {
            let len = 0;
            if (typeof arg2 === 'function') {
                cb = arg2;
            }
            else if (typeof arg2 === 'number') {
                len = arg2;
            }
            const newCb = wrapCb(cb, 1);
            try {
                if (len < 0) {
                    throw new ApiError(ErrorCode.EINVAL);
                }
                return assertRoot(this.root).truncate(normalizePath(path), len, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `truncate`.
         * @param path
         * @param len
         */
        truncateSync(path, len = 0) {
            if (len < 0) {
                throw new ApiError(ErrorCode.EINVAL);
            }
            return assertRoot(this.root).truncateSync(normalizePath(path), len);
        }
        /**
         * Asynchronous `unlink`.
         * @param path
         * @param callback
         */
        unlink(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                return assertRoot(this.root).unlink(normalizePath(path), newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        /**
         * Synchronous `unlink`.
         * @param path
         */
        unlinkSync(path) {
            return assertRoot(this.root).unlinkSync(normalizePath(path));
        }
        open(path, flag, arg2, cb = nopCb) {
            const mode = normalizeMode(arg2, 0x1a4);
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 2);
            try {
                assertRoot(this.root).open(normalizePath(path), FileFlag.getFileFlag(flag), mode, (e, file) => {
                    if (file) {
                        newCb(e, this.getFdForFile(file));
                    }
                    else {
                        newCb(e);
                    }
                });
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous file open.
         * @see http://www.manpagez.com/man/2/open/
         * @param path
         * @param flags
         * @param mode defaults to `0644`
         * @return [BrowserFS.File]
         */
        openSync(path, flag, mode = 0x1a4) {
            return this.getFdForFile(assertRoot(this.root).openSync(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4)));
        }
        readFile(filename, arg2 = {}, cb = nopCb) {
            const options = normalizeOptions(arg2, null, 'r', null);
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 2);
            try {
                const flag = FileFlag.getFileFlag(options['flag']);
                if (!flag.isReadable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
                }
                return assertRoot(this.root).readFile(normalizePath(filename), options.encoding, flag, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        readFileSync(filename, arg2 = {}) {
            const options = normalizeOptions(arg2, null, 'r', null);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isReadable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
            }
            return assertRoot(this.root).readFileSync(normalizePath(filename), options.encoding, flag);
        }
        writeFile(filename, data, arg3 = {}, cb = nopCb) {
            const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const flag = FileFlag.getFileFlag(options.flag);
                if (!flag.isWriteable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
                }
                return assertRoot(this.root).writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
            }
            catch (e) {
                return newCb(e);
            }
        }
        writeFileSync(filename, data, arg3) {
            const options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isWriteable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
            }
            return assertRoot(this.root).writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
        }
        appendFile(filename, data, arg3, cb = nopCb) {
            const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const flag = FileFlag.getFileFlag(options.flag);
                if (!flag.isAppendable()) {
                    return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
                }
                assertRoot(this.root).appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        appendFileSync(filename, data, arg3) {
            const options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
            const flag = FileFlag.getFileFlag(options.flag);
            if (!flag.isAppendable()) {
                throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
            }
            return assertRoot(this.root).appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
        }
        // FILE DESCRIPTOR METHODS
        /**
         * Asynchronous `fstat`.
         * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
         * specified by the file descriptor `fd`.
         * @param fd
         * @param callback
         */
        fstat(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                const file = this.fd2file(fd);
                file.stat(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fstat`.
         * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
         * specified by the file descriptor `fd`.
         * @param fd
         * @return [BrowserFS.node.fs.Stats]
         */
        fstatSync(fd) {
            return this.fd2file(fd).statSync();
        }
        /**
         * Asynchronous close.
         * @param fd
         * @param callback
         */
        close(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).close((e) => {
                    if (!e) {
                        this.closeFd(fd);
                    }
                    newCb(e);
                });
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous close.
         * @param fd
         */
        closeSync(fd) {
            this.fd2file(fd).closeSync();
            this.closeFd(fd);
        }
        ftruncate(fd, arg2, cb = nopCb) {
            const length = typeof arg2 === 'number' ? arg2 : 0;
            cb = typeof arg2 === 'function' ? arg2 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                const file = this.fd2file(fd);
                if (length < 0) {
                    throw new ApiError(ErrorCode.EINVAL);
                }
                file.truncate(length, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous ftruncate.
         * @param fd
         * @param len
         */
        ftruncateSync(fd, len = 0) {
            const file = this.fd2file(fd);
            if (len < 0) {
                throw new ApiError(ErrorCode.EINVAL);
            }
            file.truncateSync(len);
        }
        /**
         * Asynchronous fsync.
         * @param fd
         * @param callback
         */
        fsync(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).sync(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous fsync.
         * @param fd
         */
        fsyncSync(fd) {
            this.fd2file(fd).syncSync();
        }
        /**
         * Asynchronous fdatasync.
         * @param fd
         * @param callback
         */
        fdatasync(fd, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                this.fd2file(fd).datasync(newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous fdatasync.
         * @param fd
         */
        fdatasyncSync(fd) {
            this.fd2file(fd).datasyncSync();
        }
        write(fd, arg2, arg3, arg4, arg5, cb = nopCb) {
            let buffer, offset, length, position = null;
            if (typeof arg2 === 'string') {
                // Signature 1: (fd, string, [position?, [encoding?]], cb?)
                let encoding = 'utf8';
                switch (typeof arg3) {
                    case 'function':
                        // (fd, string, cb)
                        cb = arg3;
                        break;
                    case 'number':
                        // (fd, string, position, encoding?, cb?)
                        position = arg3;
                        encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                        cb = typeof arg5 === 'function' ? arg5 : cb;
                        break;
                    default:
                        // ...try to find the callback and get out of here!
                        cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
                        return cb(new ApiError(ErrorCode.EINVAL, 'Invalid arguments.'));
                }
                buffer = Buffer.from(arg2, encoding);
                offset = 0;
                length = buffer.length;
            }
            else {
                // Signature 2: (fd, buffer, offset, length, position?, cb?)
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = typeof arg5 === 'number' ? arg5 : null;
                cb = typeof arg5 === 'function' ? arg5 : cb;
            }
            const newCb = wrapCb(cb, 3);
            try {
                const file = this.fd2file(fd);
                if (position === undefined || position === null) {
                    position = file.getPos();
                }
                file.write(buffer, offset, length, position, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        writeSync(fd, arg2, arg3, arg4, arg5) {
            let buffer, offset = 0, length, position;
            if (typeof arg2 === 'string') {
                // Signature 1: (fd, string, [position?, [encoding?]])
                position = typeof arg3 === 'number' ? arg3 : null;
                const encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
                offset = 0;
                buffer = Buffer.from(arg2, encoding);
                length = buffer.length;
            }
            else {
                // Signature 2: (fd, buffer, offset, length, position?)
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = typeof arg5 === 'number' ? arg5 : null;
            }
            const file = this.fd2file(fd);
            if (position === undefined || position === null) {
                position = file.getPos();
            }
            return file.writeSync(buffer, offset, length, position);
        }
        read(fd, arg2, arg3, arg4, arg5, cb = nopCb) {
            let position, offset, length, buffer, newCb;
            if (typeof arg2 === 'number') {
                // legacy interface
                // (fd, length, position, encoding, callback)
                length = arg2;
                position = arg3;
                const encoding = arg4;
                cb = typeof arg5 === 'function' ? arg5 : cb;
                offset = 0;
                buffer = Buffer.alloc(length);
                // XXX: Inefficient.
                // Wrap the cb so we shelter upper layers of the API from these
                // shenanigans.
                newCb = wrapCb((err, bytesRead, buf) => {
                    if (err) {
                        return cb(err);
                    }
                    cb(err, buf.toString(encoding), bytesRead);
                }, 3);
            }
            else {
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = arg5;
                newCb = wrapCb(cb, 3);
            }
            try {
                const file = this.fd2file(fd);
                if (position === undefined || position === null) {
                    position = file.getPos();
                }
                file.read(buffer, offset, length, position, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        readSync(fd, arg2, arg3, arg4, arg5) {
            let shenanigans = false;
            let buffer, offset, length, position, encoding = 'utf8';
            if (typeof arg2 === 'number') {
                length = arg2;
                position = arg3;
                encoding = arg4;
                offset = 0;
                buffer = Buffer.alloc(length);
                shenanigans = true;
            }
            else {
                buffer = arg2;
                offset = arg3;
                length = arg4;
                position = arg5;
            }
            const file = this.fd2file(fd);
            if (position === undefined || position === null) {
                position = file.getPos();
            }
            const rv = file.readSync(buffer, offset, length, position);
            if (!shenanigans) {
                return rv;
            }
            else {
                return [buffer.toString(encoding), rv];
            }
        }
        /**
         * Asynchronous `fchown`.
         * @param fd
         * @param uid
         * @param gid
         * @param callback
         */
        fchown(fd, uid, gid, callback = nopCb) {
            const newCb = wrapCb(callback, 1);
            try {
                this.fd2file(fd).chown(uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fchown`.
         * @param fd
         * @param uid
         * @param gid
         */
        fchownSync(fd, uid, gid) {
            this.fd2file(fd).chownSync(uid, gid);
        }
        /**
         * Asynchronous `fchmod`.
         * @param fd
         * @param mode
         * @param callback
         */
        fchmod(fd, mode, cb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
                this.fd2file(fd).chmod(numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `fchmod`.
         * @param fd
         * @param mode
         */
        fchmodSync(fd, mode) {
            const numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
            this.fd2file(fd).chmodSync(numMode);
        }
        /**
         * Change the file timestamps of a file referenced by the supplied file
         * descriptor.
         * @param fd
         * @param atime
         * @param mtime
         * @param callback
         */
        futimes(fd, atime, mtime, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const file = this.fd2file(fd);
                if (typeof atime === 'number') {
                    atime = new Date(atime * 1000);
                }
                if (typeof mtime === 'number') {
                    mtime = new Date(mtime * 1000);
                }
                file.utimes(atime, mtime, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Change the file timestamps of a file referenced by the supplied file
         * descriptor.
         * @param fd
         * @param atime
         * @param mtime
         */
        futimesSync(fd, atime, mtime) {
            this.fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
        }
        // DIRECTORY-ONLY METHODS
        /**
         * Asynchronous `rmdir`.
         * @param path
         * @param callback
         */
        rmdir(path, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).rmdir(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `rmdir`.
         * @param path
         */
        rmdirSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).rmdirSync(path);
        }
        /**
         * Asynchronous `mkdir`.
         * @param path
         * @param mode defaults to `0777`
         * @param callback
         */
        mkdir(path, mode, cb = nopCb) {
            if (typeof mode === 'function') {
                cb = mode;
                mode = 0x1ff;
            }
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).mkdir(path, mode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `mkdir`.
         * @param path
         * @param mode defaults to `0777`
         */
        mkdirSync(path, mode) {
            assertRoot(this.root).mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff));
        }
        /**
         * Asynchronous `readdir`. Reads the contents of a directory.
         * The callback gets two arguments `(err, files)` where `files` is an array of
         * the names of the files in the directory excluding `'.'` and `'..'`.
         * @param path
         * @param callback
         */
        readdir(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).readdir(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `readdir`. Reads the contents of a directory.
         * @param path
         * @return [String[]]
         */
        readdirSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).readdirSync(path);
        }
        // SYMLINK METHODS
        /**
         * Asynchronous `link`.
         * @param srcpath
         * @param dstpath
         * @param callback
         */
        link(srcpath, dstpath, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                srcpath = normalizePath(srcpath);
                dstpath = normalizePath(dstpath);
                assertRoot(this.root).link(srcpath, dstpath, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `link`.
         * @param srcpath
         * @param dstpath
         */
        linkSync(srcpath, dstpath) {
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            return assertRoot(this.root).linkSync(srcpath, dstpath);
        }
        symlink(srcpath, dstpath, arg3, cb = nopCb) {
            const type = typeof arg3 === 'string' ? arg3 : 'file';
            cb = typeof arg3 === 'function' ? arg3 : cb;
            const newCb = wrapCb(cb, 1);
            try {
                if (type !== 'file' && type !== 'dir') {
                    return newCb(new ApiError(ErrorCode.EINVAL, "Invalid type: " + type));
                }
                srcpath = normalizePath(srcpath);
                dstpath = normalizePath(dstpath);
                assertRoot(this.root).symlink(srcpath, dstpath, type, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `symlink`.
         * @param srcpath
         * @param dstpath
         * @param type can be either `'dir'` or `'file'` (default is `'file'`)
         */
        symlinkSync(srcpath, dstpath, type) {
            if (!type) {
                type = 'file';
            }
            else if (type !== 'file' && type !== 'dir') {
                throw new ApiError(ErrorCode.EINVAL, "Invalid type: " + type);
            }
            srcpath = normalizePath(srcpath);
            dstpath = normalizePath(dstpath);
            return assertRoot(this.root).symlinkSync(srcpath, dstpath, type);
        }
        /**
         * Asynchronous readlink.
         * @param path
         * @param callback
         */
        readlink(path, cb = nopCb) {
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).readlink(path, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous readlink.
         * @param path
         * @return [String]
         */
        readlinkSync(path) {
            path = normalizePath(path);
            return assertRoot(this.root).readlinkSync(path);
        }
        // PROPERTY OPERATIONS
        /**
         * Asynchronous `chown`.
         * @param path
         * @param uid
         * @param gid
         * @param callback
         */
        chown(path, uid, gid, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).chown(path, false, uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `chown`.
         * @param path
         * @param uid
         * @param gid
         */
        chownSync(path, uid, gid) {
            path = normalizePath(path);
            assertRoot(this.root).chownSync(path, false, uid, gid);
        }
        /**
         * Asynchronous `lchown`.
         * @param path
         * @param uid
         * @param gid
         * @param callback
         */
        lchown(path, uid, gid, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                path = normalizePath(path);
                assertRoot(this.root).chown(path, true, uid, gid, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `lchown`.
         * @param path
         * @param uid
         * @param gid
         */
        lchownSync(path, uid, gid) {
            path = normalizePath(path);
            assertRoot(this.root).chownSync(path, true, uid, gid);
        }
        /**
         * Asynchronous `chmod`.
         * @param path
         * @param mode
         * @param callback
         */
        chmod(path, mode, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = normalizeMode(mode, -1);
                if (numMode < 0) {
                    throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
                }
                assertRoot(this.root).chmod(normalizePath(path), false, numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `chmod`.
         * @param path
         * @param mode
         */
        chmodSync(path, mode) {
            const numMode = normalizeMode(mode, -1);
            if (numMode < 0) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
            }
            path = normalizePath(path);
            assertRoot(this.root).chmodSync(path, false, numMode);
        }
        /**
         * Asynchronous `lchmod`.
         * @param path
         * @param mode
         * @param callback
         */
        lchmod(path, mode, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                const numMode = normalizeMode(mode, -1);
                if (numMode < 0) {
                    throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
                }
                assertRoot(this.root).chmod(normalizePath(path), true, numMode, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `lchmod`.
         * @param path
         * @param mode
         */
        lchmodSync(path, mode) {
            const numMode = normalizeMode(mode, -1);
            if (numMode < 1) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
            }
            assertRoot(this.root).chmodSync(normalizePath(path), true, numMode);
        }
        /**
         * Change file timestamps of the file referenced by the supplied path.
         * @param path
         * @param atime
         * @param mtime
         * @param callback
         */
        utimes(path, atime, mtime, cb = nopCb) {
            const newCb = wrapCb(cb, 1);
            try {
                assertRoot(this.root).utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Change file timestamps of the file referenced by the supplied path.
         * @param path
         * @param atime
         * @param mtime
         */
        utimesSync(path, atime, mtime) {
            assertRoot(this.root).utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime));
        }
        realpath(path, arg2, cb = nopCb) {
            const cache = typeof (arg2) === 'object' ? arg2 : {};
            cb = typeof (arg2) === 'function' ? arg2 : nopCb;
            const newCb = wrapCb(cb, 2);
            try {
                path = normalizePath(path);
                assertRoot(this.root).realpath(path, cache, newCb);
            }
            catch (e) {
                newCb(e);
            }
        }
        /**
         * Synchronous `realpath`.
         * @param path
         * @param cache An object literal of mapped paths that can be used to
         *   force a specific path resolution or avoid additional `fs.stat` calls for
         *   known real paths.
         * @return [String]
         */
        realpathSync(path, cache = {}) {
            path = normalizePath(path);
            return assertRoot(this.root).realpathSync(path, cache);
        }
        watchFile(filename, arg2, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        unwatchFile(filename, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        watch(filename, arg2, listener = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        access(path, arg2, cb = nopCb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        accessSync(path, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        createReadStream(path, options) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        createWriteStream(path, options) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * For unit testing. Passes all incoming callbacks to cbWrapper for wrapping.
         */
        wrapCallbacks(cbWrapper) {
            wrapCbHook = cbWrapper;
        }
        getFdForFile(file) {
            const fd = this.nextFd++;
            this.fdMap[fd] = file;
            return fd;
        }
        fd2file(fd) {
            const rv = this.fdMap[fd];
            if (rv) {
                return rv;
            }
            else {
                throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
            }
        }
        closeFd(fd) {
            delete this.fdMap[fd];
        }
    }
    /* tslint:disable:variable-name */
    // Exported fs.Stats.
    FS.Stats = Stats;
    //# sourceMappingURL=FS.js.map

    return FS;
});
define('skylark-browserfs/core/node_fs',['./FS'], function (FS) {
    'use strict';
    let fs = new FS();
    const _fsMock = {};
    const fsProto = FS.prototype;
    const keys = Object.getOwnPropertyNames(fsProto);
    keys.forEach(key => {
        if (typeof fs[key] === 'function') {
            _fsMock[key] = function () {
                return fs[key].apply(fs, arguments);
            };
        } else {
            _fsMock[key] = fs[key];
        }
    });
    _fsMock['changeFSModule'] = function (newFs) {
        fs = newFs;
    };
    _fsMock['getFSModule'] = function () {
        return fs;
    };
    _fsMock['FS'] = FS;
    _fsMock['Stats'] = FS.Stats;

    return _fsMock;
});
define('skylark-browserfs/core/levenshtein',[],function () {
    'use strict';
   
    /*
     * Levenshtein distance, from the `js-levenshtein` NPM module.
     * Copied here to avoid complexity of adding another CommonJS module dependency.
     */
    function _min(d0, d1, d2, bx, ay) {
        return d0 < d1 || d2 < d1 ? d0 > d2 ? d2 + 1 : d0 + 1 : bx === ay ? d1 : d1 + 1;
    }

    /**
     * Calculates levenshtein distance.
     * @param a
     * @param b
     */    
     function levenshtein(a, b) {
        if (a === b) {
            return 0;
        }
        if (a.length > b.length) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        let la = a.length;
        let lb = b.length;
        while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
            la--;
            lb--;
        }
        let offset = 0;
        while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
            offset++;
        }
        la -= offset;
        lb -= offset;
        if (la === 0 || lb === 1) {
            return lb;
        }
        const vector = new Array(la << 1);
        for (let y = 0; y < la;) {
            vector[la + y] = a.charCodeAt(offset + y);
            vector[y] = ++y;
        }
        let x;
        let d0;
        let d1;
        let d2;
        let d3;
        for (x = 0; x + 3 < lb;) {
            const bx0 = b.charCodeAt(offset + (d0 = x));
            const bx1 = b.charCodeAt(offset + (d1 = x + 1));
            const bx2 = b.charCodeAt(offset + (d2 = x + 2));
            const bx3 = b.charCodeAt(offset + (d3 = x + 3));
            let dd = x += 4;
            for (let y = 0; y < la;) {
                const ay = vector[la + y];
                const dy = vector[y];
                d0 = _min(dy, d0, d1, bx0, ay);
                d1 = _min(d0, d1, d2, bx1, ay);
                d2 = _min(d1, d2, d3, bx2, ay);
                dd = _min(d2, d3, dd, bx3, ay);
                vector[y++] = dd;
                d3 = d2;
                d2 = d1;
                d1 = d0;
                d0 = dy;
            }
        }
        let dd = 0;
        for (; x < lb;) {
            const bx0 = b.charCodeAt(offset + (d0 = x));
            dd = ++x;
            for (let y = 0; y < la; y++) {
                const dy = vector[y];
                vector[y] = dd = dy < d0 || dd < d0 ? dy > dd ? dd + 1 : dy + 1 : bx0 === vector[la + y] ? d0 : d0 + 1;
                d0 = dy;
            }
        }
        return dd;
    }

    return levenshtein;
});
define('skylark-browserfs/core/util',[
    '../libs/buffers',
    './api_error',
    './levenshtein',
    '../libs/path'
], function (buffers,api_error, levenshtein, path) {
    'use strict';

    const { ErrorCode, ApiError } = api_error;
    const {Buffer} = buffers;

    function deprecationMessage(print, fsName, opts) {
        if (print) {
            // tslint:disable-next-line:no-console
            console.warn(`[${fsName}] Direct file system constructor usage is deprecated for this file system, and will be removed in the next major version. Please use the '${fsName}.Create(${JSON.stringify(opts)}, callback)' method instead. See https://github.com/jvilk/BrowserFS/issues/176 for more details.`);
            // tslint:enable-next-line:no-console
        }
    }
    /**
     * Checks for any IE version, including IE11 which removed MSIE from the
     * userAgent string.
     * @hidden
     */
    const isIE = typeof navigator !== "undefined" && !!(/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) || navigator.userAgent.indexOf('Trident') !== -1);
    /**
     * Check if we're in a web worker.
     * @hidden
     */
    const isWebWorker = typeof window === "undefined";
    /**
     * Throws an exception. Called on code paths that should be impossible.
     * @hidden
     */
    function fail() {
        throw new Error("BFS has reached an impossible code path; please file a bug.");
    }
    /**
     * Synchronous recursive makedir.
     * @hidden
     */
    function mkdirpSync(p, mode, fs) {
        if (!fs.existsSync(p)) {
            mkdirpSync(path.dirname(p), mode, fs);
            fs.mkdirSync(p, mode);
        }
    }
    /**
     * Converts a buffer into an array buffer. Attempts to do so in a
     * zero-copy manner, e.g. the array references the same memory.
     * @hidden
     */
    function buffer2ArrayBuffer(buff) {
        const u8 = buffer2Uint8array(buff), u8offset = u8.byteOffset, u8Len = u8.byteLength;
        if (u8offset === 0 && u8Len === u8.buffer.byteLength) {
            return u8.buffer;
        }
        else {
            return u8.buffer.slice(u8offset, u8offset + u8Len);
        }
    }
    /**
     * Converts a buffer into a Uint8Array. Attempts to do so in a
     * zero-copy manner, e.g. the array references the same memory.
     * @hidden
     */
    function buffer2Uint8array(buff) {
        if (buff instanceof Uint8Array) {
            // BFS & Node v4.0 buffers *are* Uint8Arrays.
            return buff;
        }
        else {
            // Uint8Arrays can be constructed from arrayish numbers.
            // At this point, we assume this isn't a BFS array.
            return new Uint8Array(buff);
        }
    }
    /**
     * Converts the given arrayish object into a Buffer. Attempts to
     * be zero-copy.
     * @hidden
     */
    function arrayish2Buffer(arr) {
        if (arr instanceof Buffer) {
            return arr;
        }
        else if (arr instanceof Uint8Array) {
            return uint8Array2Buffer(arr);
        }
        else {
            return Buffer.from(arr);
        }
    }
    /**
     * Converts the given Uint8Array into a Buffer. Attempts to be zero-copy.
     * @hidden
     */
    function uint8Array2Buffer(u8) {
        if (u8 instanceof Buffer) {
            return u8;
        }
        else if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
            return arrayBuffer2Buffer(u8.buffer);
        }
        else {
            return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
        }
    }
    /**
     * Converts the given array buffer into a Buffer. Attempts to be
     * zero-copy.
     * @hidden
     */
    function arrayBuffer2Buffer(ab) {
        return Buffer.from(ab);
    }
    /**
     * Copies a slice of the given buffer
     * @hidden
     */
    function copyingSlice(buff, start = 0, end = buff.length) {
        if (start < 0 || end < 0 || end > buff.length || start > end) {
            throw new TypeError(`Invalid slice bounds on buffer of length ${buff.length}: [${start}, ${end}]`);
        }
        if (buff.length === 0) {
            // Avoid s0 corner case in ArrayBuffer case.
            return emptyBuffer();
        }
        else {
            const u8 = buffer2Uint8array(buff), s0 = buff[0], newS0 = (s0 + 1) % 0xFF;
            buff[0] = newS0;
            if (u8[0] === newS0) {
                // Same memory. Revert & copy.
                u8[0] = s0;
                return uint8Array2Buffer(u8.slice(start, end));
            }
            else {
                // Revert.
                buff[0] = s0;
                return uint8Array2Buffer(u8.subarray(start, end));
            }
        }
    }
    /**
     * @hidden
     */
    let emptyBuff = null;
    /**
     * Returns an empty buffer.
     * @hidden
     */
    function emptyBuffer() {
        if (emptyBuff) {
            return emptyBuff;
        }
        return emptyBuff = Buffer.alloc(0);
    }
    /**
     * Option validator for a Buffer file system option.
     * @hidden
     */
    function bufferValidator(v, cb) {
        if (Buffer.isBuffer(v)) {
            cb();
        }
        else {
            cb(new ApiError(ErrorCode.EINVAL, `option must be a Buffer.`));
        }
    }
    /**
     * Checks that the given options object is valid for the file system options.
     * @hidden
     */
    function checkOptions(fsType, opts, cb) {
        const optsInfo = fsType.Options;
        const fsName = fsType.Name;
        let pendingValidators = 0;
        let callbackCalled = false;
        let loopEnded = false;
        function validatorCallback(e) {
            if (!callbackCalled) {
                if (e) {
                    callbackCalled = true;
                    cb(e);
                }
                pendingValidators--;
                if (pendingValidators === 0 && loopEnded) {
                    cb();
                }
            }
        }
        // Check for required options.
        for (const optName in optsInfo) {
            if (optsInfo.hasOwnProperty(optName)) {
                const opt = optsInfo[optName];
                const providedValue = opts[optName];
                if (providedValue === undefined || providedValue === null) {
                    if (!opt.optional) {
                        // Required option, not provided.
                        // Any incorrect options provided? Which ones are close to the provided one?
                        // (edit distance 5 === close)
                        const incorrectOptions = Object.keys(opts).filter((o) => !(o in optsInfo)).map((a) => {
                            return { str: a, distance: levenshtein(optName, a) };
                        }).filter((o) => o.distance < 5).sort((a, b) => a.distance - b.distance);
                        // Validators may be synchronous.
                        if (callbackCalled) {
                            return;
                        }
                        callbackCalled = true;
                        return cb(new ApiError(ErrorCode.EINVAL, `[${fsName}] Required option '${optName}' not provided.${incorrectOptions.length > 0 ? ` You provided unrecognized option '${incorrectOptions[0].str}'; perhaps you meant to type '${optName}'.` : ''}\nOption description: ${opt.description}`));
                    }
                    // Else: Optional option, not provided. That is OK.
                }
                else {
                    // Option provided! Check type.
                    let typeMatches = false;
                    if (Array.isArray(opt.type)) {
                        typeMatches = opt.type.indexOf(typeof (providedValue)) !== -1;
                    }
                    else {
                        typeMatches = typeof (providedValue) === opt.type;
                    }
                    if (!typeMatches) {
                        // Validators may be synchronous.
                        if (callbackCalled) {
                            return;
                        }
                        callbackCalled = true;
                        return cb(new ApiError(ErrorCode.EINVAL, `[${fsName}] Value provided for option ${optName} is not the proper type. Expected ${Array.isArray(opt.type) ? `one of {${opt.type.join(", ")}}` : opt.type}, but received ${typeof (providedValue)}\nOption description: ${opt.description}`));
                    }
                    else if (opt.validator) {
                        pendingValidators++;
                        opt.validator(providedValue, validatorCallback);
                    }
                    // Otherwise: All good!
                }
            }
        }
        loopEnded = true;
        if (pendingValidators === 0 && !callbackCalled) {
            cb();
        }
    }

    return {
        deprecationMessage: deprecationMessage,
        isIE: isIE,
        isWebWorker: isWebWorker,
        fail: fail,
        mkdirpSync: mkdirpSync,
        buffer2ArrayBuffer: buffer2ArrayBuffer,
        buffer2Uint8array: buffer2Uint8array,
        arrayish2Buffer: arrayish2Buffer,
        uint8Array2Buffer: uint8Array2Buffer,
        arrayBuffer2Buffer: arrayBuffer2Buffer,
        copyingSlice: copyingSlice,
        emptyBuffer: emptyBuffer,
        bufferValidator: bufferValidator,
        checkOptions: checkOptions
    };
});
define('skylark-browserfs/generic/emscripten_fs',[
    '../core/node_fs',
    '../core/util'
], function (fs, util) {
    'use strict';
    const { uint8Array2Buffer } = util;

    class BFSEmscriptenStreamOps {
        constructor(fs) {
            this.fs = fs;
            this.nodefs = fs.getNodeFS();
            this.FS = fs.getFS();
            this.PATH = fs.getPATH();
            this.ERRNO_CODES = fs.getERRNO_CODES();
        }
        open(stream) {
            const path = this.fs.realPath(stream.node);
            const FS = this.FS;
            try {
                if (FS.isFile(stream.node.mode)) {
                    stream.nfd = this.nodefs.openSync(path, this.fs.flagsToPermissionString(stream.flags));
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        close(stream) {
            const FS = this.FS;
            try {
                if (FS.isFile(stream.node.mode) && stream.nfd) {
                    this.nodefs.closeSync(stream.nfd);
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        read(stream, buffer, offset, length, position) {
            // Avoid copying overhead by reading directly into buffer.
            try {
                return this.nodefs.readSync(stream.nfd, uint8Array2Buffer(buffer), offset, length, position);
            }
            catch (e) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        write(stream, buffer, offset, length, position) {
            // Avoid copying overhead.
            try {
                return this.nodefs.writeSync(stream.nfd, uint8Array2Buffer(buffer), offset, length, position);
            }
            catch (e) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        llseek(stream, offset, whence) {
            let position = offset;
            if (whence === 1) { // SEEK_CUR.
                position += stream.position;
            }
            else if (whence === 2) { // SEEK_END.
                if (this.FS.isFile(stream.node.mode)) {
                    try {
                        const stat = this.nodefs.fstatSync(stream.nfd);
                        position += stat.size;
                    }
                    catch (e) {
                        throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                    }
                }
            }
            if (position < 0) {
                throw new this.FS.ErrnoError(this.ERRNO_CODES.EINVAL);
            }
            stream.position = position;
            return position;
        }
    }
    class BFSEmscriptenNodeOps {
        constructor(fs) {
            this.fs = fs;
            this.nodefs = fs.getNodeFS();
            this.FS = fs.getFS();
            this.PATH = fs.getPATH();
            this.ERRNO_CODES = fs.getERRNO_CODES();
        }
        getattr(node) {
            const path = this.fs.realPath(node);
            let stat;
            try {
                stat = this.nodefs.lstatSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return {
                dev: stat.dev,
                ino: stat.ino,
                mode: stat.mode,
                nlink: stat.nlink,
                uid: stat.uid,
                gid: stat.gid,
                rdev: stat.rdev,
                size: stat.size,
                atime: stat.atime,
                mtime: stat.mtime,
                ctime: stat.ctime,
                blksize: stat.blksize,
                blocks: stat.blocks
            };
        }
        setattr(node, attr) {
            const path = this.fs.realPath(node);
            try {
                if (attr.mode !== undefined) {
                    this.nodefs.chmodSync(path, attr.mode);
                    // update the common node structure mode as well
                    node.mode = attr.mode;
                }
                if (attr.timestamp !== undefined) {
                    const date = new Date(attr.timestamp);
                    this.nodefs.utimesSync(path, date, date);
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                // Ignore not supported errors. Emscripten does utimesSync when it
                // writes files, but never really requires the value to be set.
                if (e.code !== "ENOTSUP") {
                    throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                }
            }
            if (attr.size !== undefined) {
                try {
                    this.nodefs.truncateSync(path, attr.size);
                }
                catch (e) {
                    if (!e.code) {
                        throw e;
                    }
                    throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
                }
            }
        }
        lookup(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            const mode = this.fs.getMode(path);
            return this.fs.createNode(parent, name, mode);
        }
        mknod(parent, name, mode, dev) {
            const node = this.fs.createNode(parent, name, mode, dev);
            // create the backing node for this in the fs root as well
            const path = this.fs.realPath(node);
            try {
                if (this.FS.isDir(node.mode)) {
                    this.nodefs.mkdirSync(path, node.mode);
                }
                else {
                    this.nodefs.writeFileSync(path, '', { mode: node.mode });
                }
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return node;
        }
        rename(oldNode, newDir, newName) {
            const oldPath = this.fs.realPath(oldNode);
            const newPath = this.PATH.join2(this.fs.realPath(newDir), newName);
            try {
                this.nodefs.renameSync(oldPath, newPath);
                // This logic is missing from the original NodeFS,
                // causing Emscripten's filesystem to think that the old file still exists.
                oldNode.name = newName;
                oldNode.parent = newDir;
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        unlink(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            try {
                this.nodefs.unlinkSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        rmdir(parent, name) {
            const path = this.PATH.join2(this.fs.realPath(parent), name);
            try {
                this.nodefs.rmdirSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        readdir(node) {
            const path = this.fs.realPath(node);
            try {
                // Node does not list . and .. in directory listings,
                // but Emscripten expects it.
                const contents = this.nodefs.readdirSync(path);
                contents.push('.', '..');
                return contents;
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        symlink(parent, newName, oldPath) {
            const newPath = this.PATH.join2(this.fs.realPath(parent), newName);
            try {
                this.nodefs.symlinkSync(oldPath, newPath);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
        readlink(node) {
            const path = this.fs.realPath(node);
            try {
                return this.nodefs.readlinkSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
        }
    }
    class BFSEmscriptenFS {
        constructor(_FS = self['FS'], _PATH = self['PATH'], _ERRNO_CODES = self['ERRNO_CODES'], nodefs = fs) {
            // This maps the integer permission modes from http://linux.die.net/man/3/open
            // to node.js-specific file open permission strings at http://nodejs.org/api/fs.html#fs_fs_open_path_flags_mode_callback
            this.flagsToPermissionStringMap = {
                0 /*O_RDONLY*/: 'r',
                1 /*O_WRONLY*/: 'r+',
                2 /*O_RDWR*/: 'r+',
                64 /*O_CREAT*/: 'r',
                65 /*O_WRONLY|O_CREAT*/: 'r+',
                66 /*O_RDWR|O_CREAT*/: 'r+',
                129 /*O_WRONLY|O_EXCL*/: 'rx+',
                193 /*O_WRONLY|O_CREAT|O_EXCL*/: 'rx+',
                514 /*O_RDWR|O_TRUNC*/: 'w+',
                577 /*O_WRONLY|O_CREAT|O_TRUNC*/: 'w',
                578 /*O_CREAT|O_RDWR|O_TRUNC*/: 'w+',
                705 /*O_WRONLY|O_CREAT|O_EXCL|O_TRUNC*/: 'wx',
                706 /*O_RDWR|O_CREAT|O_EXCL|O_TRUNC*/: 'wx+',
                1024 /*O_APPEND*/: 'a',
                1025 /*O_WRONLY|O_APPEND*/: 'a',
                1026 /*O_RDWR|O_APPEND*/: 'a+',
                1089 /*O_WRONLY|O_CREAT|O_APPEND*/: 'a',
                1090 /*O_RDWR|O_CREAT|O_APPEND*/: 'a+',
                1153 /*O_WRONLY|O_EXCL|O_APPEND*/: 'ax',
                1154 /*O_RDWR|O_EXCL|O_APPEND*/: 'ax+',
                1217 /*O_WRONLY|O_CREAT|O_EXCL|O_APPEND*/: 'ax',
                1218 /*O_RDWR|O_CREAT|O_EXCL|O_APPEND*/: 'ax+',
                4096 /*O_RDONLY|O_DSYNC*/: 'rs',
                4098 /*O_RDWR|O_DSYNC*/: 'rs+'
            };
            this.nodefs = nodefs;
            this.FS = _FS;
            this.PATH = _PATH;
            this.ERRNO_CODES = _ERRNO_CODES;
            this.node_ops = new BFSEmscriptenNodeOps(this);
            this.stream_ops = new BFSEmscriptenStreamOps(this);
        }
        mount(m) {
            return this.createNode(null, '/', this.getMode(m.opts.root), 0);
        }
        createNode(parent, name, mode, dev) {
            const FS = this.FS;
            if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
                throw new FS.ErrnoError(this.ERRNO_CODES.EINVAL);
            }
            const node = FS.createNode(parent, name, mode);
            node.node_ops = this.node_ops;
            node.stream_ops = this.stream_ops;
            return node;
        }
        getMode(path) {
            let stat;
            try {
                stat = this.nodefs.lstatSync(path);
            }
            catch (e) {
                if (!e.code) {
                    throw e;
                }
                throw new this.FS.ErrnoError(this.ERRNO_CODES[e.code]);
            }
            return stat.mode;
        }
        realPath(node) {
            const parts = [];
            while (node.parent !== node) {
                parts.push(node.name);
                node = node.parent;
            }
            parts.push(node.mount.opts.root);
            parts.reverse();
            return this.PATH.join.apply(null, parts);
        }
        flagsToPermissionString(flags) {
            let parsedFlags = (typeof flags === "string") ? parseInt(flags, 10) : flags;
            parsedFlags &= 0x1FFF;
            if (parsedFlags in this.flagsToPermissionStringMap) {
                return this.flagsToPermissionStringMap[parsedFlags];
            }
            else {
                return flags;
            }
        }
        getNodeFS() {
            return this.nodefs;
        }
        getFS() {
            return this.FS;
        }
        getPATH() {
            return this.PATH;
        }
        getERRNO_CODES() {
            return this.ERRNO_CODES;
        }
    }

    return BFSEmscriptenFS;
});
define('skylark-browserfs/core/file_system',[
    '../libs/buffers',
    './api_error',
    './file_flag',
    '../libs/path',
    './util'
], function (buffers,api_error, file_flag, path, util) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { FileFlag, ActionType } = file_flag;
    const { fail } = util;

    /**
     * Basic filesystem class. Most filesystems should extend this class, as it
     * provides default implementations for a handful of methods.
     */
    class BaseFileSystem {
        supportsLinks() {
            return false;
        }
        diskSpace(p, cb) {
            cb(0, 0);
        }
        /**
         * Opens the file at path p with the given flag. The file must exist.
         * @param p The path to open.
         * @param flag The flag to use when opening the file.
         */
        openFile(p, flag, cb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Create the file at path p with the given mode. Then, open it with the given
         * flag.
         */
        createFile(p, flag, mode, cb) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        open(p, flag, mode, cb) {
            const mustBeFile = (e, stats) => {
                if (e) {
                    // File does not exist.
                    switch (flag.pathNotExistsAction()) {
                        case ActionType.CREATE_FILE:
                            // Ensure parent exists.
                            return this.stat(path.dirname(p), false, (e, parentStats) => {
                                if (e) {
                                    cb(e);
                                }
                                else if (parentStats && !parentStats.isDirectory()) {
                                    cb(ApiError.ENOTDIR(path.dirname(p)));
                                }
                                else {
                                    this.createFile(p, flag, mode, cb);
                                }
                            });
                        case ActionType.THROW_EXCEPTION:
                            return cb(ApiError.ENOENT(p));
                        default:
                            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                    }
                }
                else {
                    // File exists.
                    if (stats && stats.isDirectory()) {
                        return cb(ApiError.EISDIR(p));
                    }
                    switch (flag.pathExistsAction()) {
                        case ActionType.THROW_EXCEPTION:
                            return cb(ApiError.EEXIST(p));
                        case ActionType.TRUNCATE_FILE:
                            // NOTE: In a previous implementation, we deleted the file and
                            // re-created it. However, this created a race condition if another
                            // asynchronous request was trying to read the file, as the file
                            // would not exist for a small period of time.
                            return this.openFile(p, flag, (e, fd) => {
                                if (e) {
                                    cb(e);
                                }
                                else if (fd) {
                                    fd.truncate(0, () => {
                                        fd.sync(() => {
                                            cb(null, fd);
                                        });
                                    });
                                }
                                else {
                                    fail();
                                }
                            });
                        case ActionType.NOP:
                            return this.openFile(p, flag, cb);
                        default:
                            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
                    }
                }
            };
            this.stat(p, false, mustBeFile);
        }
        rename(oldPath, newPath, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        renameSync(oldPath, newPath) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        stat(p, isLstat, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        statSync(p, isLstat) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Opens the file at path p with the given flag. The file must exist.
         * @param p The path to open.
         * @param flag The flag to use when opening the file.
         * @return A File object corresponding to the opened file.
         */
        openFileSync(p, flag, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Create the file at path p with the given mode. Then, open it with the given
         * flag.
         */
        createFileSync(p, flag, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        openSync(p, flag, mode) {
            // Check if the path exists, and is a file.
            let stats;
            try {
                stats = this.statSync(p, false);
            }
            catch (e) {
                // File does not exist.
                switch (flag.pathNotExistsAction()) {
                    case ActionType.CREATE_FILE:
                        // Ensure parent exists.
                        const parentStats = this.statSync(path.dirname(p), false);
                        if (!parentStats.isDirectory()) {
                            throw ApiError.ENOTDIR(path.dirname(p));
                        }
                        return this.createFileSync(p, flag, mode);
                    case ActionType.THROW_EXCEPTION:
                        throw ApiError.ENOENT(p);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
                }
            }
            // File exists.
            if (stats.isDirectory()) {
                throw ApiError.EISDIR(p);
            }
            switch (flag.pathExistsAction()) {
                case ActionType.THROW_EXCEPTION:
                    throw ApiError.EEXIST(p);
                case ActionType.TRUNCATE_FILE:
                    // Delete file.
                    this.unlinkSync(p);
                    // Create file. Use the same mode as the old file.
                    // Node itself modifies the ctime when this occurs, so this action
                    // will preserve that behavior if the underlying file system
                    // supports those properties.
                    return this.createFileSync(p, flag, stats.mode);
                case ActionType.NOP:
                    return this.openFileSync(p, flag, mode);
                default:
                    throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
            }
        }
        unlink(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        unlinkSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        rmdir(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        rmdirSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        mkdir(p, mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        mkdirSync(p, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        readdir(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        readdirSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        exists(p, cb) {
            this.stat(p, null, function (err) {
                cb(!err);
            });
        }
        existsSync(p) {
            try {
                this.statSync(p, true);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        realpath(p, cache, cb) {
            if (this.supportsLinks()) {
                // The path could contain symlinks. Split up the path,
                // resolve any symlinks, return the resolved string.
                const splitPath = p.split(path.sep);
                // TODO: Simpler to just pass through file, find sep and such.
                for (let i = 0; i < splitPath.length; i++) {
                    const addPaths = splitPath.slice(0, i + 1);
                    splitPath[i] = path.join.apply(null, addPaths);
                }
            }
            else {
                // No symlinks. We just need to verify that it exists.
                this.exists(p, function (doesExist) {
                    if (doesExist) {
                        cb(null, p);
                    }
                    else {
                        cb(ApiError.ENOENT(p));
                    }
                });
            }
        }
        realpathSync(p, cache) {
            if (this.supportsLinks()) {
                // The path could contain symlinks. Split up the path,
                // resolve any symlinks, return the resolved string.
                const splitPath = p.split(path.sep);
                // TODO: Simpler to just pass through file, find sep and such.
                for (let i = 0; i < splitPath.length; i++) {
                    const addPaths = splitPath.slice(0, i + 1);
                    splitPath[i] = path.join.apply(path, addPaths);
                }
                return splitPath.join(path.sep);
            }
            else {
                // No symlinks. We just need to verify that it exists.
                if (this.existsSync(p)) {
                    return p;
                }
                else {
                    throw ApiError.ENOENT(p);
                }
            }
        }
        truncate(p, len, cb) {
            this.open(p, FileFlag.getFileFlag('r+'), 0x1a4, (function (er, fd) {
                if (er) {
                    return cb(er);
                }
                fd.truncate(len, (function (er) {
                    fd.close((function (er2) {
                        cb(er || er2);
                    }));
                }));
            }));
        }
        truncateSync(p, len) {
            const fd = this.openSync(p, FileFlag.getFileFlag('r+'), 0x1a4);
            // Need to safely close FD, regardless of whether or not truncate succeeds.
            try {
                fd.truncateSync(len);
            }
            catch (e) {
                throw e;
            }
            finally {
                fd.closeSync();
            }
        }
        readFile(fname, encoding, flag, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, (err, fd) => {
                if (err) {
                    return cb(err);
                }
                cb = function (err, arg) {
                    fd.close(function (err2) {
                        if (!err) {
                            err = err2;
                        }
                        return oldCb(err, arg);
                    });
                };
                fd.stat((err, stat) => {
                    if (err) {
                        return cb(err);
                    }
                    // Allocate buffer.
                    const buf = Buffer.alloc(stat.size);
                    fd.read(buf, 0, stat.size, 0, (err) => {
                        if (err) {
                            return cb(err);
                        }
                        else if (encoding === null) {
                            return cb(err, buf);
                        }
                        try {
                            cb(null, buf.toString(encoding));
                        }
                        catch (e) {
                            cb(e);
                        }
                    });
                });
            });
        }
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const stat = fd.statSync();
                // Allocate buffer.
                const buf = Buffer.alloc(stat.size);
                fd.readSync(buf, 0, stat.size, 0);
                fd.closeSync();
                if (encoding === null) {
                    return buf;
                }
                return buf.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err) {
                    fd.close(function (err2) {
                        oldCb(err ? err : err2);
                    });
                };
                try {
                    if (typeof data === 'string') {
                        data = Buffer.from(data, encoding);
                    }
                }
                catch (e) {
                    return cb(e);
                }
                // Write into file.
                fd.write(data, 0, data.length, 0, cb);
            });
        }
        writeFileSync(fname, data, encoding, flag, mode) {
            // Get file.
            const fd = this.openSync(fname, flag, mode);
            try {
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                // Write into file.
                fd.writeSync(data, 0, data.length, 0);
            }
            finally {
                fd.closeSync();
            }
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            this.open(fname, flag, mode, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err) {
                    fd.close(function (err2) {
                        oldCb(err ? err : err2);
                    });
                };
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                fd.write(data, 0, data.length, null, cb);
            });
        }
        appendFileSync(fname, data, encoding, flag, mode) {
            const fd = this.openSync(fname, flag, mode);
            try {
                if (typeof data === 'string') {
                    data = Buffer.from(data, encoding);
                }
                fd.writeSync(data, 0, data.length, null);
            }
            finally {
                fd.closeSync();
            }
        }
        chmod(p, isLchmod, mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chmodSync(p, isLchmod, mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        chown(p, isLchown, uid, gid, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chownSync(p, isLchown, uid, gid) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        utimes(p, atime, mtime, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        utimesSync(p, atime, mtime) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        link(srcpath, dstpath, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        linkSync(srcpath, dstpath) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        symlink(srcpath, dstpath, type, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        symlinkSync(srcpath, dstpath, type) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        readlink(p, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        readlinkSync(p) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
    }
    /**
     * Implements the asynchronous API in terms of the synchronous API.
     * @class SynchronousFileSystem
     */
    class SynchronousFileSystem extends BaseFileSystem {
        supportsSynch() {
            return true;
        }
        rename(oldPath, newPath, cb) {
            try {
                this.renameSync(oldPath, newPath);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        stat(p, isLstat, cb) {
            try {
                cb(null, this.statSync(p, isLstat));
            }
            catch (e) {
                cb(e);
            }
        }
        open(p, flags, mode, cb) {
            try {
                cb(null, this.openSync(p, flags, mode));
            }
            catch (e) {
                cb(e);
            }
        }
        unlink(p, cb) {
            try {
                this.unlinkSync(p);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        rmdir(p, cb) {
            try {
                this.rmdirSync(p);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        mkdir(p, mode, cb) {
            try {
                this.mkdirSync(p, mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        readdir(p, cb) {
            try {
                cb(null, this.readdirSync(p));
            }
            catch (e) {
                cb(e);
            }
        }
        chmod(p, isLchmod, mode, cb) {
            try {
                this.chmodSync(p, isLchmod, mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        chown(p, isLchown, uid, gid, cb) {
            try {
                this.chownSync(p, isLchown, uid, gid);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        utimes(p, atime, mtime, cb) {
            try {
                this.utimesSync(p, atime, mtime);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        link(srcpath, dstpath, cb) {
            try {
                this.linkSync(srcpath, dstpath);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        symlink(srcpath, dstpath, type, cb) {
            try {
                this.symlinkSync(srcpath, dstpath, type);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        readlink(p, cb) {
            try {
                cb(null, this.readlinkSync(p));
            }
            catch (e) {
                cb(e);
            }
        }
    }


    return {
        BaseFileSystem: BaseFileSystem,
        SynchronousFileSystem: SynchronousFileSystem
    };
});
define('skylark-browserfs/core/file',['./api_error'], function (api_error) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    /**
     * Base class that contains shared implementations of functions for the file
     * object.
     */
    class BaseFile {
        sync(cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        syncSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        datasync(cb) {
            this.sync(cb);
        }
        datasyncSync() {
            return this.syncSync();
        }
        chown(uid, gid, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chownSync(uid, gid) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        chmod(mode, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        chmodSync(mode) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        utimes(atime, mtime, cb) {
            cb(new ApiError(ErrorCode.ENOTSUP));
        }
        utimesSync(atime, mtime) {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
    }
    return { BaseFile: BaseFile };
});
define('skylark-browserfs/generic/preload_file',[
    '../libs/buffers',
    '../core/file',
    '../core/node_fs_stats',
    '../core/api_error',
    '../core/node_fs',
    '../core/util'
], function (buffers,file, Stats, api_error, fs, util) {
    'use strict';

    const { BaseFile } = file;
    const { ApiError, ErrorCode } = api_error;
    const { emptyBuffer } = util;
    const { Buffer } = buffers;

    /**
     * An implementation of the File interface that operates on a file that is
     * completely in-memory. PreloadFiles are backed by a Buffer.
     *
     * This is also an abstract class, as it lacks an implementation of 'sync' and
     * 'close'. Each filesystem that wishes to use this file representation must
     * extend this class and implement those two methods.
     * @todo 'close' lever that disables functionality once closed.
     */
    class PreloadFile extends BaseFile {
        /**
         * Creates a file with the given path and, optionally, the given contents. Note
         * that, if contents is specified, it will be mutated by the file!
         * @param _fs The file system that created the file.
         * @param _path
         * @param _mode The mode that the file was opened using.
         *   Dictates permissions and where the file pointer starts.
         * @param _stat The stats object for the given file.
         *   PreloadFile will mutate this object. Note that this object must contain
         *   the appropriate mode that the file was opened as.
         * @param contents A buffer containing the entire
         *   contents of the file. PreloadFile will mutate this buffer. If not
         *   specified, we assume it is a new file.
         */
        constructor(_fs, _path, _flag, _stat, contents) {
            super();
            this._pos = 0;
            this._dirty = false;
            this._fs = _fs;
            this._path = _path;
            this._flag = _flag;
            this._stat = _stat;
            this._buffer = contents ? contents : emptyBuffer();
            // Note: This invariant is *not* maintained once the file starts getting
            // modified.
            // Note: Only actually matters if file is readable, as writeable modes may
            // truncate/append to file.
            if (this._stat.size !== this._buffer.length && this._flag.isReadable()) {
                throw new Error(`Invalid buffer: Buffer is ${this._buffer.length} long, yet Stats object specifies that file is ${this._stat.size} long.`);
            }
        }
        /**
         * NONSTANDARD: Get the underlying buffer for this file. !!DO NOT MUTATE!! Will mess up dirty tracking.
         */
        getBuffer() {
            return this._buffer;
        }
        /**
         * NONSTANDARD: Get underlying stats for this file. !!DO NOT MUTATE!!
         */
        getStats() {
            return this._stat;
        }
        getFlag() {
            return this._flag;
        }
        /**
         * Get the path to this file.
         * @return [String] The path to the file.
         */
        getPath() {
            return this._path;
        }
        /**
         * Get the current file position.
         *
         * We emulate the following bug mentioned in the Node documentation:
         * > On Linux, positional writes don't work when the file is opened in append
         *   mode. The kernel ignores the position argument and always appends the data
         *   to the end of the file.
         * @return [Number] The current file position.
         */
        getPos() {
            if (this._flag.isAppendable()) {
                return this._stat.size;
            }
            return this._pos;
        }
        /**
         * Advance the current file position by the indicated number of positions.
         * @param [Number] delta
         */
        advancePos(delta) {
            return this._pos += delta;
        }
        /**
         * Set the file position.
         * @param [Number] newPos
         */
        setPos(newPos) {
            return this._pos = newPos;
        }
        /**
         * **Core**: Asynchronous sync. Must be implemented by subclasses of this
         * class.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        sync(cb) {
            try {
                this.syncSync();
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * **Core**: Synchronous sync.
         */
        syncSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * **Core**: Asynchronous close. Must be implemented by subclasses of this
         * class.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        close(cb) {
            try {
                this.closeSync();
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * **Core**: Synchronous close.
         */
        closeSync() {
            throw new ApiError(ErrorCode.ENOTSUP);
        }
        /**
         * Asynchronous `stat`.
         * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
         */
        stat(cb) {
            try {
                cb(null, Stats.clone(this._stat));
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Synchronous `stat`.
         */
        statSync() {
            return Stats.clone(this._stat);
        }
        /**
         * Asynchronous truncate.
         * @param [Number] len
         * @param [Function(BrowserFS.ApiError)] cb
         */
        truncate(len, cb) {
            try {
                this.truncateSync(len);
                if (this._flag.isSynchronous() && !fs.getRootFS().supportsSynch()) {
                    this.sync(cb);
                }
                cb();
            }
            catch (e) {
                return cb(e);
            }
        }
        /**
         * Synchronous truncate.
         * @param [Number] len
         */
        truncateSync(len) {
            this._dirty = true;
            if (!this._flag.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
            }
            this._stat.mtimeMs = Date.now();
            if (len > this._buffer.length) {
                const buf = Buffer.alloc(len - this._buffer.length, 0);
                // Write will set @_stat.size for us.
                this.writeSync(buf, 0, buf.length, this._buffer.length);
                if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
                    this.syncSync();
                }
                return;
            }
            this._stat.size = len;
            // Truncate buffer to 'len'.
            const newBuff = Buffer.alloc(len);
            this._buffer.copy(newBuff, 0, 0, len);
            this._buffer = newBuff;
            if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
                this.syncSync();
            }
        }
        /**
         * Write buffer to the file.
         * Note that it is unsafe to use fs.write multiple times on the same file
         * without waiting for the callback.
         * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
         *  the file.
         * @param [Number] offset Offset in the buffer to start reading data from.
         * @param [Number] length The amount of bytes to write to the file.
         * @param [Number] position Offset from the beginning of the file where this
         *   data should be written. If position is null, the data will be written at
         *   the current position.
         * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
         *   cb The number specifies the number of bytes written into the file.
         */
        write(buffer, offset, length, position, cb) {
            try {
                cb(null, this.writeSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Write buffer to the file.
         * Note that it is unsafe to use fs.writeSync multiple times on the same file
         * without waiting for the callback.
         * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
         *  the file.
         * @param [Number] offset Offset in the buffer to start reading data from.
         * @param [Number] length The amount of bytes to write to the file.
         * @param [Number] position Offset from the beginning of the file where this
         *   data should be written. If position is null, the data will be written at
         *   the current position.
         * @return [Number]
         */
        writeSync(buffer, offset, length, position) {
            this._dirty = true;
            if (position === undefined || position === null) {
                position = this.getPos();
            }
            if (!this._flag.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
            }
            const endFp = position + length;
            if (endFp > this._stat.size) {
                this._stat.size = endFp;
                if (endFp > this._buffer.length) {
                    // Extend the buffer!
                    const newBuff = Buffer.alloc(endFp);
                    this._buffer.copy(newBuff);
                    this._buffer = newBuff;
                }
            }
            const len = buffer.copy(this._buffer, position, offset, offset + length);
            this._stat.mtimeMs = Date.now();
            if (this._flag.isSynchronous()) {
                this.syncSync();
                return len;
            }
            this.setPos(position + len);
            return len;
        }
        /**
         * Read data from the file.
         * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
         *   written to.
         * @param [Number] offset The offset within the buffer where writing will
         *   start.
         * @param [Number] length An integer specifying the number of bytes to read.
         * @param [Number] position An integer specifying where to begin reading from
         *   in the file. If position is null, data will be read from the current file
         *   position.
         * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
         *   number is the number of bytes read
         */
        read(buffer, offset, length, position, cb) {
            try {
                cb(null, this.readSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Read data from the file.
         * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
         *   written to.
         * @param [Number] offset The offset within the buffer where writing will
         *   start.
         * @param [Number] length An integer specifying the number of bytes to read.
         * @param [Number] position An integer specifying where to begin reading from
         *   in the file. If position is null, data will be read from the current file
         *   position.
         * @return [Number]
         */
        readSync(buffer, offset, length, position) {
            if (!this._flag.isReadable()) {
                throw new ApiError(ErrorCode.EPERM, 'File not opened with a readable mode.');
            }
            if (position === undefined || position === null) {
                position = this.getPos();
            }
            const endRead = position + length;
            if (endRead > this._stat.size) {
                length = this._stat.size - position;
            }
            const rv = this._buffer.copy(buffer, offset, position, position + length);
            this._stat.atimeMs = Date.now();
            this._pos = position + length;
            return rv;
        }
        /**
         * Asynchronous `fchmod`.
         * @param [Number|String] mode
         * @param [Function(BrowserFS.ApiError)] cb
         */
        chmod(mode, cb) {
            try {
                this.chmodSync(mode);
                cb();
            }
            catch (e) {
                cb(e);
            }
        }
        /**
         * Asynchronous `fchmod`.
         * @param [Number] mode
         */
        chmodSync(mode) {
            if (!this._fs.supportsProps()) {
                throw new ApiError(ErrorCode.ENOTSUP);
            }
            this._dirty = true;
            this._stat.chmod(mode);
            this.syncSync();
        }
        isDirty() {
            return this._dirty;
        }
        /**
         * Resets the dirty bit. Should only be called after a sync has completed successfully.
         */
        resetDirty() {
            this._dirty = false;
        }
    }
    /**
     * File class for the InMemory and XHR file systems.
     * Doesn't sync to anything, so it works nicely for memory-only files.
     */
    class NoSyncFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        /**
         * Asynchronous sync. Doesn't do anything, simply calls the cb.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        sync(cb) {
            cb();
        }
        /**
         * Synchronous sync. Doesn't do anything.
         */
        syncSync() {
            // NOP.
        }
        /**
         * Asynchronous close. Doesn't do anything, simply calls the cb.
         * @param [Function(BrowserFS.ApiError)] cb
         */
        close(cb) {
            cb();
        }
        /**
         * Synchronous close. Doesn't do anything.
         */
        closeSync() {
            // NOP.
        }
    }

    return {
        PreloadFile,
        NoSyncFile
    }
});
define('skylark-browserfs/backend/AsyncMirror',[
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../generic/preload_file',
    '../libs/path'
], function (file_system, api_error, file_flag, preload_file, path) {
    'use strict';


    const  { SynchronousFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { FileFlag } = file_flag;
    const { PreloadFile} = preload_file;

    /**
     * We define our own file to interpose on syncSync() for mirroring purposes.
     */
    class MirrorFile extends PreloadFile {
        constructor(fs, path, flag, stat, data) {
            super(fs, path, flag, stat, data);
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this);
                this.resetDirty();
            }
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * AsyncMirrorFS mirrors a synchronous filesystem into an asynchronous filesystem
     * by:
     *
     * * Performing operations over the in-memory copy, while asynchronously pipelining them
     *   to the backing store.
     * * During application loading, the contents of the async file system can be reloaded into
     *   the synchronous store, if desired.
     *
     * The two stores will be kept in sync. The most common use-case is to pair a synchronous
     * in-memory filesystem with an asynchronous backing store.
     *
     * Example: Mirroring an IndexedDB file system to an in memory file system. Now, you can use
     * IndexedDB synchronously.
     *
     * ```javascript
     * BrowserFS.configure({
     *   fs: "AsyncMirror",
     *   options: {
     *     sync: { fs: "InMemory" },
     *     async: { fs: "IndexedDB" }
     *   }
     * }, function(e) {
     *   // BrowserFS is initialized and ready-to-use!
     * });
     * ```
     *
     * Or, alternatively:
     *
     * ```javascript
     * BrowserFS.FileSystem.IndexedDB.Create(function(e, idbfs) {
     *   BrowserFS.FileSystem.InMemory.Create(function(e, inMemory) {
     *     BrowserFS.FileSystem.AsyncMirror({
     *       sync: inMemory, async: idbfs
     *     }, function(e, mirrored) {
     *       BrowserFS.initialize(mirrored);
     *     });
     *   });
     * });
     * ```
     */
    class AsyncMirror extends SynchronousFileSystem {
        /**
         * **Deprecated; use AsyncMirror.Create() method instead.**
         *
         * Mirrors the synchronous file system into the asynchronous file system.
         *
         * **IMPORTANT**: You must call `initialize` on the file system before it can be used.
         * @param sync The synchronous file system to mirror the asynchronous file system to.
         * @param async The asynchronous file system to mirror.
         */
        constructor(sync, async) {
            super();
            /**
             * Queue of pending asynchronous operations.
             */
            this._queue = [];
            this._queueRunning = false;
            this._isInitialized = false;
            this._initializeCallbacks = [];
            this._sync = sync;
            this._async = async;
        }
        /**
         * Constructs and initializes an AsyncMirror file system with the given options.
         */
        static Create(opts, cb) {
            try {
                const fs = new AsyncMirror(opts.sync, opts.async);
                fs._initialize((e) => {
                    if (e) {
                        cb(e);
                    }
                    else {
                        cb(null, fs);
                    }
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return true;
        }
        getName() {
            return AsyncMirror.Name;
        }
        _syncSync(fd) {
            this._sync.writeFileSync(fd.getPath(), fd.getBuffer(), null, FileFlag.getFileFlag('w'), fd.getStats().mode);
            this.enqueueOp({
                apiMethod: 'writeFile',
                arguments: [fd.getPath(), fd.getBuffer(), null, fd.getFlag(), fd.getStats().mode]
            });
        }
        isReadOnly() { return false; }
        supportsSynch() { return true; }
        supportsLinks() { return false; }
        supportsProps() { return this._sync.supportsProps() && this._async.supportsProps(); }
        renameSync(oldPath, newPath) {
            this._sync.renameSync(oldPath, newPath);
            this.enqueueOp({
                apiMethod: 'rename',
                arguments: [oldPath, newPath]
            });
        }
        statSync(p, isLstat) {
            return this._sync.statSync(p, isLstat);
        }
        openSync(p, flag, mode) {
            // Sanity check: Is this open/close permitted?
            const fd = this._sync.openSync(p, flag, mode);
            fd.closeSync();
            return new MirrorFile(this, p, flag, this._sync.statSync(p, false), this._sync.readFileSync(p, null, FileFlag.getFileFlag('r')));
        }
        unlinkSync(p) {
            this._sync.unlinkSync(p);
            this.enqueueOp({
                apiMethod: 'unlink',
                arguments: [p]
            });
        }
        rmdirSync(p) {
            this._sync.rmdirSync(p);
            this.enqueueOp({
                apiMethod: 'rmdir',
                arguments: [p]
            });
        }
        mkdirSync(p, mode) {
            this._sync.mkdirSync(p, mode);
            this.enqueueOp({
                apiMethod: 'mkdir',
                arguments: [p, mode]
            });
        }
        readdirSync(p) {
            return this._sync.readdirSync(p);
        }
        existsSync(p) {
            return this._sync.existsSync(p);
        }
        chmodSync(p, isLchmod, mode) {
            this._sync.chmodSync(p, isLchmod, mode);
            this.enqueueOp({
                apiMethod: 'chmod',
                arguments: [p, isLchmod, mode]
            });
        }
        chownSync(p, isLchown, uid, gid) {
            this._sync.chownSync(p, isLchown, uid, gid);
            this.enqueueOp({
                apiMethod: 'chown',
                arguments: [p, isLchown, uid, gid]
            });
        }
        utimesSync(p, atime, mtime) {
            this._sync.utimesSync(p, atime, mtime);
            this.enqueueOp({
                apiMethod: 'utimes',
                arguments: [p, atime, mtime]
            });
        }
        /**
         * Called once to load up files from async storage into sync storage.
         */
        _initialize(userCb) {
            const callbacks = this._initializeCallbacks;
            const end = (e) => {
                this._isInitialized = !e;
                this._initializeCallbacks = [];
                callbacks.forEach((cb) => cb(e));
            };
            if (!this._isInitialized) {
                // First call triggers initialization, the rest wait.
                if (callbacks.push(userCb) === 1) {
                    const copyDirectory = (p, mode, cb) => {
                        if (p !== '/') {
                            this._sync.mkdirSync(p, mode);
                        }
                        this._async.readdir(p, (err, files) => {
                            let i = 0;
                            // NOTE: This function must not be in a lexically nested statement,
                            // such as an if or while statement. Safari refuses to run the
                            // script since it is undefined behavior.
                            function copyNextFile(err) {
                                if (err) {
                                    cb(err);
                                }
                                else if (i < files.length) {
                                    copyItem(path.join(p, files[i]), copyNextFile);
                                    i++;
                                }
                                else {
                                    cb();
                                }
                            }
                            if (err) {
                                cb(err);
                            }
                            else {
                                copyNextFile();
                            }
                        });
                    }, copyFile = (p, mode, cb) => {
                        this._async.readFile(p, null, FileFlag.getFileFlag('r'), (err, data) => {
                            if (err) {
                                cb(err);
                            }
                            else {
                                try {
                                    this._sync.writeFileSync(p, data, null, FileFlag.getFileFlag('w'), mode);
                                }
                                catch (e) {
                                    err = e;
                                }
                                finally {
                                    cb(err);
                                }
                            }
                        });
                    }, copyItem = (p, cb) => {
                        this._async.stat(p, false, (err, stats) => {
                            if (err) {
                                cb(err);
                            }
                            else if (stats.isDirectory()) {
                                copyDirectory(p, stats.mode, cb);
                            }
                            else {
                                copyFile(p, stats.mode, cb);
                            }
                        });
                    };
                    copyDirectory('/', 0, end);
                }
            }
            else {
                userCb();
            }
        }
        enqueueOp(op) {
            this._queue.push(op);
            if (!this._queueRunning) {
                this._queueRunning = true;
                const doNextOp = (err) => {
                    if (err) {
                        throw new Error(`WARNING: File system has desynchronized. Received following error: ${err}\n$`);
                    }
                    if (this._queue.length > 0) {
                        const op = this._queue.shift(), args = op.arguments;
                        args.push(doNextOp);
                        this._async[op.apiMethod].apply(this._async, args);
                    }
                    else {
                        this._queueRunning = false;
                    }
                };
                doNextOp();
            }
        }
    }
    AsyncMirror.Name = "AsyncMirror";
    AsyncMirror.Options = {
        sync: {
            type: "object",
            description: "The synchronous file system to mirror the asynchronous file system to.",
            validator: (v, cb) => {
                if (v && typeof (v['supportsSynch']) === "function" && v.supportsSynch()) {
                    cb();
                }
                else {
                    cb(new ApiError(ErrorCode.EINVAL, `'sync' option must be a file system that supports synchronous operations`));
                }
            }
        },
        async: {
            type: "object",
            description: "The asynchronous file system to mirror."
        }
    };

    return AsyncMirror;
});
define('skylark-browserfs/backend/Dropbox',[
    '../libs/buffers',
    '../generic/preload_file',
    '../core/file_system',
    '../core/node_fs_stats',
    '../core/api_error',
    '../core/util',
///    'dropbox_bridge',
    '../generic/setImmediate',
    '../libs/path'
], function (buffers,preload_file, file_system, node_fs_stats, api_error, util,  setImmediate, path) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { Stats, FileType } = node_fs_stats;
    const { ApiError, ErrorCode } = api_error;
    const { arrayBuffer2Buffer, buffer2ArrayBuffer } =  util;
///    const { Dropbox } =  dropbox_bridge;
    const { dirname } =  path;

    const { PreloadFile} = preload_file;

    const {Buffer} = buffers;


    /**
     * Dropbox paths do not begin with a /, they just begin with a folder at the root node.
     * Here, we strip the `/`.
     * @param p An absolute path
     */
    function FixPath(p) {
        if (p === '/') {
            return '';
        }
        else {
            return p;
        }
    }
    /**
     * HACK: Dropbox errors are FUBAR'd sometimes.
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
     * @param e
     */
    function ExtractTheFuckingError(e) {
        const obj = e.error;
        if (obj['.tag']) {
            // Everything is OK.
            return obj;
        }
        else if (obj['error']) {
            // Terrible nested object bug.
            const obj2 = obj.error;
            if (obj2['.tag']) {
                return obj2;
            }
            else if (obj2['reason'] && obj2['reason']['.tag']) {
                return obj2.reason;
            }
            else {
                return obj2;
            }
        }
        else if (typeof (obj) === 'string') {
            // Might be a fucking JSON object error.
            try {
                const obj2 = JSON.parse(obj);
                if (obj2['error'] && obj2['error']['reason'] && obj2['error']['reason']['.tag']) {
                    return obj2.error.reason;
                }
            }
            catch (e) {
                // Nope. Give up.
            }
        }
        return obj;
    }
    /**
     * Returns a user-facing error message given an error.
     *
     * HACK: Dropbox error messages sometimes lack a `user_message` field.
     * Sometimes, they are even strings. Ugh.
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/146
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/145
     * @url https://github.com/dropbox/dropbox-sdk-js/issues/144
     * @param err An error.
     */
    function GetErrorMessage(err) {
        if (err['user_message']) {
            return err.user_message.text;
        }
        else if (err['error_summary']) {
            return err.error_summary;
        }
        else if (typeof (err.error) === "string") {
            return err.error;
        }
        else if (typeof (err.error) === "object") {
            // DROPBOX BUG: Sometimes, error is a nested error.
            return GetErrorMessage(err.error);
        }
        else {
            throw new Error(`Dropbox's servers gave us a garbage error message: ${JSON.stringify(err)}`);
        }
    }
    function LookupErrorToError(err, p, msg) {
        switch (err['.tag']) {
            case 'malformed_path':
                return new ApiError(ErrorCode.EBADF, msg, p);
            case 'not_found':
                return ApiError.ENOENT(p);
            case 'not_file':
                return ApiError.EISDIR(p);
            case 'not_folder':
                return ApiError.ENOTDIR(p);
            case 'restricted_content':
                return ApiError.EPERM(p);
            case 'other':
            default:
                return new ApiError(ErrorCode.EIO, msg, p);
        }
    }
    function WriteErrorToError(err, p, msg) {
        switch (err['.tag']) {
            case 'malformed_path':
            case 'disallowed_name':
                return new ApiError(ErrorCode.EBADF, msg, p);
            case 'conflict':
            case 'no_write_permission':
            case 'team_folder':
                return ApiError.EPERM(p);
            case 'insufficient_space':
                return new ApiError(ErrorCode.ENOSPC, msg);
            case 'other':
            default:
                return new ApiError(ErrorCode.EIO, msg, p);
        }
    }
    function FilesDeleteWrapped(client, p, cb) {
        const arg = {
            path: FixPath(p)
        };
        client.filesDeleteV2(arg)
            .then(() => {
            cb();
        }).catch((e) => {
            const err = ExtractTheFuckingError(e);
            switch (err['.tag']) {
                case 'path_lookup':
                    cb(LookupErrorToError(err.path_lookup, p, GetErrorMessage(e)));
                    break;
                case 'path_write':
                    cb(WriteErrorToError(err.path_write, p, GetErrorMessage(e)));
                    break;
                case 'too_many_write_operations':
                    setTimeout(() => FilesDeleteWrapped(client, p, cb), 500 + (300 * (Math.random())));
                    break;
                case 'other':
                default:
                    cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                    break;
            }
        });
    }
    class DropboxFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        sync(cb) {
            this._fs._syncFile(this.getPath(), this.getBuffer(), cb);
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * A read/write file system backed by Dropbox cloud storage.
     *
     * Uses the Dropbox V2 API, and the 2.x JS SDK.
     */
    class DropboxFileSystem extends BaseFileSystem {
        constructor(client) {
            super();
            this._client = client;
        }
        /**
         * Creates a new DropboxFileSystem instance with the given options.
         * Must be given an *authenticated* Dropbox client from 2.x JS SDK.
         */
        static Create(opts, cb) {
            cb(null, new DropboxFileSystem(opts.client));
        }
        static isAvailable() {
            // Checks if the Dropbox library is loaded.
            return typeof Dropbox !== 'undefined';
        }
        getName() {
            return DropboxFileSystem.Name;
        }
        isReadOnly() {
            return false;
        }
        // Dropbox doesn't support symlinks, properties, or synchronous calls
        // TODO: does it???
        supportsSymlinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return false;
        }
        /**
         * Deletes *everything* in the file system. Mainly intended for unit testing!
         * @param mainCb Called when operation completes.
         */
        empty(mainCb) {
            this.readdir('/', (e, paths) => {
                if (paths) {
                    const next = (e) => {
                        if (paths.length === 0) {
                            mainCb();
                        }
                        else {
                            FilesDeleteWrapped(this._client, paths.shift(), next);
                        }
                    };
                    next();
                }
                else {
                    mainCb(e);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            // Dropbox doesn't let you rename things over existing things, but POSIX does.
            // So, we need to see if newPath exists...
            this.stat(newPath, false, (e, stats) => {
                const rename = () => {
                    const relocationArg = {
                        from_path: FixPath(oldPath),
                        to_path: FixPath(newPath)
                    };
                    this._client.filesMoveV2(relocationArg)
                        .then(() => cb())
                        .catch(function (e) {
                        const err = ExtractTheFuckingError(e);
                        switch (err['.tag']) {
                            case 'from_lookup':
                                cb(LookupErrorToError(err.from_lookup, oldPath, GetErrorMessage(e)));
                                break;
                            case 'from_write':
                                cb(WriteErrorToError(err.from_write, oldPath, GetErrorMessage(e)));
                                break;
                            case 'to':
                                cb(WriteErrorToError(err.to, newPath, GetErrorMessage(e)));
                                break;
                            case 'cant_copy_shared_folder':
                            case 'cant_nest_shared_folder':
                                cb(new ApiError(ErrorCode.EPERM, GetErrorMessage(e), oldPath));
                                break;
                            case 'cant_move_folder_into_itself':
                            case 'duplicated_or_nested_paths':
                                cb(new ApiError(ErrorCode.EBADF, GetErrorMessage(e), oldPath));
                                break;
                            case 'too_many_files':
                                cb(new ApiError(ErrorCode.ENOSPC, GetErrorMessage(e), oldPath));
                                break;
                            case 'other':
                            default:
                                cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), oldPath));
                                break;
                        }
                    });
                };
                if (e) {
                    // Doesn't exist. Proceed!
                    rename();
                }
                else if (oldPath === newPath) {
                    // NOP if the path exists. Error if it doesn't exist.
                    if (e) {
                        cb(ApiError.ENOENT(newPath));
                    }
                    else {
                        cb();
                    }
                }
                else if (stats && stats.isDirectory()) {
                    // Exists, is a directory. Cannot rename over an existing directory.
                    cb(ApiError.EISDIR(newPath));
                }
                else {
                    // Exists, is a file, and differs from oldPath. Delete and rename.
                    this.unlink(newPath, (e) => {
                        if (e) {
                            cb(e);
                        }
                        else {
                            rename();
                        }
                    });
                }
            });
        }
        stat(path, isLstat, cb) {
            if (path === '/') {
                // Dropbox doesn't support querying the root directory.
                setImmediate(function () {
                    cb(null, new Stats(FileType.DIRECTORY, 4096));
                });
                return;
            }
            const arg = {
                path: FixPath(path)
            };
            this._client.filesGetMetadata(arg).then((ref) => {
                switch (ref['.tag']) {
                    case 'file':
                        const fileMetadata = ref;
                        // TODO: Parse time fields.
                        cb(null, new Stats(FileType.FILE, fileMetadata.size));
                        break;
                    case 'folder':
                        cb(null, new Stats(FileType.DIRECTORY, 4096));
                        break;
                    case 'deleted':
                        cb(ApiError.ENOENT(path));
                        break;
                    default:
                        // Unknown.
                        break;
                }
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        cb(LookupErrorToError(err.path, path, GetErrorMessage(e)));
                        break;
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                        break;
                }
            });
        }
        openFile(path, flags, cb) {
            const downloadArg = {
                path: FixPath(path)
            };
            this._client.filesDownload(downloadArg).then((res) => {
                const b = res.fileBlob;
                const fr = new FileReader();
                fr.onload = () => {
                    const ab = fr.result;
                    cb(null, new DropboxFile(this, path, flags, new Stats(FileType.FILE, ab.byteLength), arrayBuffer2Buffer(ab)));
                };
                fr.readAsArrayBuffer(b);
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        const dpError = err;
                        cb(LookupErrorToError(dpError.path, path, GetErrorMessage(e)));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                        break;
                }
            });
        }
        createFile(p, flags, mode, cb) {
            const fileData = Buffer.alloc(0);
            const blob = new Blob([buffer2ArrayBuffer(fileData)], { type: "octet/stream" });
            const commitInfo = {
                contents: blob,
                path: FixPath(p)
            };
            this._client.filesUpload(commitInfo).then((metadata) => {
                cb(null, new DropboxFile(this, p, flags, new Stats(FileType.FILE, 0), fileData));
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                // HACK: Casting to 'any' since tag can be 'too_many_write_operations'.
                switch (err['.tag']) {
                    case 'path':
                        const upError = err;
                        cb(WriteErrorToError(upError.path.reason, p, GetErrorMessage(e)));
                        break;
                    case 'too_many_write_operations':
                        // Retry in (500, 800) ms.
                        setTimeout(() => this.createFile(p, flags, mode, cb), 500 + (300 * (Math.random())));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                        break;
                }
            });
        }
        /**
         * Delete a file
         */
        unlink(path, cb) {
            // Must be a file. Check first.
            this.stat(path, false, (e, stat) => {
                if (stat) {
                    if (stat.isDirectory()) {
                        cb(ApiError.EISDIR(path));
                    }
                    else {
                        FilesDeleteWrapped(this._client, path, cb);
                    }
                }
                else {
                    cb(e);
                }
            });
        }
        /**
         * Delete a directory
         */
        rmdir(path, cb) {
            this.readdir(path, (e, paths) => {
                if (paths) {
                    if (paths.length > 0) {
                        cb(ApiError.ENOTEMPTY(path));
                    }
                    else {
                        FilesDeleteWrapped(this._client, path, cb);
                    }
                }
                else {
                    cb(e);
                }
            });
        }
        /**
         * Create a directory
         */
        mkdir(p, mode, cb) {
            // Dropbox's create_folder is recursive. Check if parent exists.
            const parent = dirname(p);
            this.stat(parent, false, (e, stats) => {
                if (e) {
                    cb(e);
                }
                else if (stats && !stats.isDirectory()) {
                    cb(ApiError.ENOTDIR(parent));
                }
                else {
                    const arg = {
                        path: FixPath(p)
                    };
                    this._client.filesCreateFolderV2(arg).then(() => cb()).catch((e) => {
                        const err = ExtractTheFuckingError(e);
                        if (err['.tag'] === "too_many_write_operations") {
                            // Retry in a bit.
                            setTimeout(() => this.mkdir(p, mode, cb), 500 + (300 * (Math.random())));
                        }
                        else {
                            cb(WriteErrorToError(ExtractTheFuckingError(e).path, p, GetErrorMessage(e)));
                        }
                    });
                }
            });
        }
        /**
         * Get the names of the files in a directory
         */
        readdir(path, cb) {
            const arg = {
                path: FixPath(path)
            };
            this._client.filesListFolder(arg).then((res) => {
                ContinueReadingDir(this._client, path, res, [], cb);
            }).catch((e) => {
                ProcessListFolderError(e, path, cb);
            });
        }
        /**
         * (Internal) Syncs file to Dropbox.
         */
        _syncFile(p, d, cb) {
            const blob = new Blob([buffer2ArrayBuffer(d)], { type: "octet/stream" });
            const arg = {
                contents: blob,
                path: FixPath(p),
                mode: {
                    '.tag': 'overwrite'
                }
            };
            this._client.filesUpload(arg).then(() => {
                cb();
            }).catch((e) => {
                const err = ExtractTheFuckingError(e);
                switch (err['.tag']) {
                    case 'path':
                        const upError = err;
                        cb(WriteErrorToError(upError.path.reason, p, GetErrorMessage(e)));
                        break;
                    case 'too_many_write_operations':
                        setTimeout(() => this._syncFile(p, d, cb), 500 + (300 * (Math.random())));
                        break;
                    case 'other':
                    default:
                        cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), p));
                        break;
                }
            });
        }
    }
    DropboxFileSystem.Name = "DropboxV2";
    DropboxFileSystem.Options = {
        client: {
            type: "object",
            description: "An *authenticated* Dropbox client. Must be from the 2.5.x JS SDK."
        }
    };
    function ProcessListFolderError(e, path, cb) {
        const err = ExtractTheFuckingError(e);
        switch (err['.tag']) {
            case 'path':
                const pathError = err;
                cb(LookupErrorToError(pathError.path, path, GetErrorMessage(e)));
                break;
            case 'other':
            default:
                cb(new ApiError(ErrorCode.EIO, GetErrorMessage(e), path));
                break;
        }
    }
    function ContinueReadingDir(client, path, res, previousEntries, cb) {
        const newEntries = res.entries.map((e) => e.path_display).filter((p) => !!p);
        const entries = previousEntries.concat(newEntries);
        if (!res.has_more) {
            cb(null, entries);
        }
        else {
            const arg = {
                cursor: res.cursor
            };
            client.filesListFolderContinue(arg).then((res) => {
                ContinueReadingDir(client, path, res, entries, cb);
            }).catch((e) => {
                ProcessListFolderError(e, path, cb);
            });
        }
    }

    DropboxFileSystem.DropboxFile = DropboxFile;

    return  DropboxFileSystem;
    
});
define('skylark-browserfs/backend/Emscripten',[
    '../libs/buffers',
    '../core/file_system',
    '../core/node_fs_stats',
    '../core/file',
    '../core/util',
    '../core/api_error'
], function (buffers,file_system, node_fs_stats, file, util, api_error) {
    'use strict';

    const { SynchronousFileSystem } = file_system;
    const { Stats, FileType } = node_fs_stats;
    const { BaseFile } = file;
    const { uint8Array2Buffer, buffer2Uint8array } = util;
    const { ApiError, ErrorCode, ErrorStrings } = api_error;
    const { Buffer } = buffers;

    /**
     * @hidden
     */
    function convertError(e, path = '') {
        const errno = e.errno;
        let parent = e.node;
        const paths = [];
        while (parent) {
            paths.unshift(parent.name);
            if (parent === parent.parent) {
                break;
            }
            parent = parent.parent;
        }
        return new ApiError(errno, ErrorStrings[errno], paths.length > 0 ? '/' + paths.join('/') : path);
    }
    class EmscriptenFile extends BaseFile {
        constructor(_fs, _FS, _path, _stream) {
            super();
            this._fs = _fs;
            this._FS = _FS;
            this._path = _path;
            this._stream = _stream;
        }
        getPos() {
            return undefined;
        }
        close(cb) {
            let err = null;
            try {
                this.closeSync();
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        closeSync() {
            try {
                this._FS.close(this._stream);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        stat(cb) {
            try {
                cb(null, this.statSync());
            }
            catch (e) {
                cb(e);
            }
        }
        statSync() {
            try {
                return this._fs.statSync(this._path, false);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        truncate(len, cb) {
            let err = null;
            try {
                this.truncateSync(len);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        truncateSync(len) {
            try {
                this._FS.ftruncate(this._stream.fd, len);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        write(buffer, offset, length, position, cb) {
            try {
                cb(null, this.writeSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        writeSync(buffer, offset, length, position) {
            try {
                const u8 = buffer2Uint8array(buffer);
                // Emscripten is particular about what position is set to.
                const emPosition = position === null ? undefined : position;
                return this._FS.write(this._stream, u8, offset, length, emPosition);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        read(buffer, offset, length, position, cb) {
            try {
                cb(null, this.readSync(buffer, offset, length, position), buffer);
            }
            catch (e) {
                cb(e);
            }
        }
        readSync(buffer, offset, length, position) {
            try {
                const u8 = buffer2Uint8array(buffer);
                // Emscripten is particular about what position is set to.
                const emPosition = position === null ? undefined : position;
                return this._FS.read(this._stream, u8, offset, length, emPosition);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        sync(cb) {
            // NOP.
            cb();
        }
        syncSync() {
            // NOP.
        }
        chown(uid, gid, cb) {
            let err = null;
            try {
                this.chownSync(uid, gid);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        chownSync(uid, gid) {
            try {
                this._FS.fchown(this._stream.fd, uid, gid);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        chmod(mode, cb) {
            let err = null;
            try {
                this.chmodSync(mode);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        chmodSync(mode) {
            try {
                this._FS.fchmod(this._stream.fd, mode);
            }
            catch (e) {
                throw convertError(e, this._path);
            }
        }
        utimes(atime, mtime, cb) {
            let err = null;
            try {
                this.utimesSync(atime, mtime);
            }
            catch (e) {
                err = e;
            }
            finally {
                cb(err);
            }
        }
        utimesSync(atime, mtime) {
            this._fs.utimesSync(this._path, atime, mtime);
        }
    }
    /**
     * Mounts an Emscripten file system into the BrowserFS file system.
     */
    class EmscriptenFileSystem extends SynchronousFileSystem {
        constructor(_FS) {
            super();
            this._FS = _FS;
        }
        /**
         * Create an EmscriptenFileSystem instance with the given options.
         */
        static Create(opts, cb) {
            cb(null, new EmscriptenFileSystem(opts.FS));
        }
        static isAvailable() { return true; }
        getName() { return this._FS.DB_NAME(); }
        isReadOnly() { return false; }
        supportsLinks() { return true; }
        supportsProps() { return true; }
        supportsSynch() { return true; }
        renameSync(oldPath, newPath) {
            try {
                this._FS.rename(oldPath, newPath);
            }
            catch (e) {
                if (e.errno === ErrorCode.ENOENT) {
                    throw convertError(e, this.existsSync(oldPath) ? newPath : oldPath);
                }
                else {
                    throw convertError(e);
                }
            }
        }
        statSync(p, isLstat) {
            try {
                const stats = isLstat ? this._FS.lstat(p) : this._FS.stat(p);
                const itemType = this.modeToFileType(stats.mode);
                return new Stats(itemType, stats.size, stats.mode, stats.atime.getTime(), stats.mtime.getTime(), stats.ctime.getTime());
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        openSync(p, flag, mode) {
            try {
                const stream = this._FS.open(p, flag.getFlagString(), mode);
                if (this._FS.isDir(stream.node.mode)) {
                    this._FS.close(stream);
                    throw ApiError.EISDIR(p);
                }
                return new EmscriptenFile(this, this._FS, p, stream);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        unlinkSync(p) {
            try {
                this._FS.unlink(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        rmdirSync(p) {
            try {
                this._FS.rmdir(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        mkdirSync(p, mode) {
            try {
                this._FS.mkdir(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        readdirSync(p) {
            try {
                // Emscripten returns items for '.' and '..'. Node does not.
                return this._FS.readdir(p).filter((p) => p !== '.' && p !== '..');
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        truncateSync(p, len) {
            try {
                this._FS.truncate(p, len);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        readFileSync(p, encoding, flag) {
            try {
                const data = this._FS.readFile(p, { flags: flag.getFlagString() });
                const buff = uint8Array2Buffer(data);
                if (encoding) {
                    return buff.toString(encoding);
                }
                else {
                    return buff;
                }
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        writeFileSync(p, data, encoding, flag, mode) {
            try {
                if (encoding) {
                    data = Buffer.from(data, encoding);
                }
                const u8 = buffer2Uint8array(data);
                this._FS.writeFile(p, u8, { flags: flag.getFlagString(), encoding: 'binary' });
                this._FS.chmod(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        chmodSync(p, isLchmod, mode) {
            try {
                isLchmod ? this._FS.lchmod(p, mode) : this._FS.chmod(p, mode);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        chownSync(p, isLchown, uid, gid) {
            try {
                isLchown ? this._FS.lchown(p, uid, gid) : this._FS.chown(p, uid, gid);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        symlinkSync(srcpath, dstpath, type) {
            try {
                this._FS.symlink(srcpath, dstpath);
            }
            catch (e) {
                throw convertError(e);
            }
        }
        readlinkSync(p) {
            try {
                return this._FS.readlink(p);
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        utimesSync(p, atime, mtime) {
            try {
                this._FS.utime(p, atime.getTime(), mtime.getTime());
            }
            catch (e) {
                throw convertError(e, p);
            }
        }
        modeToFileType(mode) {
            if (this._FS.isDir(mode)) {
                return FileType.DIRECTORY;
            }
            else if (this._FS.isFile(mode)) {
                return FileType.FILE;
            }
            else if (this._FS.isLink(mode)) {
                return FileType.SYMLINK;
            }
            else {
                throw ApiError.EPERM(`Invalid mode: ${mode}`);
            }
        }
    }
    EmscriptenFileSystem.Name = "EmscriptenFileSystem";
    EmscriptenFileSystem.Options = {
        FS: {
            type: "object",
            description: "The Emscripten file system to use (the `FS` variable)"
        }
    };

    EmscriptenFileSystem.EmscriptenFile = EmscriptenFile;

    return EmscriptenFileSystem;
});
define('skylark-browserfs/backend/FolderAdapter',[
    '../core/file_system',
    '../libs/path',
    '../core/api_error'
], function (file_system, path, api_error) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError } = api_error;

    /**
     * The FolderAdapter file system wraps a file system, and scopes all interactions to a subfolder of that file system.
     *
     * Example: Given a file system `foo` with folder `bar` and file `bar/baz`...
     *
     * ```javascript
     * BrowserFS.configure({
     *   fs: "FolderAdapter",
     *   options: {
     *     folder: "bar",
     *     wrapped: foo
     *   }
     * }, function(e) {
     *   var fs = BrowserFS.BFSRequire('fs');
     *   fs.readdirSync('/'); // ['baz']
     * });
     * ```
     */
    class FolderAdapter extends BaseFileSystem {
        constructor(folder, wrapped) {
            super();
            this._folder = folder;
            this._wrapped = wrapped;
        }
        /**
         * Creates a FolderAdapter instance with the given options.
         */
        static Create(opts, cb) {
            const fa = new FolderAdapter(opts.folder, opts.wrapped);
            fa._initialize(function (e) {
                if (e) {
                    cb(e);
                }
                else {
                    cb(null, fa);
                }
            });
        }
        static isAvailable() {
            return true;
        }
        getName() { return this._wrapped.getName(); }
        isReadOnly() { return this._wrapped.isReadOnly(); }
        supportsProps() { return this._wrapped.supportsProps(); }
        supportsSynch() { return this._wrapped.supportsSynch(); }
        supportsLinks() { return false; }
        /**
         * Initialize the file system. Ensures that the wrapped file system
         * has the given folder.
         */
        _initialize(cb) {
            this._wrapped.exists(this._folder, (exists) => {
                if (exists) {
                    cb();
                }
                else if (this._wrapped.isReadOnly()) {
                    cb(ApiError.ENOENT(this._folder));
                }
                else {
                    this._wrapped.mkdir(this._folder, 0x1ff, cb);
                }
            });
        }
    }
    FolderAdapter.Name = "FolderAdapter";
    FolderAdapter.Options = {
        folder: {
            type: "string",
            description: "The folder to use as the root directory"
        },
        wrapped: {
            type: "object",
            description: "The file system to wrap"
        }
    };
    /**
     * @hidden
     */
    function translateError(folder, e) {
        if (e !== null && typeof e === 'object') {
            const err = e;
            let p = err.path;
            if (p) {
                p = '/' + path.relative(folder, p);
                err.message = err.message.replace(err.path, p);
                err.path = p;
            }
        }
        return e;
    }
    /**
     * @hidden
     */
    function wrapCallback(folder, cb) {
        if (typeof cb === 'function') {
            return function (err) {
                if (arguments.length > 0) {
                    arguments[0] = translateError(folder, err);
                }
                cb.apply(null, arguments);
            };
        }
        else {
            return cb;
        }
    }
    /**
     * @hidden
     */
    function wrapFunction(name, wrapFirst, wrapSecond) {
        if (name.slice(name.length - 4) !== 'Sync') {
            // Async function. Translate error in callback.
            return function () {
                if (arguments.length > 0) {
                    if (wrapFirst) {
                        arguments[0] = path.join(this._folder, arguments[0]);
                    }
                    if (wrapSecond) {
                        arguments[1] = path.join(this._folder, arguments[1]);
                    }
                    arguments[arguments.length - 1] = wrapCallback(this._folder, arguments[arguments.length - 1]);
                }
                return this._wrapped[name].apply(this._wrapped, arguments);
            };
        }
        else {
            // Sync function. Translate error in catch.
            return function () {
                try {
                    if (wrapFirst) {
                        arguments[0] = path.join(this._folder, arguments[0]);
                    }
                    if (wrapSecond) {
                        arguments[1] = path.join(this._folder, arguments[1]);
                    }
                    return this._wrapped[name].apply(this._wrapped, arguments);
                }
                catch (e) {
                    throw translateError(this._folder, e);
                }
            };
        }
    }
    // First argument is a path.
    ['diskSpace', 'stat', 'statSync', 'open', 'openSync', 'unlink', 'unlinkSync',
        'rmdir', 'rmdirSync', 'mkdir', 'mkdirSync', 'readdir', 'readdirSync', 'exists',
        'existsSync', 'realpath', 'realpathSync', 'truncate', 'truncateSync', 'readFile',
        'readFileSync', 'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync',
        'chmod', 'chmodSync', 'chown', 'chownSync', 'utimes', 'utimesSync', 'readlink',
        'readlinkSync'].forEach((name) => {
        FolderAdapter.prototype[name] = wrapFunction(name, true, false);
    });
    // First and second arguments are paths.
    ['rename', 'renameSync', 'link', 'linkSync', 'symlink', 'symlinkSync'].forEach((name) => {
        FolderAdapter.prototype[name] = wrapFunction(name, true, true);
    });

    return FolderAdapter;
});
define('skylark-langx-async/async',[
    "skylark-langx-ns"
],function(skylark){
	return skylark.attach("langx.async");	
});
define('skylark-langx-async/deferred',[
    "skylark-langx-arrays",
	"skylark-langx-funcs",
    "skylark-langx-objects",
    "./async"
],function(arrays,funcs,objects,async){
    "use strict";

    var slice = Array.prototype.slice,
        proxy = funcs.proxy,
        makeArray = arrays.makeArray,
        result = objects.result,
        mixin = objects.mixin;

    mixin(Promise.prototype,{
        always: function(handler) {
            //this.done(handler);
            //this.fail(handler);
            this.then(handler,handler);
            return this;
        },
        done : function() {
            for (var i = 0;i<arguments.length;i++) {
                this.then(arguments[i]);
            }
            return this;
        },
        fail : function(handler) { 
            //return mixin(Promise.prototype.catch.call(this,handler),added);
            //return this.then(null,handler);
            this.catch(handler);
            return this;
         }
    });


    var Deferred = function() {
        var self = this,
            p = this.promise = makePromise2(new Promise(function(resolve, reject) {
                self._resolve = resolve;
                self._reject = reject;
            }));

        //wrapPromise(p,self);

        //this[PGLISTENERS] = [];
        //this[PGNOTIFIES] = [];

        //this.resolve = Deferred.prototype.resolve.bind(this);
        //this.reject = Deferred.prototype.reject.bind(this);
        //this.progress = Deferred.prototype.progress.bind(this);

    };

   
    function makePromise2(promise) {
        // Don't modify any promise that has been already modified.
        if (promise.isResolved) return promise;

        // Set initial state
        var isPending = true;
        var isRejected = false;
        var isResolved = false;

        // Observe the promise, saving the fulfillment in a closure scope.
        var result = promise.then(
            function(v) {
                isResolved = true;
                isPending = false;
                return v; 
            }, 
            function(e) {
                isRejected = true;
                isPending = false;
                throw e; 
            }
        );

        result.isResolved = function() { return isResolved; };
        result.isPending = function() { return isPending; };
        result.isRejected = function() { return isRejected; };

        result.state = function() {
            if (isResolved) {
                return 'resolved';
            }
            if (isRejected) {
                return 'rejected';
            }
            return 'pending';
        };

        var notified = [],
            listeners = [];

          
        result.then = function(onResolved,onRejected,onProgress) {
            if (onProgress) {
                this.progress(onProgress);
            }
            return makePromise2(Promise.prototype.then.call(this,
                onResolved && function(args) {
                    if (args && args.__ctx__ !== undefined) {
                        return onResolved.apply(args.__ctx__,args);
                    } else {
                        return onResolved(args);
                    }
                },
                onRejected && function(args){
                    if (args && args.__ctx__ !== undefined) {
                        return onRejected.apply(args.__ctx__,args);
                    } else {
                        return onRejected(args);
                    }
                }
            ));
        };

        result.progress = function(handler) {
            notified.forEach(function (value) {
                handler(value);
            });
            listeners.push(handler);
            return this;
        };

        result.pipe = result.then;

        result.notify = function(value) {
            try {
                notified.push(value);

                return listeners.forEach(function (listener) {
                    return listener(value);
                });
            } catch (error) {
            this.reject(error);
            }
            return this;
        };

        return result;
    }

 
    Deferred.prototype.resolve = function(value) {
        var args = slice.call(arguments);
        return this.resolveWith(null,args);
    };

    Deferred.prototype.resolveWith = function(context,args) {
        args = args ? makeArray(args) : []; 
        args.__ctx__ = context;
        this._resolve(args);
        this._resolved = true;
        return this;
    };

    Deferred.prototype.notify = function(value) {
        var p = result(this,"promise");
        p.notify(value);
        return this;
    };

    Deferred.prototype.reject = function(reason) {
        var args = slice.call(arguments);
        return this.rejectWith(null,args);
    };

    Deferred.prototype.rejectWith = function(context,args) {
        args = args ? makeArray(args) : []; 
        args.__ctx__ = context;
        this._reject(args);
        this._rejected = true;
        return this;
    };

    Deferred.prototype.isResolved = function() {
        var p = result(this,"promise");
        return p.isResolved();
    };

    Deferred.prototype.isRejected = function() {
        var p = result(this,"promise");
        return p.isRejected();
    };

    Deferred.prototype.state = function() {
        var p = result(this,"promise");
        return p.state();
    };

    Deferred.prototype.then = function(callback, errback, progback) {
        var p = result(this,"promise");
        return p.then(callback, errback, progback);
    };

    Deferred.prototype.progress = function(progback){
        var p = result(this,"promise");
        return p.progress(progback);
    };
   
    Deferred.prototype.catch = function(errback) {
        var p = result(this,"promise");
        return p.catch(errback);
    };


    Deferred.prototype.always  = function() {
        var p = result(this,"promise");
        p.always.apply(p,arguments);
        return this;
    };

    Deferred.prototype.done  = function() {
        var p = result(this,"promise");
        p.done.apply(p,arguments);
        return this;
    };

    Deferred.prototype.fail = function(errback) {
        var p = result(this,"promise");
        p.fail(errback);
        return this;
    };


    Deferred.all = function(array) {
        //return wrapPromise(Promise.all(array));
        var d = new Deferred();
        Promise.all(array).then(d.resolve.bind(d),d.reject.bind(d));
        return result(d,"promise");
    };

    Deferred.first = function(array) {
        return makePromise2(Promise.race(array));
    };


    Deferred.when = function(valueOrPromise, callback, errback, progback) {
        var receivedPromise = valueOrPromise && typeof valueOrPromise.then === "function";
        var nativePromise = receivedPromise && valueOrPromise instanceof Promise;

        if (!receivedPromise) {
            if (arguments.length > 1) {
                return callback ? callback(valueOrPromise) : valueOrPromise;
            } else {
                return new Deferred().resolve(valueOrPromise);
            }
        } else if (!nativePromise) {
            var deferred = new Deferred(valueOrPromise.cancel);
            valueOrPromise.then(proxy(deferred.resolve,deferred), proxy(deferred.reject,deferred), deferred.notify);
            valueOrPromise = deferred.promise;
        }

        if (callback || errback || progback) {
            return valueOrPromise.then(callback, errback, progback);
        }
        return valueOrPromise;
    };

    Deferred.reject = function(err) {
        var d = new Deferred();
        d.reject(err);
        return d.promise;
    };

    Deferred.resolve = function(data) {
        var d = new Deferred();
        d.resolve.apply(d,arguments);
        return d.promise;
    };

    Deferred.immediate = Deferred.resolve;


    Deferred.promise = function(callback) {
        var d = new Deferred();

        callback(d.resolve.bind(d),d.reject.bind(d),d.progress.bind(d));

        return d.promise;
    };

    return async.Deferred = Deferred;
});
define('skylark-langx-async/each',[
	"./async"
],function(async){

	function each(items, next, callback) {
		if (items.length === 0) return callback(undefined, items);

		var transformed = new Array(items.length);
		var count = 0;
		var returned = false;

		items.forEach(function(item, index) {
			next(item, function(error, transformedItem) {
		    	if (returned) return;
		    	if (error) {
		      		returned = true;
		      		return callback(error);
		    	}
		    	transformed[index] = transformedItem;
		    	count += 1;
		    	if (count === items.length) {
		    		return callback(undefined, transformed);
		    	}
			});
		});
	}

	return async.each = each;

});
define('skylark-langx-async/parallel',[
    "skylark-langx-objects",
    "./async",
    "./deferred"
],function(objects,async,Deferred){
    function parallel(arr,args,ctx) {
        var rets = [];
        ctx = ctx || null;
        args = args || [];

        objects.each(arr,function(i,func){
            rets.push(func.apply(ctx,args));
        });

        return Deferred.all(rets);
    }

	return async.parallel = parallel;
});
define('skylark-langx-async/series',[
    "skylark-langx-objects",
    "./async",
    "./deferred"
],function(objects,async,Deferred){
     function series(arr,args,ctx) {
        var rets = [],
            d = new Deferred(),
            p = d.promise;

        ctx = ctx || null;
        args = args || [];

        d.resolve();
        objects.each(arr,function(i,func){
            p = p.then(function(){
                return func.apply(ctx,args);
            });
            rets.push(p);
        });

        return Deferred.all(rets);
    }

	return async.series = series;
});
define('skylark-langx-async/waterful',[
    "skylark-langx-objects",
    "./async",
    "./deferred"
],function(objects,async,Deferred){
    function waterful(arr,args,ctx) {
        var d = new Deferred(),
            p = d.promise;

        ctx = ctx || null;
        args = args || [];

        d.resolveWith(ctx,args);

        objects.each(arr,function(i,func){
            p = p.then(func);
        });
        return p;
    }

	return async.waterful = waterful;
});
define('skylark-langx-async/main',[
	"./async",
	"./deferred",
	"./each",
	"./parallel",
	"./series",
	"./waterful"
],function(async){
	return async;
});
define('skylark-langx-async', ['skylark-langx-async/main'], function (main) { return main; });

define('skylark-browserfs/backend/HTML5FS',[
    "skylark-langx-async",
    '../generic/preload_file',
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/node_fs_stats',
    '../libs/path',
    '../core/global',
    '../core/util'
], function (async,preload_file, file_system, api_error, file_flag, node_fs_stats, path, global, util) {
    'use strict';
    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { ActionType } = file_flag;
    const { Stats, FileType } = node_fs_stats;
    const asyncEach = async.each;
    const { buffer2ArrayBuffer, arrayBuffer2Buffer } = util;

    const { PreloadFile} = preload_file;

    /**
     * @hidden
     */
    function isDirectoryEntry(entry) {
        return entry.isDirectory;
    }
    /**
     * @hidden
     */
    const _getFS = global.webkitRequestFileSystem || global.requestFileSystem || null;
    /**
     * @hidden
     */
    function _requestQuota(type, size, success, errorCallback) {
        // We cast navigator and window to '<any>' because everything here is
        // nonstandard functionality, despite the fact that Chrome has the only
        // implementation of the HTML5FS and is likely driving the standardization
        // process. Thus, these objects defined off of navigator and window are not
        // present in the DefinitelyTyped TypeScript typings for FileSystem.
        if (typeof navigator['webkitPersistentStorage'] !== 'undefined') {
            switch (type) {
                case global.PERSISTENT:
                    navigator.webkitPersistentStorage.requestQuota(size, success, errorCallback);
                    break;
                case global.TEMPORARY:
                    navigator.webkitTemporaryStorage.requestQuota(size, success, errorCallback);
                    break;
                default:
                    errorCallback(new TypeError(`Invalid storage type: ${type}`));
                    break;
            }
        }
        else {
            global.webkitStorageInfo.requestQuota(type, size, success, errorCallback);
        }
    }
    /**
     * @hidden
     */
    function _toArray(list) {
        return Array.prototype.slice.call(list || [], 0);
    }
    /**
     * Converts the given DOMError into an appropriate ApiError.
     * @url https://developer.mozilla.org/en-US/docs/Web/API/DOMError
     * @hidden
     */
    function convertError(err, p, expectedDir) {
        switch (err.name) {
            /* The user agent failed to create a file or directory due to the existence of a file or
                directory with the same path.  */
            case "PathExistsError":
                return ApiError.EEXIST(p);
            /* The operation failed because it would cause the application to exceed its storage quota.  */
            case 'QuotaExceededError':
                return ApiError.FileError(ErrorCode.ENOSPC, p);
            /*  A required file or directory could not be found at the time an operation was processed.   */
            case 'NotFoundError':
                return ApiError.ENOENT(p);
            /* This is a security error code to be used in situations not covered by any other error codes.
                - A required file was unsafe for access within a Web application
                - Too many calls are being made on filesystem resources */
            case 'SecurityError':
                return ApiError.FileError(ErrorCode.EACCES, p);
            /* The modification requested was illegal. Examples of invalid modifications include moving a
                directory into its own child, moving a file into its parent directory without changing its name,
                or copying a directory to a path occupied by a file.  */
            case 'InvalidModificationError':
                return ApiError.FileError(ErrorCode.EPERM, p);
            /* The user has attempted to look up a file or directory, but the Entry found is of the wrong type
                [e.g. is a DirectoryEntry when the user requested a FileEntry].  */
            case 'TypeMismatchError':
                return ApiError.FileError(expectedDir ? ErrorCode.ENOTDIR : ErrorCode.EISDIR, p);
            /* A path or URL supplied to the API was malformed.  */
            case "EncodingError":
            /* An operation depended on state cached in an interface object, but that state that has changed
                since it was read from disk.  */
            case "InvalidStateError":
            /* The user attempted to write to a file or directory which could not be modified due to the state
                of the underlying filesystem.  */
            case "NoModificationAllowedError":
            default:
                return ApiError.FileError(ErrorCode.EINVAL, p);
        }
    }
    // A note about getFile and getDirectory options:
    // These methods are called at numerous places in this file, and are passed
    // some combination of these two options:
    //   - create: If true, the entry will be created if it doesn't exist.
    //             If false, an error will be thrown if it doesn't exist.
    //   - exclusive: If true, only create the entry if it doesn't already exist,
    //                and throw an error if it does.
    class HTML5FSFile extends PreloadFile {
        constructor(fs, entry, path, flag, stat, contents) {
            super(fs, path, flag, stat, contents);
            this._entry = entry;
        }
        sync(cb) {
            if (!this.isDirty()) {
                return cb();
            }
            this._entry.createWriter((writer) => {
                const buffer = this.getBuffer();
                const blob = new Blob([buffer2ArrayBuffer(buffer)]);
                const length = blob.size;
                writer.onwriteend = (err) => {
                    writer.onwriteend = null;
                    writer.onerror = null;
                    writer.truncate(length);
                    this.resetDirty();
                    cb();
                };
                writer.onerror = (err) => {
                    cb(convertError(err, this.getPath(), false));
                };
                writer.write(blob);
            });
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * A read-write filesystem backed by the HTML5 FileSystem API.
     *
     * As the HTML5 FileSystem is only implemented in Blink, this interface is
     * only available in Chrome.
     */
    class HTML5FS extends BaseFileSystem {
        /**
         * @param size storage quota to request, in megabytes. Allocated value may be less.
         * @param type window.PERSISTENT or window.TEMPORARY. Defaults to PERSISTENT.
         */
        constructor(size = 5, type = global.PERSISTENT) {
            super();
            // Convert MB to bytes.
            this.size = 1024 * 1024 * size;
            this.type = type;
        }
        /**
         * Creates an HTML5FS instance with the given options.
         */
        static Create(opts, cb) {
            const fs = new HTML5FS(opts.size, opts.type);
            fs._allocate((e) => e ? cb(e) : cb(null, fs));
        }
        static isAvailable() {
            return !!_getFS;
        }
        getName() {
            return HTML5FS.Name;
        }
        isReadOnly() {
            return false;
        }
        supportsSymlinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return false;
        }
        /**
         * Deletes everything in the FS. Used for testing.
         * Karma clears the storage after you quit it but not between runs of the test
         * suite, and the tests expect an empty FS every time.
         */
        empty(mainCb) {
            // Get a list of all entries in the root directory to delete them
            this._readdir('/', (err, entries) => {
                if (err) {
                    mainCb(err);
                }
                else {
                    // Called when every entry has been operated on
                    const finished = (er) => {
                        if (err) {
                            mainCb(err);
                        }
                        else {
                            mainCb();
                        }
                    };
                    // Removes files and recursively removes directories
                    const deleteEntry = (entry, cb) => {
                        const succ = () => {
                            cb();
                        };
                        const error = (err) => {
                            cb(convertError(err, entry.fullPath, !entry.isDirectory));
                        };
                        if (isDirectoryEntry(entry)) {
                            entry.removeRecursively(succ, error);
                        }
                        else {
                            entry.remove(succ, error);
                        }
                    };
                    // Loop through the entries and remove them, then call the callback
                    // when they're all finished.
                    asyncEach(entries, deleteEntry, finished);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            let semaphore = 2;
            let successCount = 0;
            const root = this.fs.root;
            let currentPath = oldPath;
            const error = (err) => {
                if (--semaphore <= 0) {
                    cb(convertError(err, currentPath, false));
                }
            };
            const success = (file) => {
                if (++successCount === 2) {
                    return cb(new ApiError(ErrorCode.EINVAL, "Something was identified as both a file and a directory. This should never happen."));
                }
                // SPECIAL CASE: If newPath === oldPath, and the path exists, then
                // this operation trivially succeeds.
                if (oldPath === newPath) {
                    return cb();
                }
                // Get the new parent directory.
                currentPath = path.dirname(newPath);
                root.getDirectory(currentPath, {}, (parentDir) => {
                    currentPath = path.basename(newPath);
                    file.moveTo(parentDir, currentPath, (entry) => { cb(); }, (err) => {
                        // SPECIAL CASE: If oldPath is a directory, and newPath is a
                        // file, rename should delete the file and perform the move.
                        if (file.isDirectory) {
                            currentPath = newPath;
                            // Unlink only works on files. Try to delete newPath.
                            this.unlink(newPath, (e) => {
                                if (e) {
                                    // newPath is probably a directory.
                                    error(err);
                                }
                                else {
                                    // Recur, now that newPath doesn't exist.
                                    this.rename(oldPath, newPath, cb);
                                }
                            });
                        }
                        else {
                            error(err);
                        }
                    });
                }, error);
            };
            // We don't know if oldPath is a *file* or a *directory*, and there's no
            // way to stat items. So launch both requests, see which one succeeds.
            root.getFile(oldPath, {}, success, error);
            root.getDirectory(oldPath, {}, success, error);
        }
        stat(path, isLstat, cb) {
            // Throw an error if the entry doesn't exist, because then there's nothing
            // to stat.
            const opts = {
                create: false
            };
            // Called when the path has been successfully loaded as a file.
            const loadAsFile = (entry) => {
                const fileFromEntry = (file) => {
                    const stat = new Stats(FileType.FILE, file.size);
                    cb(null, stat);
                };
                entry.file(fileFromEntry, failedToLoad);
            };
            // Called when the path has been successfully loaded as a directory.
            const loadAsDir = (dir) => {
                // Directory entry size can't be determined from the HTML5 FS API, and is
                // implementation-dependant anyway, so a dummy value is used.
                const size = 4096;
                const stat = new Stats(FileType.DIRECTORY, size);
                cb(null, stat);
            };
            // Called when the path couldn't be opened as a directory or a file.
            const failedToLoad = (err) => {
                cb(convertError(err, path, false /* Unknown / irrelevant */));
            };
            // Called when the path couldn't be opened as a file, but might still be a
            // directory.
            const failedToLoadAsFile = () => {
                this.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
            };
            // No method currently exists to determine whether a path refers to a
            // directory or a file, so this implementation tries both and uses the first
            // one that succeeds.
            this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
        }
        open(p, flags, mode, cb) {
            // XXX: err is a DOMError
            const error = (err) => {
                if (err.name === 'InvalidModificationError' && flags.isExclusive()) {
                    cb(ApiError.EEXIST(p));
                }
                else {
                    cb(convertError(err, p, false));
                }
            };
            this.fs.root.getFile(p, {
                create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
                exclusive: flags.isExclusive()
            }, (entry) => {
                // Try to fetch corresponding file.
                entry.file((file) => {
                    const reader = new FileReader();
                    reader.onloadend = (event) => {
                        const bfsFile = this._makeFile(p, entry, flags, file, reader.result);
                        cb(null, bfsFile);
                    };
                    reader.onerror = (ev) => {
                        error(reader.error);
                    };
                    reader.readAsArrayBuffer(file);
                }, error);
            }, error);
        }
        unlink(path, cb) {
            this._remove(path, cb, true);
        }
        rmdir(path, cb) {
            // Check if directory is non-empty, first.
            this.readdir(path, (e, files) => {
                if (e) {
                    cb(e);
                }
                else if (files.length > 0) {
                    cb(ApiError.ENOTEMPTY(path));
                }
                else {
                    this._remove(path, cb, false);
                }
            });
        }
        mkdir(path, mode, cb) {
            // Create the directory, but throw an error if it already exists, as per
            // mkdir(1)
            const opts = {
                create: true,
                exclusive: true
            };
            const success = (dir) => {
                cb();
            };
            const error = (err) => {
                cb(convertError(err, path, true));
            };
            this.fs.root.getDirectory(path, opts, success, error);
        }
        /**
         * Map _readdir's list of `FileEntry`s to their names and return that.
         */
        readdir(path, cb) {
            this._readdir(path, (e, entries) => {
                if (entries) {
                    const rv = [];
                    for (const entry of entries) {
                        rv.push(entry.name);
                    }
                    cb(null, rv);
                }
                else {
                    return cb(e);
                }
            });
        }
        /**
         * Returns a BrowserFS object representing a File.
         */
        _makeFile(path, entry, flag, stat, data = new ArrayBuffer(0)) {
            const stats = new Stats(FileType.FILE, stat.size);
            const buffer = arrayBuffer2Buffer(data);
            return new HTML5FSFile(this, entry, path, flag, stats, buffer);
        }
        /**
         * Returns an array of `FileEntry`s. Used internally by empty and readdir.
         */
        _readdir(path, cb) {
            const error = (err) => {
                cb(convertError(err, path, true));
            };
            // Grab the requested directory.
            this.fs.root.getDirectory(path, { create: false }, (dirEntry) => {
                const reader = dirEntry.createReader();
                let entries = [];
                // Call the reader.readEntries() until no more results are returned.
                const readEntries = () => {
                    reader.readEntries(((results) => {
                        if (results.length) {
                            entries = entries.concat(_toArray(results));
                            readEntries();
                        }
                        else {
                            cb(null, entries);
                        }
                    }), error);
                };
                readEntries();
            }, error);
        }
        /**
         * Requests a storage quota from the browser to back this FS.
         */
        _allocate(cb) {
            const success = (fs) => {
                this.fs = fs;
                cb();
            };
            const error = (err) => {
                cb(convertError(err, "/", true));
            };
            if (this.type === global.PERSISTENT) {
                _requestQuota(this.type, this.size, (granted) => {
                    _getFS(this.type, granted, success, error);
                }, error);
            }
            else {
                _getFS(this.type, this.size, success, error);
            }
        }
        /**
         * Delete a file or directory from the file system
         * isFile should reflect which call was made to remove the it (`unlink` or
         * `rmdir`). If this doesn't match what's actually at `path`, an error will be
         * returned
         */
        _remove(path, cb, isFile) {
            const success = (entry) => {
                const succ = () => {
                    cb();
                };
                const err = (err) => {
                    cb(convertError(err, path, !isFile));
                };
                entry.remove(succ, err);
            };
            const error = (err) => {
                cb(convertError(err, path, !isFile));
            };
            // Deleting the entry, so don't create it
            const opts = {
                create: false
            };
            if (isFile) {
                this.fs.root.getFile(path, opts, success, error);
            }
            else {
                this.fs.root.getDirectory(path, opts, success, error);
            }
        }
    }
    HTML5FS.Name = "HTML5FS";
    HTML5FS.Options = {
        size: {
            type: "number",
            optional: true,
            description: "Storage quota to request, in megabytes. Allocated value may be less. Defaults to 5."
        },
        type: {
            type: "number",
            optional: true,
            description: "window.PERSISTENT or window.TEMPORARY. Defaults to PERSISTENT."
        }
    };

    HTML5FS.HTML5FSFile = HTML5FSFile;

    return HTML5FS;
});
define('skylark-browserfs/generic/inode',[
    '../libs/buffers',
    '../core/node_fs_stats'
], function (buffers,node_fs_stats) {
    'use strict';

    const  { Stats, FileType } = node_fs_stats;
    const { Buffer } = buffers;

    /**
     * Generic inode definition that can easily be serialized.
     */
    class Inode {
        constructor(id, size, mode, atime, mtime, ctime) {
            this.id = id;
            this.size = size;
            this.mode = mode;
            this.atime = atime;
            this.mtime = mtime;
            this.ctime = ctime;
        }
        /**
         * Converts the buffer into an Inode.
         */
        static fromBuffer(buffer) {
            if (buffer === undefined) {
                throw new Error("NO");
            }
            return new Inode(buffer.toString('ascii', 30), buffer.readUInt32LE(0), buffer.readUInt16LE(4), buffer.readDoubleLE(6), buffer.readDoubleLE(14), buffer.readDoubleLE(22));
        }
        /**
         * Handy function that converts the Inode to a Node Stats object.
         */
        toStats() {
            return new Stats((this.mode & 0xF000) === FileType.DIRECTORY ? FileType.DIRECTORY : FileType.FILE, this.size, this.mode, this.atime, this.mtime, this.ctime);
        }
        /**
         * Get the size of this Inode, in bytes.
         */
        getSize() {
            // ASSUMPTION: ID is ASCII (1 byte per char).
            return 30 + this.id.length;
        }
        /**
         * Writes the inode into the start of the buffer.
         */
        toBuffer(buff = Buffer.alloc(this.getSize())) {
            buff.writeUInt32LE(this.size, 0);
            buff.writeUInt16LE(this.mode, 4);
            buff.writeDoubleLE(this.atime, 6);
            buff.writeDoubleLE(this.mtime, 14);
            buff.writeDoubleLE(this.ctime, 22);
            buff.write(this.id, 30, this.id.length, 'ascii');
            return buff;
        }
        /**
         * Updates the Inode using information from the stats object. Used by file
         * systems at sync time, e.g.:
         * - Program opens file and gets a File object.
         * - Program mutates file. File object is responsible for maintaining
         *   metadata changes locally -- typically in a Stats object.
         * - Program closes file. File object's metadata changes are synced with the
         *   file system.
         * @return True if any changes have occurred.
         */
        update(stats) {
            let hasChanged = false;
            if (this.size !== stats.size) {
                this.size = stats.size;
                hasChanged = true;
            }
            if (this.mode !== stats.mode) {
                this.mode = stats.mode;
                hasChanged = true;
            }
            const atimeMs = stats.atime.getTime();
            if (this.atime !== atimeMs) {
                this.atime = atimeMs;
                hasChanged = true;
            }
            const mtimeMs = stats.mtime.getTime();
            if (this.mtime !== mtimeMs) {
                this.mtime = mtimeMs;
                hasChanged = true;
            }
            const ctimeMs = stats.ctime.getTime();
            if (this.ctime !== ctimeMs) {
                this.ctime = ctimeMs;
                hasChanged = true;
            }
            return hasChanged;
        }
        // XXX: Copied from Stats. Should reconcile these two into something more
        //      compact.
        /**
         * @return [Boolean] True if this item is a file.
         */
        isFile() {
            return (this.mode & 0xF000) === FileType.FILE;
        }
        /**
         * @return [Boolean] True if this item is a directory.
         */
        isDirectory() {
            return (this.mode & 0xF000) === FileType.DIRECTORY;
        }
    }


    return Inode;
});
define('skylark-browserfs/generic/key_value_filesystem',[
    '../libs/buffers',
    '../core/file_system',
    '../core/api_error',
    '../core/node_fs_stats',
    '../libs/path',
    '../generic/inode',
    '../generic/preload_file',
    '../core/util'
], function (buffers,file_system, api_error, node_fs_stats, path, Inode, preload_file, util) {
    'use strict';

    const { BaseFileSystem, SynchronousFileSystem } = file_system;
    const { ApiError, ErrorCode } = api_error;
    const { FileType } = node_fs_stats;
    const { emptyBuffer } = util;
    const { PreloadFile} = preload_file;
    const { Buffer } = buffers;


    /**
     * @hidden
     */
    const ROOT_NODE_ID = "/";
    /**
     * @hidden
     */
    let emptyDirNode = null;
    /**
     * Returns an empty directory node.
     * @hidden
     */
    function getEmptyDirNode() {
        if (emptyDirNode) {
            return emptyDirNode;
        }
        return emptyDirNode = Buffer.from("{}");
    }
    /**
     * Generates a random ID.
     * @hidden
     */
    function GenerateRandomID() {
        // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    /**
     * Helper function. Checks if 'e' is defined. If so, it triggers the callback
     * with 'e' and returns false. Otherwise, returns true.
     * @hidden
     */
    function noError(e, cb) {
        if (e) {
            cb(e);
            return false;
        }
        return true;
    }
    /**
     * Helper function. Checks if 'e' is defined. If so, it aborts the transaction,
     * triggers the callback with 'e', and returns false. Otherwise, returns true.
     * @hidden
     */
    function noErrorTx(e, tx, cb) {
        if (e) {
            tx.abort(() => {
                cb(e);
            });
            return false;
        }
        return true;
    }
    class LRUNode {
        constructor(key, value) {
            this.key = key;
            this.value = value;
            this.prev = null;
            this.next = null;
        }
    }
    // Adapted from https://chrisrng.svbtle.com/lru-cache-in-javascript
    class LRUCache {
        constructor(limit) {
            this.limit = limit;
            this.size = 0;
            this.map = {};
            this.head = null;
            this.tail = null;
        }
        /**
         * Change or add a new value in the cache
         * We overwrite the entry if it already exists
         */
        set(key, value) {
            const node = new LRUNode(key, value);
            if (this.map[key]) {
                this.map[key].value = node.value;
                this.remove(node.key);
            }
            else {
                if (this.size >= this.limit) {
                    delete this.map[this.tail.key];
                    this.size--;
                    this.tail = this.tail.prev;
                    this.tail.next = null;
                }
            }
            this.setHead(node);
        }
        /* Retrieve a single entry from the cache */
        get(key) {
            if (this.map[key]) {
                const value = this.map[key].value;
                const node = new LRUNode(key, value);
                this.remove(key);
                this.setHead(node);
                return value;
            }
            else {
                return null;
            }
        }
        /* Remove a single entry from the cache */
        remove(key) {
            const node = this.map[key];
            if (!node) {
                return;
            }
            if (node.prev !== null) {
                node.prev.next = node.next;
            }
            else {
                this.head = node.next;
            }
            if (node.next !== null) {
                node.next.prev = node.prev;
            }
            else {
                this.tail = node.prev;
            }
            delete this.map[key];
            this.size--;
        }
        /* Resets the entire cache - Argument limit is optional to be reset */
        removeAll() {
            this.size = 0;
            this.map = {};
            this.head = null;
            this.tail = null;
        }
        setHead(node) {
            node.next = this.head;
            node.prev = null;
            if (this.head !== null) {
                this.head.prev = node;
            }
            this.head = node;
            if (this.tail === null) {
                this.tail = node;
            }
            this.size++;
            this.map[node.key] = node;
        }
    }
    /**
     * A simple RW transaction for simple synchronous key-value stores.
     */
    class SimpleSyncRWTransaction {
        constructor(store) {
            this.store = store;
            /**
             * Stores data in the keys we modify prior to modifying them.
             * Allows us to roll back commits.
             */
            this.originalData = {};
            /**
             * List of keys modified in this transaction, if any.
             */
            this.modifiedKeys = [];
        }
        get(key) {
            const val = this.store.get(key);
            this.stashOldValue(key, val);
            return val;
        }
        put(key, data, overwrite) {
            this.markModified(key);
            return this.store.put(key, data, overwrite);
        }
        del(key) {
            this.markModified(key);
            this.store.del(key);
        }
        commit() { }
        abort() {
            // Rollback old values.
            for (const key of this.modifiedKeys) {
                const value = this.originalData[key];
                if (!value) {
                    // Key didn't exist.
                    this.store.del(key);
                }
                else {
                    // Key existed. Store old value.
                    this.store.put(key, value, true);
                }
            }
        }
        /**
         * Stashes given key value pair into `originalData` if it doesn't already
         * exist. Allows us to stash values the program is requesting anyway to
         * prevent needless `get` requests if the program modifies the data later
         * on during the transaction.
         */
        stashOldValue(key, value) {
            // Keep only the earliest value in the transaction.
            if (!this.originalData.hasOwnProperty(key)) {
                this.originalData[key] = value;
            }
        }
        /**
         * Marks the given key as modified, and stashes its value if it has not been
         * stashed already.
         */
        markModified(key) {
            if (this.modifiedKeys.indexOf(key) === -1) {
                this.modifiedKeys.push(key);
                if (!this.originalData.hasOwnProperty(key)) {
                    this.originalData[key] = this.store.get(key);
                }
            }
        }
    }
    class SyncKeyValueFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this.getPath(), this.getBuffer(), this.getStats());
                this.resetDirty();
            }
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * A "Synchronous key-value file system". Stores data to/retrieves data from an
     * underlying key-value store.
     *
     * We use a unique ID for each node in the file system. The root node has a
     * fixed ID.
     * @todo Introduce Node ID caching.
     * @todo Check modes.
     */
    class SyncKeyValueFileSystem extends SynchronousFileSystem {
        static isAvailable() { return true; }
        constructor(options) {
            super();
            this.store = options.store;
            // INVARIANT: Ensure that the root exists.
            this.makeRootDirectory();
        }
        getName() { return this.store.name(); }
        isReadOnly() { return false; }
        supportsSymlinks() { return false; }
        supportsProps() { return false; }
        supportsSynch() { return true; }
        /**
         * Delete all contents stored in the file system.
         */
        empty() {
            this.store.clear();
            // INVARIANT: Root always exists.
            this.makeRootDirectory();
        }
        renameSync(oldPath, newPath) {
            const tx = this.store.beginTransaction('readwrite'), oldParent = path.dirname(oldPath), oldName = path.basename(oldPath), newParent = path.dirname(newPath), newName = path.basename(newPath), 
            // Remove oldPath from parent's directory listing.
            oldDirNode = this.findINode(tx, oldParent), oldDirList = this.getDirListing(tx, oldParent, oldDirNode);
            if (!oldDirList[oldName]) {
                throw ApiError.ENOENT(oldPath);
            }
            const nodeId = oldDirList[oldName];
            delete oldDirList[oldName];
            // Invariant: Can't move a folder inside itself.
            // This funny little hack ensures that the check passes only if oldPath
            // is a subpath of newParent. We append '/' to avoid matching folders that
            // are a substring of the bottom-most folder in the path.
            if ((newParent + '/').indexOf(oldPath + '/') === 0) {
                throw new ApiError(ErrorCode.EBUSY, oldParent);
            }
            // Add newPath to parent's directory listing.
            let newDirNode, newDirList;
            if (newParent === oldParent) {
                // Prevent us from re-grabbing the same directory listing, which still
                // contains oldName.
                newDirNode = oldDirNode;
                newDirList = oldDirList;
            }
            else {
                newDirNode = this.findINode(tx, newParent);
                newDirList = this.getDirListing(tx, newParent, newDirNode);
            }
            if (newDirList[newName]) {
                // If it's a file, delete it.
                const newNameNode = this.getINode(tx, newPath, newDirList[newName]);
                if (newNameNode.isFile()) {
                    try {
                        tx.del(newNameNode.id);
                        tx.del(newDirList[newName]);
                    }
                    catch (e) {
                        tx.abort();
                        throw e;
                    }
                }
                else {
                    // If it's a directory, throw a permissions error.
                    throw ApiError.EPERM(newPath);
                }
            }
            newDirList[newName] = nodeId;
            // Commit the two changed directory listings.
            try {
                tx.put(oldDirNode.id, Buffer.from(JSON.stringify(oldDirList)), true);
                tx.put(newDirNode.id, Buffer.from(JSON.stringify(newDirList)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
        }
        statSync(p, isLstat) {
            // Get the inode to the item, convert it into a Stats object.
            return this.findINode(this.store.beginTransaction('readonly'), p).toStats();
        }
        createFileSync(p, flag, mode) {
            const tx = this.store.beginTransaction('readwrite'), data = emptyBuffer(), newFile = this.commitNewFile(tx, p, FileType.FILE, mode, data);
            // Open the file.
            return new SyncKeyValueFile(this, p, flag, newFile.toStats(), data);
        }
        openFileSync(p, flag) {
            const tx = this.store.beginTransaction('readonly'), node = this.findINode(tx, p), data = tx.get(node.id);
            if (data === undefined) {
                throw ApiError.ENOENT(p);
            }
            return new SyncKeyValueFile(this, p, flag, node.toStats(), data);
        }
        unlinkSync(p) {
            this.removeEntry(p, false);
        }
        rmdirSync(p) {
            // Check first if directory is empty.
            if (this.readdirSync(p).length > 0) {
                throw ApiError.ENOTEMPTY(p);
            }
            else {
                this.removeEntry(p, true);
            }
        }
        mkdirSync(p, mode) {
            const tx = this.store.beginTransaction('readwrite'), data = Buffer.from('{}');
            this.commitNewFile(tx, p, FileType.DIRECTORY, mode, data);
        }
        readdirSync(p) {
            const tx = this.store.beginTransaction('readonly');
            return Object.keys(this.getDirListing(tx, p, this.findINode(tx, p)));
        }
        _syncSync(p, data, stats) {
            // @todo Ensure mtime updates properly, and use that to determine if a data
            //       update is required.
            const tx = this.store.beginTransaction('readwrite'), 
            // We use the _findInode helper because we actually need the INode id.
            fileInodeId = this._findINode(tx, path.dirname(p), path.basename(p)), fileInode = this.getINode(tx, p, fileInodeId), inodeChanged = fileInode.update(stats);
            try {
                // Sync data.
                tx.put(fileInode.id, data, true);
                // Sync metadata.
                if (inodeChanged) {
                    tx.put(fileInodeId, fileInode.toBuffer(), true);
                }
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
        }
        /**
         * Checks if the root directory exists. Creates it if it doesn't.
         */
        makeRootDirectory() {
            const tx = this.store.beginTransaction('readwrite');
            if (tx.get(ROOT_NODE_ID) === undefined) {
                // Create new inode.
                const currTime = (new Date()).getTime(), 
                // Mode 0666
                dirInode = new Inode(GenerateRandomID(), 4096, 511 | FileType.DIRECTORY, currTime, currTime, currTime);
                // If the root doesn't exist, the first random ID shouldn't exist,
                // either.
                tx.put(dirInode.id, getEmptyDirNode(), false);
                tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false);
                tx.commit();
            }
        }
        /**
         * Helper function for findINode.
         * @param parent The parent directory of the file we are attempting to find.
         * @param filename The filename of the inode we are attempting to find, minus
         *   the parent.
         * @return string The ID of the file's inode in the file system.
         */
        _findINode(tx, parent, filename) {
            const readDirectory = (inode) => {
                // Get the root's directory listing.
                const dirList = this.getDirListing(tx, parent, inode);
                // Get the file's ID.
                if (dirList[filename]) {
                    return dirList[filename];
                }
                else {
                    throw ApiError.ENOENT(path.resolve(parent, filename));
                }
            };
            if (parent === '/') {
                if (filename === '') {
                    // BASE CASE #1: Return the root's ID.
                    return ROOT_NODE_ID;
                }
                else {
                    // BASE CASE #2: Find the item in the root ndoe.
                    return readDirectory(this.getINode(tx, parent, ROOT_NODE_ID));
                }
            }
            else {
                return readDirectory(this.getINode(tx, parent + path.sep + filename, this._findINode(tx, path.dirname(parent), path.basename(parent))));
            }
        }
        /**
         * Finds the Inode of the given path.
         * @param p The path to look up.
         * @return The Inode of the path p.
         * @todo memoize/cache
         */
        findINode(tx, p) {
            return this.getINode(tx, p, this._findINode(tx, path.dirname(p), path.basename(p)));
        }
        /**
         * Given the ID of a node, retrieves the corresponding Inode.
         * @param tx The transaction to use.
         * @param p The corresponding path to the file (used for error messages).
         * @param id The ID to look up.
         */
        getINode(tx, p, id) {
            const inode = tx.get(id);
            if (inode === undefined) {
                throw ApiError.ENOENT(p);
            }
            return Inode.fromBuffer(inode);
        }
        /**
         * Given the Inode of a directory, retrieves the corresponding directory
         * listing.
         */
        getDirListing(tx, p, inode) {
            if (!inode.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            const data = tx.get(inode.id);
            if (data === undefined) {
                throw ApiError.ENOENT(p);
            }
            return JSON.parse(data.toString());
        }
        /**
         * Creates a new node under a random ID. Retries 5 times before giving up in
         * the exceedingly unlikely chance that we try to reuse a random GUID.
         * @return The GUID that the data was stored under.
         */
        addNewNode(tx, data) {
            const retries = 0;
            let currId;
            while (retries < 5) {
                try {
                    currId = GenerateRandomID();
                    tx.put(currId, data, false);
                    return currId;
                }
                catch (e) {
                    // Ignore and reroll.
                }
            }
            throw new ApiError(ErrorCode.EIO, 'Unable to commit data to key-value store.');
        }
        /**
         * Commits a new file (well, a FILE or a DIRECTORY) to the file system with
         * the given mode.
         * Note: This will commit the transaction.
         * @param p The path to the new file.
         * @param type The type of the new file.
         * @param mode The mode to create the new file with.
         * @param data The data to store at the file's data node.
         * @return The Inode for the new file.
         */
        commitNewFile(tx, p, type, mode, data) {
            const parentDir = path.dirname(p), fname = path.basename(p), parentNode = this.findINode(tx, parentDir), dirListing = this.getDirListing(tx, parentDir, parentNode), currTime = (new Date()).getTime();
            // Invariant: The root always exists.
            // If we don't check this prior to taking steps below, we will create a
            // file with name '' in root should p == '/'.
            if (p === '/') {
                throw ApiError.EEXIST(p);
            }
            // Check if file already exists.
            if (dirListing[fname]) {
                throw ApiError.EEXIST(p);
            }
            let fileNode;
            try {
                // Commit data.
                const dataId = this.addNewNode(tx, data);
                fileNode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                // Commit file node.
                const fileNodeId = this.addNewNode(tx, fileNode.toBuffer());
                // Update and commit parent directory listing.
                dirListing[fname] = fileNodeId;
                tx.put(parentNode.id, Buffer.from(JSON.stringify(dirListing)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            tx.commit();
            return fileNode;
        }
        /**
         * Remove all traces of the given path from the file system.
         * @param p The path to remove from the file system.
         * @param isDir Does the path belong to a directory, or a file?
         * @todo Update mtime.
         */
        removeEntry(p, isDir) {
            const tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), parentNode = this.findINode(tx, parent), parentListing = this.getDirListing(tx, parent, parentNode), fileName = path.basename(p);
            if (!parentListing[fileName]) {
                throw ApiError.ENOENT(p);
            }
            // Remove from directory listing of parent.
            const fileNodeId = parentListing[fileName];
            delete parentListing[fileName];
            // Get file inode.
            const fileNode = this.getINode(tx, p, fileNodeId);
            if (!isDir && fileNode.isDirectory()) {
                throw ApiError.EISDIR(p);
            }
            else if (isDir && !fileNode.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            try {
                // Delete data.
                tx.del(fileNode.id);
                // Delete node.
                tx.del(fileNodeId);
                // Update directory listing.
                tx.put(parentNode.id, Buffer.from(JSON.stringify(parentListing)), true);
            }
            catch (e) {
                tx.abort();
                throw e;
            }
            // Success.
            tx.commit();
        }
    }
    class AsyncKeyValueFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, contents) {
            super(_fs, _path, _flag, _stat, contents);
        }
        sync(cb) {
            if (this.isDirty()) {
                this._fs._sync(this.getPath(), this.getBuffer(), this.getStats(), (e) => {
                    if (!e) {
                        this.resetDirty();
                    }
                    cb(e);
                });
            }
            else {
                cb();
            }
        }
        close(cb) {
            this.sync(cb);
        }
    }
    /**
     * An "Asynchronous key-value file system". Stores data to/retrieves data from
     * an underlying asynchronous key-value store.
     */
    class AsyncKeyValueFileSystem extends BaseFileSystem {
        constructor(cacheSize) {
            super();
            this._cache = null;
            if (cacheSize > 0) {
                this._cache = new LRUCache(cacheSize);
            }
        }
        static isAvailable() { return true; }
        /**
         * Initializes the file system. Typically called by subclasses' async
         * constructors.
         */
        init(store, cb) {
            this.store = store;
            // INVARIANT: Ensure that the root exists.
            this.makeRootDirectory(cb);
        }
        getName() { return this.store.name(); }
        isReadOnly() { return false; }
        supportsSymlinks() { return false; }
        supportsProps() { return false; }
        supportsSynch() { return false; }
        /**
         * Delete all contents stored in the file system.
         */
        empty(cb) {
            if (this._cache) {
                this._cache.removeAll();
            }
            this.store.clear((e) => {
                if (noError(e, cb)) {
                    // INVARIANT: Root always exists.
                    this.makeRootDirectory(cb);
                }
            });
        }
        rename(oldPath, newPath, cb) {
            // TODO: Make rename compatible with the cache.
            if (this._cache) {
                // Clear and disable cache during renaming process.
                const c = this._cache;
                this._cache = null;
                c.removeAll();
                const oldCb = cb;
                cb = (e) => {
                    // Restore empty cache.
                    this._cache = c;
                    oldCb(e);
                };
            }
            const tx = this.store.beginTransaction('readwrite');
            const oldParent = path.dirname(oldPath), oldName = path.basename(oldPath);
            const newParent = path.dirname(newPath), newName = path.basename(newPath);
            const inodes = {};
            const lists = {};
            let errorOccurred = false;
            // Invariant: Can't move a folder inside itself.
            // This funny little hack ensures that the check passes only if oldPath
            // is a subpath of newParent. We append '/' to avoid matching folders that
            // are a substring of the bottom-most folder in the path.
            if ((newParent + '/').indexOf(oldPath + '/') === 0) {
                return cb(new ApiError(ErrorCode.EBUSY, oldParent));
            }
            /**
             * Responsible for Phase 2 of the rename operation: Modifying and
             * committing the directory listings. Called once we have successfully
             * retrieved both the old and new parent's inodes and listings.
             */
            const theOleSwitcharoo = () => {
                // Sanity check: Ensure both paths are present, and no error has occurred.
                if (errorOccurred || !lists.hasOwnProperty(oldParent) || !lists.hasOwnProperty(newParent)) {
                    return;
                }
                const oldParentList = lists[oldParent], oldParentINode = inodes[oldParent], newParentList = lists[newParent], newParentINode = inodes[newParent];
                // Delete file from old parent.
                if (!oldParentList[oldName]) {
                    cb(ApiError.ENOENT(oldPath));
                }
                else {
                    const fileId = oldParentList[oldName];
                    delete oldParentList[oldName];
                    // Finishes off the renaming process by adding the file to the new
                    // parent.
                    const completeRename = () => {
                        newParentList[newName] = fileId;
                        // Commit old parent's list.
                        tx.put(oldParentINode.id, Buffer.from(JSON.stringify(oldParentList)), true, (e) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (oldParent === newParent) {
                                    // DONE!
                                    tx.commit(cb);
                                }
                                else {
                                    // Commit new parent's list.
                                    tx.put(newParentINode.id, Buffer.from(JSON.stringify(newParentList)), true, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.commit(cb);
                                        }
                                    });
                                }
                            }
                        });
                    };
                    if (newParentList[newName]) {
                        // 'newPath' already exists. Check if it's a file or a directory, and
                        // act accordingly.
                        this.getINode(tx, newPath, newParentList[newName], (e, inode) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (inode.isFile()) {
                                    // Delete the file and continue.
                                    tx.del(inode.id, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            tx.del(newParentList[newName], (e) => {
                                                if (noErrorTx(e, tx, cb)) {
                                                    completeRename();
                                                }
                                            });
                                        }
                                    });
                                }
                                else {
                                    // Can't overwrite a directory using rename.
                                    tx.abort((e) => {
                                        cb(ApiError.EPERM(newPath));
                                    });
                                }
                            }
                        });
                    }
                    else {
                        completeRename();
                    }
                }
            };
            /**
             * Grabs a path's inode and directory listing, and shoves it into the
             * inodes and lists hashes.
             */
            const processInodeAndListings = (p) => {
                this.findINodeAndDirListing(tx, p, (e, node, dirList) => {
                    if (e) {
                        if (!errorOccurred) {
                            errorOccurred = true;
                            tx.abort(() => {
                                cb(e);
                            });
                        }
                        // If error has occurred already, just stop here.
                    }
                    else {
                        inodes[p] = node;
                        lists[p] = dirList;
                        theOleSwitcharoo();
                    }
                });
            };
            processInodeAndListings(oldParent);
            if (oldParent !== newParent) {
                processInodeAndListings(newParent);
            }
        }
        stat(p, isLstat, cb) {
            const tx = this.store.beginTransaction('readonly');
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    cb(null, inode.toStats());
                }
            });
        }
        createFile(p, flag, mode, cb) {
            const tx = this.store.beginTransaction('readwrite'), data = emptyBuffer();
            this.commitNewFile(tx, p, FileType.FILE, mode, data, (e, newFile) => {
                if (noError(e, cb)) {
                    cb(null, new AsyncKeyValueFile(this, p, flag, newFile.toStats(), data));
                }
            });
        }
        openFile(p, flag, cb) {
            const tx = this.store.beginTransaction('readonly');
            // Step 1: Grab the file's inode.
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    // Step 2: Grab the file's data.
                    tx.get(inode.id, (e, data) => {
                        if (noError(e, cb)) {
                            if (data === undefined) {
                                cb(ApiError.ENOENT(p));
                            }
                            else {
                                cb(null, new AsyncKeyValueFile(this, p, flag, inode.toStats(), data));
                            }
                        }
                    });
                }
            });
        }
        unlink(p, cb) {
            this.removeEntry(p, false, cb);
        }
        rmdir(p, cb) {
            // Check first if directory is empty.
            this.readdir(p, (err, files) => {
                if (err) {
                    cb(err);
                }
                else if (files.length > 0) {
                    cb(ApiError.ENOTEMPTY(p));
                }
                else {
                    this.removeEntry(p, true, cb);
                }
            });
        }
        mkdir(p, mode, cb) {
            const tx = this.store.beginTransaction('readwrite'), data = Buffer.from('{}');
            this.commitNewFile(tx, p, FileType.DIRECTORY, mode, data, cb);
        }
        readdir(p, cb) {
            const tx = this.store.beginTransaction('readonly');
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    this.getDirListing(tx, p, inode, (e, dirListing) => {
                        if (noError(e, cb)) {
                            cb(null, Object.keys(dirListing));
                        }
                    });
                }
            });
        }
        _sync(p, data, stats, cb) {
            // @todo Ensure mtime updates properly, and use that to determine if a data
            //       update is required.
            const tx = this.store.beginTransaction('readwrite');
            // Step 1: Get the file node's ID.
            this._findINode(tx, path.dirname(p), path.basename(p), (e, fileInodeId) => {
                if (noErrorTx(e, tx, cb)) {
                    // Step 2: Get the file inode.
                    this.getINode(tx, p, fileInodeId, (e, fileInode) => {
                        if (noErrorTx(e, tx, cb)) {
                            const inodeChanged = fileInode.update(stats);
                            // Step 3: Sync the data.
                            tx.put(fileInode.id, data, true, (e) => {
                                if (noErrorTx(e, tx, cb)) {
                                    // Step 4: Sync the metadata (if it changed)!
                                    if (inodeChanged) {
                                        tx.put(fileInodeId, fileInode.toBuffer(), true, (e) => {
                                            if (noErrorTx(e, tx, cb)) {
                                                tx.commit(cb);
                                            }
                                        });
                                    }
                                    else {
                                        // No need to sync metadata; return.
                                        tx.commit(cb);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        /**
         * Checks if the root directory exists. Creates it if it doesn't.
         */
        makeRootDirectory(cb) {
            const tx = this.store.beginTransaction('readwrite');
            tx.get(ROOT_NODE_ID, (e, data) => {
                if (e || data === undefined) {
                    // Create new inode.
                    const currTime = (new Date()).getTime(), 
                    // Mode 0666
                    dirInode = new Inode(GenerateRandomID(), 4096, 511 | FileType.DIRECTORY, currTime, currTime, currTime);
                    // If the root doesn't exist, the first random ID shouldn't exist,
                    // either.
                    tx.put(dirInode.id, getEmptyDirNode(), false, (e) => {
                        if (noErrorTx(e, tx, cb)) {
                            tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false, (e) => {
                                if (e) {
                                    tx.abort(() => { cb(e); });
                                }
                                else {
                                    tx.commit(cb);
                                }
                            });
                        }
                    });
                }
                else {
                    // We're good.
                    tx.commit(cb);
                }
            });
        }
        /**
         * Helper function for findINode.
         * @param parent The parent directory of the file we are attempting to find.
         * @param filename The filename of the inode we are attempting to find, minus
         *   the parent.
         * @param cb Passed an error or the ID of the file's inode in the file system.
         */
        _findINode(tx, parent, filename, cb) {
            if (this._cache) {
                const id = this._cache.get(path.join(parent, filename));
                if (id) {
                    return cb(null, id);
                }
            }
            const handleDirectoryListings = (e, inode, dirList) => {
                if (e) {
                    cb(e);
                }
                else if (dirList[filename]) {
                    const id = dirList[filename];
                    if (this._cache) {
                        this._cache.set(path.join(parent, filename), id);
                    }
                    cb(null, id);
                }
                else {
                    cb(ApiError.ENOENT(path.resolve(parent, filename)));
                }
            };
            if (parent === '/') {
                if (filename === '') {
                    // BASE CASE #1: Return the root's ID.
                    if (this._cache) {
                        this._cache.set(path.join(parent, filename), ROOT_NODE_ID);
                    }
                    cb(null, ROOT_NODE_ID);
                }
                else {
                    // BASE CASE #2: Find the item in the root node.
                    this.getINode(tx, parent, ROOT_NODE_ID, (e, inode) => {
                        if (noError(e, cb)) {
                            this.getDirListing(tx, parent, inode, (e, dirList) => {
                                // handle_directory_listings will handle e for us.
                                handleDirectoryListings(e, inode, dirList);
                            });
                        }
                    });
                }
            }
            else {
                // Get the parent directory's INode, and find the file in its directory
                // listing.
                this.findINodeAndDirListing(tx, parent, handleDirectoryListings);
            }
        }
        /**
         * Finds the Inode of the given path.
         * @param p The path to look up.
         * @param cb Passed an error or the Inode of the path p.
         * @todo memoize/cache
         */
        findINode(tx, p, cb) {
            this._findINode(tx, path.dirname(p), path.basename(p), (e, id) => {
                if (noError(e, cb)) {
                    this.getINode(tx, p, id, cb);
                }
            });
        }
        /**
         * Given the ID of a node, retrieves the corresponding Inode.
         * @param tx The transaction to use.
         * @param p The corresponding path to the file (used for error messages).
         * @param id The ID to look up.
         * @param cb Passed an error or the inode under the given id.
         */
        getINode(tx, p, id, cb) {
            tx.get(id, (e, data) => {
                if (noError(e, cb)) {
                    if (data === undefined) {
                        cb(ApiError.ENOENT(p));
                    }
                    else {
                        cb(null, Inode.fromBuffer(data));
                    }
                }
            });
        }
        /**
         * Given the Inode of a directory, retrieves the corresponding directory
         * listing.
         */
        getDirListing(tx, p, inode, cb) {
            if (!inode.isDirectory()) {
                cb(ApiError.ENOTDIR(p));
            }
            else {
                tx.get(inode.id, (e, data) => {
                    if (noError(e, cb)) {
                        try {
                            cb(null, JSON.parse(data.toString()));
                        }
                        catch (e) {
                            // Occurs when data is undefined, or corresponds to something other
                            // than a directory listing. The latter should never occur unless
                            // the file system is corrupted.
                            cb(ApiError.ENOENT(p));
                        }
                    }
                });
            }
        }
        /**
         * Given a path to a directory, retrieves the corresponding INode and
         * directory listing.
         */
        findINodeAndDirListing(tx, p, cb) {
            this.findINode(tx, p, (e, inode) => {
                if (noError(e, cb)) {
                    this.getDirListing(tx, p, inode, (e, listing) => {
                        if (noError(e, cb)) {
                            cb(null, inode, listing);
                        }
                    });
                }
            });
        }
        /**
         * Adds a new node under a random ID. Retries 5 times before giving up in
         * the exceedingly unlikely chance that we try to reuse a random GUID.
         * @param cb Passed an error or the GUID that the data was stored under.
         */
        addNewNode(tx, data, cb) {
            let retries = 0, currId;
            const reroll = () => {
                if (++retries === 5) {
                    // Max retries hit. Return with an error.
                    cb(new ApiError(ErrorCode.EIO, 'Unable to commit data to key-value store.'));
                }
                else {
                    // Try again.
                    currId = GenerateRandomID();
                    tx.put(currId, data, false, (e, committed) => {
                        if (e || !committed) {
                            reroll();
                        }
                        else {
                            // Successfully stored under 'currId'.
                            cb(null, currId);
                        }
                    });
                }
            };
            reroll();
        }
        /**
         * Commits a new file (well, a FILE or a DIRECTORY) to the file system with
         * the given mode.
         * Note: This will commit the transaction.
         * @param p The path to the new file.
         * @param type The type of the new file.
         * @param mode The mode to create the new file with.
         * @param data The data to store at the file's data node.
         * @param cb Passed an error or the Inode for the new file.
         */
        commitNewFile(tx, p, type, mode, data, cb) {
            const parentDir = path.dirname(p), fname = path.basename(p), currTime = (new Date()).getTime();
            // Invariant: The root always exists.
            // If we don't check this prior to taking steps below, we will create a
            // file with name '' in root should p == '/'.
            if (p === '/') {
                return cb(ApiError.EEXIST(p));
            }
            // Let's build a pyramid of code!
            // Step 1: Get the parent directory's inode and directory listing
            this.findINodeAndDirListing(tx, parentDir, (e, parentNode, dirListing) => {
                if (noErrorTx(e, tx, cb)) {
                    if (dirListing[fname]) {
                        // File already exists.
                        tx.abort(() => {
                            cb(ApiError.EEXIST(p));
                        });
                    }
                    else {
                        // Step 2: Commit data to store.
                        this.addNewNode(tx, data, (e, dataId) => {
                            if (noErrorTx(e, tx, cb)) {
                                // Step 3: Commit the file's inode to the store.
                                const fileInode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime);
                                this.addNewNode(tx, fileInode.toBuffer(), (e, fileInodeId) => {
                                    if (noErrorTx(e, tx, cb)) {
                                        // Step 4: Update parent directory's listing.
                                        dirListing[fname] = fileInodeId;
                                        tx.put(parentNode.id, Buffer.from(JSON.stringify(dirListing)), true, (e) => {
                                            if (noErrorTx(e, tx, cb)) {
                                                // Step 5: Commit and return the new inode.
                                                tx.commit((e) => {
                                                    if (noErrorTx(e, tx, cb)) {
                                                        cb(null, fileInode);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
        /**
         * Remove all traces of the given path from the file system.
         * @param p The path to remove from the file system.
         * @param isDir Does the path belong to a directory, or a file?
         * @todo Update mtime.
         */
        removeEntry(p, isDir, cb) {
            // Eagerly delete from cache (harmless even if removal fails)
            if (this._cache) {
                this._cache.remove(p);
            }
            const tx = this.store.beginTransaction('readwrite'), parent = path.dirname(p), fileName = path.basename(p);
            // Step 1: Get parent directory's node and directory listing.
            this.findINodeAndDirListing(tx, parent, (e, parentNode, parentListing) => {
                if (noErrorTx(e, tx, cb)) {
                    if (!parentListing[fileName]) {
                        tx.abort(() => {
                            cb(ApiError.ENOENT(p));
                        });
                    }
                    else {
                        // Remove from directory listing of parent.
                        const fileNodeId = parentListing[fileName];
                        delete parentListing[fileName];
                        // Step 2: Get file inode.
                        this.getINode(tx, p, fileNodeId, (e, fileNode) => {
                            if (noErrorTx(e, tx, cb)) {
                                if (!isDir && fileNode.isDirectory()) {
                                    tx.abort(() => {
                                        cb(ApiError.EISDIR(p));
                                    });
                                }
                                else if (isDir && !fileNode.isDirectory()) {
                                    tx.abort(() => {
                                        cb(ApiError.ENOTDIR(p));
                                    });
                                }
                                else {
                                    // Step 3: Delete data.
                                    tx.del(fileNode.id, (e) => {
                                        if (noErrorTx(e, tx, cb)) {
                                            // Step 4: Delete node.
                                            tx.del(fileNodeId, (e) => {
                                                if (noErrorTx(e, tx, cb)) {
                                                    // Step 5: Update directory listing.
                                                    tx.put(parentNode.id, Buffer.from(JSON.stringify(parentListing)), true, (e) => {
                                                        if (noErrorTx(e, tx, cb)) {
                                                            tx.commit(cb);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    }


    return {
        SimpleSyncRWTransaction: SimpleSyncRWTransaction,
        SyncKeyValueFile: SyncKeyValueFile,
        SyncKeyValueFileSystem: SyncKeyValueFileSystem,
        AsyncKeyValueFile: AsyncKeyValueFile,
        AsyncKeyValueFileSystem: AsyncKeyValueFileSystem
    };
});
define('skylark-browserfs/backend/InMemory',['../generic/key_value_filesystem'], function (key_value_filesystem) {
    'use strict';

    const { SimpleSyncRWTransaction, SyncKeyValueFileSystem } = key_value_filesystem;
    /**
     * A simple in-memory key-value store backed by a JavaScript object.
     */
    class InMemoryStore {
        constructor() {
            this.store = {};
        }
        name() { return InMemoryFileSystem.Name; }
        clear() { this.store = {}; }
        beginTransaction(type) {
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            return this.store[key];
        }
        put(key, data, overwrite) {
            if (!overwrite && this.store.hasOwnProperty(key)) {
                return false;
            }
            this.store[key] = data;
            return true;
        }
        del(key) {
            delete this.store[key];
        }
    }
    /**
     * A simple in-memory file system backed by an InMemoryStore.
     * Files are not persisted across page loads.
     */
    class InMemoryFileSystem extends SyncKeyValueFileSystem {
        constructor() {
            super({ store: new InMemoryStore() });
        }
        /**
         * Creates an InMemoryFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new InMemoryFileSystem());
        }
    }
    InMemoryFileSystem.Name = "InMemory";
    InMemoryFileSystem.Options = {};

    InMemoryFileSystem.InMemoryStore = InMemoryStore;

    return InMemoryFileSystem;
});
define('skylark-browserfs/backend/IndexedDB',[
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global',
    '../core/util'
], function (key_value_filesystem, api_error, global, util) {
    'use strict';
    const { AsyncKeyValueFileSystem } =  key_value_filesystem;
    const { ApiError, ErrorCode }  = api_error;
    const { arrayBuffer2Buffer, buffer2ArrayBuffer }  = util;

    /**
     * Get the indexedDB constructor for the current browser.
     * @hidden
     */
    const indexedDB = global.indexedDB ||
        global.mozIndexedDB ||
        global.webkitIndexedDB ||
        global.msIndexedDB;
    /**
     * Converts a DOMException or a DOMError from an IndexedDB event into a
     * standardized BrowserFS API error.
     * @hidden
     */
    function convertError(e, message = e.toString()) {
        switch (e.name) {
            case "NotFoundError":
                return new ApiError(ErrorCode.ENOENT, message);
            case "QuotaExceededError":
                return new ApiError(ErrorCode.ENOSPC, message);
            default:
                // The rest do not seem to map cleanly to standard error codes.
                return new ApiError(ErrorCode.EIO, message);
        }
    }
    /**
     * Produces a new onerror handler for IDB. Our errors are always fatal, so we
     * handle them generically: Call the user-supplied callback with a translated
     * version of the error, and let the error bubble up.
     * @hidden
     */
    function onErrorHandler(cb, code = ErrorCode.EIO, message = null) {
        return function (e) {
            // Prevent the error from canceling the transaction.
            e.preventDefault();
            cb(new ApiError(code, message !== null ? message : undefined));
        };
    }
    /**
     * @hidden
     */
    class IndexedDBROTransaction {
        constructor(tx, store) {
            this.tx = tx;
            this.store = store;
        }
        get(key, cb) {
            try {
                const r = this.store.get(key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    // IDB returns the value 'undefined' when you try to get keys that
                    // don't exist. The caller expects this behavior.
                    const result = event.target.result;
                    if (result === undefined) {
                        cb(null, result);
                    }
                    else {
                        // IDB data is stored as an ArrayBuffer
                        cb(null, arrayBuffer2Buffer(result));
                    }
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
    }
    /**
     * @hidden
     */
    class IndexedDBRWTransaction extends IndexedDBROTransaction {
        constructor(tx, store) {
            super(tx, store);
        }
        put(key, data, overwrite, cb) {
            try {
                const arraybuffer = buffer2ArrayBuffer(data);
                let r;
                // Note: 'add' will never overwrite an existing key.
                r = overwrite ? this.store.put(arraybuffer, key) : this.store.add(arraybuffer, key);
                // XXX: NEED TO RETURN FALSE WHEN ADD HAS A KEY CONFLICT. NO ERROR.
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb(null, true);
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        del(key, cb) {
            try {
                // NOTE: IE8 has a bug with identifiers named 'delete' unless used as a string
                // like this.
                // http://stackoverflow.com/a/26479152
                const r = this.store['delete'](key);
                r.onerror = onErrorHandler(cb);
                r.onsuccess = (event) => {
                    cb();
                };
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        commit(cb) {
            // Return to the event loop to commit the transaction.
            setTimeout(cb, 0);
        }
        abort(cb) {
            let _e = null;
            try {
                this.tx.abort();
            }
            catch (e) {
                _e = convertError(e);
            }
            finally {
                cb(_e);
            }
        }
    }
    class IndexedDBStore {
        constructor(db, storeName) {
            this.db = db;
            this.storeName = storeName;
        }
        static Create(storeName, cb) {
            const openReq = indexedDB.open(storeName, 1);
            openReq.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Huh. This should never happen; we're at version 1. Why does another
                // database exist?
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                }
                db.createObjectStore(storeName);
            };
            openReq.onsuccess = (event) => {
                cb(null, new IndexedDBStore(event.target.result, storeName));
            };
            openReq.onerror = onErrorHandler(cb, ErrorCode.EACCES);
        }
        name() {
            return IndexedDBFileSystem.Name + " - " + this.storeName;
        }
        clear(cb) {
            try {
                const tx = this.db.transaction(this.storeName, 'readwrite'), objectStore = tx.objectStore(this.storeName), r = objectStore.clear();
                r.onsuccess = (event) => {
                    // Use setTimeout to commit transaction.
                    setTimeout(cb, 0);
                };
                r.onerror = onErrorHandler(cb);
            }
            catch (e) {
                cb(convertError(e));
            }
        }
        beginTransaction(type = 'readonly') {
            const tx = this.db.transaction(this.storeName, type), objectStore = tx.objectStore(this.storeName);
            if (type === 'readwrite') {
                return new IndexedDBRWTransaction(tx, objectStore);
            }
            else if (type === 'readonly') {
                return new IndexedDBROTransaction(tx, objectStore);
            }
            else {
                throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
            }
        }
    }
    /**
     * A file system that uses the IndexedDB key value file system.
     */
    class IndexedDBFileSystem extends AsyncKeyValueFileSystem {
        constructor(cacheSize) {
            super(cacheSize);
        }
        /**
         * Constructs an IndexedDB file system with the given options.
         */
        static Create(opts = {}, cb) {
            IndexedDBStore.Create(opts.storeName ? opts.storeName : 'browserfs', (e, store) => {
                if (store) {
                    const idbfs = new IndexedDBFileSystem(typeof (opts.cacheSize) === 'number' ? opts.cacheSize : 100);
                    idbfs.init(store, (e) => {
                        if (e) {
                            cb(e);
                        }
                        else {
                            cb(null, idbfs);
                        }
                    });
                }
                else {
                    cb(e);
                }
            });
        }
        static isAvailable() {
            // In Safari's private browsing mode, indexedDB.open returns NULL.
            // In Firefox, it throws an exception.
            // In Chrome, it "just works", and clears the database when you leave the page.
            // Untested: Opera, IE.
            try {
                return typeof indexedDB !== 'undefined' && null !== indexedDB.open("__browserfs_test__");
            }
            catch (e) {
                return false;
            }
        }
    }
    IndexedDBFileSystem.Name = "IndexedDB";
    IndexedDBFileSystem.Options = {
        storeName: {
            type: "string",
            optional: true,
            description: "The name of this file system. You can have multiple IndexedDB file systems operating at once, but each must have a different name."
        },
        cacheSize: {
            type: "number",
            optional: true,
            description: "The size of the inode cache. Defaults to 100. A size of 0 or below disables caching."
        }
    };


    IndexedDBFileSystem.IndexedDBROTransaction = IndexedDBROTransaction;
    IndexedDBFileSystem.IndexedDBRWTransaction = IndexedDBRWTransaction;
    IndexedDBFileSystem.IndexedDBStore = IndexedDBStore;

    return IndexedDBFileSystem;
});
define('skylark-browserfs/backend/LocalStorage',[
    '../libs/buffers',
    '../generic/key_value_filesystem',
    '../core/api_error',
    '../core/global'
], function (buffers,key_value_filesystem, api_error, global) {
    'use strict';

    const { SyncKeyValueFileSystem, SimpleSyncRWTransaction } = key_value_filesystem;
    const { ApiError, ErrorCode } = api_error;

    const { Buffer} = buffers;

    /**
     * Some versions of FF and all versions of IE do not support the full range of
     * 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
     * @url http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
     * @hidden
     */
    let supportsBinaryString = false, binaryEncoding;
    try {
        global.localStorage.setItem("__test__", String.fromCharCode(0xD800));
        supportsBinaryString = global.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
    }
    catch (e) {
        // IE throws an exception.
        supportsBinaryString = false;
    }
    binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';
    if (!Buffer.isEncoding(binaryEncoding)) {
        // Fallback for non BrowserFS implementations of buffer that lack a
        // binary_string format.
        binaryEncoding = "base64";
    }
    /**
     * A synchronous key-value store backed by localStorage.
     */
    class LocalStorageStore {
        name() {
            return LocalStorageFileSystem.Name;
        }
        clear() {
            global.localStorage.clear();
        }
        beginTransaction(type) {
            // No need to differentiate.
            return new SimpleSyncRWTransaction(this);
        }
        get(key) {
            try {
                const data = global.localStorage.getItem(key);
                if (data !== null) {
                    return Buffer.from(data, binaryEncoding);
                }
            }
            catch (e) {
                // Do nothing.
            }
            // Key doesn't exist, or a failure occurred.
            return undefined;
        }
        put(key, data, overwrite) {
            try {
                if (!overwrite && global.localStorage.getItem(key) !== null) {
                    // Don't want to overwrite the key!
                    return false;
                }
                global.localStorage.setItem(key, data.toString(binaryEncoding));
                return true;
            }
            catch (e) {
                throw new ApiError(ErrorCode.ENOSPC, "LocalStorage is full.");
            }
        }
        del(key) {
            try {
                global.localStorage.removeItem(key);
            }
            catch (e) {
                throw new ApiError(ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
            }
        }
    }
    /**
     * A synchronous file system backed by localStorage. Connects our
     * LocalStorageStore to our SyncKeyValueFileSystem.
     */
    class LocalStorageFileSystem extends SyncKeyValueFileSystem {
        /**
         * Creates a new LocalStorage file system using the contents of `localStorage`.
         */
        constructor() { super({ store: new LocalStorageStore() }); }
        /**
         * Creates a LocalStorageFileSystem instance.
         */
        static Create(options, cb) {
            cb(null, new LocalStorageFileSystem());
        }
        static isAvailable() {
            return typeof global.localStorage !== 'undefined';
        }
    }
    LocalStorageFileSystem.Name = "LocalStorage";
    LocalStorageFileSystem.Options = {};
    
    LocalStorageFileSystem.LocalStorageStore = LocalStorageStore;

    return LocalStorageFileSystem;
});
define('skylark-browserfs/backend/MountableFileSystem',[
    '../core/file_system',
    './InMemory',
    '../core/api_error',
    '../core/node_fs',
    '../libs/path',
    '../core/util'
], function (file_system, InMemory, api_error, fs, path, util) {
    'use strict';
    const { BaseFileSystem } = file_system;
    const {InMemoryFileSystem}  = InMemory;
    const { ApiError, ErrorCode }  = api_error;
    const { mkdirpSync }  = util;

    /**
     * The MountableFileSystem allows you to mount multiple backend types or
     * multiple instantiations of the same backend into a single file system tree.
     * The file systems do not need to know about each other; all interactions are
     * automatically facilitated through this interface.
     *
     * For example, if a file system is mounted at /mnt/blah, and a request came in
     * for /mnt/blah/foo.txt, the file system would see a request for /foo.txt.
     *
     * You can mount file systems when you configure the file system:
     * ```javascript
     * BrowserFS.configure({
     *   fs: "MountableFileSystem",
     *   options: {
     *     '/data': { fs: 'HTTPRequest', options: { index: "http://mysite.com/files/index.json" } },
     *     '/home': { fs: 'LocalStorage' }
     *   }
     * }, function(e) {
     *
     * });
     * ```
     *
     * For advanced users, you can also mount file systems *after* MFS is constructed:
     * ```javascript
     * BrowserFS.FileSystem.HTTPRequest.Create({
     *   index: "http://mysite.com/files/index.json"
     * }, function(e, xhrfs) {
     *   BrowserFS.FileSystem.MountableFileSystem.Create({
     *     '/data': xhrfs
     *   }, function(e, mfs) {
     *     BrowserFS.initialize(mfs);
     *
     *     // Added after-the-fact...
     *     BrowserFS.FileSystem.LocalStorage.Create(function(e, lsfs) {
     *       mfs.mount('/home', lsfs);
     *     });
     *   });
     * });
     * ```
     *
     * Since MountableFileSystem simply proxies requests to mounted file systems, it supports all of the operations that the mounted file systems support.
     *
     * With no mounted file systems, `MountableFileSystem` acts as a simple `InMemory` filesystem.
     */
    class MountableFileSystem extends BaseFileSystem {
        /**
         * Creates a new, empty MountableFileSystem.
         */
        constructor(rootFs) {
            super();
            // Contains the list of mount points in mntMap, sorted by string length in decreasing order.
            // Ensures that we scan the most specific mount points for a match first, which lets us
            // nest mount points.
            this.mountList = [];
            this.mntMap = {};
            this.rootFs = rootFs;
        }
        /**
         * Creates a MountableFileSystem instance with the given options.
         */
        static Create(opts, cb) {
            InMemoryFileSystem.Create({}, (e, imfs) => {
                if (imfs) {
                    const fs = new MountableFileSystem(imfs);
                    try {
                        Object.keys(opts).forEach((mountPoint) => {
                            fs.mount(mountPoint, opts[mountPoint]);
                        });
                    }
                    catch (e) {
                        return cb(e);
                    }
                    cb(null, fs);
                }
                else {
                    cb(e);
                }
            });
        }
        static isAvailable() {
            return true;
        }
        /**
         * Mounts the file system at the given mount point.
         */
        mount(mountPoint, fs) {
            if (mountPoint[0] !== '/') {
                mountPoint = `/${mountPoint}`;
            }
            mountPoint = path.resolve(mountPoint);
            if (this.mntMap[mountPoint]) {
                throw new ApiError(ErrorCode.EINVAL, "Mount point " + mountPoint + " is already taken.");
            }
            mkdirpSync(mountPoint, 0x1ff, this.rootFs);
            this.mntMap[mountPoint] = fs;
            this.mountList.push(mountPoint);
            this.mountList = this.mountList.sort((a, b) => b.length - a.length);
        }
        umount(mountPoint) {
            if (mountPoint[0] !== '/') {
                mountPoint = `/${mountPoint}`;
            }
            mountPoint = path.resolve(mountPoint);
            if (!this.mntMap[mountPoint]) {
                throw new ApiError(ErrorCode.EINVAL, "Mount point " + mountPoint + " is already unmounted.");
            }
            delete this.mntMap[mountPoint];
            this.mountList.splice(this.mountList.indexOf(mountPoint), 1);
            while (mountPoint !== '/') {
                if (this.rootFs.readdirSync(mountPoint).length === 0) {
                    this.rootFs.rmdirSync(mountPoint);
                    mountPoint = path.dirname(mountPoint);
                }
                else {
                    break;
                }
            }
        }
        /**
         * Returns the file system that the path points to.
         */
        _getFs(path) {
            const mountList = this.mountList, len = mountList.length;
            for (let i = 0; i < len; i++) {
                const mountPoint = mountList[i];
                // We know path is normalized, so it is a substring of the mount point.
                if (mountPoint.length <= path.length && path.indexOf(mountPoint) === 0) {
                    path = path.substr(mountPoint.length > 1 ? mountPoint.length : 0);
                    if (path === '') {
                        path = '/';
                    }
                    return { fs: this.mntMap[mountPoint], path: path, mountPoint: mountPoint };
                }
            }
            // Query our root file system.
            return { fs: this.rootFs, path: path, mountPoint: '/' };
        }
        // Global information methods
        getName() {
            return MountableFileSystem.Name;
        }
        diskSpace(path, cb) {
            cb(0, 0);
        }
        isReadOnly() {
            return false;
        }
        supportsLinks() {
            // I'm not ready for cross-FS links yet.
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return true;
        }
        /**
         * Fixes up error messages so they mention the mounted file location relative
         * to the MFS root, not to the particular FS's root.
         * Mutates the input error, and returns it.
         */
        standardizeError(err, path, realPath) {
            const index = err.message.indexOf(path);
            if (index !== -1) {
                err.message = err.message.substr(0, index) + realPath + err.message.substr(index + path.length);
                err.path = realPath;
            }
            return err;
        }
        // The following methods involve multiple file systems, and thus have custom
        // logic.
        // Note that we go through the Node API to use its robust default argument
        // processing.
        rename(oldPath, newPath, cb) {
            // Scenario 1: old and new are on same FS.
            const fs1rv = this._getFs(oldPath);
            const fs2rv = this._getFs(newPath);
            if (fs1rv.fs === fs2rv.fs) {
                return fs1rv.fs.rename(fs1rv.path, fs2rv.path, (e) => {
                    if (e) {
                        this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                    }
                    cb(e);
                });
            }
            // Scenario 2: Different file systems.
            // Read old file, write new file, delete old file.
            return fs.readFile(oldPath, function (err, data) {
                if (err) {
                    return cb(err);
                }
                fs.writeFile(newPath, data, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    fs.unlink(oldPath, cb);
                });
            });
        }
        renameSync(oldPath, newPath) {
            // Scenario 1: old and new are on same FS.
            const fs1rv = this._getFs(oldPath);
            const fs2rv = this._getFs(newPath);
            if (fs1rv.fs === fs2rv.fs) {
                try {
                    return fs1rv.fs.renameSync(fs1rv.path, fs2rv.path);
                }
                catch (e) {
                    this.standardizeError(this.standardizeError(e, fs1rv.path, oldPath), fs2rv.path, newPath);
                    throw e;
                }
            }
            // Scenario 2: Different file systems.
            const data = fs.readFileSync(oldPath);
            fs.writeFileSync(newPath, data);
            return fs.unlinkSync(oldPath);
        }
        readdirSync(p) {
            const fsInfo = this._getFs(p);
            // If null, rootfs did not have the directory
            // (or the target FS is the root fs).
            let rv = null;
            // Mount points are all defined in the root FS.
            // Ensure that we list those, too.
            if (fsInfo.fs !== this.rootFs) {
                try {
                    rv = this.rootFs.readdirSync(p);
                }
                catch (e) {
                    // Ignore.
                }
            }
            try {
                const rv2 = fsInfo.fs.readdirSync(fsInfo.path);
                if (rv === null) {
                    return rv2;
                }
                else {
                    // Filter out duplicates.
                    return rv2.concat(rv.filter((val) => rv2.indexOf(val) === -1));
                }
            }
            catch (e) {
                if (rv === null) {
                    throw this.standardizeError(e, fsInfo.path, p);
                }
                else {
                    // The root FS had something.
                    return rv;
                }
            }
        }
        readdir(p, cb) {
            const fsInfo = this._getFs(p);
            fsInfo.fs.readdir(fsInfo.path, (err, files) => {
                if (fsInfo.fs !== this.rootFs) {
                    try {
                        const rv = this.rootFs.readdirSync(p);
                        if (files) {
                            // Filter out duplicates.
                            files = files.concat(rv.filter((val) => files.indexOf(val) === -1));
                        }
                        else {
                            files = rv;
                        }
                    }
                    catch (e) {
                        // Root FS and target FS did not have directory.
                        if (err) {
                            return cb(this.standardizeError(err, fsInfo.path, p));
                        }
                    }
                }
                else if (err) {
                    // Root FS and target FS are the same, and did not have directory.
                    return cb(this.standardizeError(err, fsInfo.path, p));
                }
                cb(null, files);
            });
        }
        realpathSync(p, cache) {
            const fsInfo = this._getFs(p);
            try {
                const mountedPath = fsInfo.fs.realpathSync(fsInfo.path, {});
                // resolve is there to remove any trailing slash that may be present
                return path.resolve(path.join(fsInfo.mountPoint, mountedPath));
            }
            catch (e) {
                throw this.standardizeError(e, fsInfo.path, p);
            }
        }
        realpath(p, cache, cb) {
            const fsInfo = this._getFs(p);
            fsInfo.fs.realpath(fsInfo.path, {}, (err, rv) => {
                if (err) {
                    cb(this.standardizeError(err, fsInfo.path, p));
                }
                else {
                    // resolve is there to remove any trailing slash that may be present
                    cb(null, path.resolve(path.join(fsInfo.mountPoint, rv)));
                }
            });
        }
        rmdirSync(p) {
            const fsInfo = this._getFs(p);
            if (this._containsMountPt(p)) {
                throw ApiError.ENOTEMPTY(p);
            }
            else {
                try {
                    fsInfo.fs.rmdirSync(fsInfo.path);
                }
                catch (e) {
                    throw this.standardizeError(e, fsInfo.path, p);
                }
            }
        }
        rmdir(p, cb) {
            const fsInfo = this._getFs(p);
            if (this._containsMountPt(p)) {
                cb(ApiError.ENOTEMPTY(p));
            }
            else {
                fsInfo.fs.rmdir(fsInfo.path, (err) => {
                    cb(err ? this.standardizeError(err, fsInfo.path, p) : null);
                });
            }
        }
        /**
         * Returns true if the given path contains a mount point.
         */
        _containsMountPt(p) {
            const mountPoints = this.mountList, len = mountPoints.length;
            for (let i = 0; i < len; i++) {
                const pt = mountPoints[i];
                if (pt.length >= p.length && pt.slice(0, p.length) === p) {
                    return true;
                }
            }
            return false;
        }
    }
    MountableFileSystem.Name = "MountableFileSystem";
    MountableFileSystem.Options = {};
    /**
     * Tricky: Define all of the functions that merely forward arguments to the
     * relevant file system, or return/throw an error.
     * Take advantage of the fact that the *first* argument is always the path, and
     * the *last* is the callback function (if async).
     * @todo Can use numArgs to make proxying more efficient.
     * @hidden
     */
    function defineFcn(name, isSync, numArgs) {
        if (isSync) {
            return function (...args) {
                const path = args[0];
                const rv = this._getFs(path);
                args[0] = rv.path;
                try {
                    return rv.fs[name].apply(rv.fs, args);
                }
                catch (e) {
                    this.standardizeError(e, rv.path, path);
                    throw e;
                }
            };
        }
        else {
            return function (...args) {
                const path = args[0];
                const rv = this._getFs(path);
                args[0] = rv.path;
                if (typeof args[args.length - 1] === 'function') {
                    const cb = args[args.length - 1];
                    args[args.length - 1] = (...args) => {
                        if (args.length > 0 && args[0] instanceof ApiError) {
                            this.standardizeError(args[0], rv.path, path);
                        }
                        cb.apply(null, args);
                    };
                }
                return rv.fs[name].apply(rv.fs, args);
            };
        }
    }
    /**
     * @hidden
     */
    const fsCmdMap = [
        // 1 arg functions
        ['exists', 'unlink', 'readlink'],
        // 2 arg functions
        ['stat', 'mkdir', 'truncate'],
        // 3 arg functions
        ['open', 'readFile', 'chmod', 'utimes'],
        // 4 arg functions
        ['chown'],
        // 5 arg functions
        ['writeFile', 'appendFile']
    ];
    for (let i = 0; i < fsCmdMap.length; i++) {
        const cmds = fsCmdMap[i];
        for (const fnName of cmds) {
            MountableFileSystem.prototype[fnName] = defineFcn(fnName, false, i + 1);
            MountableFileSystem.prototype[fnName + 'Sync'] = defineFcn(fnName + 'Sync', true, i + 1);
        }
    }


    return MountableFileSystem;
});
define('skylark-browserfs/generic/mutex',['../generic/setImmediate'], function (setImmediate) {
    'use strict';
    /**
     * Non-recursive mutex
     * @hidden
     */
    class Mutex {
        constructor() {
            this._locked = false;
            this._waiters = [];
        }
        lock(cb) {
            if (this._locked) {
                this._waiters.push(cb);
                return;
            }
            this._locked = true;
            cb();
        }
        unlock() {
            if (!this._locked) {
                throw new Error('unlock of a non-locked mutex');
            }
            const next = this._waiters.shift();
            // don't unlock - we want to queue up next for the
            // _end_ of the current task execution, but we don't
            // want it to be called inline with whatever the
            // current stack is.  This way we still get the nice
            // behavior that an unlock immediately followed by a
            // lock won't cause starvation.
            if (next) {
                setImmediate(next);
                return;
            }
            this._locked = false;
        }
        tryLock() {
            if (this._locked) {
                return false;
            }
            this._locked = true;
            return true;
        }
        isLocked() {
            return this._locked;
        }
    }

    return Mutex;
});
define('skylark-browserfs/generic/locked_fs',['./mutex'], function (Mutex) {
    'use strict';
    /**
     * This class serializes access to an underlying async filesystem.
     * For example, on an OverlayFS instance with an async lower
     * directory operations like rename and rmdir may involve multiple
     * requests involving both the upper and lower filesystems -- they
     * are not executed in a single atomic step.  OverlayFS uses this
     * LockedFS to avoid having to reason about the correctness of
     * multiple requests interleaving.
     */
    class LockedFS {
        constructor(fs) {
            this._fs = fs;
            this._mu = new Mutex();
        }
        getName() {
            return 'LockedFS<' + this._fs.getName() + '>';
        }
        getFSUnlocked() {
            return this._fs;
        }
        diskSpace(p, cb) {
            // FIXME: should this lock?
            this._fs.diskSpace(p, cb);
        }
        isReadOnly() {
            return this._fs.isReadOnly();
        }
        supportsLinks() {
            return this._fs.supportsLinks();
        }
        supportsProps() {
            return this._fs.supportsProps();
        }
        supportsSynch() {
            return this._fs.supportsSynch();
        }
        rename(oldPath, newPath, cb) {
            this._mu.lock(() => {
                this._fs.rename(oldPath, newPath, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        renameSync(oldPath, newPath) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.renameSync(oldPath, newPath);
        }
        stat(p, isLstat, cb) {
            this._mu.lock(() => {
                this._fs.stat(p, isLstat, (err, stat) => {
                    this._mu.unlock();
                    cb(err, stat);
                });
            });
        }
        statSync(p, isLstat) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.statSync(p, isLstat);
        }
        open(p, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.open(p, flag, mode, (err, fd) => {
                    this._mu.unlock();
                    cb(err, fd);
                });
            });
        }
        openSync(p, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.openSync(p, flag, mode);
        }
        unlink(p, cb) {
            this._mu.lock(() => {
                this._fs.unlink(p, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        unlinkSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.unlinkSync(p);
        }
        rmdir(p, cb) {
            this._mu.lock(() => {
                this._fs.rmdir(p, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        rmdirSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.rmdirSync(p);
        }
        mkdir(p, mode, cb) {
            this._mu.lock(() => {
                this._fs.mkdir(p, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        mkdirSync(p, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.mkdirSync(p, mode);
        }
        readdir(p, cb) {
            this._mu.lock(() => {
                this._fs.readdir(p, (err, files) => {
                    this._mu.unlock();
                    cb(err, files);
                });
            });
        }
        readdirSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readdirSync(p);
        }
        exists(p, cb) {
            this._mu.lock(() => {
                this._fs.exists(p, (exists) => {
                    this._mu.unlock();
                    cb(exists);
                });
            });
        }
        existsSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.existsSync(p);
        }
        realpath(p, cache, cb) {
            this._mu.lock(() => {
                this._fs.realpath(p, cache, (err, resolvedPath) => {
                    this._mu.unlock();
                    cb(err, resolvedPath);
                });
            });
        }
        realpathSync(p, cache) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.realpathSync(p, cache);
        }
        truncate(p, len, cb) {
            this._mu.lock(() => {
                this._fs.truncate(p, len, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        truncateSync(p, len) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.truncateSync(p, len);
        }
        readFile(fname, encoding, flag, cb) {
            this._mu.lock(() => {
                this._fs.readFile(fname, encoding, flag, (err, data) => {
                    this._mu.unlock();
                    cb(err, data);
                });
            });
        }
        readFileSync(fname, encoding, flag) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readFileSync(fname, encoding, flag);
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.writeFile(fname, data, encoding, flag, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        writeFileSync(fname, data, encoding, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.writeFileSync(fname, data, encoding, flag, mode);
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            this._mu.lock(() => {
                this._fs.appendFile(fname, data, encoding, flag, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        appendFileSync(fname, data, encoding, flag, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.appendFileSync(fname, data, encoding, flag, mode);
        }
        chmod(p, isLchmod, mode, cb) {
            this._mu.lock(() => {
                this._fs.chmod(p, isLchmod, mode, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        chmodSync(p, isLchmod, mode) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.chmodSync(p, isLchmod, mode);
        }
        chown(p, isLchown, uid, gid, cb) {
            this._mu.lock(() => {
                this._fs.chown(p, isLchown, uid, gid, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        chownSync(p, isLchown, uid, gid) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.chownSync(p, isLchown, uid, gid);
        }
        utimes(p, atime, mtime, cb) {
            this._mu.lock(() => {
                this._fs.utimes(p, atime, mtime, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        utimesSync(p, atime, mtime) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.utimesSync(p, atime, mtime);
        }
        link(srcpath, dstpath, cb) {
            this._mu.lock(() => {
                this._fs.link(srcpath, dstpath, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        linkSync(srcpath, dstpath) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.linkSync(srcpath, dstpath);
        }
        symlink(srcpath, dstpath, type, cb) {
            this._mu.lock(() => {
                this._fs.symlink(srcpath, dstpath, type, (err) => {
                    this._mu.unlock();
                    cb(err);
                });
            });
        }
        symlinkSync(srcpath, dstpath, type) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.symlinkSync(srcpath, dstpath, type);
        }
        readlink(p, cb) {
            this._mu.lock(() => {
                this._fs.readlink(p, (err, linkString) => {
                    this._mu.unlock();
                    cb(err, linkString);
                });
            });
        }
        readlinkSync(p) {
            if (this._mu.isLocked()) {
                throw new Error('invalid sync call');
            }
            return this._fs.readlinkSync(p);
        }
    }

    return LockedFS;
});
define('skylark-browserfs/backend/OverlayFS',[
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../generic/locked_fs',
    '../libs/path'
], function (file_system, api_error, file_flag, node_fs_stats, preload_file, LockedFS, path) {

    'use strict';


    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { FileFlag, ActionType }  = file_flag;
    const { Stats }  = node_fs_stats;
    const {PreloadFile}  = preload_file;

    /**
     * @hidden
     */
    const deletionLogPath = '/.deletedFiles.log';
    /**
     * Given a read-only mode, makes it writable.
     * @hidden
     */
    function makeModeWritable(mode) {
        return 0o222 | mode;
    }
    /**
     * @hidden
     */
    function getFlag(f) {
        return FileFlag.getFileFlag(f);
    }
    /**
     * Overlays a RO file to make it writable.
     */
    class OverlayFile extends PreloadFile {
        constructor(fs, path, flag, stats, data) {
            super(fs, path, flag, stats, data);
        }
        sync(cb) {
            if (!this.isDirty()) {
                cb(null);
                return;
            }
            this._fs._syncAsync(this, (err) => {
                this.resetDirty();
                cb(err);
            });
        }
        syncSync() {
            if (this.isDirty()) {
                this._fs._syncSync(this);
                this.resetDirty();
            }
        }
        close(cb) {
            this.sync(cb);
        }
        closeSync() {
            this.syncSync();
        }
    }
    /**
     * *INTERNAL, DO NOT USE DIRECTLY!*
     *
     * Core OverlayFS class that contains no locking whatsoever. We wrap these objects
     * in a LockedFS to prevent races.
     */
    class UnlockedOverlayFS extends BaseFileSystem {
        constructor(writable, readable) {
            super();
            this._isInitialized = false;
            this._initializeCallbacks = [];
            this._deletedFiles = {};
            this._deleteLog = '';
            // If 'true', we have scheduled a delete log update.
            this._deleteLogUpdatePending = false;
            // If 'true', a delete log update is needed after the scheduled delete log
            // update finishes.
            this._deleteLogUpdateNeeded = false;
            // If there was an error updating the delete log...
            this._deleteLogError = null;
            this._writable = writable;
            this._readable = readable;
            if (this._writable.isReadOnly()) {
                throw new ApiError(ErrorCode.EINVAL, "Writable file system must be writable.");
            }
        }
        static isAvailable() {
            return true;
        }
        getOverlayedFileSystems() {
            return {
                readable: this._readable,
                writable: this._writable
            };
        }
        _syncAsync(file, cb) {
            this.createParentDirectoriesAsync(file.getPath(), (err) => {
                if (err) {
                    return cb(err);
                }
                this._writable.writeFile(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode, cb);
            });
        }
        _syncSync(file) {
            this.createParentDirectories(file.getPath());
            this._writable.writeFileSync(file.getPath(), file.getBuffer(), null, getFlag('w'), file.getStats().mode);
        }
        getName() {
            return OverlayFS.Name;
        }
        /**
         * **INTERNAL METHOD**
         *
         * Called once to load up metadata stored on the writable file system.
         */
        _initialize(cb) {
            const callbackArray = this._initializeCallbacks;
            const end = (e) => {
                this._isInitialized = !e;
                this._initializeCallbacks = [];
                callbackArray.forEach(((cb) => cb(e)));
            };
            // if we're already initialized, immediately invoke the callback
            if (this._isInitialized) {
                return cb();
            }
            callbackArray.push(cb);
            // The first call to initialize initializes, the rest wait for it to complete.
            if (callbackArray.length !== 1) {
                return;
            }
            // Read deletion log, process into metadata.
            this._writable.readFile(deletionLogPath, 'utf8', getFlag('r'), (err, data) => {
                if (err) {
                    // ENOENT === Newly-instantiated file system, and thus empty log.
                    if (err.errno !== ErrorCode.ENOENT) {
                        return end(err);
                    }
                }
                else {
                    this._deleteLog = data;
                }
                this._reparseDeletionLog();
                end();
            });
        }
        isReadOnly() { return false; }
        supportsSynch() { return this._readable.supportsSynch() && this._writable.supportsSynch(); }
        supportsLinks() { return false; }
        supportsProps() { return this._readable.supportsProps() && this._writable.supportsProps(); }
        getDeletionLog() {
            return this._deleteLog;
        }
        restoreDeletionLog(log) {
            this._deleteLog = log;
            this._reparseDeletionLog();
            this.updateLog('');
        }
        rename(oldPath, newPath, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(oldPath, cb) || this.checkPathAsync(newPath, cb)) {
                return;
            }
            if (oldPath === deletionLogPath || newPath === deletionLogPath) {
                return cb(ApiError.EPERM('Cannot rename deletion log.'));
            }
            // nothing to do if paths match
            if (oldPath === newPath) {
                return cb();
            }
            this.stat(oldPath, false, (oldErr, oldStats) => {
                if (oldErr) {
                    return cb(oldErr);
                }
                return this.stat(newPath, false, (newErr, newStats) => {
                    const self = this;
                    // precondition: both oldPath and newPath exist and are dirs.
                    // decreases: |files|
                    // Need to move *every file/folder* currently stored on
                    // readable to its new location on writable.
                    function copyDirContents(files) {
                        const file = files.shift();
                        if (!file) {
                            return cb();
                        }
                        const oldFile = path.resolve(oldPath, file);
                        const newFile = path.resolve(newPath, file);
                        // Recursion! Should work for any nested files / folders.
                        self.rename(oldFile, newFile, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            copyDirContents(files);
                        });
                    }
                    let mode = 0o777;
                    // from linux's rename(2) manpage: oldpath can specify a
                    // directory.  In this case, newpath must either not exist, or
                    // it must specify an empty directory.
                    if (oldStats.isDirectory()) {
                        if (newErr) {
                            if (newErr.errno !== ErrorCode.ENOENT) {
                                return cb(newErr);
                            }
                            return this._writable.exists(oldPath, (exists) => {
                                // simple case - both old and new are on the writable layer
                                if (exists) {
                                    return this._writable.rename(oldPath, newPath, cb);
                                }
                                this._writable.mkdir(newPath, mode, (mkdirErr) => {
                                    if (mkdirErr) {
                                        return cb(mkdirErr);
                                    }
                                    this._readable.readdir(oldPath, (err, files) => {
                                        if (err) {
                                            return cb();
                                        }
                                        copyDirContents(files);
                                    });
                                });
                            });
                        }
                        mode = newStats.mode;
                        if (!newStats.isDirectory()) {
                            return cb(ApiError.ENOTDIR(newPath));
                        }
                        this.readdir(newPath, (readdirErr, files) => {
                            if (files && files.length) {
                                return cb(ApiError.ENOTEMPTY(newPath));
                            }
                            this._readable.readdir(oldPath, (err, files) => {
                                if (err) {
                                    return cb();
                                }
                                copyDirContents(files);
                            });
                        });
                    }
                    if (newStats && newStats.isDirectory()) {
                        return cb(ApiError.EISDIR(newPath));
                    }
                    this.readFile(oldPath, null, getFlag('r'), (err, data) => {
                        if (err) {
                            return cb(err);
                        }
                        return this.writeFile(newPath, data, null, getFlag('w'), oldStats.mode, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            return this.unlink(oldPath, cb);
                        });
                    });
                });
            });
        }
        renameSync(oldPath, newPath) {
            this.checkInitialized();
            this.checkPath(oldPath);
            this.checkPath(newPath);
            if (oldPath === deletionLogPath || newPath === deletionLogPath) {
                throw ApiError.EPERM('Cannot rename deletion log.');
            }
            // Write newPath using oldPath's contents, delete oldPath.
            const oldStats = this.statSync(oldPath, false);
            if (oldStats.isDirectory()) {
                // Optimization: Don't bother moving if old === new.
                if (oldPath === newPath) {
                    return;
                }
                let mode = 0o777;
                if (this.existsSync(newPath)) {
                    const stats = this.statSync(newPath, false);
                    mode = stats.mode;
                    if (stats.isDirectory()) {
                        if (this.readdirSync(newPath).length > 0) {
                            throw ApiError.ENOTEMPTY(newPath);
                        }
                    }
                    else {
                        throw ApiError.ENOTDIR(newPath);
                    }
                }
                // Take care of writable first. Move any files there, or create an empty directory
                // if it doesn't exist.
                if (this._writable.existsSync(oldPath)) {
                    this._writable.renameSync(oldPath, newPath);
                }
                else if (!this._writable.existsSync(newPath)) {
                    this._writable.mkdirSync(newPath, mode);
                }
                // Need to move *every file/folder* currently stored on readable to its new location
                // on writable.
                if (this._readable.existsSync(oldPath)) {
                    this._readable.readdirSync(oldPath).forEach((name) => {
                        // Recursion! Should work for any nested files / folders.
                        this.renameSync(path.resolve(oldPath, name), path.resolve(newPath, name));
                    });
                }
            }
            else {
                if (this.existsSync(newPath) && this.statSync(newPath, false).isDirectory()) {
                    throw ApiError.EISDIR(newPath);
                }
                this.writeFileSync(newPath, this.readFileSync(oldPath, null, getFlag('r')), null, getFlag('w'), oldStats.mode);
            }
            if (oldPath !== newPath && this.existsSync(oldPath)) {
                this.unlinkSync(oldPath);
            }
        }
        stat(p, isLstat, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this._writable.stat(p, isLstat, (err, stat) => {
                if (err && err.errno === ErrorCode.ENOENT) {
                    if (this._deletedFiles[p]) {
                        cb(ApiError.ENOENT(p));
                    }
                    this._readable.stat(p, isLstat, (err, stat) => {
                        if (stat) {
                            // Make the oldStat's mode writable. Preserve the topmost
                            // part of the mode, which specifies if it is a file or a
                            // directory.
                            stat = Stats.clone(stat);
                            stat.mode = makeModeWritable(stat.mode);
                        }
                        cb(err, stat);
                    });
                }
                else {
                    cb(err, stat);
                }
            });
        }
        statSync(p, isLstat) {
            this.checkInitialized();
            try {
                return this._writable.statSync(p, isLstat);
            }
            catch (e) {
                if (this._deletedFiles[p]) {
                    throw ApiError.ENOENT(p);
                }
                const oldStat = Stats.clone(this._readable.statSync(p, isLstat));
                // Make the oldStat's mode writable. Preserve the topmost part of the
                // mode, which specifies if it is a file or a directory.
                oldStat.mode = makeModeWritable(oldStat.mode);
                return oldStat;
            }
        }
        open(p, flag, mode, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(p, cb)) {
                return;
            }
            this.stat(p, false, (err, stats) => {
                if (stats) {
                    switch (flag.pathExistsAction()) {
                        case ActionType.TRUNCATE_FILE:
                            return this.createParentDirectoriesAsync(p, (err) => {
                                if (err) {
                                    return cb(err);
                                }
                                this._writable.open(p, flag, mode, cb);
                            });
                        case ActionType.NOP:
                            return this._writable.exists(p, (exists) => {
                                if (exists) {
                                    this._writable.open(p, flag, mode, cb);
                                }
                                else {
                                    // at this point we know the stats object we got is from
                                    // the readable FS.
                                    stats = Stats.clone(stats);
                                    stats.mode = mode;
                                    this._readable.readFile(p, null, getFlag('r'), (readFileErr, data) => {
                                        if (readFileErr) {
                                            return cb(readFileErr);
                                        }
                                        if (stats.size === -1) {
                                            stats.size = data.length;
                                        }
                                        const f = new OverlayFile(this, p, flag, stats, data);
                                        cb(null, f);
                                    });
                                }
                            });
                        default:
                            return cb(ApiError.EEXIST(p));
                    }
                }
                else {
                    switch (flag.pathNotExistsAction()) {
                        case ActionType.CREATE_FILE:
                            return this.createParentDirectoriesAsync(p, (err) => {
                                if (err) {
                                    return cb(err);
                                }
                                return this._writable.open(p, flag, mode, cb);
                            });
                        default:
                            return cb(ApiError.ENOENT(p));
                    }
                }
            });
        }
        openSync(p, flag, mode) {
            this.checkInitialized();
            this.checkPath(p);
            if (p === deletionLogPath) {
                throw ApiError.EPERM('Cannot open deletion log.');
            }
            if (this.existsSync(p)) {
                switch (flag.pathExistsAction()) {
                    case ActionType.TRUNCATE_FILE:
                        this.createParentDirectories(p);
                        return this._writable.openSync(p, flag, mode);
                    case ActionType.NOP:
                        if (this._writable.existsSync(p)) {
                            return this._writable.openSync(p, flag, mode);
                        }
                        else {
                            // Create an OverlayFile.
                            const buf = this._readable.readFileSync(p, null, getFlag('r'));
                            const stats = Stats.clone(this._readable.statSync(p, false));
                            stats.mode = mode;
                            return new OverlayFile(this, p, flag, stats, buf);
                        }
                    default:
                        throw ApiError.EEXIST(p);
                }
            }
            else {
                switch (flag.pathNotExistsAction()) {
                    case ActionType.CREATE_FILE:
                        this.createParentDirectories(p);
                        return this._writable.openSync(p, flag, mode);
                    default:
                        throw ApiError.ENOENT(p);
                }
            }
        }
        unlink(p, cb) {
            if (!this.checkInitAsync(cb) || this.checkPathAsync(p, cb)) {
                return;
            }
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (writableExists) => {
                    if (writableExists) {
                        return this._writable.unlink(p, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            this.exists(p, (readableExists) => {
                                if (readableExists) {
                                    this.deletePath(p);
                                }
                                cb(null);
                            });
                        });
                    }
                    else {
                        // if this only exists on the readable FS, add it to the
                        // delete map.
                        this.deletePath(p);
                        cb(null);
                    }
                });
            });
        }
        unlinkSync(p) {
            this.checkInitialized();
            this.checkPath(p);
            if (this.existsSync(p)) {
                if (this._writable.existsSync(p)) {
                    this._writable.unlinkSync(p);
                }
                // if it still exists add to the delete log
                if (this.existsSync(p)) {
                    this.deletePath(p);
                }
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        rmdir(p, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            const rmdirLower = () => {
                this.readdir(p, (err, files) => {
                    if (err) {
                        return cb(err);
                    }
                    if (files.length) {
                        return cb(ApiError.ENOTEMPTY(p));
                    }
                    this.deletePath(p);
                    cb(null);
                });
            };
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (writableExists) => {
                    if (writableExists) {
                        this._writable.rmdir(p, (err) => {
                            if (err) {
                                return cb(err);
                            }
                            this._readable.exists(p, (readableExists) => {
                                if (readableExists) {
                                    rmdirLower();
                                }
                                else {
                                    cb();
                                }
                            });
                        });
                    }
                    else {
                        rmdirLower();
                    }
                });
            });
        }
        rmdirSync(p) {
            this.checkInitialized();
            if (this.existsSync(p)) {
                if (this._writable.existsSync(p)) {
                    this._writable.rmdirSync(p);
                }
                if (this.existsSync(p)) {
                    // Check if directory is empty.
                    if (this.readdirSync(p).length > 0) {
                        throw ApiError.ENOTEMPTY(p);
                    }
                    else {
                        this.deletePath(p);
                    }
                }
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        mkdir(p, mode, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.exists(p, (exists) => {
                if (exists) {
                    return cb(ApiError.EEXIST(p));
                }
                // The below will throw should any of the parent directories
                // fail to exist on _writable.
                this.createParentDirectoriesAsync(p, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    this._writable.mkdir(p, mode, cb);
                });
            });
        }
        mkdirSync(p, mode) {
            this.checkInitialized();
            if (this.existsSync(p)) {
                throw ApiError.EEXIST(p);
            }
            else {
                // The below will throw should any of the parent directories fail to exist
                // on _writable.
                this.createParentDirectories(p);
                this._writable.mkdirSync(p, mode);
            }
        }
        readdir(p, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.stat(p, false, (err, dirStats) => {
                if (err) {
                    return cb(err);
                }
                if (!dirStats.isDirectory()) {
                    return cb(ApiError.ENOTDIR(p));
                }
                this._writable.readdir(p, (err, wFiles) => {
                    if (err && err.code !== 'ENOENT') {
                        return cb(err);
                    }
                    else if (err || !wFiles) {
                        wFiles = [];
                    }
                    this._readable.readdir(p, (err, rFiles) => {
                        // if the directory doesn't exist on the lower FS set rFiles
                        // here to simplify the following code.
                        if (err || !rFiles) {
                            rFiles = [];
                        }
                        // Readdir in both, check delete log on read-only file system's files, merge, return.
                        const seenMap = {};
                        const filtered = wFiles.concat(rFiles.filter((fPath) => !this._deletedFiles[`${p}/${fPath}`])).filter((fPath) => {
                            // Remove duplicates.
                            const result = !seenMap[fPath];
                            seenMap[fPath] = true;
                            return result;
                        });
                        cb(null, filtered);
                    });
                });
            });
        }
        readdirSync(p) {
            this.checkInitialized();
            const dirStats = this.statSync(p, false);
            if (!dirStats.isDirectory()) {
                throw ApiError.ENOTDIR(p);
            }
            // Readdir in both, check delete log on RO file system's listing, merge, return.
            let contents = [];
            try {
                contents = contents.concat(this._writable.readdirSync(p));
            }
            catch (e) {
                // NOP.
            }
            try {
                contents = contents.concat(this._readable.readdirSync(p).filter((fPath) => !this._deletedFiles[`${p}/${fPath}`]));
            }
            catch (e) {
                // NOP.
            }
            const seenMap = {};
            return contents.filter((fileP) => {
                const result = !seenMap[fileP];
                seenMap[fileP] = true;
                return result;
            });
        }
        exists(p, cb) {
            // Cannot pass an error back to callback, so throw an exception instead
            // if not initialized.
            this.checkInitialized();
            this._writable.exists(p, (existsWritable) => {
                if (existsWritable) {
                    return cb(true);
                }
                this._readable.exists(p, (existsReadable) => {
                    cb(existsReadable && this._deletedFiles[p] !== true);
                });
            });
        }
        existsSync(p) {
            this.checkInitialized();
            return this._writable.existsSync(p) || (this._readable.existsSync(p) && this._deletedFiles[p] !== true);
        }
        chmod(p, isLchmod, mode, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.chmod(p, isLchmod, mode, cb);
                }
            });
        }
        chmodSync(p, isLchmod, mode) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.chmodSync(p, isLchmod, mode);
            });
        }
        chown(p, isLchmod, uid, gid, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.chown(p, isLchmod, uid, gid, cb);
                }
            });
        }
        chownSync(p, isLchown, uid, gid) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.chownSync(p, isLchown, uid, gid);
            });
        }
        utimes(p, atime, mtime, cb) {
            if (!this.checkInitAsync(cb)) {
                return;
            }
            this.operateOnWritableAsync(p, (err) => {
                if (err) {
                    return cb(err);
                }
                else {
                    this._writable.utimes(p, atime, mtime, cb);
                }
            });
        }
        utimesSync(p, atime, mtime) {
            this.checkInitialized();
            this.operateOnWritable(p, () => {
                this._writable.utimesSync(p, atime, mtime);
            });
        }
        deletePath(p) {
            this._deletedFiles[p] = true;
            this.updateLog(`d${p}\n`);
        }
        updateLog(addition) {
            this._deleteLog += addition;
            if (this._deleteLogUpdatePending) {
                this._deleteLogUpdateNeeded = true;
            }
            else {
                this._deleteLogUpdatePending = true;
                this._writable.writeFile(deletionLogPath, this._deleteLog, 'utf8', FileFlag.getFileFlag('w'), 0o644, (e) => {
                    this._deleteLogUpdatePending = false;
                    if (e) {
                        this._deleteLogError = e;
                    }
                    else if (this._deleteLogUpdateNeeded) {
                        this._deleteLogUpdateNeeded = false;
                        this.updateLog('');
                    }
                });
            }
        }
        _reparseDeletionLog() {
            this._deletedFiles = {};
            this._deleteLog.split('\n').forEach((path) => {
                // If the log entry begins w/ 'd', it's a deletion.
                this._deletedFiles[path.slice(1)] = path.slice(0, 1) === 'd';
            });
        }
        checkInitialized() {
            if (!this._isInitialized) {
                throw new ApiError(ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it.");
            }
            else if (this._deleteLogError !== null) {
                const e = this._deleteLogError;
                this._deleteLogError = null;
                throw e;
            }
        }
        checkInitAsync(cb) {
            if (!this._isInitialized) {
                cb(new ApiError(ErrorCode.EPERM, "OverlayFS is not initialized. Please initialize OverlayFS using its initialize() method before using it."));
                return false;
            }
            else if (this._deleteLogError !== null) {
                const e = this._deleteLogError;
                this._deleteLogError = null;
                cb(e);
                return false;
            }
            return true;
        }
        checkPath(p) {
            if (p === deletionLogPath) {
                throw ApiError.EPERM(p);
            }
        }
        checkPathAsync(p, cb) {
            if (p === deletionLogPath) {
                cb(ApiError.EPERM(p));
                return true;
            }
            return false;
        }
        createParentDirectoriesAsync(p, cb) {
            let parent = path.dirname(p);
            const toCreate = [];
            const self = this;
            this._writable.stat(parent, false, statDone);
            function statDone(err, stat) {
                if (err) {
                    if (parent === "/") {
                        cb(new ApiError(ErrorCode.EBUSY, "Invariant failed: root does not exist!"));
                    }
                    else {
                        toCreate.push(parent);
                        parent = path.dirname(parent);
                        self._writable.stat(parent, false, statDone);
                    }
                }
                else {
                    createParents();
                }
            }
            function createParents() {
                if (!toCreate.length) {
                    return cb();
                }
                const dir = toCreate.pop();
                self._readable.stat(dir, false, (err, stats) => {
                    // stop if we couldn't read the dir
                    if (!stats) {
                        return cb();
                    }
                    self._writable.mkdir(dir, stats.mode, (err) => {
                        if (err) {
                            return cb(err);
                        }
                        createParents();
                    });
                });
            }
        }
        /**
         * With the given path, create the needed parent directories on the writable storage
         * should they not exist. Use modes from the read-only storage.
         */
        createParentDirectories(p) {
            let parent = path.dirname(p), toCreate = [];
            while (!this._writable.existsSync(parent)) {
                toCreate.push(parent);
                parent = path.dirname(parent);
            }
            toCreate = toCreate.reverse();
            toCreate.forEach((p) => {
                this._writable.mkdirSync(p, this.statSync(p, false).mode);
            });
        }
        /**
         * Helper function:
         * - Ensures p is on writable before proceeding. Throws an error if it doesn't exist.
         * - Calls f to perform operation on writable.
         */
        operateOnWritable(p, f) {
            if (this.existsSync(p)) {
                if (!this._writable.existsSync(p)) {
                    // File is on readable storage. Copy to writable storage before
                    // changing its mode.
                    this.copyToWritable(p);
                }
                f();
            }
            else {
                throw ApiError.ENOENT(p);
            }
        }
        operateOnWritableAsync(p, cb) {
            this.exists(p, (exists) => {
                if (!exists) {
                    return cb(ApiError.ENOENT(p));
                }
                this._writable.exists(p, (existsWritable) => {
                    if (existsWritable) {
                        cb();
                    }
                    else {
                        return this.copyToWritableAsync(p, cb);
                    }
                });
            });
        }
        /**
         * Copy from readable to writable storage.
         * PRECONDITION: File does not exist on writable storage.
         */
        copyToWritable(p) {
            const pStats = this.statSync(p, false);
            if (pStats.isDirectory()) {
                this._writable.mkdirSync(p, pStats.mode);
            }
            else {
                this.writeFileSync(p, this._readable.readFileSync(p, null, getFlag('r')), null, getFlag('w'), this.statSync(p, false).mode);
            }
        }
        copyToWritableAsync(p, cb) {
            this.stat(p, false, (err, pStats) => {
                if (err) {
                    return cb(err);
                }
                if (pStats.isDirectory()) {
                    return this._writable.mkdir(p, pStats.mode, cb);
                }
                // need to copy file.
                this._readable.readFile(p, null, getFlag('r'), (err, data) => {
                    if (err) {
                        return cb(err);
                    }
                    this.writeFile(p, data, null, getFlag('w'), pStats.mode, cb);
                });
            });
        }
    }
    /**
     * OverlayFS makes a read-only filesystem writable by storing writes on a second,
     * writable file system. Deletes are persisted via metadata stored on the writable
     * file system.
     */
    class OverlayFS extends LockedFS {
        /**
         * @param writable The file system to write modified files to.
         * @param readable The file system that initially populates this file system.
         */
        constructor(writable, readable) {
            super(new UnlockedOverlayFS(writable, readable));
        }
        /**
         * Constructs and initializes an OverlayFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                const fs = new OverlayFS(opts.writable, opts.readable);
                fs._initialize((e) => {
                    cb(e, fs);
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return UnlockedOverlayFS.isAvailable();
        }
        getOverlayedFileSystems() {
            return super.getFSUnlocked().getOverlayedFileSystems();
        }
        unwrap() {
            return super.getFSUnlocked();
        }
        _initialize(cb) {
            super.getFSUnlocked()._initialize(cb);
        }
    }
    OverlayFS.Name = "OverlayFS";
    OverlayFS.Options = {
        writable: {
            type: "object",
            description: "The file system to write modified files to."
        },
        readable: {
            type: "object",
            description: "The file system that initially populates this file system."
        }
    };

    return OverlayFS;
});
define('skylark-browserfs/backend/WorkerFS',[
    '../libs/buffers',
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/util',
    '../core/file',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../core/global',
    '../core/node_fs'
], function (buffers,file_system, api_error, file_flag, util, file, node_fs_stats, preload_file, global, fs) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { FileFlag }  = file_flag;
    const { buffer2ArrayBuffer, arrayBuffer2Buffer, emptyBuffer }  = util;
    const { BaseFile }  = file;
    const { Stats }  = node_fs_stats;
    const {PreloadFile}  = preload_file;
    const { Buffer } = buffers;

    /**
     * @hidden
     */
    var SpecialArgType;
    (function (SpecialArgType) {
        // Callback
        SpecialArgType[SpecialArgType["CB"] = 0] = "CB";
        // File descriptor
        SpecialArgType[SpecialArgType["FD"] = 1] = "FD";
        // API error
        SpecialArgType[SpecialArgType["API_ERROR"] = 2] = "API_ERROR";
        // Stats object
        SpecialArgType[SpecialArgType["STATS"] = 3] = "STATS";
        // Initial probe for file system information.
        SpecialArgType[SpecialArgType["PROBE"] = 4] = "PROBE";
        // FileFlag object.
        SpecialArgType[SpecialArgType["FILEFLAG"] = 5] = "FILEFLAG";
        // Buffer object.
        SpecialArgType[SpecialArgType["BUFFER"] = 6] = "BUFFER";
        // Generic Error object.
        SpecialArgType[SpecialArgType["ERROR"] = 7] = "ERROR";
    })(SpecialArgType || (SpecialArgType = {}));
    /**
     * Converts callback arguments into ICallbackArgument objects, and back
     * again.
     * @hidden
     */
    class CallbackArgumentConverter {
        constructor() {
            this._callbacks = {};
            this._nextId = 0;
        }
        toRemoteArg(cb) {
            const id = this._nextId++;
            this._callbacks[id] = cb;
            return {
                type: SpecialArgType.CB,
                id: id
            };
        }
        toLocalArg(id) {
            const cb = this._callbacks[id];
            delete this._callbacks[id];
            return cb;
        }
    }
    /**
     * @hidden
     */
    class FileDescriptorArgumentConverter {
        constructor() {
            this._fileDescriptors = {};
            this._nextId = 0;
        }
        toRemoteArg(fd, p, flag, cb) {
            const id = this._nextId++;
            let data;
            let stat;
            this._fileDescriptors[id] = fd;
            // Extract needed information asynchronously.
            fd.stat((err, stats) => {
                if (err) {
                    cb(err);
                }
                else {
                    stat = bufferToTransferrableObject(stats.toBuffer());
                    // If it's a readable flag, we need to grab contents.
                    if (flag.isReadable()) {
                        fd.read(Buffer.alloc(stats.size), 0, stats.size, 0, (err, bytesRead, buff) => {
                            if (err) {
                                cb(err);
                            }
                            else {
                                data = bufferToTransferrableObject(buff);
                                cb(null, {
                                    type: SpecialArgType.FD,
                                    id: id,
                                    data: data,
                                    stat: stat,
                                    path: p,
                                    flag: flag.getFlagString()
                                });
                            }
                        });
                    }
                    else {
                        // File is not readable, which means writing to it will append or
                        // truncate/replace existing contents. Return an empty arraybuffer.
                        cb(null, {
                            type: SpecialArgType.FD,
                            id: id,
                            data: new ArrayBuffer(0),
                            stat: stat,
                            path: p,
                            flag: flag.getFlagString()
                        });
                    }
                }
            });
        }
        applyFdAPIRequest(request, cb) {
            const fdArg = request.args[0];
            this._applyFdChanges(fdArg, (err, fd) => {
                if (err) {
                    cb(err);
                }
                else {
                    // Apply method on now-changed file descriptor.
                    fd[request.method]((e) => {
                        if (request.method === 'close') {
                            delete this._fileDescriptors[fdArg.id];
                        }
                        cb(e);
                    });
                }
            });
        }
        _applyFdChanges(remoteFd, cb) {
            const fd = this._fileDescriptors[remoteFd.id], data = transferrableObjectToBuffer(remoteFd.data), remoteStats = Stats.fromBuffer(transferrableObjectToBuffer(remoteFd.stat));
            // Write data if the file is writable.
            const flag = FileFlag.getFileFlag(remoteFd.flag);
            if (flag.isWriteable()) {
                // Appendable: Write to end of file.
                // Writeable: Replace entire contents of file.
                fd.write(data, 0, data.length, flag.isAppendable() ? fd.getPos() : 0, (e) => {
                    function applyStatChanges() {
                        // Check if mode changed.
                        fd.stat((e, stats) => {
                            if (e) {
                                cb(e);
                            }
                            else {
                                if (stats.mode !== remoteStats.mode) {
                                    fd.chmod(remoteStats.mode, (e) => {
                                        cb(e, fd);
                                    });
                                }
                                else {
                                    cb(e, fd);
                                }
                            }
                        });
                    }
                    if (e) {
                        cb(e);
                    }
                    else {
                        // If writeable & not appendable, we need to ensure file contents are
                        // identical to those from the remote FD. Thus, we truncate to the
                        // length of the remote file.
                        if (!flag.isAppendable()) {
                            fd.truncate(data.length, () => {
                                applyStatChanges();
                            });
                        }
                        else {
                            applyStatChanges();
                        }
                    }
                });
            }
            else {
                cb(null, fd);
            }
        }
    }
    /**
     * @hidden
     */
    function apiErrorLocal2Remote(e) {
        return {
            type: SpecialArgType.API_ERROR,
            errorData: bufferToTransferrableObject(e.writeToBuffer())
        };
    }
    /**
     * @hidden
     */
    function apiErrorRemote2Local(e) {
        return ApiError.fromBuffer(transferrableObjectToBuffer(e.errorData));
    }
    /**
     * @hidden
     */
    function errorLocal2Remote(e) {
        return {
            type: SpecialArgType.ERROR,
            name: e.name,
            message: e.message,
            stack: e.stack
        };
    }
    /**
     * @hidden
     */
    function errorRemote2Local(e) {
        let cnstr = global[e.name];
        if (typeof (cnstr) !== 'function') {
            cnstr = Error;
        }
        const err = new cnstr(e.message);
        err.stack = e.stack;
        return err;
    }
    /**
     * @hidden
     */
    function statsLocal2Remote(stats) {
        return {
            type: SpecialArgType.STATS,
            statsData: bufferToTransferrableObject(stats.toBuffer())
        };
    }
    /**
     * @hidden
     */
    function statsRemote2Local(stats) {
        return Stats.fromBuffer(transferrableObjectToBuffer(stats.statsData));
    }
    /**
     * @hidden
     */
    function fileFlagLocal2Remote(flag) {
        return {
            type: SpecialArgType.FILEFLAG,
            flagStr: flag.getFlagString()
        };
    }
    /**
     * @hidden
     */
    function fileFlagRemote2Local(remoteFlag) {
        return FileFlag.getFileFlag(remoteFlag.flagStr);
    }
    /**
     * @hidden
     */
    function bufferToTransferrableObject(buff) {
        return buffer2ArrayBuffer(buff);
    }
    /**
     * @hidden
     */
    function transferrableObjectToBuffer(buff) {
        return arrayBuffer2Buffer(buff);
    }
    /**
     * @hidden
     */
    function bufferLocal2Remote(buff) {
        return {
            type: SpecialArgType.BUFFER,
            data: bufferToTransferrableObject(buff)
        };
    }
    /**
     * @hidden
     */
    function bufferRemote2Local(buffArg) {
        return transferrableObjectToBuffer(buffArg.data);
    }
    /**
     * @hidden
     */
    function isAPIRequest(data) {
        return data && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
    }
    /**
     * @hidden
     */
    function isAPIResponse(data) {
        return data && typeof data === 'object' && data.hasOwnProperty('browserfsMessage') && data['browserfsMessage'];
    }
    /**
     * Represents a remote file in a different worker/thread.
     */
    class WorkerFile extends PreloadFile {
        constructor(_fs, _path, _flag, _stat, remoteFdId, contents) {
            super(_fs, _path, _flag, _stat, contents);
            this._remoteFdId = remoteFdId;
        }
        getRemoteFdId() {
            return this._remoteFdId;
        }
        /**
         * @hidden
         */
        toRemoteArg() {
            return {
                type: SpecialArgType.FD,
                id: this._remoteFdId,
                data: bufferToTransferrableObject(this.getBuffer()),
                stat: bufferToTransferrableObject(this.getStats().toBuffer()),
                path: this.getPath(),
                flag: this.getFlag().getFlagString()
            };
        }
        sync(cb) {
            this._syncClose('sync', cb);
        }
        close(cb) {
            this._syncClose('close', cb);
        }
        _syncClose(type, cb) {
            if (this.isDirty()) {
                this._fs.syncClose(type, this, (e) => {
                    if (!e) {
                        this.resetDirty();
                    }
                    cb(e);
                });
            }
            else {
                cb();
            }
        }
    }
    /**
     * WorkerFS lets you access a BrowserFS instance that is running in a different
     * JavaScript context (e.g. access BrowserFS in one of your WebWorkers, or
     * access BrowserFS running on the main page from a WebWorker).
     *
     * For example, to have a WebWorker access files in the main browser thread,
     * do the following:
     *
     * MAIN BROWSER THREAD:
     *
     * ```javascript
     *   // Listen for remote file system requests.
     *   BrowserFS.FileSystem.WorkerFS.attachRemoteListener(webWorkerObject);
     * ```
     *
     * WEBWORKER THREAD:
     *
     * ```javascript
     *   // Set the remote file system as the root file system.
     *   BrowserFS.configure({ fs: "WorkerFS", options: { worker: self }}, function(e) {
     *     // Ready!
     *   });
     * ```
     *
     * Note that synchronous operations are not permitted on the WorkerFS, regardless
     * of the configuration option of the remote FS.
     */
    class WorkerFS extends BaseFileSystem {
        /**
         * Constructs a new WorkerFS instance that connects with BrowserFS running on
         * the specified worker.
         */
        constructor(worker) {
            super();
            this._callbackConverter = new CallbackArgumentConverter();
            this._isInitialized = false;
            this._isReadOnly = false;
            this._supportLinks = false;
            this._supportProps = false;
            this._worker = worker;
            this._worker.addEventListener('message', (e) => {
                const resp = e.data;
                if (isAPIResponse(resp)) {
                    let i;
                    const args = resp.args;
                    const fixedArgs = new Array(args.length);
                    // Dispatch event to correct id.
                    for (i = 0; i < fixedArgs.length; i++) {
                        fixedArgs[i] = this._argRemote2Local(args[i]);
                    }
                    this._callbackConverter.toLocalArg(resp.cbId).apply(null, fixedArgs);
                }
            });
        }
        static Create(opts, cb) {
            const fs = new WorkerFS(opts.worker);
            fs._initialize(() => {
                cb(null, fs);
            });
        }
        static isAvailable() {
            return typeof (importScripts) !== 'undefined' || typeof (Worker) !== 'undefined';
        }
        /**
         * Attaches a listener to the remote worker for file system requests.
         */
        static attachRemoteListener(worker) {
            const fdConverter = new FileDescriptorArgumentConverter();
            function argLocal2Remote(arg, requestArgs, cb) {
                switch (typeof arg) {
                    case 'object':
                        if (arg instanceof Stats) {
                            cb(null, statsLocal2Remote(arg));
                        }
                        else if (arg instanceof ApiError) {
                            cb(null, apiErrorLocal2Remote(arg));
                        }
                        else if (arg instanceof BaseFile) {
                            // Pass in p and flags from original request.
                            cb(null, fdConverter.toRemoteArg(arg, requestArgs[0], requestArgs[1], cb));
                        }
                        else if (arg instanceof FileFlag) {
                            cb(null, fileFlagLocal2Remote(arg));
                        }
                        else if (arg instanceof Buffer) {
                            cb(null, bufferLocal2Remote(arg));
                        }
                        else if (arg instanceof Error) {
                            cb(null, errorLocal2Remote(arg));
                        }
                        else {
                            cb(null, arg);
                        }
                        break;
                    default:
                        cb(null, arg);
                        break;
                }
            }
            function argRemote2Local(arg, fixedRequestArgs) {
                if (!arg) {
                    return arg;
                }
                switch (typeof arg) {
                    case 'object':
                        if (typeof arg['type'] === 'number') {
                            const specialArg = arg;
                            switch (specialArg.type) {
                                case SpecialArgType.CB:
                                    const cbId = arg.id;
                                    return function () {
                                        let i;
                                        const fixedArgs = new Array(arguments.length);
                                        let message, countdown = arguments.length;
                                        function abortAndSendError(err) {
                                            if (countdown > 0) {
                                                countdown = -1;
                                                message = {
                                                    browserfsMessage: true,
                                                    cbId: cbId,
                                                    args: [apiErrorLocal2Remote(err)]
                                                };
                                                worker.postMessage(message);
                                            }
                                        }
                                        for (i = 0; i < arguments.length; i++) {
                                            // Capture i and argument.
                                            ((i, arg) => {
                                                argLocal2Remote(arg, fixedRequestArgs, (err, fixedArg) => {
                                                    fixedArgs[i] = fixedArg;
                                                    if (err) {
                                                        abortAndSendError(err);
                                                    }
                                                    else if (--countdown === 0) {
                                                        message = {
                                                            browserfsMessage: true,
                                                            cbId: cbId,
                                                            args: fixedArgs
                                                        };
                                                        worker.postMessage(message);
                                                    }
                                                });
                                            })(i, arguments[i]);
                                        }
                                        if (arguments.length === 0) {
                                            message = {
                                                browserfsMessage: true,
                                                cbId: cbId,
                                                args: fixedArgs
                                            };
                                            worker.postMessage(message);
                                        }
                                    };
                                case SpecialArgType.API_ERROR:
                                    return apiErrorRemote2Local(specialArg);
                                case SpecialArgType.STATS:
                                    return statsRemote2Local(specialArg);
                                case SpecialArgType.FILEFLAG:
                                    return fileFlagRemote2Local(specialArg);
                                case SpecialArgType.BUFFER:
                                    return bufferRemote2Local(specialArg);
                                case SpecialArgType.ERROR:
                                    return errorRemote2Local(specialArg);
                                default:
                                    // No idea what this is.
                                    return arg;
                            }
                        }
                        else {
                            return arg;
                        }
                    default:
                        return arg;
                }
            }
            worker.addEventListener('message', (e) => {
                const request = e.data;
                if (isAPIRequest(request)) {
                    const args = request.args, fixedArgs = new Array(args.length);
                    switch (request.method) {
                        case 'close':
                        case 'sync':
                            (() => {
                                // File descriptor-relative methods.
                                const remoteCb = args[1];
                                fdConverter.applyFdAPIRequest(request, (err) => {
                                    // Send response.
                                    const response = {
                                        browserfsMessage: true,
                                        cbId: remoteCb.id,
                                        args: err ? [apiErrorLocal2Remote(err)] : []
                                    };
                                    worker.postMessage(response);
                                });
                            })();
                            break;
                        case 'probe':
                            (() => {
                                const rootFs = fs.getRootFS(), remoteCb = args[1], probeResponse = {
                                    type: SpecialArgType.PROBE,
                                    isReadOnly: rootFs.isReadOnly(),
                                    supportsLinks: rootFs.supportsLinks(),
                                    supportsProps: rootFs.supportsProps()
                                }, response = {
                                    browserfsMessage: true,
                                    cbId: remoteCb.id,
                                    args: [probeResponse]
                                };
                                worker.postMessage(response);
                            })();
                            break;
                        default:
                            // File system methods.
                            for (let i = 0; i < args.length; i++) {
                                fixedArgs[i] = argRemote2Local(args[i], fixedArgs);
                            }
                            const rootFS = fs.getRootFS();
                            rootFS[request.method].apply(rootFS, fixedArgs);
                            break;
                    }
                }
            });
        }
        getName() {
            return WorkerFS.Name;
        }
        isReadOnly() { return this._isReadOnly; }
        supportsSynch() { return false; }
        supportsLinks() { return this._supportLinks; }
        supportsProps() { return this._supportProps; }
        rename(oldPath, newPath, cb) {
            this._rpc('rename', arguments);
        }
        stat(p, isLstat, cb) {
            this._rpc('stat', arguments);
        }
        open(p, flag, mode, cb) {
            this._rpc('open', arguments);
        }
        unlink(p, cb) {
            this._rpc('unlink', arguments);
        }
        rmdir(p, cb) {
            this._rpc('rmdir', arguments);
        }
        mkdir(p, mode, cb) {
            this._rpc('mkdir', arguments);
        }
        readdir(p, cb) {
            this._rpc('readdir', arguments);
        }
        exists(p, cb) {
            this._rpc('exists', arguments);
        }
        realpath(p, cache, cb) {
            this._rpc('realpath', arguments);
        }
        truncate(p, len, cb) {
            this._rpc('truncate', arguments);
        }
        readFile(fname, encoding, flag, cb) {
            this._rpc('readFile', arguments);
        }
        writeFile(fname, data, encoding, flag, mode, cb) {
            this._rpc('writeFile', arguments);
        }
        appendFile(fname, data, encoding, flag, mode, cb) {
            this._rpc('appendFile', arguments);
        }
        chmod(p, isLchmod, mode, cb) {
            this._rpc('chmod', arguments);
        }
        chown(p, isLchown, uid, gid, cb) {
            this._rpc('chown', arguments);
        }
        utimes(p, atime, mtime, cb) {
            this._rpc('utimes', arguments);
        }
        link(srcpath, dstpath, cb) {
            this._rpc('link', arguments);
        }
        symlink(srcpath, dstpath, type, cb) {
            this._rpc('symlink', arguments);
        }
        readlink(p, cb) {
            this._rpc('readlink', arguments);
        }
        syncClose(method, fd, cb) {
            this._worker.postMessage({
                browserfsMessage: true,
                method: method,
                args: [fd.toRemoteArg(), this._callbackConverter.toRemoteArg(cb)]
            });
        }
        /**
         * Called once both local and remote sides are set up.
         */
        _initialize(cb) {
            if (!this._isInitialized) {
                const message = {
                    browserfsMessage: true,
                    method: 'probe',
                    args: [this._argLocal2Remote(emptyBuffer()), this._callbackConverter.toRemoteArg((probeResponse) => {
                            this._isInitialized = true;
                            this._isReadOnly = probeResponse.isReadOnly;
                            this._supportLinks = probeResponse.supportsLinks;
                            this._supportProps = probeResponse.supportsProps;
                            cb();
                        })]
                };
                this._worker.postMessage(message);
            }
            else {
                cb();
            }
        }
        _argRemote2Local(arg) {
            if (!arg) {
                return arg;
            }
            switch (typeof arg) {
                case 'object':
                    if (typeof arg['type'] === 'number') {
                        const specialArg = arg;
                        switch (specialArg.type) {
                            case SpecialArgType.API_ERROR:
                                return apiErrorRemote2Local(specialArg);
                            case SpecialArgType.FD:
                                const fdArg = specialArg;
                                return new WorkerFile(this, fdArg.path, FileFlag.getFileFlag(fdArg.flag), Stats.fromBuffer(transferrableObjectToBuffer(fdArg.stat)), fdArg.id, transferrableObjectToBuffer(fdArg.data));
                            case SpecialArgType.STATS:
                                return statsRemote2Local(specialArg);
                            case SpecialArgType.FILEFLAG:
                                return fileFlagRemote2Local(specialArg);
                            case SpecialArgType.BUFFER:
                                return bufferRemote2Local(specialArg);
                            case SpecialArgType.ERROR:
                                return errorRemote2Local(specialArg);
                            default:
                                return arg;
                        }
                    }
                    else {
                        return arg;
                    }
                default:
                    return arg;
            }
        }
        _rpc(methodName, args) {
            const fixedArgs = new Array(args.length);
            for (let i = 0; i < args.length; i++) {
                fixedArgs[i] = this._argLocal2Remote(args[i]);
            }
            const message = {
                browserfsMessage: true,
                method: methodName,
                args: fixedArgs
            };
            this._worker.postMessage(message);
        }
        /**
         * Converts a local argument into a remote argument. Public so WorkerFile objects can call it.
         */
        _argLocal2Remote(arg) {
            if (!arg) {
                return arg;
            }
            switch (typeof arg) {
                case "object":
                    if (arg instanceof Stats) {
                        return statsLocal2Remote(arg);
                    }
                    else if (arg instanceof ApiError) {
                        return apiErrorLocal2Remote(arg);
                    }
                    else if (arg instanceof WorkerFile) {
                        return arg.toRemoteArg();
                    }
                    else if (arg instanceof FileFlag) {
                        return fileFlagLocal2Remote(arg);
                    }
                    else if (arg instanceof Buffer) {
                        return bufferLocal2Remote(arg);
                    }
                    else if (arg instanceof Error) {
                        return errorLocal2Remote(arg);
                    }
                    else {
                        return "Unknown argument";
                    }
                case "function":
                    return this._callbackConverter.toRemoteArg(arg);
                default:
                    return arg;
            }
        }
    }
    WorkerFS.Name = "WorkerFS";
    WorkerFS.Options = {
        worker: {
            type: "object",
            description: "The target worker that you want to connect to, or the current worker if in a worker context.",
            validator: function (v, cb) {
                // Check for a `postMessage` function.
                if (v['postMessage']) {
                    cb();
                }
                else {
                    cb(new ApiError(ErrorCode.EINVAL, `option must be a Web Worker instance.`));
                }
            }
        }
    };

    return WorkerFS;
});
define('skylark-browserfs/generic/xhr',[
    '../libs/buffers',
    '../core/util',
    '../core/api_error'
], function (buffers,util, api_error) {
    'use strict';
    /**
     * Contains utility methods for performing a variety of tasks with
     * XmlHttpRequest across browsers.
     */
    const { isIE, emptyBuffer } = util;
    const { ApiError, ErrorCode } = api_error;
    const { Buffer } = buffers;

    const xhrIsAvailable = (typeof (XMLHttpRequest) !== "undefined" && XMLHttpRequest !== null);
    function asyncDownloadFileModern(p, type, cb) {
        const req = new XMLHttpRequest();
        req.open('GET', p, true);
        let jsonSupported = true;
        switch (type) {
            case 'buffer':
                req.responseType = 'arraybuffer';
                break;
            case 'json':
                // Some browsers don't support the JSON response type.
                // They either reset responseType, or throw an exception.
                // @see https://github.com/Modernizr/Modernizr/blob/master/src/testXhrType.js
                try {
                    req.responseType = 'json';
                    jsonSupported = req.responseType === 'json';
                }
                catch (e) {
                    jsonSupported = false;
                }
                break;
            default:
                return cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
        }
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            // XXX: WebKit-based browsers return *null* when XHRing an empty file.
                            return cb(null, req.response ? Buffer.from(req.response) : emptyBuffer());
                        case 'json':
                            if (jsonSupported) {
                                return cb(null, req.response);
                            }
                            else {
                                return cb(null, JSON.parse(req.responseText));
                            }
                    }
                }
                else {
                    return cb(new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`));
                }
            }
        };
        req.send();
    }
    function syncDownloadFileModern(p, type) {
        const req = new XMLHttpRequest();
        req.open('GET', p, false);
        // On most platforms, we cannot set the responseType of synchronous downloads.
        // @todo Test for this; IE10 allows this, as do older versions of Chrome/FF.
        let data = null;
        let err = null;
        // Classic hack to download binary data as a string.
        req.overrideMimeType('text/plain; charset=x-user-defined');
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            // Convert the text into a buffer.
                            const text = req.responseText;
                            data = Buffer.alloc(text.length);
                            // Throw away the upper bits of each character.
                            for (let i = 0; i < text.length; i++) {
                                // This will automatically throw away the upper bit of each
                                // character for us.
                                data[i] = text.charCodeAt(i);
                            }
                            return;
                        case 'json':
                            data = JSON.parse(req.responseText);
                            return;
                    }
                }
                else {
                    err = new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`);
                    return;
                }
            }
        };
        req.send();
        if (err) {
            throw err;
        }
        return data;
    }
    function syncDownloadFileIE10(p, type) {
        const req = new XMLHttpRequest();
        req.open('GET', p, false);
        switch (type) {
            case 'buffer':
                req.responseType = 'arraybuffer';
                break;
            case 'json':
                // IE10 does not support the JSON type.
                break;
            default:
                throw new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type);
        }
        let data;
        let err;
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    switch (type) {
                        case 'buffer':
                            data = Buffer.from(req.response);
                            break;
                        case 'json':
                            data = JSON.parse(req.response);
                            break;
                    }
                }
                else {
                    err = new ApiError(ErrorCode.EIO, `XHR error: response returned code ${req.status}`);
                }
            }
        };
        req.send();
        if (err) {
            throw err;
        }
        return data;
    }
    /**
     * @hidden
     */
    function getFileSize(async, p, cb) {
        const req = new XMLHttpRequest();
        req.open('HEAD', p, async);
        req.onreadystatechange = function (e) {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    try {
                        return cb(null, parseInt(req.getResponseHeader('Content-Length') || '-1', 10));
                    }
                    catch (e) {
                        // In the event that the header isn't present or there is an error...
                        return cb(new ApiError(ErrorCode.EIO, "XHR HEAD error: Could not read content-length."));
                    }
                }
                else {
                    return cb(new ApiError(ErrorCode.EIO, `XHR HEAD error: response returned code ${req.status}`));
                }
            }
        };
        req.send();
    }
    /**
     * Asynchronously download a file as a buffer or a JSON object.
     * Note that the third function signature with a non-specialized type is
     * invalid, but TypeScript requires it when you specialize string arguments to
     * constants.
     * @hidden
     */
    let asyncDownloadFile = asyncDownloadFileModern;
    /**
     * Synchronously download a file as a buffer or a JSON object.
     * Note that the third function signature with a non-specialized type is
     * invalid, but TypeScript requires it when you specialize string arguments to
     * constants.
     * @hidden
     */
    let syncDownloadFile = (isIE && typeof Blob !== 'undefined') ? syncDownloadFileIE10 : syncDownloadFileModern;
    /**
     * Synchronously retrieves the size of the given file in bytes.
     * @hidden
     */
    function getFileSizeSync(p) {
        let rv = -1;
        getFileSize(false, p, function (err, size) {
            if (err) {
                throw err;
            }
            rv = size;
        });
        return rv;
    }
    /**
     * Asynchronously retrieves the size of the given file in bytes.
     * @hidden
     */
    function getFileSizeAsync(p, cb) {
        getFileSize(true, p, cb);
    }



    return {
        xhrIsAvailable: xhrIsAvailable,
        asyncDownloadFile: asyncDownloadFile,
        syncDownloadFile: syncDownloadFile,
        getFileSizeSync: getFileSizeSync,
        getFileSizeAsync: getFileSizeAsync
    };
});
define('skylark-browserfs/generic/fetch',[
    '../libs/buffers',
    '../core/api_error'
], function (buffers,api_error) {
    'use strict';

    /**
     * Contains utility methods using 'fetch'.
     */
    const { ApiError, ErrorCode }= api_error;

    const fetchIsAvailable = (typeof (fetch) !== "undefined" && fetch !== null);
    const { Buffer } = buffers;

    function fetchFileAsync(p, type, cb) {
        let request;
        try {
            request = fetch(p);
        }
        catch (e) {
            // XXX: fetch will throw a TypeError if the URL has credentials in it
            return cb(new ApiError(ErrorCode.EINVAL, e.message));
        }
        request
            .then((res) => {
            if (!res.ok) {
                return cb(new ApiError(ErrorCode.EIO, `fetch error: response returned code ${res.status}`));
            }
            else {
                switch (type) {
                    case 'buffer':
                        res.arrayBuffer()
                            .then((buf) => cb(null, Buffer.from(buf)))
                            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
                        break;
                    case 'json':
                        res.json()
                            .then((json) => cb(null, json))
                            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
                        break;
                    default:
                        cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
                }
            }
        })
            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
    }

    /**
     * Asynchronously retrieves the size of the given file in bytes.
     * @hidden
     */

    function fetchFileSizeAsync(p, cb) {
        fetch(p, { method: 'HEAD' })
            .then((res) => {
            if (!res.ok) {
                return cb(new ApiError(ErrorCode.EIO, `fetch HEAD error: response returned code ${res.status}`));
            }
            else {
                return cb(null, parseInt(res.headers.get('Content-Length') || '-1', 10));
            }
        })
            .catch((err) => cb(new ApiError(ErrorCode.EIO, err.message)));
    }

    return {
        fetchIsAvailable: fetchIsAvailable,
        fetchFileAsync: fetchFileAsync,
        fetchFileSizeAsync: fetchFileSizeAsync
    };
});
define('skylark-browserfs/generic/file_index',[
    '../core/node_fs_stats',
    '../libs/path'
], function (node_fs_stats, path) {
    'use strict';

    const {Stats, FileType }  = node_fs_stats;

    /**
     * A simple class for storing a filesystem index. Assumes that all paths passed
     * to it are *absolute* paths.
     *
     * Can be used as a partial or a full index, although care must be taken if used
     * for the former purpose, especially when directories are concerned.
     */
    class FileIndex {
        /**
         * Constructs a new FileIndex.
         */
        constructor() {
            // _index is a single-level key,value store that maps *directory* paths to
            // DirInodes. File information is only contained in DirInodes themselves.
            this._index = {};
            // Create the root directory.
            this.addPath('/', new DirInode());
        }
        /**
         * Static method for constructing indices from a JSON listing.
         * @param listing Directory listing generated by tools/XHRIndexer.coffee
         * @return A new FileIndex object.
         */
        static fromListing(listing) {
            const idx = new FileIndex();
            // Add a root DirNode.
            const rootInode = new DirInode();
            idx._index['/'] = rootInode;
            const queue = [['', listing, rootInode]];
            while (queue.length > 0) {
                let inode;
                const next = queue.pop();
                const pwd = next[0];
                const tree = next[1];
                const parent = next[2];
                for (const node in tree) {
                    if (tree.hasOwnProperty(node)) {
                        const children = tree[node];
                        const name = `${pwd}/${node}`;
                        if (children) {
                            idx._index[name] = inode = new DirInode();
                            queue.push([name, children, inode]);
                        }
                        else {
                            // This inode doesn't have correct size information, noted with -1.
                            inode = new FileInode(new Stats(FileType.FILE, -1, 0x16D));
                        }
                        if (parent) {
                            parent._ls[node] = inode;
                        }
                    }
                }
            }
            return idx;
        }
        /**
         * Runs the given function over all files in the index.
         */
        fileIterator(cb) {
            for (const path in this._index) {
                if (this._index.hasOwnProperty(path)) {
                    const dir = this._index[path];
                    const files = dir.getListing();
                    for (const file of files) {
                        const item = dir.getItem(file);
                        if (isFileInode(item)) {
                            cb(item.getData());
                        }
                    }
                }
            }
        }
        /**
         * Adds the given absolute path to the index if it is not already in the index.
         * Creates any needed parent directories.
         * @param path The path to add to the index.
         * @param inode The inode for the
         *   path to add.
         * @return 'True' if it was added or already exists, 'false' if there
         *   was an issue adding it (e.g. item in path is a file, item exists but is
         *   different).
         * @todo If adding fails and implicitly creates directories, we do not clean up
         *   the new empty directories.
         */
        addPath(path, inode) {
            if (!inode) {
                throw new Error('Inode must be specified');
            }
            if (path[0] !== '/') {
                throw new Error('Path must be absolute, got: ' + path);
            }
            // Check if it already exists.
            if (this._index.hasOwnProperty(path)) {
                return this._index[path] === inode;
            }
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Try to add to its parent directory first.
            let parent = this._index[dirpath];
            if (parent === undefined && path !== '/') {
                // Create parent.
                parent = new DirInode();
                if (!this.addPath(dirpath, parent)) {
                    return false;
                }
            }
            // Add myself to my parent.
            if (path !== '/') {
                if (!parent.addItem(itemname, inode)) {
                    return false;
                }
            }
            // If I'm a directory, add myself to the index.
            if (isDirInode(inode)) {
                this._index[path] = inode;
            }
            return true;
        }
        /**
         * Adds the given absolute path to the index if it is not already in the index.
         * The path is added without special treatment (no joining of adjacent separators, etc).
         * Creates any needed parent directories.
         * @param path The path to add to the index.
         * @param inode The inode for the
         *   path to add.
         * @return 'True' if it was added or already exists, 'false' if there
         *   was an issue adding it (e.g. item in path is a file, item exists but is
         *   different).
         * @todo If adding fails and implicitly creates directories, we do not clean up
         *   the new empty directories.
         */
        addPathFast(path, inode) {
            const itemNameMark = path.lastIndexOf('/');
            const parentPath = itemNameMark === 0 ? "/" : path.substring(0, itemNameMark);
            const itemName = path.substring(itemNameMark + 1);
            // Try to add to its parent directory first.
            let parent = this._index[parentPath];
            if (parent === undefined) {
                // Create parent.
                parent = new DirInode();
                this.addPathFast(parentPath, parent);
            }
            if (!parent.addItem(itemName, inode)) {
                return false;
            }
            // If adding a directory, add to the index as well.
            if (inode.isDir()) {
                this._index[path] = inode;
            }
            return true;
        }
        /**
         * Removes the given path. Can be a file or a directory.
         * @return The removed item,
         *   or null if it did not exist.
         */
        removePath(path) {
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Try to remove it from its parent directory first.
            const parent = this._index[dirpath];
            if (parent === undefined) {
                return null;
            }
            // Remove myself from my parent.
            const inode = parent.remItem(itemname);
            if (inode === null) {
                return null;
            }
            // If I'm a directory, remove myself from the index, and remove my children.
            if (isDirInode(inode)) {
                const children = inode.getListing();
                for (const child of children) {
                    this.removePath(path + '/' + child);
                }
                // Remove the directory from the index, unless it's the root.
                if (path !== '/') {
                    delete this._index[path];
                }
            }
            return inode;
        }
        /**
         * Retrieves the directory listing of the given path.
         * @return An array of files in the given path, or 'null' if it does not exist.
         */
        ls(path) {
            const item = this._index[path];
            if (item === undefined) {
                return null;
            }
            return item.getListing();
        }
        /**
         * Returns the inode of the given item.
         * @return Returns null if the item does not exist.
         */
        getInode(path) {
            const splitPath = this._split_path(path);
            const dirpath = splitPath[0];
            const itemname = splitPath[1];
            // Retrieve from its parent directory.
            const parent = this._index[dirpath];
            if (parent === undefined) {
                return null;
            }
            // Root case
            if (dirpath === path) {
                return parent;
            }
            return parent.getItem(itemname);
        }
        /**
         * Split into a (directory path, item name) pair
         */
        _split_path(p) {
            const dirpath = path.dirname(p);
            const itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
            return [dirpath, itemname];
        }
    }
    
    /**
     * Inode for a file. Stores an arbitrary (filesystem-specific) data payload.
     */
    class FileInode {
        constructor(data) {
            this.data = data;
        }
        isFile() { return true; }
        isDir() { return false; }
        getData() { return this.data; }
        setData(data) { this.data = data; }
    }
    /**
     * Inode for a directory. Currently only contains the directory listing.
     */
    class DirInode {
        /**
         * Constructs an inode for a directory.
         */
        constructor(data = null) {
            this.data = data;
            this._ls = {};
        }
        isFile() {
            return false;
        }
        isDir() {
            return true;
        }
        getData() { return this.data; }
        /**
         * Return a Stats object for this inode.
         * @todo Should probably remove this at some point. This isn't the
         *       responsibility of the FileIndex.
         */
        getStats() {
            return new Stats(FileType.DIRECTORY, 4096, 0x16D);
        }
        /**
         * Returns the directory listing for this directory. Paths in the directory are
         * relative to the directory's path.
         * @return The directory listing for this directory.
         */
        getListing() {
            return Object.keys(this._ls);
        }
        /**
         * Returns the inode for the indicated item, or null if it does not exist.
         * @param p Name of item in this directory.
         */
        getItem(p) {
            const item = this._ls[p];
            return item ? item : null;
        }
        /**
         * Add the given item to the directory listing. Note that the given inode is
         * not copied, and will be mutated by the DirInode if it is a DirInode.
         * @param p Item name to add to the directory listing.
         * @param inode The inode for the
         *   item to add to the directory inode.
         * @return True if it was added, false if it already existed.
         */
        addItem(p, inode) {
            if (p in this._ls) {
                return false;
            }
            this._ls[p] = inode;
            return true;
        }
        /**
         * Removes the given item from the directory listing.
         * @param p Name of item to remove from the directory listing.
         * @return Returns the item
         *   removed, or null if the item did not exist.
         */
        remItem(p) {
            const item = this._ls[p];
            if (item === undefined) {
                return null;
            }
            delete this._ls[p];
            return item;
        }
    }
    /**
     * @hidden
     */
    function isFileInode(inode) {
        return !!inode && inode.isFile();
    }
    /**
     * @hidden
     */
    function isDirInode(inode) {
        return !!inode && inode.isDir();
    }


    return {
        FileIndex: FileIndex,
        FileInode: FileInode,
        DirInode: DirInode,
        isFileInode: isFileInode,
        isDirInode: isDirInode
    };
});
define('skylark-browserfs/backend/HTTPRequest',[
    '../core/file_system',
    '../core/api_error',
    '../core/file_flag',
    '../core/util',
    '../core/node_fs_stats',
    '../generic/preload_file',
    '../generic/xhr',
    '../generic/fetch',
    '../generic/file_index'
], function (file_system, api_error, file_flag, util, node_fs_stats, preload_file, xhr, fetch, file_index) {
    'use strict';

    const { BaseFileSystem } = file_system;
    const { ApiError, ErrorCode }  = api_error;
    const { ActionType }  = file_flag;
    const { copyingSlice }  = util;
    const  {Stats} = node_fs_stats;
    const { NoSyncFile }  = preload_file;
    const { xhrIsAvailable, asyncDownloadFile, syncDownloadFile, getFileSizeAsync, getFileSizeSync }  = xhr;
    const { fetchIsAvailable, fetchFileAsync, fetchFileSizeAsync }  = fetch;
    const { FileIndex, isFileInode, isDirInode }  = file_index;
    /**
     * Try to convert the given buffer into a string, and pass it to the callback.
     * Optimization that removes the needed try/catch into a helper function, as
     * this is an uncommon case.
     * @hidden
     */
    function tryToString(buff, encoding, cb) {
        try {
            cb(null, buff.toString(encoding));
        }
        catch (e) {
            cb(e);
        }
    }
    function syncNotAvailableError() {
        throw new ApiError(ErrorCode.ENOTSUP, `Synchronous HTTP download methods are not available in this environment.`);
    }
    /**
     * A simple filesystem backed by HTTP downloads. You must create a directory listing using the
     * `make_http_index` tool provided by BrowserFS.
     *
     * If you install BrowserFS globally with `npm i -g browserfs`, you can generate a listing by
     * running `make_http_index` in your terminal in the directory you would like to index:
     *
     * ```
     * make_http_index > index.json
     * ```
     *
     * Listings objects look like the following:
     *
     * ```json
     * {
     *   "home": {
     *     "jvilk": {
     *       "someFile.txt": null,
     *       "someDir": {
     *         // Empty directory
     *       }
     *     }
     *   }
     * }
     * ```
     *
     * *This example has the folder `/home/jvilk` with subfile `someFile.txt` and subfolder `someDir`.*
     */
    class HTTPRequest extends BaseFileSystem {
        constructor(index, prefixUrl = '', preferXHR = false) {
            super();
            // prefix_url must end in a directory separator.
            if (prefixUrl.length > 0 && prefixUrl.charAt(prefixUrl.length - 1) !== '/') {
                prefixUrl = prefixUrl + '/';
            }
            this.prefixUrl = prefixUrl;
            this._index = FileIndex.fromListing(index);
            if (fetchIsAvailable && (!preferXHR || !xhrIsAvailable)) {
                this._requestFileAsyncInternal = fetchFileAsync;
                this._requestFileSizeAsyncInternal = fetchFileSizeAsync;
            }
            else {
                this._requestFileAsyncInternal = asyncDownloadFile;
                this._requestFileSizeAsyncInternal = getFileSizeAsync;
            }
            if (xhrIsAvailable) {
                this._requestFileSyncInternal = syncDownloadFile;
                this._requestFileSizeSyncInternal = getFileSizeSync;
            }
            else {
                this._requestFileSyncInternal = syncNotAvailableError;
                this._requestFileSizeSyncInternal = syncNotAvailableError;
            }
        }
        /**
         * Construct an HTTPRequest file system backend with the given options.
         */
        static Create(opts, cb) {
            if (opts.index === undefined) {
                opts.index = `index.json`;
            }
            if (typeof (opts.index) === "string") {
                asyncDownloadFile(opts.index, "json", (e, data) => {
                    if (e) {
                        cb(e);
                    }
                    else {
                        cb(null, new HTTPRequest(data, opts.baseUrl));
                    }
                });
            }
            else {
                cb(null, new HTTPRequest(opts.index, opts.baseUrl));
            }
        }
        static isAvailable() {
            return xhrIsAvailable || fetchIsAvailable;
        }
        empty() {
            this._index.fileIterator(function (file) {
                file.fileData = null;
            });
        }
        getName() {
            return HTTPRequest.Name;
        }
        diskSpace(path, cb) {
            // Read-only file system. We could calculate the total space, but that's not
            // important right now.
            cb(0, 0);
        }
        isReadOnly() {
            return true;
        }
        supportsLinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            // Synchronous operations are only available via the XHR interface for now.
            return xhrIsAvailable;
        }
        /**
         * Special HTTPFS function: Preload the given file into the index.
         * @param [String] path
         * @param [BrowserFS.Buffer] buffer
         */
        preloadFile(path, buffer) {
            const inode = this._index.getInode(path);
            if (isFileInode(inode)) {
                if (inode === null) {
                    throw ApiError.ENOENT(path);
                }
                const stats = inode.getData();
                stats.size = buffer.length;
                stats.fileData = buffer;
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        stat(path, isLstat, cb) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                return cb(ApiError.ENOENT(path));
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData();
                // At this point, a non-opened file will still have default stats from the listing.
                if (stats.size < 0) {
                    this._requestFileSizeAsync(path, function (e, size) {
                        if (e) {
                            return cb(e);
                        }
                        stats.size = size;
                        cb(null, Stats.clone(stats));
                    });
                }
                else {
                    cb(null, Stats.clone(stats));
                }
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
                cb(null, stats);
            }
            else {
                cb(ApiError.FileError(ErrorCode.EINVAL, path));
            }
        }
        statSync(path, isLstat) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData();
                // At this point, a non-opened file will still have default stats from the listing.
                if (stats.size < 0) {
                    stats.size = this._requestFileSizeSync(path);
                }
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
            }
            else {
                throw ApiError.FileError(ErrorCode.EINVAL, path);
            }
            return stats;
        }
        open(path, flags, mode, cb) {
            // INVARIANT: You can't write to files on this file system.
            if (flags.isWriteable()) {
                return cb(new ApiError(ErrorCode.EPERM, path));
            }
            const self = this;
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (inode === null) {
                return cb(ApiError.ENOENT(path));
            }
            if (isFileInode(inode)) {
                const stats = inode.getData();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        return cb(ApiError.EEXIST(path));
                    case ActionType.NOP:
                        // Use existing file contents.
                        // XXX: Uh, this maintains the previously-used flag.
                        if (stats.fileData) {
                            return cb(null, new NoSyncFile(self, path, flags, Stats.clone(stats), stats.fileData));
                        }
                        // @todo be lazier about actually requesting the file
                        this._requestFileAsync(path, 'buffer', function (err, buffer) {
                            if (err) {
                                return cb(err);
                            }
                            // we don't initially have file sizes
                            stats.size = buffer.length;
                            stats.fileData = buffer;
                            return cb(null, new NoSyncFile(self, path, flags, Stats.clone(stats), buffer));
                        });
                        break;
                    default:
                        return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.'));
                }
            }
            else {
                return cb(ApiError.EISDIR(path));
            }
        }
        openSync(path, flags, mode) {
            // INVARIANT: You can't write to files on this file system.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, path);
            }
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            if (isFileInode(inode)) {
                const stats = inode.getData();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(path);
                    case ActionType.NOP:
                        // Use existing file contents.
                        // XXX: Uh, this maintains the previously-used flag.
                        if (stats.fileData) {
                            return new NoSyncFile(this, path, flags, Stats.clone(stats), stats.fileData);
                        }
                        // @todo be lazier about actually requesting the file
                        const buffer = this._requestFileSync(path, 'buffer');
                        // we don't initially have file sizes
                        stats.size = buffer.length;
                        stats.fileData = buffer;
                        return new NoSyncFile(this, path, flags, Stats.clone(stats), buffer);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        readdir(path, cb) {
            try {
                cb(null, this.readdirSync(path));
            }
            catch (e) {
                cb(e);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            else if (isDirInode(inode)) {
                return inode.getListing();
            }
            else {
                throw ApiError.ENOTDIR(path);
            }
        }
        /**
         * We have the entire file as a buffer; optimize readFile.
         */
        readFile(fname, encoding, flag, cb) {
            // Wrap cb in file closing code.
            const oldCb = cb;
            // Get file.
            this.open(fname, flag, 0x1a4, function (err, fd) {
                if (err) {
                    return cb(err);
                }
                cb = function (err, arg) {
                    fd.close(function (err2) {
                        if (!err) {
                            err = err2;
                        }
                        return oldCb(err, arg);
                    });
                };
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    cb(err, copyingSlice(fdBuff));
                }
                else {
                    tryToString(fdBuff, encoding, cb);
                }
            });
        }
        /**
         * Specially-optimized readfile.
         */
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    return copyingSlice(fdBuff);
                }
                return fdBuff.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
        _getHTTPPath(filePath) {
            if (filePath.charAt(0) === '/') {
                filePath = filePath.slice(1);
            }
            return this.prefixUrl + filePath;
        }
        _requestFileAsync(p, type, cb) {
            this._requestFileAsyncInternal(this._getHTTPPath(p), type, cb);
        }
        _requestFileSync(p, type) {
            return this._requestFileSyncInternal(this._getHTTPPath(p), type);
        }
        /**
         * Only requests the HEAD content, for the file size.
         */
        _requestFileSizeAsync(path, cb) {
            this._requestFileSizeAsyncInternal(this._getHTTPPath(path), cb);
        }
        _requestFileSizeSync(path) {
            return this._requestFileSizeSyncInternal(this._getHTTPPath(path));
        }
    }
    HTTPRequest.Name = "HTTPRequest";
    HTTPRequest.Options = {
        index: {
            type: ["string", "object"],
            optional: true,
            description: "URL to a file index as a JSON file or the file index object itself, generated with the make_http_index script. Defaults to `index.json`."
        },
        baseUrl: {
            type: "string",
            optional: true,
            description: "Used as the URL prefix for fetched files. Default: Fetch files relative to the index."
        },
        preferXHR: {
            type: "boolean",
            optional: true,
            description: "Whether to prefer XmlHttpRequest or fetch for async operations if both are available. Default: false"
        }
    };

    return HTTPRequest;
});
define('skylark-browserfs/generic/extended_ascii',[],function () {
    'use strict';
    /**
     * (Nonstandard) String utility function for 8-bit ASCII with the extended
     * character set. Unlike the ASCII above, we do not mask the high bits.
     *
     * Placed into a separate file so it can be used with other Buffer implementations.
     * @see http://en.wikipedia.org/wiki/Extended_ASCII
     */
    class ExtendedASCII {
        static str2byte(str, buf) {
            const length = str.length > buf.length ? buf.length : str.length;
            for (let i = 0; i < length; i++) {
                let charCode = str.charCodeAt(i);
                if (charCode > 0x7F) {
                    // Check if extended ASCII.
                    const charIdx = ExtendedASCII.extendedChars.indexOf(str.charAt(i));
                    if (charIdx > -1) {
                        charCode = charIdx + 0x80;
                    }
                    // Otherwise, keep it as-is.
                }
                buf[charCode] = i;
            }
            return length;
        }
        static byte2str(buff) {
            const chars = new Array(buff.length);
            for (let i = 0; i < buff.length; i++) {
                const charCode = buff[i];
                if (charCode > 0x7F) {
                    chars[i] = ExtendedASCII.extendedChars[charCode - 128];
                }
                else {
                    chars[i] = String.fromCharCode(charCode);
                }
            }
            return chars.join('');
        }
        static byteLength(str) { return str.length; }
    }
    
    ExtendedASCII.extendedChars = ['\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4',
        '\u00E0', '\u00E5', '\u00E7', '\u00EA', '\u00EB', '\u00E8', '\u00EF',
        '\u00EE', '\u00EC', '\u00C4', '\u00C5', '\u00C9', '\u00E6', '\u00C6',
        '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9', '\u00FF', '\u00D6',
        '\u00DC', '\u00F8', '\u00A3', '\u00D8', '\u00D7', '\u0192', '\u00E1',
        '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1', '\u00AA', '\u00BA',
        '\u00BF', '\u00AE', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB',
        '\u00BB', '_', '_', '_', '\u00A6', '\u00A6', '\u00C1', '\u00C2', '\u00C0',
        '\u00A9', '\u00A6', '\u00A6', '+', '+', '\u00A2', '\u00A5', '+', '+', '-',
        '-', '+', '-', '+', '\u00E3', '\u00C3', '+', '+', '-', '-', '\u00A6', '-',
        '+', '\u00A4', '\u00F0', '\u00D0', '\u00CA', '\u00CB', '\u00C8', 'i',
        '\u00CD', '\u00CE', '\u00CF', '+', '+', '_', '_', '\u00A6', '\u00CC', '_',
        '\u00D3', '\u00DF', '\u00D4', '\u00D2', '\u00F5', '\u00D5', '\u00B5',
        '\u00FE', '\u00DE', '\u00DA', '\u00DB', '\u00D9', '\u00FD', '\u00DD',
        '\u00AF', '\u00B4', '\u00AD', '\u00B1', '_', '\u00BE', '\u00B6', '\u00A7',
        '\u00F7', '\u00B8', '\u00B0', '\u00A8', '\u00B7', '\u00B9', '\u00B3',
        '\u00B2', '_', ' '];

    return ExtendedASCII;
});
define('skylark-browserfs/backend/ZipFS',[
    '../core/api_error',
    '../core/node_fs_stats',
    '../core/file_system',
    '../core/file_flag',
    '../generic/preload_file',
    '../core/util',
    '../generic/extended_ascii',
    '../generic/setImmediate',
    '../generic/file_index'
], function (api_error,  node_fs_stats, file_system, file_flag, preload_file, util, ExtendedASCII, setImmediate, file_index) {
    'use strict';

    const { ApiError, ErrorCode }  = api_error;
    const { Stats, FileType }  = node_fs_stats;
    const { SynchronousFileSystem }  = file_system;
    const { ActionType }  = file_flag;
    const { NoSyncFile }  = preload_file;
    const { arrayish2Buffer, copyingSlice, bufferValidator }  = util;
    /**
     * @hidden
     */
    let inflateRaw;
    try {
        inflateRaw = require('pako/lib/inflate').inflateRaw;
    } catch (e) {
        console.warn(e);
    }
    const { FileIndex, DirInode, FileInode, isDirInode, isFileInode } = '../generic/file_index';
    /**
     * Maps CompressionMethod => function that decompresses.
     * @hidden
     */
    const decompressionMethods = {};
    /**
     * 4.4.2.2: Indicates the compatibiltiy of a file's external attributes.
     */
    var ExternalFileAttributeType;
    (function (ExternalFileAttributeType) {
        ExternalFileAttributeType[ExternalFileAttributeType["MSDOS"] = 0] = "MSDOS";
        ExternalFileAttributeType[ExternalFileAttributeType["AMIGA"] = 1] = "AMIGA";
        ExternalFileAttributeType[ExternalFileAttributeType["OPENVMS"] = 2] = "OPENVMS";
        ExternalFileAttributeType[ExternalFileAttributeType["UNIX"] = 3] = "UNIX";
        ExternalFileAttributeType[ExternalFileAttributeType["VM_CMS"] = 4] = "VM_CMS";
        ExternalFileAttributeType[ExternalFileAttributeType["ATARI_ST"] = 5] = "ATARI_ST";
        ExternalFileAttributeType[ExternalFileAttributeType["OS2_HPFS"] = 6] = "OS2_HPFS";
        ExternalFileAttributeType[ExternalFileAttributeType["MAC"] = 7] = "MAC";
        ExternalFileAttributeType[ExternalFileAttributeType["Z_SYSTEM"] = 8] = "Z_SYSTEM";
        ExternalFileAttributeType[ExternalFileAttributeType["CP_M"] = 9] = "CP_M";
        ExternalFileAttributeType[ExternalFileAttributeType["NTFS"] = 10] = "NTFS";
        ExternalFileAttributeType[ExternalFileAttributeType["MVS"] = 11] = "MVS";
        ExternalFileAttributeType[ExternalFileAttributeType["VSE"] = 12] = "VSE";
        ExternalFileAttributeType[ExternalFileAttributeType["ACORN_RISC"] = 13] = "ACORN_RISC";
        ExternalFileAttributeType[ExternalFileAttributeType["VFAT"] = 14] = "VFAT";
        ExternalFileAttributeType[ExternalFileAttributeType["ALT_MVS"] = 15] = "ALT_MVS";
        ExternalFileAttributeType[ExternalFileAttributeType["BEOS"] = 16] = "BEOS";
        ExternalFileAttributeType[ExternalFileAttributeType["TANDEM"] = 17] = "TANDEM";
        ExternalFileAttributeType[ExternalFileAttributeType["OS_400"] = 18] = "OS_400";
        ExternalFileAttributeType[ExternalFileAttributeType["OSX"] = 19] = "OSX";
    })(ExternalFileAttributeType || (ExternalFileAttributeType = {}));
    /**
     * 4.4.5
     */
    var CompressionMethod;
    (function (CompressionMethod) {
        CompressionMethod[CompressionMethod["STORED"] = 0] = "STORED";
        CompressionMethod[CompressionMethod["SHRUNK"] = 1] = "SHRUNK";
        CompressionMethod[CompressionMethod["REDUCED_1"] = 2] = "REDUCED_1";
        CompressionMethod[CompressionMethod["REDUCED_2"] = 3] = "REDUCED_2";
        CompressionMethod[CompressionMethod["REDUCED_3"] = 4] = "REDUCED_3";
        CompressionMethod[CompressionMethod["REDUCED_4"] = 5] = "REDUCED_4";
        CompressionMethod[CompressionMethod["IMPLODE"] = 6] = "IMPLODE";
        CompressionMethod[CompressionMethod["DEFLATE"] = 8] = "DEFLATE";
        CompressionMethod[CompressionMethod["DEFLATE64"] = 9] = "DEFLATE64";
        CompressionMethod[CompressionMethod["TERSE_OLD"] = 10] = "TERSE_OLD";
        CompressionMethod[CompressionMethod["BZIP2"] = 12] = "BZIP2";
        CompressionMethod[CompressionMethod["LZMA"] = 14] = "LZMA";
        CompressionMethod[CompressionMethod["TERSE_NEW"] = 18] = "TERSE_NEW";
        CompressionMethod[CompressionMethod["LZ77"] = 19] = "LZ77";
        CompressionMethod[CompressionMethod["WAVPACK"] = 97] = "WAVPACK";
        CompressionMethod[CompressionMethod["PPMD"] = 98] = "PPMD"; // PPMd version I, Rev 1
    })(CompressionMethod || (CompressionMethod = {}));
    /**
     * Converts the input time and date in MS-DOS format into a JavaScript Date
     * object.
     * @hidden
     */
    function msdos2date(time, date) {
        // MS-DOS Date
        // |0 0 0 0  0|0 0 0  0|0 0 0  0 0 0 0
        //   D (1-31)  M (1-23)  Y (from 1980)
        const day = date & 0x1F;
        // JS date is 0-indexed, DOS is 1-indexed.
        const month = ((date >> 5) & 0xF) - 1;
        const year = (date >> 9) + 1980;
        // MS DOS Time
        // |0 0 0 0  0|0 0 0  0 0 0|0  0 0 0 0
        //    Second      Minute       Hour
        const second = time & 0x1F;
        const minute = (time >> 5) & 0x3F;
        const hour = time >> 11;
        return new Date(year, month, day, hour, minute, second);
    }
    /**
     * Safely returns the string from the buffer, even if it is 0 bytes long.
     * (Normally, calling toString() on a buffer with start === end causes an
     * exception).
     * @hidden
     */
    function safeToString(buff, useUTF8, start, length) {
        if (length === 0) {
            return "";
        }
        else if (useUTF8) {
            return buff.toString('utf8', start, start + length);
        }
        else {
            return ExtendedASCII.byte2str(buff.slice(start, start + length));
        }
    }
    /*
       4.3.6 Overall .ZIP file format:

          [local file header 1]
          [encryption header 1]
          [file data 1]
          [data descriptor 1]
          .
          .
          .
          [local file header n]
          [encryption header n]
          [file data n]
          [data descriptor n]
          [archive decryption header]
          [archive extra data record]
          [central directory header 1]
          .
          .
          .
          [central directory header n]
          [zip64 end of central directory record]
          [zip64 end of central directory locator]
          [end of central directory record]
    */
    /**
     * 4.3.7  Local file header:
     *
     *     local file header signature     4 bytes  (0x04034b50)
     *     version needed to extract       2 bytes
     *     general purpose bit flag        2 bytes
     *     compression method              2 bytes
     *    last mod file time              2 bytes
     *    last mod file date              2 bytes
     *    crc-32                          4 bytes
     *    compressed size                 4 bytes
     *    uncompressed size               4 bytes
     *    file name length                2 bytes
     *    extra field length              2 bytes
     *
     *    file name (variable size)
     *    extra field (variable size)
     */
    class FileHeader {
        constructor(data) {
            this.data = data;
            if (data.readUInt32LE(0) !== 0x04034b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid Zip file: Local file header has invalid signature: " + this.data.readUInt32LE(0));
            }
        }
        versionNeeded() { return this.data.readUInt16LE(4); }
        flags() { return this.data.readUInt16LE(6); }
        compressionMethod() { return this.data.readUInt16LE(8); }
        lastModFileTime() {
            // Time and date is in MS-DOS format.
            return msdos2date(this.data.readUInt16LE(10), this.data.readUInt16LE(12));
        }
        rawLastModFileTime() {
            return this.data.readUInt32LE(10);
        }
        crc32() { return this.data.readUInt32LE(14); }
        /**
         * These two values are COMPLETELY USELESS.
         *
         * Section 4.4.9:
         *   If bit 3 of the general purpose bit flag is set,
         *   these fields are set to zero in the local header and the
         *   correct values are put in the data descriptor and
         *   in the central directory.
         *
         * So we'll just use the central directory's values.
         */
        // public compressedSize(): number { return this.data.readUInt32LE(18); }
        // public uncompressedSize(): number { return this.data.readUInt32LE(22); }
        fileNameLength() { return this.data.readUInt16LE(26); }
        extraFieldLength() { return this.data.readUInt16LE(28); }
        fileName() {
            return safeToString(this.data, this.useUTF8(), 30, this.fileNameLength());
        }
        extraField() {
            const start = 30 + this.fileNameLength();
            return this.data.slice(start, start + this.extraFieldLength());
        }
        totalSize() { return 30 + this.fileNameLength() + this.extraFieldLength(); }
        useUTF8() { return (this.flags() & 0x800) === 0x800; }
    }
    /**
     * 4.3.8  File data
     *
     *   Immediately following the local header for a file
     *   SHOULD be placed the compressed or stored data for the file.
     *   If the file is encrypted, the encryption header for the file
     *   SHOULD be placed after the local header and before the file
     *   data. The series of [local file header][encryption header]
     *   [file data][data descriptor] repeats for each file in the
     *   .ZIP archive.
     *
     *   Zero-byte files, directories, and other file types that
     *   contain no content MUST not include file data.
     */
    class FileData {
        constructor(header, record, data) {
            this.header = header;
            this.record = record;
            this.data = data;
        }
        decompress() {
            // Check the compression
            const compressionMethod = this.header.compressionMethod();
            const fcn = decompressionMethods[compressionMethod];
            if (fcn) {
                return fcn(this.data, this.record.compressedSize(), this.record.uncompressedSize(), this.record.flag());
            }
            else {
                let name = CompressionMethod[compressionMethod];
                if (!name) {
                    name = `Unknown: ${compressionMethod}`;
                }
                throw new ApiError(ErrorCode.EINVAL, `Invalid compression method on file '${this.header.fileName()}': ${name}`);
            }
        }
        getHeader() {
            return this.header;
        }
        getRecord() {
            return this.record;
        }
        getRawData() {
            return this.data;
        }
    }
    /**
     * 4.3.9  Data descriptor:
     *
     *    crc-32                          4 bytes
     *    compressed size                 4 bytes
     *    uncompressed size               4 bytes
     */
    class DataDescriptor {
        constructor(data) {
            this.data = data;
        }
        crc32() { return this.data.readUInt32LE(0); }
        compressedSize() { return this.data.readUInt32LE(4); }
        uncompressedSize() { return this.data.readUInt32LE(8); }
    }
    /*
    ` 4.3.10  Archive decryption header:

          4.3.10.1 The Archive Decryption Header is introduced in version 6.2
          of the ZIP format specification.  This record exists in support
          of the Central Directory Encryption Feature implemented as part of
          the Strong Encryption Specification as described in this document.
          When the Central Directory Structure is encrypted, this decryption
          header MUST precede the encrypted data segment.
     */
    /**
     * 4.3.11  Archive extra data record:
     *
     *      archive extra data signature    4 bytes  (0x08064b50)
     *      extra field length              4 bytes
     *      extra field data                (variable size)
     *
     *    4.3.11.1 The Archive Extra Data Record is introduced in version 6.2
     *    of the ZIP format specification.  This record MAY be used in support
     *    of the Central Directory Encryption Feature implemented as part of
     *    the Strong Encryption Specification as described in this document.
     *    When present, this record MUST immediately precede the central
     *    directory data structure.
     */
    class ArchiveExtraDataRecord {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x08064b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid archive extra data record signature: " + this.data.readUInt32LE(0));
            }
        }
        length() { return this.data.readUInt32LE(4); }
        extraFieldData() { return this.data.slice(8, 8 + this.length()); }
    }
    /**
     * 4.3.13 Digital signature:
     *
     *      header signature                4 bytes  (0x05054b50)
     *      size of data                    2 bytes
     *      signature data (variable size)
     *
     *    With the introduction of the Central Directory Encryption
     *    feature in version 6.2 of this specification, the Central
     *    Directory Structure MAY be stored both compressed and encrypted.
     *    Although not required, it is assumed when encrypting the
     *    Central Directory Structure, that it will be compressed
     *    for greater storage efficiency.  Information on the
     *    Central Directory Encryption feature can be found in the section
     *    describing the Strong Encryption Specification. The Digital
     *    Signature record will be neither compressed nor encrypted.
     */
    class DigitalSignature {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x05054b50) {
                throw new ApiError(ErrorCode.EINVAL, "Invalid digital signature signature: " + this.data.readUInt32LE(0));
            }
        }
        size() { return this.data.readUInt16LE(4); }
        signatureData() { return this.data.slice(6, 6 + this.size()); }
    }
    /**
     * 4.3.12  Central directory structure:
     *
     *  central file header signature   4 bytes  (0x02014b50)
     *  version made by                 2 bytes
     *  version needed to extract       2 bytes
     *  general purpose bit flag        2 bytes
     *  compression method              2 bytes
     *  last mod file time              2 bytes
     *  last mod file date              2 bytes
     *  crc-32                          4 bytes
     *  compressed size                 4 bytes
     *  uncompressed size               4 bytes
     *  file name length                2 bytes
     *  extra field length              2 bytes
     *  file comment length             2 bytes
     *  disk number start               2 bytes
     *  internal file attributes        2 bytes
     *  external file attributes        4 bytes
     *  relative offset of local header 4 bytes
     *
     *  file name (variable size)
     *  extra field (variable size)
     *  file comment (variable size)
     */
    class CentralDirectory {
        constructor(zipData, data) {
            this.zipData = zipData;
            this.data = data;
            // Sanity check.
            if (this.data.readUInt32LE(0) !== 0x02014b50) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid Zip file: Central directory record has invalid signature: ${this.data.readUInt32LE(0)}`);
            }
            this._filename = this.produceFilename();
        }
        versionMadeBy() { return this.data.readUInt16LE(4); }
        versionNeeded() { return this.data.readUInt16LE(6); }
        flag() { return this.data.readUInt16LE(8); }
        compressionMethod() { return this.data.readUInt16LE(10); }
        lastModFileTime() {
            // Time and date is in MS-DOS format.
            return msdos2date(this.data.readUInt16LE(12), this.data.readUInt16LE(14));
        }
        rawLastModFileTime() {
            return this.data.readUInt32LE(12);
        }
        crc32() { return this.data.readUInt32LE(16); }
        compressedSize() { return this.data.readUInt32LE(20); }
        uncompressedSize() { return this.data.readUInt32LE(24); }
        fileNameLength() { return this.data.readUInt16LE(28); }
        extraFieldLength() { return this.data.readUInt16LE(30); }
        fileCommentLength() { return this.data.readUInt16LE(32); }
        diskNumberStart() { return this.data.readUInt16LE(34); }
        internalAttributes() { return this.data.readUInt16LE(36); }
        externalAttributes() { return this.data.readUInt32LE(38); }
        headerRelativeOffset() { return this.data.readUInt32LE(42); }
        produceFilename() {
            /*
              4.4.17.1 claims:
              * All slashes are forward ('/') slashes.
              * Filename doesn't begin with a slash.
              * No drive letters or any nonsense like that.
              * If filename is missing, the input came from standard input.
        
              Unfortunately, this isn't true in practice. Some Windows zip utilities use
              a backslash here, but the correct Unix-style path in file headers.
        
              To avoid seeking all over the file to recover the known-good filenames
              from file headers, we simply convert '/' to '\' here.
            */
            const fileName = safeToString(this.data, this.useUTF8(), 46, this.fileNameLength());
            return fileName.replace(/\\/g, "/");
        }
        fileName() {
            return this._filename;
        }
        rawFileName() {
            return this.data.slice(46, 46 + this.fileNameLength());
        }
        extraField() {
            const start = 44 + this.fileNameLength();
            return this.data.slice(start, start + this.extraFieldLength());
        }
        fileComment() {
            const start = 46 + this.fileNameLength() + this.extraFieldLength();
            return safeToString(this.data, this.useUTF8(), start, this.fileCommentLength());
        }
        rawFileComment() {
            const start = 46 + this.fileNameLength() + this.extraFieldLength();
            return this.data.slice(start, start + this.fileCommentLength());
        }
        totalSize() {
            return 46 + this.fileNameLength() + this.extraFieldLength() + this.fileCommentLength();
        }
        isDirectory() {
            // NOTE: This assumes that the zip file implementation uses the lower byte
            //       of external attributes for DOS attributes for
            //       backwards-compatibility. This is not mandated, but appears to be
            //       commonplace.
            //       According to the spec, the layout of external attributes is
            //       platform-dependent.
            //       If that fails, we also check if the name of the file ends in '/',
            //       which is what Java's ZipFile implementation does.
            const fileName = this.fileName();
            return (this.externalAttributes() & 0x10 ? true : false) || (fileName.charAt(fileName.length - 1) === '/');
        }
        isFile() { return !this.isDirectory(); }
        useUTF8() { return (this.flag() & 0x800) === 0x800; }
        isEncrypted() { return (this.flag() & 0x1) === 0x1; }
        getFileData() {
            // Need to grab the header before we can figure out where the actual
            // compressed data starts.
            const start = this.headerRelativeOffset();
            const header = new FileHeader(this.zipData.slice(start));
            return new FileData(header, this, this.zipData.slice(start + header.totalSize()));
        }
        getData() {
            return this.getFileData().decompress();
        }
        getRawData() {
            return this.getFileData().getRawData();
        }
        getStats() {
            return new Stats(FileType.FILE, this.uncompressedSize(), 0x16D, Date.now(), this.lastModFileTime().getTime());
        }
    }
    /**
     * 4.3.16: end of central directory record
     *  end of central dir signature    4 bytes  (0x06054b50)
     *  number of this disk             2 bytes
     *  number of the disk with the
     *  start of the central directory  2 bytes
     *  total number of entries in the
     *  central directory on this disk  2 bytes
     *  total number of entries in
     *  the central directory           2 bytes
     *  size of the central directory   4 bytes
     *  offset of start of central
     *  directory with respect to
     *  the starting disk number        4 bytes
     *  .ZIP file comment length        2 bytes
     *  .ZIP file comment       (variable size)
     */
    class EndOfCentralDirectory {
        constructor(data) {
            this.data = data;
            if (this.data.readUInt32LE(0) !== 0x06054b50) {
                throw new ApiError(ErrorCode.EINVAL, `Invalid Zip file: End of central directory record has invalid signature: ${this.data.readUInt32LE(0)}`);
            }
        }
        diskNumber() { return this.data.readUInt16LE(4); }
        cdDiskNumber() { return this.data.readUInt16LE(6); }
        cdDiskEntryCount() { return this.data.readUInt16LE(8); }
        cdTotalEntryCount() { return this.data.readUInt16LE(10); }
        cdSize() { return this.data.readUInt32LE(12); }
        cdOffset() { return this.data.readUInt32LE(16); }
        cdZipCommentLength() { return this.data.readUInt16LE(20); }
        cdZipComment() {
            // Assuming UTF-8. The specification doesn't specify.
            return safeToString(this.data, true, 22, this.cdZipCommentLength());
        }
        rawCdZipComment() {
            return this.data.slice(22, 22 + this.cdZipCommentLength());
        }
    }
    /**
     * Contains the table of contents of a Zip file.
     */
    class ZipTOC {
        constructor(index, directoryEntries, eocd, data) {
            this.index = index;
            this.directoryEntries = directoryEntries;
            this.eocd = eocd;
            this.data = data;
        }
    }
    /**
     * Zip file-backed filesystem
     * Implemented according to the standard:
     * http://www.pkware.com/documents/casestudies/APPNOTE.TXT
     *
     * While there are a few zip libraries for JavaScript (e.g. JSZip and zip.js),
     * they are not a good match for BrowserFS. In particular, these libraries
     * perform a lot of unneeded data copying, and eagerly decompress every file
     * in the zip file upon loading to check the CRC32. They also eagerly decode
     * strings. Furthermore, these libraries duplicate functionality already present
     * in BrowserFS (e.g. UTF-8 decoding and binary data manipulation).
     *
     * This filesystem takes advantage of BrowserFS's Buffer implementation, which
     * efficiently represents the zip file in memory (in both ArrayBuffer-enabled
     * browsers *and* non-ArrayBuffer browsers), and which can neatly be 'sliced'
     * without copying data. Each struct defined in the standard is represented with
     * a buffer slice pointing to an offset in the zip file, and has getters for
     * each field. As we anticipate that this data will not be read often, we choose
     * not to store each struct field in the JavaScript object; instead, to reduce
     * memory consumption, we retrieve it directly from the binary data each time it
     * is requested.
     *
     * When the filesystem is instantiated, we determine the directory structure
     * of the zip file as quickly as possible. We lazily decompress and check the
     * CRC32 of files. We do not cache decompressed files; if this is a desired
     * feature, it is best implemented as a generic file system wrapper that can
     * cache data from arbitrary file systems.
     *
     * For inflation, we use `pako`'s implementation:
     * https://github.com/nodeca/pako
     *
     * Current limitations:
     * * No encryption.
     * * No ZIP64 support.
     * * Read-only.
     *   Write support would require that we:
     *   - Keep track of changed/new files.
     *   - Compress changed files, and generate appropriate metadata for each.
     *   - Update file offsets for other files in the zip file.
     *   - Stream it out to a location.
     *   This isn't that bad, so we might do this at a later date.
     */
    class ZipFS extends SynchronousFileSystem {
        constructor(input, name = '') {
            super();
            this.name = name;
            this._index = new FileIndex();
            this._directoryEntries = [];
            this._eocd = null;
            this._index = input.index;
            this._directoryEntries = input.directoryEntries;
            this._eocd = input.eocd;
            this.data = input.data;
        }
        /**
         * Constructs a ZipFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                ZipFS._computeIndex(opts.zipData, (e, zipTOC) => {
                    if (zipTOC) {
                        const fs = new ZipFS(zipTOC, opts.name);
                        cb(null, fs);
                    }
                    else {
                        cb(e);
                    }
                });
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() { return true; }
        static RegisterDecompressionMethod(m, fcn) {
            decompressionMethods[m] = fcn;
        }
        /**
         * Locates the end of central directory record at the end of the file.
         * Throws an exception if it cannot be found.
         */
        static _getEOCD(data) {
            // Unfortunately, the comment is variable size and up to 64K in size.
            // We assume that the magic signature does not appear in the comment, and
            // in the bytes between the comment and the signature. Other ZIP
            // implementations make this same assumption, since the alternative is to
            // read thread every entry in the file to get to it. :(
            // These are *negative* offsets from the end of the file.
            const startOffset = 22;
            const endOffset = Math.min(startOffset + 0xFFFF, data.length - 1);
            // There's not even a byte alignment guarantee on the comment so we need to
            // search byte by byte. *grumble grumble*
            for (let i = startOffset; i < endOffset; i++) {
                // Magic number: EOCD Signature
                if (data.readUInt32LE(data.length - i) === 0x06054b50) {
                    return new EndOfCentralDirectory(data.slice(data.length - i));
                }
            }
            throw new ApiError(ErrorCode.EINVAL, "Invalid ZIP file: Could not locate End of Central Directory signature.");
        }
        static _addToIndex(cd, index) {
            // Paths must be absolute, yet zip file paths are always relative to the
            // zip root. So we append '/' and call it a day.
            let filename = cd.fileName();
            if (filename.charAt(0) === '/') {
                throw new ApiError(ErrorCode.EPERM, `Unexpectedly encountered an absolute path in a zip file. Please file a bug.`);
            }
            // XXX: For the file index, strip the trailing '/'.
            if (filename.charAt(filename.length - 1) === '/') {
                filename = filename.substr(0, filename.length - 1);
            }
            if (cd.isDirectory()) {
                index.addPathFast('/' + filename, new DirInode(cd));
            }
            else {
                index.addPathFast('/' + filename, new FileInode(cd));
            }
        }
        static _computeIndex(data, cb) {
            try {
                const index = new FileIndex();
                const eocd = ZipFS._getEOCD(data);
                if (eocd.diskNumber() !== eocd.cdDiskNumber()) {
                    return cb(new ApiError(ErrorCode.EINVAL, "ZipFS does not support spanned zip files."));
                }
                const cdPtr = eocd.cdOffset();
                if (cdPtr === 0xFFFFFFFF) {
                    return cb(new ApiError(ErrorCode.EINVAL, "ZipFS does not support Zip64."));
                }
                const cdEnd = cdPtr + eocd.cdSize();
                ZipFS._computeIndexResponsive(data, index, cdPtr, cdEnd, cb, [], eocd);
            }
            catch (e) {
                cb(e);
            }
        }
        static _computeIndexResponsiveTrampoline(data, index, cdPtr, cdEnd, cb, cdEntries, eocd) {
            try {
                ZipFS._computeIndexResponsive(data, index, cdPtr, cdEnd, cb, cdEntries, eocd);
            }
            catch (e) {
                cb(e);
            }
        }
        static _computeIndexResponsive(data, index, cdPtr, cdEnd, cb, cdEntries, eocd) {
            if (cdPtr < cdEnd) {
                let count = 0;
                while (count++ < 200 && cdPtr < cdEnd) {
                    const cd = new CentralDirectory(data, data.slice(cdPtr));
                    ZipFS._addToIndex(cd, index);
                    cdPtr += cd.totalSize();
                    cdEntries.push(cd);
                }
                setImmediate(() => {
                    ZipFS._computeIndexResponsiveTrampoline(data, index, cdPtr, cdEnd, cb, cdEntries, eocd);
                });
            }
            else {
                cb(null, new ZipTOC(index, cdEntries, eocd, data));
            }
        }
        getName() {
            return ZipFS.Name + (this.name !== '' ? ` ${this.name}` : '');
        }
        /**
         * Get the CentralDirectory object for the given path.
         */
        getCentralDirectoryEntry(path) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            if (isFileInode(inode)) {
                return inode.getData();
            }
            else if (isDirInode(inode)) {
                return inode.getData();
            }
            else {
                // Should never occur.
                throw ApiError.EPERM(`Invalid inode: ${inode}`);
            }
        }
        getCentralDirectoryEntryAt(index) {
            const dirEntry = this._directoryEntries[index];
            if (!dirEntry) {
                throw new RangeError(`Invalid directory index: ${index}.`);
            }
            return dirEntry;
        }
        getNumberOfCentralDirectoryEntries() {
            return this._directoryEntries.length;
        }
        getEndOfCentralDirectory() {
            return this._eocd;
        }
        diskSpace(path, cb) {
            // Read-only file system.
            cb(this.data.length, 0);
        }
        isReadOnly() {
            return true;
        }
        supportsLinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return true;
        }
        statSync(path, isLstat) {
            const inode = this._index.getInode(path);
            if (inode === null) {
                throw ApiError.ENOENT(path);
            }
            let stats;
            if (isFileInode(inode)) {
                stats = inode.getData().getStats();
            }
            else if (isDirInode(inode)) {
                stats = inode.getStats();
            }
            else {
                throw new ApiError(ErrorCode.EINVAL, "Invalid inode.");
            }
            return stats;
        }
        openSync(path, flags, mode) {
            // INVARIANT: Cannot write to RO file systems.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, path);
            }
            // Check if the path exists, and is a file.
            const inode = this._index.getInode(path);
            if (!inode) {
                throw ApiError.ENOENT(path);
            }
            else if (isFileInode(inode)) {
                const cdRecord = inode.getData();
                const stats = cdRecord.getStats();
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(path);
                    case ActionType.NOP:
                        return new NoSyncFile(this, path, flags, stats, cdRecord.getData());
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(path);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const inode = this._index.getInode(path);
            if (!inode) {
                throw ApiError.ENOENT(path);
            }
            else if (isDirInode(inode)) {
                return inode.getListing();
            }
            else {
                throw ApiError.ENOTDIR(path);
            }
        }
        /**
         * Specially-optimized readfile.
         */
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    return copyingSlice(fdBuff);
                }
                return fdBuff.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
    }
    ZipFS.Name = "ZipFS";
    ZipFS.Options = {
        zipData: {
            type: "object",
            description: "The zip file as a Buffer object.",
            validator: bufferValidator
        },
        name: {
            type: "string",
            optional: true,
            description: "The name of the zip file (optional)."
        }
    };
    ZipFS.CompressionMethod = CompressionMethod;
    ZipFS.RegisterDecompressionMethod(CompressionMethod.DEFLATE, (data, compressedSize, uncompressedSize) => {
        return arrayish2Buffer(inflateRaw(data.slice(0, compressedSize), { chunkSize: uncompressedSize }));
    });
    ZipFS.RegisterDecompressionMethod(CompressionMethod.STORED, (data, compressedSize, uncompressedSize) => {
        return copyingSlice(data, 0, uncompressedSize);
    });

    return ZipFS;

});
define('skylark-browserfs/backend/IsoFS',[
    '../core/api_error',
    '../core/node_fs_stats',
    '../core/file_system',
    '../core/file_flag',
    '../generic/preload_file',
    '../core/util',
    '../libs/path'
], function (api_error,  node_fs_stats,file_system, file_flag, preload_file, util, path) {
    'use strict';

    const { ApiError, ErrorCode } = api_error;
    const { Stats, FileType }  = node_fs_stats;
    const { SynchronousFileSystem }  = file_system;
    const { ActionType }  = file_flag;
    const { NoSyncFile }  = preload_file;
    const { copyingSlice, bufferValidator }  = util;

    /**
     * @hidden
     */
    const rockRidgeIdentifier = "IEEE_P1282";
    /**
     * @hidden
     */
    function getASCIIString(data, startIndex, length) {
        return data.toString('ascii', startIndex, startIndex + length).trim();
    }
    /**
     * @hidden
     */
    function getJolietString(data, startIndex, length) {
        if (length === 1) {
            // Special: Root, parent, current directory are still a single byte.
            return String.fromCharCode(data[startIndex]);
        }
        // UTF16-BE, which isn't natively supported by NodeJS Buffers.
        // Length should be even, but pessimistically floor just in case.
        const pairs = Math.floor(length / 2);
        const chars = new Array(pairs);
        for (let i = 0; i < pairs; i++) {
            const pos = startIndex + (i << 1);
            chars[i] = String.fromCharCode(data[pos + 1] | (data[pos] << 8));
        }
        return chars.join('');
    }
    /**
     * @hidden
     */
    function getDate(data, startIndex) {
        const year = parseInt(getASCIIString(data, startIndex, 4), 10);
        const mon = parseInt(getASCIIString(data, startIndex + 4, 2), 10);
        const day = parseInt(getASCIIString(data, startIndex + 6, 2), 10);
        const hour = parseInt(getASCIIString(data, startIndex + 8, 2), 10);
        const min = parseInt(getASCIIString(data, startIndex + 10, 2), 10);
        const sec = parseInt(getASCIIString(data, startIndex + 12, 2), 10);
        const hundrethsSec = parseInt(getASCIIString(data, startIndex + 14, 2), 10);
        // Last is a time-zone offset, but JavaScript dates don't support time zones well.
        return new Date(year, mon, day, hour, min, sec, hundrethsSec * 100);
    }
    /**
     * @hidden
     */
    function getShortFormDate(data, startIndex) {
        const yearsSince1900 = data[startIndex];
        const month = data[startIndex + 1];
        const day = data[startIndex + 2];
        const hour = data[startIndex + 3];
        const minute = data[startIndex + 4];
        const second = data[startIndex + 5];
        // JavaScript's Date support isn't so great; ignore timezone.
        // const offsetFromGMT = this._data[24];
        return new Date(yearsSince1900, month - 1, day, hour, minute, second);
    }
    /**
     * @hidden
     */
    function constructSystemUseEntry(bigData, i) {
        const data = bigData.slice(i);
        const sue = new SystemUseEntry(data);
        switch (sue.signatureWord()) {
            case 17221 /* CE */:
                return new CEEntry(data);
            case 20548 /* PD */:
                return new PDEntry(data);
            case 21328 /* SP */:
                return new SPEntry(data);
            case 21332 /* ST */:
                return new STEntry(data);
            case 17746 /* ER */:
                return new EREntry(data);
            case 17747 /* ES */:
                return new ESEntry(data);
            case 20568 /* PX */:
                return new PXEntry(data);
            case 20558 /* PN */:
                return new PNEntry(data);
            case 21324 /* SL */:
                return new SLEntry(data);
            case 20045 /* NM */:
                return new NMEntry(data);
            case 17228 /* CL */:
                return new CLEntry(data);
            case 20556 /* PL */:
                return new PLEntry(data);
            case 21061 /* RE */:
                return new REEntry(data);
            case 21574 /* TF */:
                return new TFEntry(data);
            case 21318 /* SF */:
                return new SFEntry(data);
            case 21074 /* RR */:
                return new RREntry(data);
            default:
                return sue;
        }
    }
    /**
     * @hidden
     */
    function constructSystemUseEntries(data, i, len, isoData) {
        // If the remaining allocated space following the last recorded System Use Entry in a System
        // Use field or Continuation Area is less than four bytes long, it cannot contain a System
        // Use Entry and shall be ignored
        len = len - 4;
        let entries = new Array();
        while (i < len) {
            const entry = constructSystemUseEntry(data, i);
            const length = entry.length();
            if (length === 0) {
                // Invalid SU section; prevent infinite loop.
                return entries;
            }
            i += length;
            if (entry instanceof STEntry) {
                // ST indicates the end of entries.
                break;
            }
            if (entry instanceof CEEntry) {
                entries = entries.concat(entry.getEntries(isoData));
            }
            else {
                entries.push(entry);
            }
        }
        return entries;
    }
    /**
     * @hidden
     */
    class VolumeDescriptor {
        constructor(data) {
            this._data = data;
        }
        type() {
            return this._data[0];
        }
        standardIdentifier() {
            return getASCIIString(this._data, 1, 5);
        }
        version() {
            return this._data[6];
        }
        data() {
            return this._data.slice(7, 2048);
        }
    }
    /**
     * @hidden
     */
    class PrimaryOrSupplementaryVolumeDescriptor extends VolumeDescriptor {
        constructor(data) {
            super(data);
            this._root = null;
        }
        systemIdentifier() {
            return this._getString32(8);
        }
        volumeIdentifier() {
            return this._getString32(40);
        }
        volumeSpaceSize() {
            return this._data.readUInt32LE(80);
        }
        volumeSetSize() {
            return this._data.readUInt16LE(120);
        }
        volumeSequenceNumber() {
            return this._data.readUInt16LE(124);
        }
        logicalBlockSize() {
            return this._data.readUInt16LE(128);
        }
        pathTableSize() {
            return this._data.readUInt32LE(132);
        }
        locationOfTypeLPathTable() {
            return this._data.readUInt32LE(140);
        }
        locationOfOptionalTypeLPathTable() {
            return this._data.readUInt32LE(144);
        }
        locationOfTypeMPathTable() {
            return this._data.readUInt32BE(148);
        }
        locationOfOptionalTypeMPathTable() {
            return this._data.readUInt32BE(152);
        }
        rootDirectoryEntry(isoData) {
            if (this._root === null) {
                this._root = this._constructRootDirectoryRecord(this._data.slice(156));
                this._root.rootCheckForRockRidge(isoData);
            }
            return this._root;
        }
        volumeSetIdentifier() {
            return this._getString(190, 128);
        }
        publisherIdentifier() {
            return this._getString(318, 128);
        }
        dataPreparerIdentifier() {
            return this._getString(446, 128);
        }
        applicationIdentifier() {
            return this._getString(574, 128);
        }
        copyrightFileIdentifier() {
            return this._getString(702, 38);
        }
        abstractFileIdentifier() {
            return this._getString(740, 36);
        }
        bibliographicFileIdentifier() {
            return this._getString(776, 37);
        }
        volumeCreationDate() {
            return getDate(this._data, 813);
        }
        volumeModificationDate() {
            return getDate(this._data, 830);
        }
        volumeExpirationDate() {
            return getDate(this._data, 847);
        }
        volumeEffectiveDate() {
            return getDate(this._data, 864);
        }
        fileStructureVersion() {
            return this._data[881];
        }
        applicationUsed() {
            return this._data.slice(883, 883 + 512);
        }
        reserved() {
            return this._data.slice(1395, 1395 + 653);
        }
        _getString32(idx) {
            return this._getString(idx, 32);
        }
    }
    /**
     * @hidden
     */
    class PrimaryVolumeDescriptor extends PrimaryOrSupplementaryVolumeDescriptor {
        constructor(data) {
            super(data);
            if (this.type() !== 1 /* PrimaryVolumeDescriptor */) {
                throw new ApiError(ErrorCode.EIO, `Invalid primary volume descriptor.`);
            }
        }
        name() {
            return "ISO9660";
        }
        _constructRootDirectoryRecord(data) {
            return new ISODirectoryRecord(data, -1);
        }
        _getString(idx, len) {
            return this._getString(idx, len);
        }
    }
    /**
     * @hidden
     */
    class SupplementaryVolumeDescriptor extends PrimaryOrSupplementaryVolumeDescriptor {
        constructor(data) {
            super(data);
            if (this.type() !== 2 /* SupplementaryVolumeDescriptor */) {
                throw new ApiError(ErrorCode.EIO, `Invalid supplementary volume descriptor.`);
            }
            const escapeSequence = this.escapeSequence();
            const third = escapeSequence[2];
            // Third character identifies what 'level' of the UCS specification to follow.
            // We ignore it.
            if (escapeSequence[0] !== 0x25 || escapeSequence[1] !== 0x2F ||
                (third !== 0x40 && third !== 0x43 && third !== 0x45)) {
                throw new ApiError(ErrorCode.EIO, `Unrecognized escape sequence for SupplementaryVolumeDescriptor: ${escapeSequence.toString()}`);
            }
        }
        name() {
            return "Joliet";
        }
        escapeSequence() {
            return this._data.slice(88, 120);
        }
        _constructRootDirectoryRecord(data) {
            return new JolietDirectoryRecord(data, -1);
        }
        _getString(idx, len) {
            return getJolietString(this._data, idx, len);
        }
    }
    /**
     * @hidden
     */
    class DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            this._suEntries = null;
            this._fileOrDir = null;
            this._data = data;
            this._rockRidgeOffset = rockRidgeOffset;
        }
        hasRockRidge() {
            return this._rockRidgeOffset > -1;
        }
        getRockRidgeOffset() {
            return this._rockRidgeOffset;
        }
        /**
         * !!ONLY VALID ON ROOT NODE!!
         * Checks if Rock Ridge is enabled, and sets the offset.
         */
        rootCheckForRockRidge(isoData) {
            const dir = this.getDirectory(isoData);
            this._rockRidgeOffset = dir.getDotEntry(isoData)._getRockRidgeOffset(isoData);
            if (this._rockRidgeOffset > -1) {
                // Wipe out directory. Start over with RR knowledge.
                this._fileOrDir = null;
            }
        }
        length() {
            return this._data[0];
        }
        extendedAttributeRecordLength() {
            return this._data[1];
        }
        lba() {
            return this._data.readUInt32LE(2) * 2048;
        }
        dataLength() {
            return this._data.readUInt32LE(10);
        }
        recordingDate() {
            return getShortFormDate(this._data, 18);
        }
        fileFlags() {
            return this._data[25];
        }
        fileUnitSize() {
            return this._data[26];
        }
        interleaveGapSize() {
            return this._data[27];
        }
        volumeSequenceNumber() {
            return this._data.readUInt16LE(28);
        }
        identifier() {
            return this._getString(33, this._data[32]);
        }
        fileName(isoData) {
            if (this.hasRockRidge()) {
                const fn = this._rockRidgeFilename(isoData);
                if (fn !== null) {
                    return fn;
                }
            }
            const ident = this.identifier();
            if (this.isDirectory(isoData)) {
                return ident;
            }
            // Files:
            // - MUST have 0x2E (.) separating the name from the extension
            // - MUST have 0x3B (;) separating the file name and extension from the version
            // Gets expanded to two-byte char in Unicode directory records.
            const versionSeparator = ident.indexOf(';');
            if (versionSeparator === -1) {
                // Some Joliet filenames lack the version separator, despite the standard
                // specifying that it should be there.
                return ident;
            }
            else if (ident[versionSeparator - 1] === '.') {
                // Empty extension. Do not include '.' in the filename.
                return ident.slice(0, versionSeparator - 1);
            }
            else {
                // Include up to version separator.
                return ident.slice(0, versionSeparator);
            }
        }
        isDirectory(isoData) {
            let rv = !!(this.fileFlags() & 2 /* Directory */);
            // If it lacks the Directory flag, it may still be a directory if we've exceeded the directory
            // depth limit. Rock Ridge marks these as files and adds a special attribute.
            if (!rv && this.hasRockRidge()) {
                rv = this.getSUEntries(isoData).filter((e) => e instanceof CLEntry).length > 0;
            }
            return rv;
        }
        isSymlink(isoData) {
            return this.hasRockRidge() && this.getSUEntries(isoData).filter((e) => e instanceof SLEntry).length > 0;
        }
        getSymlinkPath(isoData) {
            let p = "";
            const entries = this.getSUEntries(isoData);
            const getStr = this._getGetString();
            for (const entry of entries) {
                if (entry instanceof SLEntry) {
                    const components = entry.componentRecords();
                    for (const component of components) {
                        const flags = component.flags();
                        if (flags & 2 /* CURRENT */) {
                            p += "./";
                        }
                        else if (flags & 4 /* PARENT */) {
                            p += "../";
                        }
                        else if (flags & 8 /* ROOT */) {
                            p += "/";
                        }
                        else {
                            p += component.content(getStr);
                            if (!(flags & 1 /* CONTINUE */)) {
                                p += '/';
                            }
                        }
                    }
                    if (!entry.continueFlag()) {
                        // We are done with this link.
                        break;
                    }
                }
            }
            if (p.length > 1 && p[p.length - 1] === '/') {
                // Trim trailing '/'.
                return p.slice(0, p.length - 1);
            }
            else {
                return p;
            }
        }
        getFile(isoData) {
            if (this.isDirectory(isoData)) {
                throw new Error(`Tried to get a File from a directory.`);
            }
            if (this._fileOrDir === null) {
                this._fileOrDir = isoData.slice(this.lba(), this.lba() + this.dataLength());
            }
            return this._fileOrDir;
        }
        getDirectory(isoData) {
            if (!this.isDirectory(isoData)) {
                throw new Error(`Tried to get a Directory from a file.`);
            }
            if (this._fileOrDir === null) {
                this._fileOrDir = this._constructDirectory(isoData);
            }
            return this._fileOrDir;
        }
        getSUEntries(isoData) {
            if (!this._suEntries) {
                this._constructSUEntries(isoData);
            }
            return this._suEntries;
        }
        _rockRidgeFilename(isoData) {
            const nmEntries = this.getSUEntries(isoData).filter((e) => e instanceof NMEntry);
            if (nmEntries.length === 0 || nmEntries[0].flags() & (2 /* CURRENT */ | 4 /* PARENT */)) {
                return null;
            }
            let str = '';
            const getString = this._getGetString();
            for (const e of nmEntries) {
                str += e.name(getString);
                if (!(e.flags() & 1 /* CONTINUE */)) {
                    break;
                }
            }
            return str;
        }
        _constructSUEntries(isoData) {
            let i = 33 + this._data[32];
            if (i % 2 === 1) {
                // Skip padding field.
                i++;
            }
            i += this._rockRidgeOffset;
            this._suEntries = constructSystemUseEntries(this._data, i, this.length(), isoData);
        }
        /**
         * !!ONLY VALID ON FIRST ENTRY OF ROOT DIRECTORY!!
         * Returns -1 if rock ridge is not enabled. Otherwise, returns the offset
         * at which system use fields begin.
         */
        _getRockRidgeOffset(isoData) {
            // In the worst case, we get some garbage SU entries.
            // Fudge offset to 0 before proceeding.
            this._rockRidgeOffset = 0;
            const suEntries = this.getSUEntries(isoData);
            if (suEntries.length > 0) {
                const spEntry = suEntries[0];
                if (spEntry instanceof SPEntry && spEntry.checkBytesPass()) {
                    // SUSP is in use.
                    for (let i = 1; i < suEntries.length; i++) {
                        const entry = suEntries[i];
                        if (entry instanceof RREntry || (entry instanceof EREntry && entry.extensionIdentifier() === rockRidgeIdentifier)) {
                            // Rock Ridge is in use!
                            return spEntry.bytesSkipped();
                        }
                    }
                }
            }
            // Failed.
            this._rockRidgeOffset = -1;
            return -1;
        }
    }
    /**
     * @hidden
     */
    class ISODirectoryRecord extends DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            super(data, rockRidgeOffset);
        }
        _getString(i, len) {
            return getASCIIString(this._data, i, len);
        }
        _constructDirectory(isoData) {
            return new ISODirectory(this, isoData);
        }
        _getGetString() {
            return getASCIIString;
        }
    }
    /**
     * @hidden
     */
    class JolietDirectoryRecord extends DirectoryRecord {
        constructor(data, rockRidgeOffset) {
            super(data, rockRidgeOffset);
        }
        _getString(i, len) {
            return getJolietString(this._data, i, len);
        }
        _constructDirectory(isoData) {
            return new JolietDirectory(this, isoData);
        }
        _getGetString() {
            return getJolietString;
        }
    }
    /**
     * @hidden
     */
    class SystemUseEntry {
        constructor(data) {
            this._data = data;
        }
        signatureWord() {
            return this._data.readUInt16BE(0);
        }
        signatureWordString() {
            return getASCIIString(this._data, 0, 2);
        }
        length() {
            return this._data[2];
        }
        suVersion() {
            return this._data[3];
        }
    }
    /**
     * Continuation entry.
     * @hidden
     */
    class CEEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
            this._entries = null;
        }
        /**
         * Logical block address of the continuation area.
         */
        continuationLba() {
            return this._data.readUInt32LE(4);
        }
        /**
         * Offset into the logical block.
         */
        continuationLbaOffset() {
            return this._data.readUInt32LE(12);
        }
        /**
         * Length of the continuation area.
         */
        continuationLength() {
            return this._data.readUInt32LE(20);
        }
        getEntries(isoData) {
            if (!this._entries) {
                const start = this.continuationLba() * 2048 + this.continuationLbaOffset();
                this._entries = constructSystemUseEntries(isoData, start, this.continuationLength(), isoData);
            }
            return this._entries;
        }
    }
    /**
     * Padding entry.
     * @hidden
     */
    class PDEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * Identifies that SUSP is in-use.
     * @hidden
     */
    class SPEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        checkBytesPass() {
            return this._data[4] === 0xBE && this._data[5] === 0xEF;
        }
        bytesSkipped() {
            return this._data[6];
        }
    }
    /**
     * Identifies the end of the SUSP entries.
     * @hidden
     */
    class STEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * Specifies system-specific extensions to SUSP.
     * @hidden
     */
    class EREntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        identifierLength() {
            return this._data[4];
        }
        descriptorLength() {
            return this._data[5];
        }
        sourceLength() {
            return this._data[6];
        }
        extensionVersion() {
            return this._data[7];
        }
        extensionIdentifier() {
            return getASCIIString(this._data, 8, this.identifierLength());
        }
        extensionDescriptor() {
            return getASCIIString(this._data, 8 + this.identifierLength(), this.descriptorLength());
        }
        extensionSource() {
            return getASCIIString(this._data, 8 + this.identifierLength() + this.descriptorLength(), this.sourceLength());
        }
    }
    /**
     * @hidden
     */
    class ESEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        extensionSequence() {
            return this._data[4];
        }
    }
    /**
     * RockRidge: Marks that RockRidge is in use [deprecated]
     * @hidden
     */
    class RREntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * RockRidge: Records POSIX file attributes.
     * @hidden
     */
    class PXEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        mode() {
            return this._data.readUInt32LE(4);
        }
        fileLinks() {
            return this._data.readUInt32LE(12);
        }
        uid() {
            return this._data.readUInt32LE(20);
        }
        gid() {
            return this._data.readUInt32LE(28);
        }
        inode() {
            return this._data.readUInt32LE(36);
        }
    }
    /**
     * RockRidge: Records POSIX device number.
     * @hidden
     */
    class PNEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        devTHigh() {
            return this._data.readUInt32LE(4);
        }
        devTLow() {
            return this._data.readUInt32LE(12);
        }
    }
    /**
     * RockRidge: Records symbolic link
     * @hidden
     */
    class SLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        continueFlag() {
            return this.flags() & 0x1;
        }
        componentRecords() {
            const records = new Array();
            let i = 5;
            while (i < this.length()) {
                const record = new SLComponentRecord(this._data.slice(i));
                records.push(record);
                i += record.length();
            }
            return records;
        }
    }
    /**
     * @hidden
     */
    class SLComponentRecord {
        constructor(data) {
            this._data = data;
        }
        flags() {
            return this._data[0];
        }
        length() {
            return 2 + this.componentLength();
        }
        componentLength() {
            return this._data[1];
        }
        content(getString) {
            return getString(this._data, 2, this.componentLength());
        }
    }
    /**
     * RockRidge: Records alternate file name
     * @hidden
     */
    class NMEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        name(getString) {
            return getString(this._data, 5, this.length() - 5);
        }
    }
    /**
     * RockRidge: Records child link
     * @hidden
     */
    class CLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        childDirectoryLba() {
            return this._data.readUInt32LE(4);
        }
    }
    /**
     * RockRidge: Records parent link.
     * @hidden
     */
    class PLEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        parentDirectoryLba() {
            return this._data.readUInt32LE(4);
        }
    }
    /**
     * RockRidge: Records relocated directory.
     * @hidden
     */
    class REEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
    }
    /**
     * RockRidge: Records file timestamps
     * @hidden
     */
    class TFEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        flags() {
            return this._data[4];
        }
        creation() {
            if (this.flags() & 1 /* CREATION */) {
                if (this._longFormDates()) {
                    return getDate(this._data, 5);
                }
                else {
                    return getShortFormDate(this._data, 5);
                }
            }
            else {
                return null;
            }
        }
        modify() {
            if (this.flags() & 2 /* MODIFY */) {
                const previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        access() {
            if (this.flags() & 4 /* ACCESS */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        backup() {
            if (this.flags() & 16 /* BACKUP */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        expiration() {
            if (this.flags() & 32 /* EXPIRATION */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                previousDates += (this.flags() & 16 /* BACKUP */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        effective() {
            if (this.flags() & 64 /* EFFECTIVE */) {
                let previousDates = (this.flags() & 1 /* CREATION */) ? 1 : 0;
                previousDates += (this.flags() & 2 /* MODIFY */) ? 1 : 0;
                previousDates += (this.flags() & 4 /* ACCESS */) ? 1 : 0;
                previousDates += (this.flags() & 16 /* BACKUP */) ? 1 : 0;
                previousDates += (this.flags() & 32 /* EXPIRATION */) ? 1 : 0;
                if (this._longFormDates) {
                    return getDate(this._data, 5 + (previousDates * 17));
                }
                else {
                    return getShortFormDate(this._data, 5 + (previousDates * 7));
                }
            }
            else {
                return null;
            }
        }
        _longFormDates() {
            return !!(this.flags() && 128 /* LONG_FORM */);
        }
    }
    /**
     * RockRidge: File data in sparse format.
     * @hidden
     */
    class SFEntry extends SystemUseEntry {
        constructor(data) {
            super(data);
        }
        virtualSizeHigh() {
            return this._data.readUInt32LE(4);
        }
        virtualSizeLow() {
            return this._data.readUInt32LE(12);
        }
        tableDepth() {
            return this._data[20];
        }
    }
    /**
     * @hidden
     */
    class Directory {
        constructor(record, isoData) {
            this._fileList = [];
            this._fileMap = {};
            this._record = record;
            let i = record.lba();
            let iLimit = i + record.dataLength();
            if (!(record.fileFlags() & 2 /* Directory */)) {
                // Must have a CL entry.
                const cl = record.getSUEntries(isoData).filter((e) => e instanceof CLEntry)[0];
                i = cl.childDirectoryLba() * 2048;
                iLimit = Infinity;
            }
            while (i < iLimit) {
                const len = isoData[i];
                // Zero-padding between sectors.
                // TODO: Could optimize this to seek to nearest-sector upon
                // seeing a 0.
                if (len === 0) {
                    i++;
                    continue;
                }
                const r = this._constructDirectoryRecord(isoData.slice(i));
                const fname = r.fileName(isoData);
                // Skip '.' and '..' entries.
                if (fname !== '\u0000' && fname !== '\u0001') {
                    // Skip relocated entries.
                    if (!r.hasRockRidge() || r.getSUEntries(isoData).filter((e) => e instanceof REEntry).length === 0) {
                        this._fileMap[fname] = r;
                        this._fileList.push(fname);
                    }
                }
                else if (iLimit === Infinity) {
                    // First entry contains needed data.
                    iLimit = i + r.dataLength();
                }
                i += r.length();
            }
        }
        /**
         * Get the record with the given name.
         * Returns undefined if not present.
         */
        getRecord(name) {
            return this._fileMap[name];
        }
        getFileList() {
            return this._fileList;
        }
        getDotEntry(isoData) {
            return this._constructDirectoryRecord(isoData.slice(this._record.lba()));
        }
    }
    /**
     * @hidden
     */
    class ISODirectory extends Directory {
        constructor(record, isoData) {
            super(record, isoData);
        }
        _constructDirectoryRecord(data) {
            return new ISODirectoryRecord(data, this._record.getRockRidgeOffset());
        }
    }
    /**
     * @hidden
     */
    class JolietDirectory extends Directory {
        constructor(record, isoData) {
            super(record, isoData);
        }
        _constructDirectoryRecord(data) {
            return new JolietDirectoryRecord(data, this._record.getRockRidgeOffset());
        }
    }
    /**
     * Mounts an ISO file as a read-only file system.
     *
     * Supports:
     * * Vanilla ISO9660 ISOs
     * * Microsoft Joliet and Rock Ridge extensions to the ISO9660 standard
     */
    class IsoFS extends SynchronousFileSystem {
        /**
         * **Deprecated. Please use IsoFS.Create() method instead.**
         *
         * Constructs a read-only file system from the given ISO.
         * @param data The ISO file in a buffer.
         * @param name The name of the ISO (optional; used for debug messages / identification via getName()).
         */
        constructor(data, name = "") {
            super();
            this._data = data;
            // Skip first 16 sectors.
            let vdTerminatorFound = false;
            let i = 16 * 2048;
            const candidateVDs = new Array();
            while (!vdTerminatorFound) {
                const slice = data.slice(i);
                const vd = new VolumeDescriptor(slice);
                switch (vd.type()) {
                    case 1 /* PrimaryVolumeDescriptor */:
                        candidateVDs.push(new PrimaryVolumeDescriptor(slice));
                        break;
                    case 2 /* SupplementaryVolumeDescriptor */:
                        candidateVDs.push(new SupplementaryVolumeDescriptor(slice));
                        break;
                    case 255 /* VolumeDescriptorSetTerminator */:
                        vdTerminatorFound = true;
                        break;
                }
                i += 2048;
            }
            if (candidateVDs.length === 0) {
                throw new ApiError(ErrorCode.EIO, `Unable to find a suitable volume descriptor.`);
            }
            candidateVDs.forEach((v) => {
                // Take an SVD over a PVD.
                if (!this._pvd || this._pvd.type() !== 2 /* SupplementaryVolumeDescriptor */) {
                    this._pvd = v;
                }
            });
            this._root = this._pvd.rootDirectoryEntry(data);
            this._name = name;
        }
        /**
         * Creates an IsoFS instance with the given options.
         */
        static Create(opts, cb) {
            try {
                cb(null, new IsoFS(opts.data, opts.name));
            }
            catch (e) {
                cb(e);
            }
        }
        static isAvailable() {
            return true;
        }
        getName() {
            let name = `IsoFS${this._name}${this._pvd ? `-${this._pvd.name()}` : ''}`;
            if (this._root && this._root.hasRockRidge()) {
                name += `-RockRidge`;
            }
            return name;
        }
        diskSpace(path, cb) {
            // Read-only file system.
            cb(this._data.length, 0);
        }
        isReadOnly() {
            return true;
        }
        supportsLinks() {
            return false;
        }
        supportsProps() {
            return false;
        }
        supportsSynch() {
            return true;
        }
        statSync(p, isLstat) {
            const record = this._getDirectoryRecord(p);
            if (record === null) {
                throw ApiError.ENOENT(p);
            }
            return this._getStats(p, record);
        }
        openSync(p, flags, mode) {
            // INVARIANT: Cannot write to RO file systems.
            if (flags.isWriteable()) {
                throw new ApiError(ErrorCode.EPERM, p);
            }
            // Check if the path exists, and is a file.
            const record = this._getDirectoryRecord(p);
            if (!record) {
                throw ApiError.ENOENT(p);
            }
            else if (record.isSymlink(this._data)) {
                return this.openSync(path.resolve(p, record.getSymlinkPath(this._data)), flags, mode);
            }
            else if (!record.isDirectory(this._data)) {
                const data = record.getFile(this._data);
                const stats = this._getStats(p, record);
                switch (flags.pathExistsAction()) {
                    case ActionType.THROW_EXCEPTION:
                    case ActionType.TRUNCATE_FILE:
                        throw ApiError.EEXIST(p);
                    case ActionType.NOP:
                        return new NoSyncFile(this, p, flags, stats, data);
                    default:
                        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
                }
            }
            else {
                throw ApiError.EISDIR(p);
            }
        }
        readdirSync(path) {
            // Check if it exists.
            const record = this._getDirectoryRecord(path);
            if (!record) {
                throw ApiError.ENOENT(path);
            }
            else if (record.isDirectory(this._data)) {
                return record.getDirectory(this._data).getFileList().slice(0);
            }
            else {
                throw ApiError.ENOTDIR(path);
            }
        }
        /**
         * Specially-optimized readfile.
         */
        readFileSync(fname, encoding, flag) {
            // Get file.
            const fd = this.openSync(fname, flag, 0x1a4);
            try {
                const fdCast = fd;
                const fdBuff = fdCast.getBuffer();
                if (encoding === null) {
                    return copyingSlice(fdBuff);
                }
                return fdBuff.toString(encoding);
            }
            finally {
                fd.closeSync();
            }
        }
        _getDirectoryRecord(path) {
            // Special case.
            if (path === '/') {
                return this._root;
            }
            const components = path.split('/').slice(1);
            let dir = this._root;
            for (const component of components) {
                if (dir.isDirectory(this._data)) {
                    dir = dir.getDirectory(this._data).getRecord(component);
                    if (!dir) {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
            return dir;
        }
        _getStats(p, record) {
            if (record.isSymlink(this._data)) {
                const newP = path.resolve(p, record.getSymlinkPath(this._data));
                const dirRec = this._getDirectoryRecord(newP);
                if (!dirRec) {
                    return null;
                }
                return this._getStats(newP, dirRec);
            }
            else {
                const len = record.dataLength();
                let mode = 0x16D;
                const date = record.recordingDate().getTime();
                let atime = date;
                let mtime = date;
                let ctime = date;
                if (record.hasRockRidge()) {
                    const entries = record.getSUEntries(this._data);
                    for (const entry of entries) {
                        if (entry instanceof PXEntry) {
                            mode = entry.mode();
                        }
                        else if (entry instanceof TFEntry) {
                            const flags = entry.flags();
                            if (flags & 4 /* ACCESS */) {
                                atime = entry.access().getTime();
                            }
                            if (flags & 2 /* MODIFY */) {
                                mtime = entry.modify().getTime();
                            }
                            if (flags & 1 /* CREATION */) {
                                ctime = entry.creation().getTime();
                            }
                        }
                    }
                }
                // Mask out writeable flags. This is a RO file system.
                mode = mode & 0x16D;
                return new Stats(record.isDirectory(this._data) ? FileType.DIRECTORY : FileType.FILE, len, mode, atime, mtime, ctime);
            }
        }
    }
    IsoFS.Name = "IsoFS";
    IsoFS.Options = {
        data: {
            type: "object",
            description: "The ISO file in a buffer",
            validator: bufferValidator
        }
    };


    return IsoFS;
});
define('skylark-browserfs/core/backends',[
    './util',
    '../backend/AsyncMirror',
    '../backend/Dropbox',
    '../backend/Emscripten',
    '../backend/FolderAdapter',
    '../backend/HTML5FS',
    '../backend/InMemory',
    '../backend/IndexedDB',
    '../backend/LocalStorage',
    '../backend/MountableFileSystem',
    '../backend/OverlayFS',
    '../backend/WorkerFS',
    '../backend/HTTPRequest',
    '../backend/ZipFS',
    '../backend/IsoFS'
], function (util, AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, ZipFS, IsoFS) {
    'use strict';
    const { checkOptions } = util;

    

    // Monkey-patch `Create` functions to check options before file system initialization.
    [AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, IsoFS, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, ZipFS].forEach((fsType) => {
        const create = fsType.Create;
        fsType.Create = function (opts, cb) {
            const oneArg = typeof (opts) === "function";
            const normalizedCb = oneArg ? opts : cb;
            const normalizedOpts = oneArg ? {} : opts;
            function wrappedCb(e) {
                if (e) {
                    normalizedCb(e);
                }
                else {
                    create.call(fsType, normalizedOpts, normalizedCb);
                }
            }
            checkOptions(fsType, normalizedOpts, wrappedCb);
        };
    });
    /**
     * @hidden
     */
    const Backends = { AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, IsoFS, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, HTTPRequest, XmlHttpRequest: HTTPRequest, ZipFS };
    // Make sure all backends cast to FileSystemConstructor (for type checking)
    const _ = Backends;
    // tslint:disable-next-line:no-unused-expression
    _;
    // tslint:enable-next-line:no-unused-expression
    return Backends;
});
define('skylark-browserfs/core/browserfs',[
    "skylark-langx-ns",
    '../libs/process',
    '../libs/buffers',
    './node_fs',
    '../libs/path',
    '../generic/emscripten_fs',
    './backends',
    './util',
    './api_error',
    '../generic/setImmediate'
], function (skylark,process,buffers, fs, path, EmscriptenFS, Backends, BFSUtils, Errors, setImmediate) {
    'use strict';

    const {Buffer} = buffers;
    
    /**
     * BrowserFS's main module. This is exposed in the browser via the BrowserFS global.
     * Due to limitations in typedoc, we document these functions in ./typedoc.ts.
     */
    if (process['initializeTTYs']) {
        process['initializeTTYs']();
    }
    /**
     * Installs BFSRequire as global `require`, a Node Buffer polyfill as the global `Buffer` variable,
     * and a Node process polyfill as the global `process` variable.
     */
    function install(obj) {
        obj.Buffer = Buffer;
        obj.process = process;
        const oldRequire = obj.require ? obj.require : null;
        // Monkey-patch require for Node-style code.
        obj.require = function (arg) {
            const rv = BFSRequire(arg);
            if (!rv) {
                return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0));
            }
            else {
                return rv;
            }
        };
    }
    /**
     * @hidden
     */
    function registerFileSystem(name, fs) {
        Backends[name] = fs;
    }
    function BFSRequire(module) {
        switch (module) {
            case 'fs':
                return fs;
            case 'path':
                return path;
            case 'buffer':
                // The 'buffer' module has 'Buffer' as a property.
                return buffer;
            case 'process':
                return process;
            case 'bfs_utils':
                return BFSUtils;
            default:
                return Backends[module];
        }
    }
    /**
     * Initializes BrowserFS with the given root file system.
     */
    function initialize(rootfs) {
        return fs.initialize(rootfs);
    }
    /**
     * Creates a file system with the given configuration, and initializes BrowserFS with it.
     * See the FileSystemConfiguration type for more info on the configuration object.
     */
    function configure(config, cb) {
        getFileSystem(config, (e, fs) => {
            if (fs) {
                initialize(fs);
                cb();
            }
            else {
                cb(e);
            }
        });
    }
    /**
     * Retrieve a file system with the given configuration.
     * @param config A FileSystemConfiguration object. See FileSystemConfiguration for details.
     * @param cb Called when the file system is constructed, or when an error occurs.
     */
    function getFileSystem(config, cb) {
        const fsName = config['fs'];
        if (!fsName) {
            return cb(new Errors.ApiError(Errors.ErrorCode.EPERM, 'Missing "fs" property on configuration object.'));
        }
        const options = config['options'];
        let waitCount = 0;
        let called = false;
        function finish() {
            if (!called) {
                called = true;
                const fsc = Backends[fsName];
                if (!fsc) {
                    cb(new Errors.ApiError(Errors.ErrorCode.EPERM, `File system ${fsName} is not available in BrowserFS.`));
                }
                else {
                    fsc.Create(options, cb);
                }
            }
        }
        if (options !== null && typeof (options) === "object") {
            let finishedIterating = false;
            const props = Object.keys(options).filter((k) => k !== 'fs');
            // Check recursively if other fields have 'fs' properties.
            props.forEach((p) => {
                const d = options[p];
                if (d !== null && typeof (d) === "object" && d['fs']) {
                    waitCount++;
                    getFileSystem(d, function (e, fs) {
                        waitCount--;
                        if (e) {
                            if (called) {
                                return;
                            }
                            called = true;
                            cb(e);
                        }
                        else {
                            options[p] = fs;
                            if (waitCount === 0 && finishedIterating) {
                                finish();
                            }
                        }
                    });
                }
            });
            finishedIterating = true;
        }
        if (waitCount === 0) {
            finish();
        }
    }

    return skylark.attach("intg.BrowserFS",{
        install: install,
        registerFileSystem: registerFileSystem,
        BFSRequire: BFSRequire,
        initialize: initialize,
        configure: configure,
        getFileSystem: getFileSystem,
        EmscriptenFS,
        "FileSystem" : Backends,
        Errors,
        setImmediate
    });
});
define('skylark-browserfs/main',[
    "./core/browserfs"
],function(browserfs){
    return browserfs;
});
define('skylark-browserfs', ['skylark-browserfs/main'], function (main) { return main; });


},this);
//# sourceMappingURL=sourcemaps/skylark-browserfs-all.js.map
