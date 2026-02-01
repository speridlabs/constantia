import fs from 'fs';
import type { ReadStream } from 'fs';

export class File implements IFile {
    md5: string;
    name: string;
    size: number;
    mimetype: string;
    tempFilePath: string;
    mv: (path: string, cb: (err: Error) => void) => void;

    static beingUsed: string[] = [];

    constructor(file: FileInput) {
        if (file.data !== undefined && file.data.length !== 0)
            throw new Error('Buffer data should be an empty buffer');
        if (!file.tempFilePath) throw new Error('tempFilePath is required');
        if (file.truncated) throw new Error('File is truncated');

        this.md5 = file.md5;
        this.name = file.name;
        this.size = file.size;
        this.mimetype = file.mimetype;
        this.tempFilePath = file.tempFilePath;
        this.mv = file.mv;
    }

    public getstream(): ReadStream {
        return fs.createReadStream(this.tempFilePath);
    }

    public keepAlive(): void {
        File.beingUsed.push(this.md5);
    }

    public cleanup(): void {
        if (!this.tempFilePath) return;
        fs.unlink(this.tempFilePath, (err) => {
            if (err) throw err;
            File.beingUsed = File.beingUsed.filter((md5) => md5 !== this.md5);
        });
    }
}

export interface FileInput {
    md5: string;
    name: string;
    data: Buffer;
    size: number;
    mimetype: string;
    truncated: boolean;
    tempFilePath: string;
    mv: (path: string, cb: (err: Error) => void) => void;
}

export interface IFile {
    md5: string;
    name: string;
    size: number;
    mimetype: string;
    cleanup: () => void;
    tempFilePath: string;
    keepAlive: () => void;
    getstream: () => ReadStream;
    mv: (path: string, cb: (err: Error) => void) => void;
}
