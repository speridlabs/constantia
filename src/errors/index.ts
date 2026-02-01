export class FrameworkError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        name: string,
    ) {
        super(message);
        this.name = name;
    }
}

export class InternalServerError extends FrameworkError {
    constructor(message: string, status: number = 500) {
        super(message, status, 'Internal Server Error');
    }
}

export class BadRequestError extends FrameworkError {
    constructor(message: string, status: number = 400) {
        super(message, status, 'Bad Request');
    }
}

export class NotFoundError extends FrameworkError {
    constructor(message: string, status: number = 404) {
        super(message, status, 'Not Found');
    }
}

export class UnauthorizedError extends FrameworkError {
    constructor(message: string, status: number = 401) {
        super(message, status, 'Unauthorized');
    }
}

export class ForbiddenError extends FrameworkError {
    constructor(message: string, status: number = 403) {
        super(message, status, 'Forbidden');
    }
}

export class StatusCodeErrorError extends FrameworkError {
    constructor(message: string, status: number) {
        super(message, status, 'StatusCodeError');
    }
}

export class MissingInjectionError extends FrameworkError {
    constructor(key: string) {
        super(
            `Context value "${key}" was not injected`,
            500,
            'MissingInjection',
        );
    }
}
