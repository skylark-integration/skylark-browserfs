define([
    '../core/node_fs_stats'
], function (node_fs_stats) {
    'use strict';

    const  { Stats, FileType } = node_fs_stats;

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