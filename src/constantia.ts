import { logger } from './logger';

import { type Middleware } from './types/middleware';
import { type IFrameworkAdapter } from './adapters';
import { MetadataStorage, type ControllerMetadata } from './metadata';
import { writeSpecFile, OpenAPIController, type OpenAPIConfig } from './openapi';

type ClassConstructor = new (...args: never[]) => unknown;

export interface ConstantiaOpenAPIOptions {
    config?: OpenAPIConfig;
    specFile?: string;
}

export class Constantia {
    private readonly registered: Map<Function, ControllerMetadata> = new Map();

    constructor(private readonly adapter: IFrameworkAdapter) {}

    public readonly registerGlobalMiddlewares = (middlewares: Middleware[]): void => {
        if (middlewares.length === 0) return logger.info('[constantia] No global middlewares to register');

        this.adapter.registerGlobalMiddlewares(middlewares);
        logger.info(`[constantia] Registered [${middlewares.length}] global middlewares`);
    };

    public readonly registerControllers = (controllers: ClassConstructor[]): void => {
        if (controllers.length === 0) throw new Error('No controllers to register');

        const storage = MetadataStorage.getInstance();
        const metadata = controllers.map((controllerClass) => {
            const meta = storage.controllers.get(controllerClass);
            if (!meta)
                throw new Error(
                    `Controller ${controllerClass.name} has no metadata, is it decorated with @Controller?`,
                );

            this.registered.set(controllerClass, meta);
            return meta;
        });

        this.adapter.registerControllers([metadata, controllers]);
        logger.info(`[constantia] Registered [${controllers.length}] controllers`);
    };

    public readonly registerOpenAPI = async (options: ConstantiaOpenAPIOptions = {}): Promise<void> => {
        const storage = MetadataStorage.getInstance();
        if (!storage.controllers.has(OpenAPIController)) storage.addController(OpenAPIController, '/openapi.json');

        const meta = storage.controllers.get(OpenAPIController);
        if (!meta) throw new Error('Failed to register OpenAPI controller');

        const controller = new OpenAPIController(options.config, () => Array.from(this.registered.values()));
        this.adapter.registerControllers([[meta], [OpenAPIController]], new Map([[OpenAPIController, controller]]));

        if (options.specFile) await writeSpecFile(await controller.getOpenAPISpec(), options.specFile);
    };

    public readonly finalize = (): void => {
        this.adapter.finalize();
    };
}
