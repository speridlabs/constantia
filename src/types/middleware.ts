import { Context } from '../context';

export type Middleware = (ctx: Context, next: () => Promise<void>) => unknown;

export interface MiddlewareFactory {
    (...args: unknown[]): Middleware;
    isFactory: true;
}

export const createMiddlewareFactory = (
    factory: (...args: unknown[]) => Middleware,
): MiddlewareFactory => {
    const middlewareFactory = factory as MiddlewareFactory;
    middlewareFactory.isFactory = true;
    return middlewareFactory;
};
