import express from 'express';
import fileupload from 'express-fileupload';
import type { Express, Request, Response, RequestHandler } from 'express';

import { logger } from '../logger';

import type {
    RouteMetadata,
    ParameterMetadata,
    ControllerMetadata,
} from '../metadata';
import { type IFrameworkAdapter } from './index';
import { File, FileInput } from '../types/files';
import { BasicContext, type Context } from '../context';
import { Middleware } from '../types/middleware';

import {
    BadRequestError,
    FrameworkError,
    MissingInjectionError,
    NotFoundError,
} from '../errors';
import { validateAndTransform } from './validation';
import { DataStreamResponse, FileStreamResponse } from '../types';
import * as os from 'os';

declare global {
    namespace Express {
        interface Request {
            rawBody?: Buffer;
            uploadedFiles?: File[];
        }
    }
}

class ExpressAdapter implements IFrameworkAdapter {
    constructor(private readonly app: Express) {}

    registerGlobalMiddlewares(middlewares: Middleware[]): void {
        this.app.use(express.urlencoded({ extended: true }));
        if (middlewares.length === 0) return;
        for (const middleware of middlewares) {
            this.app.use(async (req: Request, res: Response, next) => {
                const ctx: Context = new BasicContext(req, res);

                try {
                    await middleware(ctx, async () => {
                        next();
                    });
                } catch (err) {
                    this.handleError(res, err as Error);
                }
            });
        }
    }

    registerControllers([metadata, controllerClasses]: [
        ControllerMetadata[],
        Function[],
    ]): void {
        if (metadata.length !== controllerClasses.length)
            throw new Error(
                'Metadata and controller classes arrays must have the same length',
            );

        for (let i = 0; i < metadata.length; i++)
            this.registerController(metadata[i], controllerClasses[i]);
    }

    private registerController(
        controller: ControllerMetadata,
        controllerClass: Function,
    ): void {
        const controllerInstance = new (controllerClass as new () => unknown)();

        if (controller.defaultHandler)
            return this.registerDefaultHandler(
                controller.path,
                controller.defaultHandler,
                controllerInstance,
            );

        for (const route of controller.routes)
            this.registerRoute(controller.path, route, controllerInstance);
    }

    private registerRoute(
        basePath: string,
        route: RouteMetadata,
        controllerInstance: unknown,
    ): void {
        const path = `${basePath}${route.path}`;
        const method = route.method.toLowerCase() as
            | 'get'
            | 'post'
            | 'put'
            | 'delete'
            | 'patch';

        const expressMiddlewares: RequestHandler[] =
            this.buildNativeMiddlewares(route);

        const frameworkPipeline: Middleware[] = [
            ...route.middlewares,
            this.makeCoreHandler(route, controllerInstance),
        ];

        this.app[method](
            path,
            ...expressMiddlewares,
            async (req: Request, res: Response) => {
                const ctx: Context = new BasicContext(req, res);

                try {
                    await this.runPipeline(frameworkPipeline, ctx);
                    if (!res.headersSent && !route.stream)
                        res.status(204).end();
                } catch (err) {
                    this.handleError(res, err as Error);
                } finally {
                    req.uploadedFiles?.forEach((f) => {
                        if (!File.beingUsed.includes(f.md5)) f.cleanup();
                    });

                    if (req.files)
                        for (const fileInput of Object.values(req.files).flat())
                            new File(
                                fileInput as unknown as FileInput,
                            ).cleanup();
                }
            },
        );
    }

