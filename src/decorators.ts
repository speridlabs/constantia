import {
    type SchemaType,
    type Middleware,
    extractParameterSchema,
    extractMethodReturnSchema,
    MiddlewareFactory,
} from './types';
import type { StreamOptions } from './types/stream';
import { MetadataStorage, type ParameterMetadata } from './metadata';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export const Controller =
    (
        path: string = '',
        registerAutomatically: boolean = true,
    ): ClassDecorator =>
    (target: Function) => {
        if (!registerAutomatically) return;
        MetadataStorage.getInstance().addController(target, path);
    };

const Route = (method: HttpMethod, path: string = ''): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        try {
            const methodReturnSchema = extractMethodReturnSchema(
                // @ts-expect-error - accessing constructor from prototype
                target.constructor,
                propertyKey,
            );

            MetadataStorage.getInstance().addRoute(target.constructor, {
                path,
                method,
                returnType: methodReturnSchema,
                handler: descriptor.value,
                methodName: propertyKey.toString(),
            });
        } catch (error) {
            console.error(error);
            throw new Error(
                `Error in Route: ${method} ${path} ${propertyKey.toString()}\n` +
                    `Type of response needs to be defined in Controller method.\n`,
            );
        }
    };
};

const Get = (path: string = ''): MethodDecorator => Route('GET', path);
const Post = (path: string = ''): MethodDecorator => Route('POST', path);
const Put = (path: string = ''): MethodDecorator => Route('PUT', path);
const Delete = (path: string = ''): MethodDecorator => Route('DELETE', path);
const Patch = (path: string = ''): MethodDecorator => Route('PATCH', path);

export { Route, Get, Post, Put, Delete, Patch };

type FileOptions = {
    maxFileSize?: number;
    forceArray?: boolean;
    maxFiles?: number;
};

export function File(
    target: object,
    propertyKey: string | symbol,
    parameterIndex: number,
): void;
export function File(): ParameterDecorator;
export function File(opts: FileOptions): ParameterDecorator;
export function File(name: string, opts: FileOptions): ParameterDecorator;

export function File(
    nameOrTarget?: string | FileOptions | object,
    maybeOptsOrKey?: FileOptions | string | symbol,
    maybeIndex?: number,
): void | ParameterDecorator {
    if (
        typeof nameOrTarget === 'object' &&
        (typeof maybeOptsOrKey === 'string' ||
            typeof maybeOptsOrKey === 'symbol') &&
        typeof maybeIndex === 'number'
    ) {
        const target = nameOrTarget as object;
        const propertyKey = maybeOptsOrKey as string | symbol;
        const parameterIndex = maybeIndex;

        const varName = getParameterNames(target, propertyKey)[parameterIndex];

        const [, isRequiredParam] = extractParameterSchema(
            target,
            propertyKey,
            parameterIndex,
        );

        MetadataStorage.getInstance().addParameter(
            target.constructor as Function,
            propertyKey.toString(),
            {
                parameterIndex,
                type: 'file',
                name: varName,
                schema: { type: 'file' } as SchemaType,
                required: isRequiredParam,
            },
        );
        return;
    }

    let name: string | undefined;
    let options: FileOptions | undefined;

    if (typeof nameOrTarget === 'string') {
        name = nameOrTarget;
        options = maybeOptsOrKey as FileOptions | undefined;
    } else {
        options = nameOrTarget as FileOptions | undefined;
    }

    return function (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) {
        if (propertyKey === undefined)
            throw new Error('PropertyKey cannot be undefined');

        const varName =
            name ?? getParameterNames(target, propertyKey)[parameterIndex];

        const [, isRequiredParam] = extractParameterSchema(
            target,
            propertyKey,
            parameterIndex,
        );

        MetadataStorage.getInstance().addParameter(
            target.constructor as Function,
            propertyKey.toString(),
            {
                parameterIndex,
                type: 'file',
                name: varName,
                schema: { type: 'file' } as SchemaType,
                required: isRequiredParam,
                ...(options ? { options } : {}),
            },
        );
    };
}

export function Files(
    target: object,
    propertyKey: string | symbol,
    parameterIndex: number,
): void;
export function Files(): ParameterDecorator;
export function Files(opts: FileOptions): ParameterDecorator;
export function Files(name: string, opts?: FileOptions): ParameterDecorator;

export function Files(
    nameOrTarget?: string | FileOptions | object,
    maybeOptsOrKey?: FileOptions | string | symbol,
    maybeIndex?: number,
): void | ParameterDecorator {
    if (
        typeof nameOrTarget === 'object' &&
        (typeof maybeOptsOrKey === 'string' ||
            typeof maybeOptsOrKey === 'symbol') &&
        typeof maybeIndex === 'number'
    ) {
        const target = nameOrTarget as object;
        const propertyKey = maybeOptsOrKey as string | symbol;
        const parameterIndex = maybeIndex;

        const [, isRequiredParam] = extractParameterSchema(
            target,
            propertyKey,
            parameterIndex,
        );

        MetadataStorage.getInstance().addParameter(
            target.constructor as Function,
            propertyKey.toString(),
            {
                parameterIndex,
                type: 'file',
                name: undefined,
                schema: { type: 'file' } as SchemaType,
                required: isRequiredParam,
                options: { forceArray: true },
            },
        );
        return;
    }

    let name: string | undefined;
    let options: FileOptions | undefined;

    if (typeof nameOrTarget === 'string') {
        name = nameOrTarget;
        options = maybeOptsOrKey as FileOptions | undefined;
    } else {
        options = nameOrTarget as FileOptions | undefined;
        name = undefined;
    }

    return function (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) {
        if (propertyKey === undefined)
            throw new Error('PropertyKey cannot be undefined');

        const [, isRequiredParam] = extractParameterSchema(
            target,
            propertyKey,
            parameterIndex,
        );

        MetadataStorage.getInstance().addParameter(
            target.constructor as Function,
            propertyKey.toString(),
            {
                parameterIndex,
                type: 'file',
                name,
                schema: { type: 'file' } as SchemaType,
                required: isRequiredParam,
                options: { ...(options ?? {}), forceArray: true },
            },
        );
    };
}

