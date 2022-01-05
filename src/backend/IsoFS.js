define([
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