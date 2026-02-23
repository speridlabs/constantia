import { StreamOptions } from './types/stream';
import type { SchemaType, Middleware } from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

class MetadataStorage {
    private static instance: MetadataStorage;

    public controllers: Map<Function, ControllerMetadata> = new Map();

    private pendingRoutes: Map<Function, Map<string, RouteMetadata>> =
        new Map();
    private pendingParameters: Map<Function, Map<string, ParameterMetadata[]>> =
        new Map();
    private pendingStreams: Map<
        Function,
        Map<
            string,
            { options: StreamOptions; streamType: 'dataStream' | 'fileStream' }
        >
    > = new Map();

    private pendingMiddlewares = new Map<Function, Map<string, Middleware[]>>();
    private pendingDefaultHandlers = new Map<
        Function,
        { methodName: string; handler: Function }
    >();
    private pendingSecurity = new Map<Function, Map<string, string[]>>();

    public static getInstance(): MetadataStorage {
        if (!MetadataStorage.instance)
            MetadataStorage.instance = new MetadataStorage();
        return MetadataStorage.instance;
    }

    private constructor() {}

    addMiddleware(
        target: Function,
        methodName: string | undefined,
        ...mw: Middleware[]
    ) {
        if (this.controllers.has(target)) {
            const meta = this.controllers.get(target)!;

            if (methodName) {
                const r = meta.routes.find((r) => r.methodName === methodName);
                if (!r)
                    throw new Error(
                        `@Use on "${methodName}" but route not found in ${target.name}`,
                    );
                return r.middlewares.push(...mw);
            }

            meta.middlewares.unshift(...mw);

            if (meta.defaultHandler) {
                meta.defaultHandler.middlewares = [
                    ...mw,
                    ...meta.defaultHandler.middlewares,
                ];
            }

            return meta.routes.forEach((r) => r.middlewares.unshift(...mw));
        }

        const store = this.pendingMiddlewares.get(target) ?? new Map();
        const key = methodName ?? '__class';
        store.set(key, [...(store.get(key) ?? []), ...mw]);
        this.pendingMiddlewares.set(target, store);
    }

    addSecurity(
        target: Function,
        methodName: string | undefined,
        ...schemeNames: string[]
    ) {
        if (this.controllers.has(target)) {
            const meta = this.controllers.get(target)!;

            if (methodName) {
                const r = meta.routes.find((r) => r.methodName === methodName);
                if (!r)
                    throw new Error(
                        `@Security on "${methodName}" but route not found in ${target.name}`,
                    );
                r.security.push(...schemeNames);
                return;
            }

            meta.security.push(...schemeNames);
            return meta.routes.forEach((r) => r.security.push(...schemeNames));
        }

        const store = this.pendingSecurity.get(target) ?? new Map();
        const key = methodName ?? '__class';
        store.set(key, [...(store.get(key) ?? []), ...schemeNames]);
        this.pendingSecurity.set(target, store);
    }