    private buildNativeMiddlewares(route: RouteMetadata): RequestHandler[] {
        const mws: RequestHandler[] = [];

        const hasRawBodyParam = route.parameters.some(
            (p) => p.type === 'rawBody',
        );

        if (hasRawBodyParam) {
            mws.push(
                express.json({
                    verify: (req: Request, _res: Response, buf: Buffer) => {
                        req.rawBody = buf;
                    },
                }),
            );
        } else {
            mws.push(express.json());
        }

        const fileParams = route.parameters.filter((p) => p.type === 'file');

        if (fileParams.length > 0) {
            const DEFAULT_FILESIZE_LIMIT = 1 * 1024 * 1024 * 1024;

            const maxFileLimit =
                fileParams
                    .map((p) => p.options?.maxFileSize ?? 0)
                    .reduce((a, b) => Math.max(a, b), 0) ||
                DEFAULT_FILESIZE_LIMIT;

            const totalMaxFiles = fileParams
                .map(
                    (p) =>
                        p.options?.maxFiles ?? (p.options?.forceArray ? 10 : 1),
                )
                .reduce((a, b) => a + b, 0);

            const tmp = os.tmpdir();
            mws.push(
                fileupload({
                    debug: false,
                    useTempFiles: true,
                    tempFileDir: tmp,
                    abortOnLimit: true,
                    safeFileNames: true,
                    preserveExtension: 5,
                    limits: {
                        fileSize: maxFileLimit,
                        files: totalMaxFiles,
                    },
                }),
            );
        }

        return mws;
    }

    private async runPipeline(mws: Middleware[], ctx: Context): Promise<void> {
        let i = -1;
        const dispatch = async (k: number): Promise<void> => {
            if (k <= i) throw new Error('next() called twice');
            i = k;
            if (k < mws.length) {
                await mws[k](ctx, () => dispatch(k + 1));
            }
        };
        await dispatch(0);
    }

    private makeCoreHandler(
        route: RouteMetadata,
        controller: unknown,
    ): Middleware {
        return async (ctx, next) => {
            const req = ctx.request as Request;
            const res = ctx.response as Response;

            const args = this.extractParameters(req, route.parameters, ctx);
            const result = await route.handler.apply(controller, args);

            if (route.stream)
                return await this.handleStreamResponse(result, route, req, res);

            res.setHeader('Content-Type', 'application/json');
            res.status(result ? 200 : 204);
            res.send(JSON.stringify(result, null, 2));

            await next();
        };
    }

    private handleError(res: Response, err: Error) {
        if (err instanceof FrameworkError) {
            if (res.headersSent) return;
            return res.status(err.status).json({
                error: err.name,
                message: `[${err.name}]: ${err.message}`,
            });
        }

        logger.error(`Internal Server Error: ${err.message}`, err);

        if (res.headersSent) return;
        res.status(500).json({
            error: 'InternalServerError',
            message: 'Something bad happened',
        });
    }

    private async handleStreamResponse<T>(
        result: FileStreamResponse | DataStreamResponse<T>,
        route: RouteMetadata,
        req: Request,
        res: Response,
    ): Promise<void> {
        if (!result || !route.stream?.options) {
            throw new Error('Invalid stream response');
        }

        res.setHeader('Content-Type', result.contentType);

        if (route.stream.streamType === 'dataStream') {
            result = result as DataStreamResponse<T>;
            for await (const chunk of result.stream) {
                if (!res.write(JSON.stringify(chunk) + '\n')) {
                    await new Promise((resolve) => res.once('drain', resolve));
                }
            }
            res.end();
        } else if (route.stream.streamType === 'fileStream') {
            result = result as FileStreamResponse;
            const { stream, contentLength, filename, cacheControl } = result;

            stream.on('error', (err: NodeJS.ErrnoException) => {
                if (res.headersSent) {
                    logger.error(
                        `Stream error after headers sent: ${err.message}`,
                        err,
                    );
                    res.end();
                    return;
                }

                if (err.code === 'ENOENT') {
                    this.handleError(
                        res,
                        new NotFoundError('File not found during streaming'),
                    );
                } else {
                    this.handleError(res, err);
                }
            });

            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
                res.setHeader('Accept-Ranges', 'bytes');
            }

            if (cacheControl) {
                res.setHeader('Cache-Control', cacheControl);
            }

            if (route.stream.options.downloadName || filename) {
                const contentDisposition =
                    route.stream.options.contentDisposition || 'attachment';
                res.setHeader(
                    'Content-Disposition',
                    `${contentDisposition}; filename="${route.stream.options.downloadName || filename}"`,
                );
            }

            const range = req.headers.range;
            if (range && contentLength) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1]
                    ? parseInt(parts[1], 10)
                    : contentLength - 1;

