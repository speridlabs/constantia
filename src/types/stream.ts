import { Readable } from 'stream';

export interface DataStreamResponse<T> {
    type: 'dataStream';
    contentType: string;
    stream: AsyncIterable<T>;
    ISASTREAMDATAONLYFORFRAMEWORK: true;
}

export interface FileStreamResponse {
    type: 'fileStream';
    stream: Readable;
    filename: string;
    contentType: string;
    cacheControl?: string;
    contentLength?: number;
    range?: {
        start: number;
        end: number;
    };
    ISASTREAMFILEONLYFORFRAMEWORK: true;
}

export interface StreamOptions {
    contentType?: string;
    downloadName?: string;
    contentDisposition?: 'inline' | 'attachment';
}