    addController(target: Function, path: string): void {
        if (this.controllers.has(target))
            throw new Error(
                `ERROR adding controller ${target.name}, controller already defined`,
            );

        if (!path || path.trim() === '' || path === '/') {
            throw new Error(
                `ERROR adding controller ${target.name}: controller path cannot be empty or contain only whitespace`,
            );
        }

        if (path.includes(':')) {
            throw new Error(
                `ERROR adding controller ${target.name}: controller path \"${path}\" cannot contain route parameters (:param). Parameters are only allowed in route paths.`,
            );
        }

        if (!/^[\\/a-zA-Z0-9-_\\.]+$/.test(path)) {
            throw new Error(
                `ERROR adding controller ${target.name}: controller path \"${path}\" can only contain letters, numbers, hyphens, underscores, and dots (no whitespace)`,
            );
        }

        const defaultHandler = this.pendingDefaultHandlers.get(target);
        const routes = this.pendingRoutes.get(target);

        if (!defaultHandler && !routes) {
            throw new Error(
                `ERROR adding controller ${target.name}, no routes or default handler defined`,
            );
        }

        if (defaultHandler && routes && routes.size > 0) {
            throw new Error(
                `ERROR adding controller ${target.name}, cannot have both default handler and route methods`,
            );
        }

        const parameters = this.pendingParameters.get(target) || new Map();

        const classLevel =
            this.pendingMiddlewares.get(target)?.get('__class') ?? [];

        const classLevelSecurity =
            this.pendingSecurity.get(target)?.get('__class') ?? [];

        let finalRoutes: RouteMetadata[] = [];

        if (routes) {
            finalRoutes = this.sortRoutes(
                Array.from(routes.values()).map((route) => {
                    const perRoute =
                        this.pendingMiddlewares
                            .get(target)
                            ?.get(route.methodName) ?? [];

                    const perRouteSecurity =
                        this.pendingSecurity
                            .get(target)
                            ?.get(route.methodName) ?? [];

                    return {
                        ...route,
                        middlewares: [...classLevel, ...perRoute],
                        security: [...classLevelSecurity, ...perRouteSecurity],
                        parameters: (
                            parameters.get(route.methodName) || []
                        ).sort(
                            (a: ParameterMetadata, b: ParameterMetadata) =>
                                a.parameterIndex - b.parameterIndex,
                        ),
                    };
                }),
            );
        }

        this.controllers.set(target, {
            path,
            routes: finalRoutes,
            middlewares: classLevel,
            security: classLevelSecurity,
            defaultHandler: defaultHandler
                ? {
                      methodName: defaultHandler.methodName,
                      handler: defaultHandler.handler,
                      middlewares: [
                          ...classLevel,
                          ...(this.pendingMiddlewares
                              .get(target)
                              ?.get(defaultHandler.methodName) ?? []),
                      ],
                  }
                : undefined,
        });

        this.pendingRoutes.delete(target);
        this.pendingParameters.delete(target);
        this.pendingMiddlewares.delete(target);
        this.pendingDefaultHandlers.delete(target);
        this.pendingSecurity.delete(target);
    }

    addRoute(
        target: Function,
        metadata: Omit<
            RouteMetadata,
            'parameters' | 'middlewares' | 'security'
        >,
    ): void {
        if (this.controllers.has(target)) {
            throw new Error(
                `ERROR adding ${metadata.methodName} to controller ${target.name}, controller already defined`,
            );
        }

        const allowedTypes = [
            'object',
            'array',
            'dataStream',
            'fileStream',
            'null',
        ];
        if (!allowedTypes.includes(metadata.returnType.type))
            throw new Error(
                `ERROR in ${metadata.methodName}: return type must be ${allowedTypes.join(', ')} not ${metadata.returnType.type}`,
            );

        const parameters =
            this.pendingParameters.get(target)?.get(metadata.methodName) || [];
        const pathParams = (
            metadata.path.match(/:[a-zA-Z_$][a-zA-Z0-9_$]*/g) || []
        ).map((p) => p.substring(1));
        const paramDecorators = parameters.filter((p) => p.type === 'param');

        if (pathParams.length > 0 && paramDecorators.length === 0) {
            throw new Error(
                `ERROR in ${metadata.methodName}: route "${metadata.path}" has parameters but no @Param decorators`,
            );
        }

        if (pathParams.length === 0 && paramDecorators.length !== 0) {
            throw new Error(
                `ERROR in ${metadata.methodName}: route "${metadata.path}" has no parameters but @Param decorators are used`,
            );
        }

        if (pathParams.length !== paramDecorators.length) {
            throw new Error(
                `ERROR in ${metadata.methodName}: route "${metadata.path}" has ${pathParams.length} parameters but found ${paramDecorators.length} @Param decorators`,
            );
        }

        const decoratorNames = paramDecorators
            .map((p) => p.name)
            .filter((name): name is string => name !== undefined);
        const missingParams = decoratorNames.filter(
            (name) => !pathParams.includes(name),
        );

        if (missingParams.length > 0) {
            throw new Error(
                `ERROR in ${metadata.methodName}: @Param decorator names [${missingParams.join(', ')}] don't match any route parameters in "${metadata.path}"`,
            );
        }

        const uniqueDecoratorNames = new Set(decoratorNames);
        if (uniqueDecoratorNames.size !== decoratorNames.length) {
            throw new Error(
                `ERROR in ${metadata.methodName}: duplicate @Param decorator names found`,
            );
        }

        const routes = this.pendingRoutes.get(target) || new Map();
        const normalizedPath = metadata.path
            ? metadata.path.startsWith('/')
                ? metadata.path
                : `/${metadata.path}`
            : '/';
        const duplicateRoute = Array.from(routes.values()).find((route) => {
            const existingPath = route.path
                ? route.path.startsWith('/')
                    ? route.path
                    : `/${route.path}`
                : '/';
            return (
                route.method === metadata.method &&
                existingPath === normalizedPath
            );
        });

        if (duplicateRoute)
            throw new Error(
                `ERROR adding ${metadata.methodName} in controller ${target.name}, route with method ${metadata.method} and path "${metadata.path}" already defined in ${duplicateRoute.methodName}`,
            );

        const streamInfo = this.pendingStreams
            .get(target)
            ?.get(metadata.methodName);

        if (streamInfo) {
            if (
                streamInfo.streamType === 'fileStream' &&
                metadata.returnType.type !== 'fileStream'
            ) {
                throw new Error(
                    `ERROR in ${metadata.methodName}: Routes with file stream must return FileStreamResponse`,
                );
            }
            if (
                streamInfo.streamType === 'dataStream' &&
                metadata.returnType.type !== 'dataStream'
            ) {
                throw new Error(
                    `ERROR in ${metadata.methodName}: Routes with data stream must return DataStreamResponse`,
                );
            }
        }

        routes.set(metadata.methodName, {
            ...metadata,
            path: normalizedPath,
            parameters: [],
            stream: streamInfo,
            middlewares: [],
            security: [],
        });

        this.pendingRoutes.set(target, routes);
    }

