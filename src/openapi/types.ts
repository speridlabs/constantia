export interface OpenAPISpec {
    openapi: string;
    info: InfoObject;
    paths: PathsObject;
    components?: ComponentsObject;
    tags?: { name: string; description?: string }[];
    servers?: ServerObject[];
    security?: SecurityRequirementObject[];
}

export interface InfoObject {
    title: string;
    version: string;
    description?: string;
}

export interface PathsObject {
    [path: string]: PathItemObject;
}

export interface PathItemObject {
    get?: OperationObject;
    put?: OperationObject;
    post?: OperationObject;
    delete?: OperationObject;
    patch?: OperationObject;
    parameters?: (ParameterObject | ReferenceObject)[];
}

export interface OperationObject {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    parameters?: (ParameterObject | ReferenceObject)[];
    requestBody?: RequestBodyObject | ReferenceObject;
    responses: ResponsesObject;
    deprecated?: boolean;
    security?: SecurityRequirementObject[];
}

export interface ParameterObject {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    schema?: SchemaObject | ReferenceObject;
}

export interface RequestBodyObject {
    description?: string;
    content: { [mediaType: string]: MediaTypeObject };
    required?: boolean;
}

export interface MediaTypeObject {
    schema?: SchemaObject | ReferenceObject;
}

export interface ResponsesObject {
    default?: ResponseObject | ReferenceObject;
    [statusCode: string]: ResponseObject | ReferenceObject | undefined;
}

export interface ResponseObject {
    description: string;
    headers?: { [headerName: string]: HeaderObject | ReferenceObject };
    content?: { [mediaType: string]: MediaTypeObject };
}

export interface SchemaObject {
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    format?: string;
    items?: SchemaObject | ReferenceObject;
    properties?: { [propertyName: string]: SchemaObject | ReferenceObject };
    required?: string[];
    nullable?: boolean;
    oneOf?: (SchemaObject | ReferenceObject)[];
    allOf?: (SchemaObject | ReferenceObject)[];
    anyOf?: (SchemaObject | ReferenceObject)[];
    description?: string;
    example?: unknown;
    minItems?: number;
    maxItems?: number;
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
}

export interface ComponentsObject {
    schemas?: { [schemaName: string]: SchemaObject | ReferenceObject };
    responses?: { [responseName: string]: ResponseObject | ReferenceObject };
    parameters?: { [parameterName: string]: ParameterObject | ReferenceObject };
    requestBodies?: {
        [requestBodyName: string]: RequestBodyObject | ReferenceObject;
    };
    headers?: { [headerName: string]: HeaderObject | ReferenceObject };
    securitySchemes?: {
        [schemeName: string]: SecuritySchemeObject | ReferenceObject;
    };
}

export interface ServerObject {
    url: string;
    description?: string;
}

export interface HeaderObject extends Omit<ParameterObject, 'name' | 'in'> {}

export interface ReferenceObject {
    $ref: string;
}

export interface SecuritySchemeObject {
    type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
    description?: string;
    name?: string;
    in?: 'query' | 'header' | 'cookie';
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlowsObject;
    openIdConnectUrl?: string;
}

export interface OAuthFlowsObject {
    implicit?: OAuthFlowObject;
    password?: OAuthFlowObject;
    clientCredentials?: OAuthFlowObject;
    authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: { [scope: string]: string };
}

export interface SecurityRequirementObject {
    [schemeName: string]: string[];
}
