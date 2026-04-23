import { Context } from '../context';

export type Middleware = (ctx: Context, next: () => Promise<void>) => unknown;

export interface SecurityMiddleware extends Middleware {
    __securityScheme: string;
}

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

export const createSecurityMiddleware = (
    schemeName: string,
    middleware: Middleware,
): SecurityMiddleware => {
    const securityMiddleware = middleware as SecurityMiddleware;
    securityMiddleware.__securityScheme = schemeName;
    return securityMiddleware;
};
