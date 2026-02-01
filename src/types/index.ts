import {
    ReflectionClass,
    ReflectionKind,
    ReflectionMethod,
    type Type,
} from '@deepkit/type';

const extractMethodReturnSchema = (
    objectClass: Parameters<typeof ReflectionClass.from>[0],
    methodName: string | symbol,
): SchemaType => {
    const reflection = ReflectionClass.from(objectClass);
    const methodReflection: ReflectionMethod | undefined =
        reflection.getMethod(methodName);

    if (!methodReflection)
        throw new Error(
            `Method ${String(methodName)} not found in reflection.`,
        );

    const returnType = methodReflection.getReturnType();

    return reflectionTypeToSchema(returnType);
};

const reflectionToSchema = (
    ref: ReturnType<typeof ReflectionClass.from> | Type,
): SchemaType => {
    if ('kind' in ref) return reflectionTypeToSchema(ref);

    const props: Record<string, SchemaType> = {};
    const required: string[] = [];

    for (const p of ref.getProperties()) {
        if (p.name === 'ISASTREAMFILEONLYFORFRAMEWORK')
            return { type: 'fileStream' };
        if (p.name === 'ISASTREAMDATAONLYFORFRAMEWORK')
            return { type: 'dataStream' };

        const propSchema = reflectionTypeToSchema(p.type);
        if (propSchema !== undefined) {
            props[p.name] = propSchema;
            if (!p.isOptional()) {
                required.push(p.name);
            }
        }
    }

    return {
        type: 'object',
        properties: props,
        required: required.length > 0 ? required : undefined,
    };
};

const reflectionTypeToSchema = (t: Type): SchemaType => {
    switch (t.kind) {
        case ReflectionKind.string:
            return { type: 'string' };
        case ReflectionKind.number:
            return { type: 'number' };
        case ReflectionKind.boolean:
            return { type: 'boolean' };
        case ReflectionKind.array:
            return {
                type: 'array',
                items: reflectionTypeToSchema(t.type),
            };
        case ReflectionKind.objectLiteral: {
            const nestedRef = ReflectionClass.from(t);
            return reflectionToSchema(nestedRef);
        }
        case ReflectionKind.class: {
            if (t.classType === Date) {
                return { type: 'string', format: 'date-time' };
            }

            const nestedRef = ReflectionClass.from(t);
            return reflectionToSchema(nestedRef);
        }
        case ReflectionKind.promise:
            return reflectionTypeToSchema(t.type);
        case ReflectionKind.union: {
            const types = t.types.map((subType) =>
                reflectionTypeToSchema(subType),
            );
            return { oneOf: types, type: 'union' };
        }
        case ReflectionKind.literal:
            return { type: 'string' };
        case ReflectionKind.tuple: {
            const elements = t.types.map((elementType) =>
                reflectionTypeToSchema(elementType),
            );
            return {
                type: 'tuple',
                elements: elements,
            };
        }
        case ReflectionKind.tupleMember:
            return reflectionTypeToSchema(t.type);
        case ReflectionKind.never:
            return { type: 'null' };
        case ReflectionKind.undefined:
            return { type: 'null' };
        case ReflectionKind.null:
            return { type: 'null' };
        case ReflectionKind.void:
            return { type: 'null' };
        case ReflectionKind.any:
            if (t.parent?.kind === ReflectionKind.property) {
                return undefined as unknown as SchemaType;
            }
            throw new Error('Raw "any" type is not supported');
        default:
            throw new Error(`Unsupported type ${t.kind} of type ${t}`);
    }
};

interface SchemaType {
    type:
        | 'string'
        | 'number'
        | 'boolean'
        | 'array'
        | 'object'
        | 'null'
        | 'file'
        | 'union'
        | 'dataStream'
        | 'fileStream'
        | 'void'
        | 'tuple';
    format?: string;
    items?: SchemaType;
    elements?: SchemaType[];
    required?: string[];
    oneOf?: SchemaType[];
    properties?: Record<string, SchemaType>;
}

export type { SchemaType };

const extractParameterSchema = (
    target: object,
    propertyKey: string | symbol,
    parameterIndex: number,
): [schema: SchemaType, required: boolean] => {
    // @ts-expect-error - accessing constructor from prototype
    const reflection = ReflectionClass.from(target.constructor);
    const methodReflection = reflection.getMethod(propertyKey);

    if (!methodReflection) {
        throw new Error(
            `Method ${String(propertyKey)} not found in reflection`,
        );
    }

    const parameters = methodReflection.parameters;
    if (!parameters || parameters.length <= parameterIndex) {
        throw new Error(
            `Parameter at index ${parameterIndex} not found in method ${String(propertyKey)}`,
        );
    }

    const parameter = parameters[parameterIndex];
    if (!parameter || !parameter.type) {
        throw new Error(
            `Type information not found for parameter at index ${parameterIndex} in method ${String(propertyKey)}`,
        );
    }

    return [reflectionTypeToSchema(parameter.type), !parameter.isOptional()];
};

export {
    extractMethodReturnSchema,
    reflectionToSchema,
    reflectionTypeToSchema,
    extractParameterSchema,
};

export * from './files';
export * from './stream';
export * from './middleware';
