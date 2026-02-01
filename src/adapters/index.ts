import { type ControllerMetadata } from '../metadata';
import { type Middleware } from '../types/middleware';

interface IFrameworkAdapter {
    registerControllers(controllers: [ControllerMetadata[], Function[]]): void;
    registerGlobalMiddlewares(middlewares: Middleware[]): void;
}

export * from './express';
export type { IFrameworkAdapter };
