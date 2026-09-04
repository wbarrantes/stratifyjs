import { parseCliOptions, toLibraryOptions } from '../options.js';

describe('parseCliOptions', () => {
    it('parses all provided options', () => {
        const result = parseCliOptions({
            config: 'my-config.json',
            root: '/workspace',
            mode: 'error',
            format: 'json',
        });

        expect(result).toEqual({
            config: 'my-config.json',
            root: '/workspace',
            mode: 'error',
            format: 'json',
        });
    });

    it('defaults config to stratify.config.json when not provided', () => {
        const result = parseCliOptions({});
        expect(result.config).toBe('stratify.config.json');
    });

    it('defaults format to console when not provided', () => {
        const result = parseCliOptions({});
        expect(result.format).toBe('console');
    });

    it('defaults mode to undefined when not provided', () => {
        // This is important: mode must be undefined (not 'warn') so the API
        // and CLI can fall back to the config file's mode instead.
        const result = parseCliOptions({});
        expect(result.mode).toBeUndefined();
    });
});

describe('toLibraryOptions', () => {
    it('returns configPath', () => {
        const result = toLibraryOptions({
            root: '/workspace',
            config: 'stratify.config.json',
            format: 'console',
        });

        expect(result).toEqual({
            workspaceRoot: '/workspace',
            configPath: 'stratify.config.json',
            mode: undefined,
        });
        expect(result).not.toHaveProperty('config');
    });

    it('passes CLI mode through', () => {
        const result = toLibraryOptions({
            root: '/workspace',
            config: 'stratify.config.json',
            mode: 'error',
            format: 'console',
        });

        expect(result.mode).toBe('error');
    });

    it('passes undefined mode when CLI mode is not set', () => {
        const result = toLibraryOptions({
            root: '/workspace',
            config: 'stratify.config.json',
            format: 'console',
        });

        expect(result.mode).toBeUndefined();
    });
});
