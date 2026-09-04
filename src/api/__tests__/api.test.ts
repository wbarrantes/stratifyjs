import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { validateLayers } from '../api.js';
import { StratifyError } from '../../core/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', '..', '__tests__', 'fixtures');
const MONOREPO_DIR = resolve(FIXTURES_DIR, 'sample-monorepo');
const CONFIGS_DIR = resolve(FIXTURES_DIR, 'configs');

describe('validateLayers', () => {
    it('runs the full pipeline and finds the expected violation', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            configPath: resolve(CONFIGS_DIR, 'valid-config.json'),
        });

        expect(result.totalPackages).toBe(4);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('invalid-dependency');
        expect(result.violations[0].package).toBe('@sample/bad-pkg');
        expect(result.violations[0].details?.toLayer).toBe('infra');
        expect(result.violations[0].details?.fromLayer).toBe('ui');
        expect(result.duration).toBeGreaterThan(0);
    });

    it('populates detailedMessage on each violation', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            configPath: resolve(CONFIGS_DIR, 'valid-config.json'),
        });

        for (const v of result.violations) {
            expect(v.detailedMessage).toBeDefined();
            expect(v.detailedMessage.length).toBeGreaterThan(v.message.length);
        }
    });

    it('works with a pre-built config (skips file loading, applies defaults)', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
            },
        });

        expect(result.totalPackages).toBe(4);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].package).toBe('@sample/bad-pkg');
    });

    it('applies defaults for omitted workspaces fields when config is provided programmatically', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
            },
        });

        // protocols and ignore should have gotten defaults
        expect(result.totalPackages).toBe(4);
        expect(result.violations).toHaveLength(1);
    });

    it('returns zero violations when all dependencies are allowed via wildcard', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['*'] },
                    core: { allowedDependencies: ['*'] },
                    infra: { allowedDependencies: [] },
                },
                enforcement: { mode: 'error' },
                workspaces: {
                    patterns: ['packages/*'],
                    protocols: ['workspace:'],
                    ignore: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
                },
            },
        });

        expect(result.violations).toHaveLength(0);
    });

    it('throws StratifyError when config file does not exist', async () => {
        await expect(
            validateLayers({
                workspaceRoot: MONOREPO_DIR,
                configPath: 'nonexistent.json',
            })
        ).rejects.toThrow(StratifyError);

        try {
            await validateLayers({
                workspaceRoot: MONOREPO_DIR,
                configPath: 'nonexistent.json',
            });
        } catch (e) {
            expect(e).toBeInstanceOf(StratifyError);
            expect((e as StratifyError).type).toBe('config-not-found');
        }
    });

    it('returns duration as a positive number', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                enforcement: { mode: 'warn' },
                workspaces: {
                    patterns: ['packages/*'],
                    protocols: ['workspace:'],
                    ignore: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
                },
            },
        });

        expect(result.duration).toBeGreaterThan(0);
    });

    it('short-circuits with zero violations and zero packages when config mode is off', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                enforcement: { mode: 'off' },
                workspaces: {
                    patterns: ['packages/*'],
                    protocols: ['workspace:'],
                    ignore: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
                },
            },
        });

        expect(result.violations).toHaveLength(0);
        expect(result.totalPackages).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('short-circuits when options.mode overrides to off', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            configPath: resolve(CONFIGS_DIR, 'valid-config.json'), // config has mode: 'error'
            mode: 'off',
        });

        expect(result.violations).toHaveLength(0);
        expect(result.totalPackages).toBe(0);
    });

    it('still validates and reports configured exceptions when mode is off', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            mode: 'off',
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
                dependencyExceptions: [
                    {
                        fromPackage: '@sample/bad-pkg',
                        toPackage: '@sample/infra',
                        owner: 'platform',
                        reason: 'Temporary migration bridge',
                    },
                ],
            },
        });

        expect(result.totalPackages).toBe(4);
        expect(result.violations).toEqual([]);
        expect(result.acceptedExceptions).toHaveLength(1);
    });

    it('rejects stale configured exceptions when mode is off', async () => {
        await expect(
            validateLayers({
                workspaceRoot: MONOREPO_DIR,
                mode: 'off',
                config: {
                    layers: {
                        ui: { allowedDependencies: ['core'] },
                        core: { allowedDependencies: ['infra'] },
                        infra: { allowedDependencies: [] },
                    },
                    workspaces: { patterns: ['packages/*'] },
                    dependencyExceptions: [
                        {
                            fromPackage: '@sample/infra',
                            toPackage: '@sample/app-ui',
                            owner: 'platform',
                            reason: 'Stale edge',
                        },
                    ],
                },
            })
        ).rejects.toMatchObject({
            type: 'config-validation-error',
            details: [expect.stringContaining('stale')],
        });
    });

    it('options.mode overrides config enforcement mode', async () => {
        // Config has mode: 'error' but we override to 'warn' — same violations, just different mode.
        // This test verifies the override mechanism itself works (the pipeline still runs).
        const resultWithOverride = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                enforcement: { mode: 'error' },
                workspaces: {
                    patterns: ['packages/*'],
                    protocols: ['workspace:'],
                    ignore: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
                },
            },
            mode: 'warn',
        });

        // The pipeline should still run and find violations
        expect(resultWithOverride.totalPackages).toBe(4);
        expect(resultWithOverride.violations).toHaveLength(1);
    });

    it('enforces an empty inline membership allowlist', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'], allowedPackages: [] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
            },
        });

        expect(result.violations.filter(v => v.type === 'unauthorized-layer-member')).toHaveLength(
            2
        );
    });

    it('enforces an empty file-backed membership allowlist', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: {
                        allowedDependencies: ['core'],
                        allowedPackagesFile: 'empty-allowed-packages.json',
                    },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
            },
        });

        expect(result.violations.filter(v => v.type === 'unauthorized-layer-member')).toHaveLength(
            2
        );
    });

    it('reports an accepted exact dependency exception', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
                dependencyExceptions: [
                    {
                        fromPackage: '@sample/bad-pkg',
                        toPackage: '@sample/infra',
                        owner: 'platform',
                        reason: 'Temporary migration bridge',
                    },
                ],
            },
        });

        expect(result.violations).toEqual([]);
        expect(result.acceptedExceptions).toHaveLength(1);
        expect(result.acceptedExceptions[0].acceptedEdges).toEqual([
            {
                fromPackage: '@sample/bad-pkg',
                fromLayer: 'ui',
                toPackage: '@sample/infra',
                toLayer: 'infra',
            },
        ]);
    });

    it('reports an accepted layer-to-package dependency exception', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            config: {
                layers: {
                    ui: { allowedDependencies: ['core'] },
                    core: { allowedDependencies: ['infra'] },
                    infra: { allowedDependencies: [] },
                },
                workspaces: { patterns: ['packages/*'] },
                dependencyExceptions: [
                    {
                        fromLayer: 'ui',
                        toPackage: '@sample/infra',
                        owner: 'architecture',
                        reason: 'Designated infrastructure capability',
                    },
                ],
            },
        });

        expect(result.violations).toEqual([]);
        expect(result.acceptedExceptions[0].exception.scope).toBe('layer');
    });

    it('rejects semantic dependency exception errors as config validation failures', async () => {
        await expect(
            validateLayers({
                workspaceRoot: MONOREPO_DIR,
                config: {
                    layers: {
                        ui: { allowedDependencies: ['core'] },
                        core: { allowedDependencies: ['infra'] },
                        infra: { allowedDependencies: [] },
                    },
                    workspaces: { patterns: ['packages/*'] },
                    dependencyExceptions: [
                        {
                            fromPackage: '@sample/app-ui',
                            toPackage: '@sample/core-lib',
                            owner: 'platform',
                            reason: 'This edge is already allowed',
                        },
                    ],
                },
            })
        ).rejects.toMatchObject({
            type: 'config-validation-error',
            details: [expect.stringContaining('unnecessary')],
        });
    });

    it('preserves legacy validation results when no exceptions are configured', async () => {
        const result = await validateLayers({
            workspaceRoot: MONOREPO_DIR,
            configPath: resolve(CONFIGS_DIR, 'valid-config.json'),
        });

        expect(
            result.violations.map(({ type, package: packageName }) => [type, packageName])
        ).toEqual([['invalid-dependency', '@sample/bad-pkg']]);
        expect(result.acceptedExceptions).toEqual([]);
    });
});