                if (start >= 0 && end < contentLength) {
                    const chunkSize = end - start + 1;
                    res.status(206);
                    res.setHeader('Accept-Ranges', 'bytes');
                    res.setHeader(
                        'Content-Range',
                        `bytes ${start}-${end}/${contentLength}`,
                    );
                    res.setHeader('Content-Length', chunkSize);
                    // @ts-expect-error - pipe with range options
                    stream.pipe(res, { start, end });
                } else {
                    res.setHeader('Content-Range', `bytes */${contentLength}`);
                    res.status(416).send('Requested range not satisfiable');
                }
            } else {
                stream.pipe(res);
            }
        } else {
            throw new Error('Invalid stream type response');
        }
    }

    private extractParameters(
        req: Request,
        parameters: ParameterMetadata[],
        ctx: Context,
    ): unknown[] {
        const requiredNamedFileParams = parameters.filter(
            (p) => p.type === 'file' && p.name && p.required,
        );

        if (requiredNamedFileParams.length > 0) {
            const missing = requiredNamedFileParams.filter(
                (p) =>
                    !(
                        req.files &&
                        (req.files as Record<string, unknown>)[p.name!]
                    ),
            );
            if (missing.length > 0) {
                throw new BadRequestError(
                    `Missing file parameter${missing.length > 1 ? 's' : ''}: ` +
                        missing.map((p) => p.name).join(', '),
                );
            }
        }

        const namedFiles: Record<string, File | File[]> = {};
        if (req.files) {
            for (const p of parameters.filter(
                (p) => p.type === 'file' && p.name,
            )) {
                const entry = (req.files as Record<string, unknown>)[p.name!];
                if (!entry) continue;

                if (Array.isArray(entry)) {
                    if (p.options?.forceArray) {
                        namedFiles[p.name!] = entry.map(
                            (f: unknown) => new File(f as FileInput),
                        );
                    } else {
                        throw new BadRequestError(
                            `Multiple files found for "${p.name}"`,
                        );
                    }
                } else {
                    if (p.options?.forceArray) {
                        namedFiles[p.name!] = [new File(entry as FileInput)];
                    } else {
                        namedFiles[p.name!] = new File(entry as FileInput);
                    }
                }

                delete (req.files as Record<string, unknown>)[p.name!];
            }

            if (
                req.files &&
                Object.keys(req.files as Record<string, unknown>).length === 0
            )
                req.files = undefined;
        }

        return parameters.map((param) => {
            let value: unknown;

            try {
                switch (param.type) {
                    case 'ctx':
                        value = param.name ? ctx.get(param.name) : ctx;

                        if (value === undefined || value === null) {
                            if (param.required) {
                                const k = param.name ?? '<context>';
                                throw new MissingInjectionError(k);
                            }
                        }

                        break;
                    case 'file':
                        if (param.name) {
                            const stored = namedFiles[param.name];

                            if (!param.required && !stored) {
                                value = param.options?.forceArray
                                    ? []
                                    : undefined;
                                break;
                            }

                            if (param.options?.forceArray) {
                                const arr = Array.isArray(stored)
                                    ? stored
                                    : [stored];
                                if (arr.length === 0 && param.required)
                                    throw new BadRequestError(
                                        `File "${param.name}" not found`,
                                    );
                                value = arr;
                                req.uploadedFiles = req.uploadedFiles ?? [];
                                req.uploadedFiles.push(...arr);
                            } else {
                                if (!stored && param.required)
                                    throw new BadRequestError(
                                        `File "${param.name}" not found`,
                                    );

                                if (stored) {
                                    const singleFile = Array.isArray(stored)
                                        ? stored[0]
                                        : stored;
                                    value = singleFile;
                                    req.uploadedFiles = req.uploadedFiles ?? [];
                                    req.uploadedFiles.push(singleFile);
                                } else {
                                    value = undefined;
                                }
                            }
                        } else {
                            if (!req.files) {
                                if (param.required) {
                                    throw new BadRequestError(
                                        'No files were uploaded',
                                    );
                                } else {
                                    value = [];
                                    break;
                                }
                            }

                            const obj = req.files as Record<string, unknown>;
                            const raw = Object.values(obj);
                            const arr = raw.flat();

                            if (arr.length === 0) {
                                if (param.required) {
                                    throw new BadRequestError(
                                        'No files uploaded',
                                    );
                                } else {
                                    value = [];
                                    break;
                                }
                            }
                            const files = arr.map(
                                (f: unknown) => new File(f as FileInput),
                            );
                            value = files;
                            req.files = undefined;
                            req.uploadedFiles = req.uploadedFiles ?? [];
                            req.uploadedFiles.push(...files);
                        }

                        break;
                    case 'body':
                        value = req.body;

                        if (typeof value === 'string') {
                            try {
                                value = JSON.parse(value);
                            } catch {
                                throw new BadRequestError(
                                    'Invalid JSON in request body',
                                );
                            }
                        } else if (value && typeof value === 'object') {
                            value = this.parseNestedFormFields(
                                value as Record<string, unknown>,
                            );
                        }
                        break;

                    case 'query':
                        value = param.name ? req.query[param.name] : req.query;
                        if (
                            !param.required &&
                            (value === undefined || value === null)
                        ) {
                            return value;
                        }
                        break;

                    case 'param':
                        value = param.name
                            ? req.params[param.name]
                            : req.params;
                        break;

                    case 'header':
                        value = param.name
                            ? req.headers[param.name.toLowerCase()]
                            : req.headers;
                        break;

                    case 'rawBody':
                        value = req.rawBody;
                        if (!value && param.required) {
                            throw new BadRequestError('Raw body not available');
                        }
                        break;

                    default:
                        throw new Error(
                            `Unknown parameter type: ${param.type}`,
                        );
                }

                return validateAndTransform(value, param.schema, param.type);
            } catch (error) {
                if (error instanceof BadRequestError) {
                    throw new BadRequestError(
                        `Validation error for ${param.type}${
                            param.name ? ` "${param.name}"` : ''
                        }: ${error.message}`,
                    );
                }
                throw error;
            }
        });
    }

    private parseNestedFormFields(
        obj: Record<string, unknown>,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(obj)) {
            if (key.includes('[') && key.includes(']')) {
                this.setNestedValue(
                    result,
                    key,
                    this.coerceValue(val as string),
                );
            } else {
                result[key] = val;
            }
        }

        return result;
    }

    private setNestedValue(
        obj: Record<string, unknown>,
        path: string,
        value: unknown,
    ): void {
        const keys = path.match(/[^\[\]]+/g);
        if (!keys || keys.length === 0) return;

        let current: Record<string, unknown> = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            const nextKey = keys[i + 1];
            const isNextNumeric = /^\d+$/.test(nextKey);

            if (!(key in current)) {
                current[key] = isNextNumeric ? [] : {};
            }

            current = current[key] as Record<string, unknown>;
        }

        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
    }

    private coerceValue(value: string): unknown {
        if (value === '') return value;

        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (value === 'undefined') return undefined;

        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
            return num;
        }

        return value;
    }

    private registerDefaultHandler(
        basePath: string,
        defaultHandler: {
            methodName: string;
            handler: Function;
            middlewares?: Middleware[];
        },
        controllerInstance: unknown,
    ) {
        const paths = [basePath, `${basePath}/*`];

        const nativeMiddlewares: RequestHandler[] = [
            express.json(),
            express.urlencoded({ extended: true }),
        ];

        for (const p of paths) {
            this.app.all(
                p,
                ...nativeMiddlewares,
                async (req: Request, res: Response) => {
                    const ctx: Context = new BasicContext(req, res);

                    const mws: Middleware[] = [
                        ...(defaultHandler.middlewares ?? []),
                        async (_ctx, next) => {
                            try {
                                if (!res.headersSent) {
                                    await defaultHandler.handler.call(
                                        controllerInstance,
                                        req,
                                        res,
                                    );
                                }
                            } finally {
                                await next();
                            }
                        },
                    ];

                    try {
                        await this.runPipeline(mws, ctx);

                        if (!res.headersSent) res.status(204).end();
                    } catch (err) {
                        this.handleError(res, err as Error);
                    } finally {
                        req.uploadedFiles?.forEach((f) => {
                            if (!File.beingUsed.includes(f.md5)) f.cleanup();
                        });

                        if (req.files)
                            for (const fileInput of Object.values(
                                req.files,
                            ).flat())
                                new File(
                                    fileInput as unknown as FileInput,
                                ).cleanup();
                    }
                },
            );
        }
    }
}

export { ExpressAdapter };
