define(['../generic/setImmediate'], function (setImmediate) {
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