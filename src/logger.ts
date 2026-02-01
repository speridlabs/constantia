export interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string, error?: Error) => void;
    debug: (message: string) => void;
}

const consoleLogger: Logger = {
    info: (message: string) => console.log(`[INFO] ${message}`),
    warn: (message: string) => console.warn(`[WARN] ${message}`),
    error: (message: string, error?: Error) => {
        console.error(`[ERROR] ${message}`);
        if (error) console.error(error);
    },
    debug: (message: string) => console.debug(`[DEBUG] ${message}`),
};

let currentLogger: Logger = consoleLogger;

export const setLogger = (logger: Logger): void => {
    currentLogger = logger;
};

export const getLogger = (): Logger => currentLogger;

export const logger: Logger = {
    info: (message: string) => currentLogger.info(message),
    warn: (message: string) => currentLogger.warn(message),
    error: (message: string, error?: Error) =>
        currentLogger.error(message, error),
    debug: (message: string) => currentLogger.debug(message),
};
