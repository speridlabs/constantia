import { validateAndTransform } from '../../src/adapters/validation';
import { BadRequestError } from '../../src/errors';

// Express hands over req.query already URL-decoded, so values must be taken as they are
// and converted only according to the declared schema type.
describe('validateAndTransform for query parameters', () => {
    it('keeps string parameters verbatim, including numeric-looking and boolean-looking values', () => {
        expect(validateAndTransform('2024', { type: 'string' }, 'query')).toBe('2024');
        expect(validateAndTransform('true', { type: 'string' }, 'query')).toBe('true');
        expect(validateAndTransform('snake_case', { type: 'string' }, 'query')).toBe('snake_case');
    });

    it('does not decode the value a second time', () => {
        expect(validateAndTransform('50%', { type: 'string' }, 'query')).toBe('50%');
        expect(validateAndTransform('a%2Fb', { type: 'string' }, 'query')).toBe('a%2Fb');
        expect(validateAndTransform('100% sure', { type: 'string' }, 'query')).toBe('100% sure');
    });

    it('still converts strings for number and boolean parameters', () => {
        expect(validateAndTransform('42', { type: 'number' }, 'query')).toBe(42);
        expect(validateAndTransform('-1.5', { type: 'number' }, 'query')).toBe(-1.5);
        expect(validateAndTransform('true', { type: 'boolean' }, 'query')).toBe(true);
        expect(validateAndTransform('FALSE', { type: 'boolean' }, 'query')).toBe(false);
    });

    it('rejects values that do not fit the declared type', () => {
        expect(() => validateAndTransform('abc', { type: 'number' }, 'query')).toThrow(BadRequestError);
        expect(() => validateAndTransform('yes', { type: 'boolean' }, 'query')).toThrow(BadRequestError);
    });
});