    addParameter(
        target: Function,
        methodName: string,
        parameter: ParameterMetadata,
    ): void {
        if (this.controllers.has(target)) {
            throw new Error(
                `ERROR adding parameter to ${methodName} in controller ${target.name}, controller already defined`,
            );
        }

        const parameters = this.pendingParameters.get(target) || new Map();
        const methodParams = parameters.get(methodName) || [];

        this.validateParameterCombination(methodName, parameter, methodParams);

        if (parameter.type === 'param') {
            this.validateParamNameAgainstRoute(
                target,
                methodName,
                parameter.name,
            );
        }

        methodParams.push(parameter);
        parameters.set(methodName, methodParams);
        this.pendingParameters.set(target, parameters);
    }

    addDefaultHandler(
        target: Function,
        methodName: string,
        handler: Function,
    ): void {
        if (this.controllers.has(target)) {
            throw new Error(
                `ERROR adding default handler to controller ${target.name}, controller already defined`,
            );
        }

        if (this.pendingDefaultHandlers.has(target)) {
            throw new Error(
                `ERROR adding default handler ${methodName} to controller ${target.name}, default handler already defined`,
            );
        }

        this.pendingDefaultHandlers.set(target, { methodName, handler });
    }

    private validateParameterCombination(
        methodName: string,
        newParam: ParameterMetadata,
        existingParams: ParameterMetadata[],
    ): void {
        if (
            newParam.type === 'body' &&
            existingParams.some((p) => p.type === 'body')
        ) {
            throw new Error(
                `ERROR in ${methodName}: multiple @Body decorators are not allowed`,
            );
        }

        if (newParam.type === 'param') {
            const existingParam = existingParams.find(
                (p) => p.type === 'param' && p.name === newParam.name,
            );
            if (existingParam) {
                throw new Error(
                    `ERROR in ${methodName}: duplicate @Param decorator for parameter "${newParam.name}"`,
                );
            }
        }

        if (
            (newParam.type === 'body' &&
                existingParams.some((p) => p.type === 'query')) ||
            (newParam.type === 'query' &&
                existingParams.some((p) => p.type === 'body'))
        ) {
            throw new Error(
                `ERROR in ${methodName}: cannot combine @Body with @Query parameters`,
            );
        }

        if (
            !newParam.required &&
            newParam.type !== 'query' &&
            newParam.type !== 'file'
        ) {
            throw new Error(
                `ERROR in ${methodName}: only @Query and @File parameters can be optional`,
            );
        }

        if (newParam.type === 'query' || newParam.type === 'param') {
            const schema = newParam.schema;
            if (
                !schema ||
                typeof schema !== 'object' ||
                !('type' in schema) ||
                (schema.type !== 'string' && schema.type !== 'number')
            ) {
                const isQuery = newParam.type === 'query';
                throw new Error(
                    `ERROR in ${methodName}: @${isQuery ? 'Query' : 'Param'} parameters must be of type string or number, got ${
                        schema && typeof schema === 'object' && 'type' in schema
                            ? schema.type
                            : 'invalid type'
                    }`,
                );
            }
        }

        if (newParam.type === 'body') {
            const schema = newParam.schema;
            if (
                !schema ||
                typeof schema !== 'object' ||
                !('type' in schema) ||
                schema.type !== 'object'
            ) {
                throw new Error(
                    `ERROR in ${methodName}: @Body parameter must be of type object, got ${
                        schema && typeof schema === 'object' && 'type' in schema
                            ? schema.type
                            : 'invalid type'
                    }`,
                );
            }
        }
    }

