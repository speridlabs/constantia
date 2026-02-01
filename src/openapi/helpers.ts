import { logger } from '../logger';

import { type RouteMetadata, type ParameterMetadata } from '../metadata';
import { type SchemaType } from '../types';

import {
    SchemaObject,
    ParameterObject,
    ReferenceObject,
    ResponseObject,
    ResponsesObject,
    ComponentsObject,
    RequestBodyObject,
} from './types';

export const schemaTypeToOpenAPISchema = (
    schemaType: SchemaType | undefined,
    components: ComponentsObject,
): SchemaObject | ReferenceObject | undefined => {
    if (!schemaType) {
        return undefined;
    }

    switch (schemaType.type) {
        case 'string':
            if (schemaType.format) {
                return { type: 'string', format: schemaType.format };
            }
            return { type: 'string' };
        case 'number':
            return { type: 'number' };
        case 'boolean':
            return { type: 'boolean' };
        case 'null':
        case 'void':
            return { nullable: true };
        case 'file':
            return { type: 'string', format: 'binary' };
        case 'fileStream':
            return { type: 'string', format: 'binary' };
        case 'dataStream':
            logger.warn(
                `OpenAPI: DataStream schema generation defaults to 'object'. Define item schema explicitly if possible.`,
            );
            return {
                type: 'object',
                description: 'Stream of data objects (e.g., ndjson)',
            };

        case 'array': {
            const itemsSchema = schemaTypeToOpenAPISchema(
                schemaType.items,
                components,
            );
            return { type: 'array', items: itemsSchema || {} };
        }

        case 'object': {
            const properties: {
                [key: string]: SchemaObject | ReferenceObject;
            } = {};
            if (schemaType.properties) {
                for (const [key, propSchema] of Object.entries(
                    schemaType.properties,
                )) {
                    const openApiPropSchema = schemaTypeToOpenAPISchema(
                        propSchema,
                        components,
                    );
                    if (openApiPropSchema) {
                        properties[key] = openApiPropSchema;
                    }
                }
            }
            return {
                type: 'object',
                properties: properties,
                required: schemaType.required,
            };
        }

        case 'union': {
            const nonNullTypes = schemaType.oneOf?.filter(
                (t) => t.type !== 'null' && t.type !== 'void',
            );
            const hasNull = schemaType.oneOf?.some(
                (t) => t.type === 'null' || t.type === 'void',
            );

            if (nonNullTypes?.length === 1) {
                const baseSchema = schemaTypeToOpenAPISchema(
                    nonNullTypes[0],
                    components,
                ) as SchemaObject;
                if (baseSchema && hasNull) {
                    baseSchema.nullable = true;
                }
                return baseSchema;
            } else if (schemaType.oneOf) {
                return {
                    oneOf: schemaType.oneOf
                        .map((subSchema) =>
                            schemaTypeToOpenAPISchema(subSchema, components),
                        )
                        .filter((s) => s !== undefined) as (
                        | SchemaObject
                        | ReferenceObject
                    )[],
                };
            }
            return {};
        }

        case 'tuple': {
            if (!schemaType.elements || schemaType.elements.length === 0) {
                return {
                    type: 'array',
                    items: {},
                    minItems: 0,
                    maxItems: 0,
                };
            }

            const elementSchemas = schemaType.elements.map((el) =>
                schemaTypeToOpenAPISchema(el, components),
            );

            const allSameType = schemaType.elements.every(
                (el) => el.type === schemaType.elements![0].type,
            );

            if (allSameType && schemaType.elements.length > 0) {
                return {
                    type: 'array',
                    items: elementSchemas[0] || {},
                    minItems: schemaType.elements.length,
                    maxItems: schemaType.elements.length,
                    description: `Fixed-length array (tuple) with ${schemaType.elements.length} elements`,
                };
            } else {
                return {
                    type: 'array',
                    items: {},
                    minItems: schemaType.elements.length,
                    maxItems: schemaType.elements.length,
                    description: `Fixed-length tuple with ${schemaType.elements.length} elements of types: ${schemaType.elements.map((el) => el.type).join(', ')}`,
                };
            }
        }

        default:
            logger.warn(
                `OpenAPI: Unsupported schema type "${(schemaType as SchemaType).type}" encountered.`,
            );
            return {};
    }
};

