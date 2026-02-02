import { Context } from '../context';

export type Middleware = (ctx: Context, next: () => Promise<void>) => unknown;

export interface MiddlewareFactory {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]): Middleware;
    isFactory: true;
}

export const createMiddlewareFactory = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    factory: (...args: any[]) => Middleware,
): MiddlewareFactory => {
    const middlewareFactory = factory as MiddlewareFactory;
    middlewareFactory.isFactory = true;
    return middlewareFactory;
};
