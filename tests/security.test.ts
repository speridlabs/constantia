/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import request from 'supertest';

/*
 * Test fixtures are compiled from src/__tests__/fixtures.ts via `pnpm build:tsc`.
 * The Deepkit type compiler injects runtime type metadata during that build.
 * We import from `dist/` so the decorators and reflection work correctly.
 */

let ExpressAdapter: any;
let registerControllersWrapper: any;
let registerGlobalMiddlewaresWrapper: any;
let registerOpenAPI: any;
let SecureController: any;
let MixedController: any;
let UsePlusSecurityController: any;

beforeAll(async () => {
    const mod = await import('../dist/index.js');
    ExpressAdapter = mod.ExpressAdapter;
    registerControllersWrapper = mod.registerControllersWrapper;
    registerGlobalMiddlewaresWrapper = mod.registerGlobalMiddlewaresWrapper;
    registerOpenAPI = mod.registerOpenAPI;

    const fixtures = await import('../dist/__tests__/fixtures.js');
    SecureController = fixtures.SecureController;
    MixedController = fixtures.MixedController;
    UsePlusSecurityController = fixtures.UsePlusSecurityController;
});

interface OpenAPISpec {
    openapi: string;
    info: { title: string; version: string; description?: string };
    paths: Record<string, Record<string, { security?: Record<string, string[]>[] }>>;
    components?: {
        securitySchemes?: Record<string, unknown>;
        schemas?: Record<string, unknown>;
        responses?: Record<string, unknown>;
    };
}

async function createApp(): Promise<express.Express> {
    const app = express();
    const adapter = new ExpressAdapter(app);

    registerGlobalMiddlewaresWrapper([])(adapter);
    registerControllersWrapper([
        SecureController,
        MixedController,
        UsePlusSecurityController,
    ])(adapter);
    await registerOpenAPI(adapter, {
        config: {
            title: 'Test API',
            version: '1.0.0',
            description: 'Test API with security',
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    });

    return app;
}

describe('Security decorator + OpenAPI auth integration', () => {
    let app: express.Express;

    beforeAll(async () => {
        app = await createApp();
    });

    // -- OpenAPI spec tests --
    describe('OpenAPI spec generation', () => {
        let spec: OpenAPISpec;

        beforeAll(async () => {
            const res = await request(app).get('/openapi.json').expect(200);
            spec = JSON.parse(res.text);
        });

        it('should include securitySchemes in components', () => {
            expect(spec.components?.securitySchemes).toBeDefined();
            expect(spec.components!.securitySchemes!['bearerAuth']).toEqual({
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            });
        });

        it('should add security to class-level @Security routes', () => {
            const listOp = spec.paths['/secure/']?.get;
            expect(listOp).toBeDefined();
            expect(listOp!.security).toEqual([{ bearerAuth: [] }]);

            const createOp = spec.paths['/secure/']?.post;
            expect(createOp).toBeDefined();
            expect(createOp!.security).toEqual([{ bearerAuth: [] }]);
        });

        it('should add security only to method-level @Security routes', () => {
            const publicOp = spec.paths['/mixed/']?.get;
            expect(publicOp).toBeDefined();
            expect(publicOp!.security).toBeUndefined();

            const protectedOp = spec.paths['/mixed/protected']?.get;
            expect(protectedOp).toBeDefined();
            expect(protectedOp!.security).toEqual([{ bearerAuth: [] }]);
        });

        it('should add security when @Use + @Security combined', () => {
            const listOp = spec.paths['/use-plus-security/']?.get;
            expect(listOp).toBeDefined();
            expect(listOp!.security).toEqual([{ bearerAuth: [] }]);
        });

        it('should have valid OpenAPI 3.0.3 structure', () => {
            expect(spec.openapi).toBe('3.0.3');
            expect(spec.info.title).toBe('Test API');
            expect(spec.info.version).toBe('1.0.0');
        });

        it('should not add security to routes without @Security', () => {
            const publicOp = spec.paths['/mixed/']?.get;
            expect(publicOp).toBeDefined();
            expect(publicOp!.security).toBeUndefined();
        });
    });

    // -- Middleware enforcement tests --
    describe('Auth middleware enforcement', () => {
        it('should reject unauthenticated requests on class-level @Security', async () => {
            const res = await request(app).get('/secure/');
            expect(res.status).toBe(401);
        });

        it('should allow authenticated requests on class-level @Security', async () => {
            const res = await request(app)
                .get('/secure/')
                .set('Authorization', 'Bearer valid-token');
            expect(res.status).toBe(200);
            expect(res.body.items).toEqual(['a', 'b']);
        });

        it('should allow public routes without auth', async () => {
            const res = await request(app).get('/mixed/');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('public');
        });

        it('should reject unauthenticated requests on method-level @Security', async () => {
            const res = await request(app).get('/mixed/protected');
            expect(res.status).toBe(401);
        });

        it('should allow authenticated requests on method-level @Security', async () => {
            const res = await request(app)
                .get('/mixed/protected')
                .set('Authorization', 'Bearer valid-token');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('protected');
        });

        it('should reject unauthenticated requests on @Use + @Security', async () => {
            const res = await request(app).get('/use-plus-security/');
            expect(res.status).toBe(401);
        });

        it('should allow authenticated requests on @Use + @Security', async () => {
            const res = await request(app)
                .get('/use-plus-security/')
                .set('Authorization', 'Bearer valid-token');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('should accept POST with body on authenticated secure route', async () => {
            const res = await request(app)
                .post('/secure/')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Test' });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id: '1', name: 'Test' });
        });
    });
});
