import { Controller, Get, Post, Body, Security, Use } from '../decorators';
import { UnauthorizedError } from '../errors';
import type { Middleware } from '../types/middleware';
import { createSecurityMiddleware } from '../types/middleware';

const rawAuthMiddleware: Middleware = async (ctx, next) => {
    const token = ctx.request.headers['authorization'];
    if (!token || token !== 'Bearer valid-token') {
        throw new UnauthorizedError('Invalid or missing token');
    }
    ctx.set('user', { id: '1', name: 'Alice' });
    await next();
};

// Tag the middleware with its security scheme — @Use auto-detects it
export const authMiddleware = createSecurityMiddleware(
    'bearerAuth',
    rawAuthMiddleware,
);

// Seamless: just @Use(authMiddleware) — security is auto-detected
@Use(authMiddleware)
@Controller('/secure')
export class SecureController {
    @Get()
    async list(): Promise<{ items: string[] }> {
        return { items: ['a', 'b'] };
    }

    @Post()
    async create(
        @Body() body: { name: string },
    ): Promise<{ id: string; name: string }> {
        return { id: '1', name: body.name };
    }
}

@Controller('/mixed')
export class MixedController {
    @Get()
    async publicRoute(): Promise<{ message: string }> {
        return { message: 'public' };
    }

    // Method-level: just @Use(authMiddleware)
    @Use(authMiddleware)
    @Get('/protected')
    async protectedRoute(): Promise<{ message: string }> {
        return { message: 'protected' };
    }
}

// @Security still works as a lightweight fallback for metadata-only
@Use(rawAuthMiddleware)
@Security('bearerAuth')
@Controller('/use-plus-security')
export class UsePlusSecurityController {
    @Get()
    async list(): Promise<{ ok: boolean }> {
        return { ok: true };
    }
}
