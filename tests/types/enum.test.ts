import { ReflectionKind, type Type } from '@deepkit/type';

import { BadRequestError } from '../../src/errors';
import { reflectionTypeToSchema } from '../../src/types';
import { schemaTypeToOpenAPISchema } from '../../src/openapi/helpers';
import { validateAndTransform } from '../../src/adapters/validation';

const literal = (value: string | number | boolean): Type => ({ kind: ReflectionKind.literal, literal: value }) as Type;
const union = (...types: Type[]): Type => ({ kind: ReflectionKind.union, types }) as Type;
const nullType = { kind: ReflectionKind.null } as Type;
const numberType = { kind: ReflectionKind.number } as Type;

describe('reflectionTypeToSchema for literal types', () => {
    it('maps string, number and boolean literals to single-value enums', () => {
        expect(reflectionTypeToSchema(literal('done'))).toEqual({ type: 'string', enum: ['done'] });
        expect(reflectionTypeToSchema(literal(2))).toEqual({ type: 'number', enum: [2] });
        expect(reflectionTypeToSchema(literal(true))).toEqual({ type: 'boolean', enum: [true] });
    });

    it('merges a union of string literals into one enum', () => {
        expect(reflectionTypeToSchema(union(literal('free'), literal('pro'), literal('max')))).toEqual({
            type: 'string',
            enum: ['free', 'pro', 'max'],
        });
    });

    it('keeps null beside the merged enum', () => {
        expect(reflectionTypeToSchema(union(literal('a'), literal('b'), nullType))).toEqual({
            type: 'union',
            oneOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }],
        });
    });

    it('leaves unions that are not literals of one type as oneOf', () => {
        expect(reflectionTypeToSchema(union(literal('a'), numberType))).toEqual({
            type: 'union',
            oneOf: [{ type: 'string', enum: ['a'] }, { type: 'number' }],
        });
    });
});

describe('schemaTypeToOpenAPISchema for enums', () => {
    it('emits the enum values', () => {
        expect(schemaTypeToOpenAPISchema({ type: 'string', enum: ['a', 'b'] }, {})).toEqual({
            type: 'string',
            enum: ['a', 'b'],
        });
    });

    it('marks a nullable enum as nullable', () => {
        const schema = reflectionTypeToSchema(union(literal('a'), literal('b'), nullType));
        expect(schemaTypeToOpenAPISchema(schema, {})).toEqual({ type: 'string', enum: ['a', 'b'], nullable: true });
    });
});

describe('validateAndTransform for enums', () => {
    it('accepts a listed value', () => {
        expect(validateAndTransform('pro', { type: 'string', enum: ['free', 'pro'] }, 'body')).toBe('pro');
    });

    it('rejects a value outside the enum', () => {
        expect(() => validateAndTransform('gold', { type: 'string', enum: ['free', 'pro'] }, 'body')).toThrow(
            BadRequestError,
        );
    });
});
