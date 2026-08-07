import { type ControllerMetadata } from '../metadata';
import { type Middleware } from '../types/middleware';

interface IFrameworkAdapter {
    registerControllers(controllers: [ControllerMetadata[], Function[]], instances?: Map<Function, unknown>): void;
    registerGlobalMiddlewares(middlewares: Middleware[]): void;
    finalize(): void;
}

export * from './express';
export type { IFrameworkAdapter };
