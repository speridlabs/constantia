// Decorators
export {
    Body,
    ContentType,
    Controller,
    DataStream,
    DefaultHandler,
    Delete,
    File,
    FileStream,
    Files,
    Get,
    Header,
    Inject,
    Param,
    Patch,
    Post,
    Put,
    Query,
    RawBody,
    Route,
    Use,
} from './decorators';
export type { HttpMethod } from './decorators';

// Context
export { BasicContext, getRequestContext } from './context';
export type { Context, IRequest, IResponse } from './context';

// Metadata
export { MetadataStorage } from './metadata';
export type { ControllerMetadata, RouteMetadata, ParameterMetadata } from './metadata';

// Errors
export {
    BadRequestError,
    ForbiddenError,
    FrameworkError,
    InternalServerError,
    MissingInjectionError,
    NotFoundError,
    StatusCodeErrorError,
    UnauthorizedError,
} from './errors';

// Types - using 'export *' to include Deepkit runtime type metadata (__Ω* symbols)
export * from './types';
export { File as FrameworkFile } from './types/files';

// Adapters
export { ExpressAdapter } from './adapters/express';
export type { IFrameworkAdapter } from './adapters';

// OpenAPI
export { registerOpenAPI } from './openapi';
export type { OpenAPISpec, OpenAPIConfig, RegisterOpenAPIOptions } from './openapi';

// Controllers registration
export { registerControllersWrapper, registerGlobalMiddlewaresWrapper } from './controllers';

// Logger
export { setLogger, getLogger, logger } from './logger';
export type { Logger } from './logger';
