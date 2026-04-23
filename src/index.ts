// Decorators
export {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Route,
    Body,
    Query,
    Param,
    Header,
    Inject,
    RawBody,
    File,
    Files,
    DataStream,
    FileStream,
    Use,
    Security,
    DefaultHandler,
} from './decorators';
export type { HttpMethod } from './decorators';

// Context
export { BasicContext } from './context';
export type { Context, IRequest, IResponse } from './context';

// Metadata
export { MetadataStorage } from './metadata';
export type {
    ControllerMetadata,
    RouteMetadata,
    ParameterMetadata,
} from './metadata';

// Errors
export {
    FrameworkError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    InternalServerError,
    StatusCodeErrorError,
    MissingInjectionError,
} from './errors';

// Types - using 'export *' to include Deepkit runtime type metadata (__Ω* symbols)
export * from './types';
export { File as FrameworkFile } from './types/files';

// Adapters
export { ExpressAdapter } from './adapters/express';
export type { IFrameworkAdapter } from './adapters';

// OpenAPI
export { registerOpenAPI } from './openapi';
export type {
    OpenAPISpec,
    OpenAPIConfig,
    RegisterOpenAPIOptions,
} from './openapi';

// Controllers registration
export {
    registerControllersWrapper,
    registerGlobalMiddlewaresWrapper,
} from './controllers';

// Logger
export { setLogger, getLogger, logger } from './logger';
export type { Logger } from './logger';