export const createOpenAPIParameters = (
    routeParams: ParameterMetadata[],
    components: ComponentsObject,
): (ParameterObject | ReferenceObject)[] => {
    const openApiParams: (ParameterObject | ReferenceObject)[] = [];

    for (const param of routeParams) {
        let location: ParameterObject['in'] | null = null;
        switch (param.type) {
            case 'param':
                location = 'path';
                break;
            case 'query':
                location = 'query';
                break;
            case 'header':
                location = 'header';
                break;
            case 'body':
            case 'file':
                continue;
            case 'ctx':
            case 'rawBody':
                continue;
            default:
                logger.warn(
                    `OpenAPI: Unsupported parameter type "${param.type}" for parameter "${param.name}".`,
                );
                continue;
        }

        if (!param.name) {
            logger.warn(
                `OpenAPI: Parameter of type "${param.type}" is missing a name.`,
            );
            continue;
        }

        openApiParams.push({
            name: param.name,
            in: location,
            required: param.required ?? location === 'path',
            schema: schemaTypeToOpenAPISchema(param.schema, components) || {},
        });
    }

    return openApiParams;
};

export const createOpenAPIRequestBody = (
    routeParams: ParameterMetadata[],
    components: ComponentsObject,
): RequestBodyObject | undefined => {
    const bodyParam = routeParams.find((p) => p.type === 'body');
    const fileParams = routeParams.filter((p) => p.type === 'file');

    if (!bodyParam && fileParams.length === 0) {
        return undefined;
    }

    const requestBody: RequestBodyObject = {
        required: true,
        content: {},
    };

    if (bodyParam) {
        requestBody.content['application/json'] = {
            schema:
                schemaTypeToOpenAPISchema(bodyParam.schema, components) || {},
        };
        requestBody.required = bodyParam.required;
    }

    if (fileParams.length > 0) {
        const properties: { [key: string]: SchemaObject | ReferenceObject } =
            {};
        const requiredFields: string[] = [];

        let hasUnnamedFileArray = false;

        for (const fileParam of fileParams) {
            if (fileParam.name) {
                properties[fileParam.name] = {
                    type: 'string',
                    format: 'binary',
                };
                if (fileParam.required) {
                    requiredFields.push(fileParam.name);
                }
            } else {
                hasUnnamedFileArray = true;
                if (fileParam.required) {
                    requiredFields.push('files');
                }
            }
        }

        if (hasUnnamedFileArray) {
            properties['files'] = {
                type: 'array',
                items: { type: 'string', format: 'binary' },
                description: 'One or more files uploaded.',
            };
        } else if (
            Object.keys(properties).length === 0 &&
            fileParams.length > 0
        ) {
            properties['file'] = {
                type: 'string',
                format: 'binary',
                description: 'A file upload.',
            };
            if (fileParams.some((fp) => fp.required))
                requiredFields.push('file');
        }

        requestBody.content['multipart/form-data'] = {
            schema: {
                type: 'object',
                properties: properties,
                required:
                    requiredFields.length > 0 ? requiredFields : undefined,
            },
        };
        requestBody.required = true;
    }

    return requestBody;
};

