import { type SchemaType } from '../types';
import { BadRequestError } from '../errors';

const decodeQueryParam = (value: string): string | number | boolean => {
    try {
        const decoded = decodeURIComponent(value);

        if (/^-?\d+(\.\d+)?$/.test(decoded)) {
            return Number(decoded);
        }

        if (decoded.toLowerCase() === 'true') return true;
        if (decoded.toLowerCase() === 'false') return false;

        return decoded;
    } catch {
        throw new BadRequestError(`Failed to decode query parameter: ${value}`);
    }
};

export const validateAndTransform = (
    value: unknown,
    schema: SchemaType,
    paramType:
        | 'query'
        | 'body'
        | 'param'
        | 'header'
        | 'file'
        | 'ctx'
        | 'rawBody',
    path: string = '',
): unknown => {
    if (paramType === 'ctx' || paramType === 'rawBody') return value;

    const pathDisplay = path ? ` at path "${path}"` : '';
    const contextDisplay = path || paramType;

    if (value === undefined || value === null) {
        if (schema.type !== 'null') {
            throw new BadRequestError(
                `Value is required for ${contextDisplay}${pathDisplay}`,
            );
        }
        return null;
    }

    if (paramType === 'query' && typeof value === 'string') {
        value = decodeQueryParam(value);
    }

    if (schema.type === 'file' || paramType === 'file') {
        if (!value) {
            throw new BadRequestError('File is required');
        }
        return value;
    }

    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') {
                throw new BadRequestError(
                    `Expected string${pathDisplay}, got ${typeof value}`,
                );
            }
            return value;

        case 'number':
            if (typeof value === 'string') {
                const num = Number(value);
                if (isNaN(num)) {
                    throw new BadRequestError(
                        `Invalid number format${pathDisplay}: ${value}`,
                    );
                }
                return num;
            }
            if (typeof value !== 'number') {
                throw new BadRequestError(
                    `Expected number${pathDisplay}, got ${typeof value}`,
                );
            }
            return value;

        case 'boolean':
            if (typeof value === 'string') {
                const lowered = value.toLowerCase();
                if (lowered === 'true') return true;
                if (lowered === 'false') return false;
                throw new BadRequestError(
                    `Invalid boolean value${pathDisplay}: ${value}`,
                );
            }
            if (typeof value !== 'boolean') {
                throw new BadRequestError(
                    `Expected boolean${pathDisplay}, got ${typeof value}`,
                );
            }
            return value;

        case 'array':
            if (!Array.isArray(value)) {
                if (typeof value === 'string' && paramType === 'query') {
                    try {
                        value = JSON.parse(value);
                        if (!Array.isArray(value)) {
                            throw new Error('Not an array');
                        }
                    } catch {
                        throw new BadRequestError(
                            `Invalid array format${pathDisplay}`,
                        );
                    }
                } else {
                    throw new BadRequestError(
                        `Expected array${pathDisplay}, got ${typeof value}`,
                    );
                }
            }
            return (value as unknown[]).map((item, index) => {
                const itemPath = path ? `${path}[${index}]` : `[${index}]`;
                return validateAndTransform(
                    item,
                    schema.items!,
                    paramType,
                    itemPath,
                );
            });

        case 'object':
            if (typeof value !== 'object' || value === null) {
                if (typeof value === 'string' && paramType === 'query') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        throw new BadRequestError(
                            `Invalid object format${pathDisplay}`,
                        );
                    }
                } else {
                    throw new BadRequestError(
                        `Expected object${pathDisplay}, got ${typeof value}`,
                    );
                }
            }

            const result: Record<string, unknown> = {};
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(
                    schema.properties,
                )) {
                    const propPath = path ? `${path}.${key}` : key;
                    const objValue = value as Record<string, unknown>;
                    if (schema.required?.includes(key) && !(key in objValue)) {
                        throw new BadRequestError(
                            `Missing required property "${key}"${pathDisplay ? ` in ${path}` : ''}`,
                        );
                    }
                    if (key in objValue) {
                        result[key] = validateAndTransform(
                            objValue[key],
                            propSchema,
                            paramType,
                            propPath,
                        );
                    }
                }
            }
            return result;

        case 'union':
            if (!schema.oneOf) {
                throw new BadRequestError(
                    `Invalid union type definition${pathDisplay}`,
                );
            }

            const errors: Error[] = [];
            for (const subSchema of schema.oneOf) {
                try {
                    return validateAndTransform(
                        value,
                        subSchema,
                        paramType,
                        path,
                    );
                } catch (e) {
                    errors.push(e as Error);
                }
            }
            throw new BadRequestError(
                `Value does not match any type in union${pathDisplay}. Errors: ${errors
                    .map((e) => e.message)
                    .join(', ')}`,
            );

        case 'tuple':
            if (!Array.isArray(value)) {
                if (typeof value === 'string' && paramType === 'query') {
                    try {
                        value = JSON.parse(value);
                        if (!Array.isArray(value)) {
                            throw new Error('Not an array');
                        }
                    } catch {
                        throw new BadRequestError(
                            `Invalid tuple format${pathDisplay}`,
                        );
                    }
                } else {
                    throw new BadRequestError(
                        `Expected tuple (array)${pathDisplay}, got ${typeof value}`,
                    );
                }
            }

            if (!schema.elements || schema.elements.length === 0) {
                throw new BadRequestError(
                    `Invalid tuple schema definition${pathDisplay}`,
                );
            }

            if ((value as unknown[]).length !== schema.elements.length) {
                throw new BadRequestError(
                    `Tuple length mismatch${pathDisplay}: expected ${schema.elements.length}, got ${(value as unknown[]).length}`,
                );
            }

            return (value as unknown[]).map((item, index) => {
                const itemPath = path ? `${path}[${index}]` : `[${index}]`;
                return validateAndTransform(
                    item,
                    schema.elements![index],
                    paramType,
                    itemPath,
                );
            });

        case 'null':
            return null;

        default:
            throw new BadRequestError(
                `Unsupported type: ${schema.type} for ${paramType}`,
            );
    }
};