const createParameterDecorator =
    (type: ParameterMetadata['type']) =>
    (name?: string): ParameterDecorator =>
    (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ): void => {
        if (propertyKey === undefined)
            throw new Error('PropertyKey cannot be undefined');

        let required = true;
        let schema: SchemaType;

        if (type === 'file')
            throw new Error(
                'File decorator should be used directly, not through createParameterDecorator',
            );

        if (type === 'rawBody') {
            schema = { type: 'object' } as SchemaType;
            required = true;
        } else {
            const [typeSchema, isRequiredParam] = extractParameterSchema(
                target,
                propertyKey,
                parameterIndex,
            );
            schema = typeSchema;
            required = isRequiredParam;
        }

        if (name === undefined)
            name = getParameterNames(target, propertyKey)[parameterIndex];

        MetadataStorage.getInstance().addParameter(
            target.constructor as Function,
            propertyKey.toString(),
            {
                parameterIndex,
                type,
                name,
                schema,
                required,
            },
        );
    };

const getParameterNames = (
    target: object,
    propertyKey: string | symbol,
): string[] => {
    const method = (target as Record<string | symbol, unknown>)[propertyKey];
    if (!method || typeof method !== 'function') return [];

    const fnStr = method.toString().replace(/[\r\n\s]+/g, ' ');
    const result = fnStr
        .slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'))
        .split(',');
    return result.map((param: string) => param.trim().replace(/=.*$/, ''));
};

const createParameterDecoratorFunction = (
    type: ParameterMetadata['type'],
): ParameterDecorator & ((paramName?: string) => ParameterDecorator) => {
    const decorator = createParameterDecorator(type);

    return function parameterDecorator(
        targetOrParamName?: object | string,
        propertyKey?: string | symbol,
        parameterIndex?: number,
    ): ParameterDecorator | void {
        if (
            typeof targetOrParamName === 'string' ||
            targetOrParamName === undefined
        ) {
            return decorator(targetOrParamName);
        }

        return decorator(undefined)(
            targetOrParamName,
            propertyKey!,
            parameterIndex!,
        );
    } as ParameterDecorator & ((paramName?: string) => ParameterDecorator);
};

type ParamDecoratorWithFactory = ParameterDecorator &
    ((paramName?: string) => ParameterDecorator);

// prettier-ignore
const Inject: ParamDecoratorWithFactory = createParameterDecoratorFunction('ctx');
// prettier-ignore
const Body: ParamDecoratorWithFactory = createParameterDecoratorFunction('body');
// prettier-ignore
const Query: ParamDecoratorWithFactory = createParameterDecoratorFunction('query');
// prettier-ignore
const Param: ParamDecoratorWithFactory = createParameterDecoratorFunction('param');
// prettier-ignore
const Header: ParamDecoratorWithFactory = createParameterDecoratorFunction('header');
// prettier-ignore
const RawBody: ParamDecoratorWithFactory = createParameterDecoratorFunction('rawBody');

export { Body, Query, Param, Header, Inject, RawBody };

export const DataStream = (options: StreamOptions = {}): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        MetadataStorage.getInstance().addStreamInfo(
            target.constructor as Function,
            propertyKey.toString(),
            'dataStream',
            options,
        );
        return descriptor;
    };
};

export const FileStream = (options: StreamOptions): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        MetadataStorage.getInstance().addStreamInfo(
            target.constructor as Function,
            propertyKey.toString(),
            'fileStream',
            options,
        );
        return descriptor;
    };
};

export const Use =
    (
        ...mws: (Middleware | MiddlewareFactory)[]
    ): ClassDecorator & MethodDecorator =>
    (target: Function | object, propertyKey?: string | symbol) => {
        const owner =
            propertyKey === undefined ? target : (target as object).constructor;

        const resolvedMiddlewares: Middleware[] = mws.map((mw) => {
            if (typeof mw === 'function') {
                if ((mw as MiddlewareFactory).isFactory) {
                    return (mw as MiddlewareFactory)();
                }
                return mw as Middleware;
            }
            return mw as Middleware;
        });

        MetadataStorage.getInstance().addMiddleware(
            owner as Function,
            propertyKey?.toString(),
            ...resolvedMiddlewares,
        );
    };

export const Security =
    (
        schemeName: string,
        ...mws: (Middleware | MiddlewareFactory)[]
    ): ClassDecorator & MethodDecorator =>
    (target: Function | object, propertyKey?: string | symbol) => {
        const owner =
            propertyKey === undefined ? target : (target as object).constructor;

        MetadataStorage.getInstance().addSecurity(
            owner as Function,
            propertyKey?.toString(),
            schemeName,
        );

        if (mws.length > 0) {
            const resolvedMiddlewares: Middleware[] = mws.map((mw) => {
                if (typeof mw === 'function') {
                    if ((mw as MiddlewareFactory).isFactory) {
                        return (mw as MiddlewareFactory)();
                    }
                    return mw as Middleware;
                }
                return mw as Middleware;
            });

            MetadataStorage.getInstance().addMiddleware(
                owner as Function,
                propertyKey?.toString(),
                ...resolvedMiddlewares,
            );
        }
    };

export const DefaultHandler = (): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        MetadataStorage.getInstance().addDefaultHandler(
            target.constructor as Function,
            propertyKey.toString(),
            descriptor.value,
        );
        return descriptor;
    };
};