export const createOpenAPIResponses = (
    route: RouteMetadata,
    components: ComponentsObject,
): ResponsesObject => {
    const responses: ResponsesObject = {};

    if (!components.schemas) components.schemas = {};
    if (!components.responses) components.responses = {};

    if (!components.schemas['ErrorResponse']) {
        components.schemas['ErrorResponse'] = {
            type: 'object',
            properties: {
                error: {
                    type: 'string',
                    description:
                        'Short error identifier (e.g., BadRequest, NotFound, Unauthorized)',
                },
                message: {
                    type: 'string',
                    description: 'Detailed error message',
                },
            },
            required: ['error', 'message'],
            description: 'Standard error structure for failed responses.',
        };
    }

    const errorResponseRef = { $ref: '#/components/schemas/ErrorResponse' };

    if (!components.responses['BadRequest']) {
        components.responses['BadRequest'] = {
            description: 'Bad Request (e.g., validation error, invalid input)',
            content: { 'application/json': { schema: errorResponseRef } },
        };
    }

    if (!components.responses['Unauthorized']) {
        components.responses['Unauthorized'] = {
            description:
                'Unauthorized (e.g., missing or invalid authentication credentials)',
            content: { 'application/json': { schema: errorResponseRef } },
        };
    }

    if (!components.responses['NotFound']) {
        components.responses['NotFound'] = {
            description: 'Resource Not Found',
            content: { 'application/json': { schema: errorResponseRef } },
        };
    }

    if (!components.responses['InternalError']) {
        components.responses['InternalError'] = {
            description:
                'Internal Server Error (an unexpected condition occurred)',
            content: { 'application/json': { schema: errorResponseRef } },
        };
    }

    if (!components.responses['DefaultError']) {
        components.responses['DefaultError'] = {
            description:
                'An unexpected error occurred (includes errors specified by StatusCodeErrorError)',
            content: { 'application/json': { schema: errorResponseRef } },
        };
    }

    let successStatusCode = '200';
    const successResponse: ResponseObject = {
        description: 'Successful operation',
    };

    const returnSchema = schemaTypeToOpenAPISchema(
        route.returnType,
        components,
    );

    const specifiedContentType = route.stream?.options?.contentType;

    if (route.stream?.streamType === 'fileStream') {
        const responseContentType =
            specifiedContentType || 'application/octet-stream';
        successResponse.description = 'File stream';
        successResponse.content = {
            [responseContentType]: {
                schema: { type: 'string', format: 'binary' },
            },
        };
        successResponse.headers = {
            'Accept-Ranges': {
                schema: { type: 'string' },
                description: 'Indicates support for range requests (bytes)',
            },
            'Content-Range': {
                schema: { type: 'string' },
                description:
                    'Indicates the part of the file returned for partial content',
            },
            'Content-Length': {
                schema: { type: 'string' },
                description: 'The size of the file part or whole file',
            },
            'Content-Disposition': {
                schema: { type: 'string' },
                description:
                    'Specifies presentation (inline/attachment) and filename',
            },
        };
    } else if (route.stream?.streamType === 'dataStream') {
        const responseContentType =
            specifiedContentType || 'application/x-ndjson';
        successResponse.description = 'Data stream';
        successResponse.content = {
            [responseContentType]: {
                schema: {
                    type: 'string',
                    description: `Stream of data objects, often newline-delimited (like ${responseContentType}). Schema represents one object within the stream.`,
                },
            },
        };
    } else if (
        route.returnType.type === 'void' ||
        route.returnType.type === 'null'
    ) {
        successStatusCode = '204';
        successResponse.description = 'Success (No Content)';
    } else if (returnSchema) {
        successResponse.content = {
            'application/json': {
                schema: returnSchema,
            },
        };
    } else {
        successResponse.description = 'Success';
    }

    responses[successStatusCode] = successResponse;

    responses['400'] = { $ref: '#/components/responses/BadRequest' };
    responses['401'] = { $ref: '#/components/responses/Unauthorized' };
    responses['404'] = { $ref: '#/components/responses/NotFound' };
    responses['500'] = { $ref: '#/components/responses/InternalError' };
    responses.default = { $ref: '#/components/responses/DefaultError' };

    return responses;
};
