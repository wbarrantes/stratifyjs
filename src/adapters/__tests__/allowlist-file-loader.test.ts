import { validateAllowlistContent } from '../allowlist-file-loader.js';

describe('validateAllowlistContent', () => {
    it('should return a Set from a valid string array', () => {
        const result = validateAllowlistContent(
            ['@app/auth', '@app/cart', '@app/checkout'],
            'test.json'
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value).toEqual(new Set(['@app/auth', '@app/cart', '@app/checkout']));
        }
    });

    it('should reject non-array input', () => {
        const result = validateAllowlistContent({ not: 'an array' }, 'test.json');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('must contain a JSON array');
        }
    });

    it('should accept an empty array as a restrict-all allowlist', () => {
        const result = validateAllowlistContent([], 'test.json');
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value).toEqual(new Set());
        }
    });

    it('should reject arrays with non-string elements', () => {
        const result = validateAllowlistContent(['@app/auth', 123, true], 'test.json');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('must contain only strings');
        }
    });

    it('should reject a plain string', () => {
        const result = validateAllowlistContent('@app/auth', 'test.json');
        expect(result.success).toBe(false);
    });

    it('should reject null', () => {
        const result = validateAllowlistContent(null, 'test.json');
        expect(result.success).toBe(false);
    });

    it('should deduplicate entries via Set', () => {
        const result = validateAllowlistContent(
            ['@app/auth', '@app/auth', '@app/cart'],
            'test.json'
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.size).toBe(2);
        }
    });
});