    private sortRoutes(routes: RouteMetadata[]): RouteMetadata[] {
        return routes.sort((routeA, routeB) => {
            const segmentsA = routeA.path.split('/').filter(Boolean);
            const segmentsB = routeB.path.split('/').filter(Boolean);

            const minLength = Math.min(segmentsA.length, segmentsB.length);

            for (let i = 0; i < minLength; i++) {
                const isParamA = segmentsA[i].startsWith(':');
                const isParamB = segmentsB[i].startsWith(':');

                if (isParamA !== isParamB) {
                    return isParamA ? 1 : -1;
                }

                if (!isParamA && !isParamB && segmentsA[i] !== segmentsB[i]) {
                    return segmentsA[i].localeCompare(segmentsB[i]);
                }
            }

            if (segmentsA.length !== segmentsB.length) {
                return segmentsA.length - segmentsB.length;
            }

            return 0;
        });
    }

    public addStreamInfo(
        target: Function,
        methodName: string,
        streamType: 'dataStream' | 'fileStream',
        options: StreamOptions,
    ): void {
        const streams = this.pendingStreams.get(target) || new Map();
        streams.set(methodName, { options, streamType });
        this.pendingStreams.set(target, streams);
    }

    private validateParamNameAgainstRoute(
        target: Function,
        methodName: string,
        paramName?: string,
    ): void {
        const routes = this.pendingRoutes.get(target);
        const route = routes?.get(methodName);

        if (route) {
            const pathParams =
                route.path.match(/:[a-zA-Z]+/g)?.map((p) => p.substring(1)) ||
                [];

            if (pathParams.length === 0) {
                throw new Error(
                    `ERROR in ${methodName}: @Param decorator used but route "${route.path}" has no parameters`,
                );
            }

            if (!paramName) {
                throw new Error(
                    `ERROR in ${methodName}: @Param decorator requires a name when used with route parameters`,
                );
            }

            if (!pathParams.includes(paramName)) {
                throw new Error(
                    `ERROR in ${methodName}: parameter name "${paramName}" doesn't match any route parameter in path "${route.path}"`,
                );
            }

            const parameters =
                this.pendingParameters.get(target)?.get(methodName) || [];
            const existingParam = parameters.find(
                (p) => p.type === 'param' && p.name === paramName,
            );
            if (existingParam) {
                throw new Error(
                    `ERROR in ${methodName}: duplicate @Param("${paramName}") decorator. Each route parameter can only be used once.`,
                );
            }
        }
    }
}

interface ParameterMetadata {
    name?: string;
    required: boolean;
    schema: SchemaType;
    parameterIndex: number;
    type: 'body' | 'query' | 'param' | 'header' | 'file' | 'ctx' | 'rawBody';
    options?: { maxFileSize?: number; forceArray?: boolean; maxFiles?: number };
}

interface RouteMetadata {
    path: string;
    handler: Function;
    methodName: string;
    method: HttpMethod;
    stream?: {
        options: StreamOptions;
        streamType: 'dataStream' | 'fileStream';
    };
    returnType: SchemaType;
    parameters: ParameterMetadata[];
    middlewares: Middleware[];
    security: string[];
}

export interface ControllerMetadata {
    path: string;
    routes: RouteMetadata[];
    middlewares: Middleware[];
    security: string[];
    defaultHandler?: {
        methodName: string;
        handler: Function;
        middlewares: Middleware[];
    };
}

export { MetadataStorage };
export type { ParameterMetadata, RouteMetadata };
