import { logger } from './logger';

import { type IFrameworkAdapter } from './adapters';
import { MetadataStorage, type ControllerMetadata } from './metadata';
import { type Middleware } from './types/middleware';

type ClassConstructor = { new (): unknown };

const registerControllersWrapper = (controllers: ClassConstructor[]) => {
    return (adapter: IFrameworkAdapter): void => {
        if (controllers.length === 0)
            throw new Error('No controllers to register');

        const metadataStorage = MetadataStorage.getInstance();
        const metadata: ControllerMetadata[] = Array.from(
            metadataStorage.controllers.values(),
        );

        const controllerClasses = Array.from(
            metadataStorage.controllers.keys(),
        );

        adapter.registerControllers([metadata, controllerClasses]);
        logger.info(
            `[constantia] Registered [${controllers.length}] controllers`,
        );
    };
};

const registerGlobalMiddlewaresWrapper = (middlewares: Middleware[]) => {
    return (adapter: IFrameworkAdapter): void => {
        if (middlewares.length === 0)
            return logger.info(
                '[constantia] No global middlewares to register',
            );

        adapter.registerGlobalMiddlewares(middlewares);
        logger.info(
            `[constantia] Registered [${middlewares.length}] global middlewares`,
        );
    };
};

export { registerControllersWrapper, registerGlobalMiddlewaresWrapper };
