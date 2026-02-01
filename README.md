# Constantia

A decorator-based, type-safe web framework for building self-documenting REST APIs with automatic OpenAPI generation. Built on top of [Deepkit](https://deepkit.io/) runtime types for zero-overhead validation.

## Features

-   **Decorator-based routing** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`
-   **Automatic type validation** — Parameters validated at runtime from TypeScript types (no schemas to write)
-   **OpenAPI generation** — Full OpenAPI 3.0 spec auto-generated from your controllers
-   **File uploads** — `@File`, `@Files` with size/count limits and temp file management
-   **Streaming** — `@FileStream`, `@DataStream` for large files and real-time data
-   **Middleware pipeline** — Koa-style `@Use` middleware with context injection via `@Inject`
-   **Adapter pattern** — Framework-agnostic core; ships with Express adapter
-   **Error handling** — Typed errors (`BadRequestError`, `NotFoundError`, etc.) that map to HTTP status codes
-   **Configurable logger** — Plug in your own logger or use the built-in console logger

## Requirements

-   **Node.js** >= 20
-   **TypeScript** 5.x
-   **pnpm** >= 8 (recommended)

> **Important:** Constantia uses [Deepkit Type Compiler](https://deepkit.io/documentation/type) for runtime type reflection. Your project's TypeScript must be patched by `@deepkit/type-compiler` at install time. See [Setup](#setup) for details.

## Setup

```bash
pnpm add constantia
```

Your `package.json` must include:

```json
{
    "scripts": {
        "postinstall": "node_modules/.bin/deepkit-type-install"
    },
    "pnpm": {
        "onlyBuiltDependencies": ["@deepkit/type-compiler"]
    }
}
```

Add `@deepkit/type-compiler` as a dev dependency:

```bash
pnpm add -D @deepkit/type-compiler@1.0.1-alpha.155
```

Your `tsconfig.json` **must** include:

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    },
    "reflection": true
}
```

The `"reflection": true` key is read by the Deepkit type compiler to emit type metadata at compile time.

## Quick Start

```typescript
import express from 'express';
import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    ExpressAdapter,
    registerControllersWrapper,
    registerGlobalMiddlewaresWrapper,
    registerOpenAPI,
    BadRequestError,
} from 'constantia';

// 1. Define a controller
@Controller('/users')
class UserController {
    @Get()
    async list(): Promise<{ id: string; name: string }[]> {
        return [{ id: '1', name: 'Alice' }];
    }

    @Get('/:id')
    async getById(
        @Param('id') id: string,
    ): Promise<{ id: string; name: string }> {
        if (id === '0') throw new BadRequestError('Invalid user ID');
        return { id, name: 'Alice' };
    }

    @Post()
    async create(
        @Body() body: { name: string; email: string },
    ): Promise<{ id: string }> {
        return { id: '42' };
    }

    @Get('/search')
    async search(@Query('q') q: string): Promise<{ results: string[] }> {
        return { results: [`Result for: ${q}`] };
    }
}

// 2. Boot the app
const app = express();
const adapter = new ExpressAdapter(app);

// 3. Register middlewares, controllers, and OpenAPI
registerGlobalMiddlewaresWrapper([])(adapter);
registerControllersWrapper([UserController])(adapter);
await registerOpenAPI(adapter, {
    config: { title: 'My API', version: '1.0.0' },
});

app.listen(3000, () => console.log('Listening on :3000'));
```

Visit `http://localhost:3000/openapi.json` to see the generated spec.

## Decorators

### Class

| Decorator              | Description                             |
| ---------------------- | --------------------------------------- |
| `@Controller('/path')` | Registers a class as a route controller |

### Methods

| Decorator           | Description                               |
| ------------------- | ----------------------------------------- |
| `@Get('/path')`     | `GET` route                               |
| `@Post('/path')`    | `POST` route                              |
| `@Put('/path')`     | `PUT` route                               |
| `@Delete('/path')`  | `DELETE` route                            |
| `@Patch('/path')`   | `PATCH` route                             |
| `@DefaultHandler()` | Catch-all handler for the controller path |

### Parameters

| Decorator         | Description                                     |
| ----------------- | ----------------------------------------------- |
| `@Param('name')`  | URL path parameter (`:name`)                    |
| `@Query('name')`  | Query string parameter                          |
| `@Body()`         | Request body (validated as object)              |
| `@Header('name')` | Request header                                  |
| `@Inject('key')`  | Inject a value from context (set by middleware) |
| `@RawBody()`      | Raw request body as `Buffer`                    |

### Files

| Decorator                                        | Description                   |
| ------------------------------------------------ | ----------------------------- |
| `@File()`                                        | Single file upload            |
| `@File('fieldName', { maxFileSize, maxFiles })`  | Named file with options       |
| `@Files()`                                       | Multiple files (array)        |
| `@Files('fieldName', { maxFileSize, maxFiles })` | Named multi-file with options |

### Streaming

| Decorator                                                        | Description                |
| ---------------------------------------------------------------- | -------------------------- |
| `@FileStream({ contentDisposition, contentType, downloadName })` | Stream a file response     |
| `@DataStream({ contentType })`                                   | Stream data (e.g., ndjson) |

Return types must match:

```typescript
// For @FileStream
async download(): Promise<FileStreamResponse> { ... }

// For @DataStream
async events(): Promise<DataStreamResponse<MyEvent>> { ... }
```

### Middleware

```typescript
import { Use, Middleware, createMiddlewareFactory } from 'constantia';

// Simple middleware
const logRequest: Middleware = async (ctx, next) => {
    console.log(`${ctx.request.method} ${ctx.request.url}`);
    await next();
};

// Middleware factory (for parameterized middleware)
const requireRole = createMiddlewareFactory((role: string) => {
    return async (ctx, next) => {
        const user = ctx.get<{ role: string }>('user');
        if (user?.role !== role) throw new UnauthorizedError('Forbidden');
        await next();
    };
});

// Apply at class level (all routes)
@Use(logRequest)
@Controller('/admin')
class AdminController {
    // Apply at method level
    @Use(requireRole('admin'))
    @Get('/dashboard')
    async dashboard(): Promise<{ status: string }> {
        return { status: 'ok' };
    }
}
```

### Context Injection

Middleware can inject values into the request context for controllers to consume:

```typescript
const authMiddleware: Middleware = async (ctx, next) => {
    const token = ctx.request.headers['authorization'];
    const user = await verifyToken(token);
    ctx.set('user', user);
    await next();
};

@Use(authMiddleware)
@Controller('/profile')
class ProfileController {
    @Get()
    async getProfile(@Inject('user') user: User): Promise<User> {
        return user;
    }
}
```

## Errors

Throw typed errors to return the corresponding HTTP status:

```typescript
import {
    BadRequestError, // 400
    UnauthorizedError, // 401
    ForbiddenError, // 403
    NotFoundError, // 404
    InternalServerError, // 500
    StatusCodeErrorError, // custom status
} from 'constantia';

throw new BadRequestError('Invalid input');
throw new NotFoundError('User not found');
throw new StatusCodeErrorError('Rate limited', 429);
```

## OpenAPI

The spec is auto-generated from your decorators and TypeScript types. Expose it at runtime:

```typescript
await registerOpenAPI(adapter, {
    config: {
        title: 'My API',
        version: '2.0.0',
        description: 'My awesome API',
    },
});
```

Generate a static `openapi.json` at build time:

```bash
node dist/app.js --only-generate-spec ./openapi.json
```

Or generate alongside the running server:

```bash
node dist/app.js --generate-spec ./openapi.json
```

## Custom Logger

By default Constantia logs to the console. Plug in your own:

```typescript
import { setLogger } from 'constantia';

setLogger({
    info: (msg) => myLogger.info(msg),
    warn: (msg) => myLogger.warn(msg),
    error: (msg, err) => myLogger.error(msg, err),
    debug: (msg) => myLogger.debug(msg),
});
```

## File Handling

Uploaded files are stored as temp files. Important lifecycle methods:

```typescript
@Post('/upload')
async upload(@File('document', { maxFileSize: 10 * 1024 * 1024 }) file: IFile) {
    // file.name, file.size, file.mimetype, file.tempFilePath
    const stream = file.getstream(); // ReadStream

    // If you need to process after the response:
    file.keepAlive(); // prevents auto-cleanup
    // ... later ...
    file.cleanup(); // manual cleanup when done
}
```

## Project Structure (recommended)

```
src/
├── controllers/
│   ├── user.controller.ts
│   ├── auth.controller.ts
│   └── index.ts          # export all controllers
├── middlewares/
│   └── index.ts           # export global middlewares
├── app.ts                 # boot express + constantia
└── ...
```

```typescript
// src/app.ts
import express from 'express';
import {
    ExpressAdapter,
    registerControllersWrapper,
    registerGlobalMiddlewaresWrapper,
    registerOpenAPI,
} from 'constantia';
import { controllers } from './controllers';
import { globalMiddlewares } from './middlewares';

const app = express();
const adapter = new ExpressAdapter(app);

registerGlobalMiddlewaresWrapper(globalMiddlewares)(adapter);
registerControllersWrapper(controllers)(adapter);
await registerOpenAPI(adapter);

app.listen(3000);
```

## License

MIT
