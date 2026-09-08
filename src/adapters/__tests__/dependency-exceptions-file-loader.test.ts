import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { loadDependencyExceptions } from '../dependency-exceptions-file-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MONOREPO_DIR = resolve(__dirname, '..', '..', '__tests__', 'fixtures', 'sample-monorepo');
const layers = {
    ui: { allowedDependencies: ['core'] },
    core: { allowedDependencies: ['infra'] },
    infra: { allowedDependencies: [] },
};

describe('loadDependencyExceptions', () => {
    it('loads and validates dependency exceptions from a JSON file', async () => {
        const result = await loadDependencyExceptions(
            MONOREPO_DIR,
            'sample-dependency-exceptions.json',
            layers
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value).toEqual([
                {
                    fromPackage: '@sample/bad-pkg',
                    toPackage: '@sample/infra',
                    owner: 'platform',
                    reason: 'Temporary migration bridge',
                },
            ]);
        }
    });

    it('accepts an empty JSON array', async () => {
        const result = await loadDependencyExceptions(
            MONOREPO_DIR,
            'empty-dependency-exceptions.json',
            layers
        );

        expect(result).toEqual({ success: true, value: [] });
    });

    it('rejects a missing file', async () => {
        const result = await loadDependencyExceptions(
            MONOREPO_DIR,
            'missing-dependency-exceptions.json',
            layers
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('config-not-found');
        }
    });

    it('applies the same entry validation as inline exceptions', async () => {
        const result = await loadDependencyExceptions(
            MONOREPO_DIR,
            'invalid-dependency-exceptions.json',
            layers
        );

        expect(result.success).toBe(false);
        if (!result.success && result.error.type === 'config-validation-error') {
            expect(result.error.details).toEqual([
                'Dependency exception #1 (package "@sample/bad-pkg", layer "ui" -> package "@sample/infra") in dependency-exceptions file "invalid-dependency-exceptions.json" (array index 0) must specify exactly one of "fromPackage" or "fromLayer"',
                'Dependency exception #1 (package "@sample/bad-pkg", layer "ui" -> package "@sample/infra") in dependency-exceptions file "invalid-dependency-exceptions.json" (array index 0): "owner" must be a non-empty string',
            ]);
        }
    });
});
