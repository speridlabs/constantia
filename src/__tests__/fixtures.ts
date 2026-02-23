import { Controller, Get, Post, Body, Security, Use } from '../decorators';
import { UnauthorizedError } from '../errors';
import type { Middleware } from '../types/middleware';

export const authMiddleware: Middleware = async (ctx, next) => {
    const token = ctx.request.headers['authorization'];
    if (!token || token !== 'Bearer valid-token') {
        throw new UnauthorizedError('Invalid or missing token');
    }
    ctx.set('user', { id: '1', name: 'Alice' });
    await next();
};

@Security('bearerAuth', authMiddleware)
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

    @Security('bearerAuth', authMiddleware)
    @Get('/protected')
    async protectedRoute(): Promise<{ message: string }> {
        return { message: 'protected' };
    }
}

@Use(authMiddleware)
@Security('bearerAuth')
@Controller('/use-plus-security')
export class UsePlusSecurityController {
    @Get()
    async list(): Promise<{ ok: boolean }> {
        return { ok: true };
    }
}
