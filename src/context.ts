import { AsyncLocalStorage } from 'node:async_hooks';

export interface Context {
    readonly request: IRequest;
    readonly response: IResponse;
    get<T>(key: string): T | undefined;
    has(key: string): boolean;
    set<T>(key: string, value: T): void;
}

export interface IRequest {
    method: string;
    url: string;
    originalUrl?: string;
    headers: Record<string, string | string[] | undefined>;
    path: string;
    rawBody?: Buffer;
    raw?: unknown;
}

export interface IResponse {
    statusCode: number;
    headersSent: boolean;
    setHeader(name: string, value: string | number | readonly string[]): void;
    getHeader?(name: string): unknown;
    raw?: unknown;
    status(code: number): this;
    on(event: string, listener: (...args: unknown[]) => void): void;
    end(): void;
}

export class BasicContext implements Context {
    private store = new Map<string, unknown>();
    constructor(
        public readonly request: IRequest,
        public readonly response: IResponse,
    ) {}
    get<T>(k: string) {
        return this.store.get(k) as T | undefined;
    }
    has(k: string) {
        return this.store.has(k);
    }
    set<T>(k: string, v: T) {
        this.store.set(k, v);
    }
}

export const requestStore = new AsyncLocalStorage<Context>();

export const getRequestContext = (): Context | undefined => requestStore.getStore();
