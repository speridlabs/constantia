export interface Logger {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: Logger = {
    info: (message: string, _meta?: Record<string, unknown>) => console.log(`[INFO] ${message}`),
    warn: (message: string, _meta?: Record<string, unknown>) => console.warn(`[WARN] ${message}`),
    error: (message: string, error?: Error, _meta?: Record<string, unknown>) => {
        console.error(`[ERROR] ${message}`);
        if (error) console.error(error);
    },
    debug: (message: string, _meta?: Record<string, unknown>) => console.debug(`[DEBUG] ${message}`),
};

let currentLogger: Logger = consoleLogger;

export const setLogger = (logger: Logger): void => {
    currentLogger = logger;
};

export const getLogger = (): Logger => currentLogger;

export const logger: Logger = {
    info: (message: string, meta?: Record<string, unknown>) => currentLogger.info(message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => currentLogger.warn(message, meta),
    error: (message: string, error?: Error, meta?: Record<string, unknown>) =>
        currentLogger.error(message, error, meta),
    debug: (message: string, meta?: Record<string, unknown>) => currentLogger.debug(message, meta),
};
